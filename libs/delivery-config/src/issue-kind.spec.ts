/**
 * The kind rule (decision record #786, R1) — what an issue is filed as, read from the marker the
 * repository declares, by the one copy the epic resolver and the batch filer both call.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
    classifyIssueKind,
    initiativeNeedsIssueType,
    isDeclaredInitiative,
    readKindMarkers,
    resolveKindClassification,
    resolveRecordClassification,
} from "./issue-kind.js";

/** A checkout declaring `settings` — the only thing the resolver reads. */
function repoWith(settings: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "classify-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

describe("resolveRecordClassification — the one shared publishing resolver, called in process", () => {
    it("takes the mode and the record names from the resolver, reading no config itself", () => {
        const r = resolveRecordClassification(
            repoWith("github:\n  classification: labels\n  record-label: decision-record\n  record-type: Decision Record\n"),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification).toEqual({
            mode: "labels",
            recordLabel: "decision-record",
            recordType: "Decision Record",
        });
    });

    it("treats an unset mode as the resolver's legacy-auto default", () => {
        const r = resolveRecordClassification(repoWith("github:\n  project: none\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.mode).toBe("legacy-auto");
    });

    it("takes the record names from the resolver's built-ins when none are declared", () => {
        const r = resolveRecordClassification(repoWith("github:\n  project: none\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.recordLabel).toBe("decision-record");
        expect(r.classification.recordType).toBe("Decision Record");
    });

    it("resolves without spawning anything, from a checkout with nothing installed", () => {
        const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "classify-bare-"));
        const r = resolveRecordClassification(root);
        expect(r.ok).toBe(true);
    });
});

describe("resolveKindClassification — the epic/story markers, from the same resolver", () => {
    it("takes the epic and story names from the declared settings", () => {
        const r = resolveKindClassification(
            repoWith("github:\n  classification: labels\n  epic-label: epic\n  story-label: story\n"),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.mode).toBe("labels");
        expect(r.classification.epicLabel).toBe("epic");
        expect(r.classification.storyLabel).toBe("story");
    });

    it("falls back to the resolver's built-in epic and story labels", () => {
        const r = resolveKindClassification(repoWith("github:\n  project: none\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.epicLabel).toBe("epic");
        expect(r.classification.storyLabel).toBe("story");
    });

    it("refuses type-based classification when the repo declares no epic or story type", () => {
        // `epic-type` and `story-type` carry no built-in — under `types` there is nothing to
        // classify against, and guessing a name would silently mis-file every candidate.
        const r = resolveKindClassification(repoWith("github:\n  classification: types\n"));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("record-classification-unresolved");
        expect(r.error.message).toContain("epic-type");
    });

    it("carries the initiative marker: a built-in label, and no built-in issue type (record #786, D5)", () => {
        const r = resolveKindClassification(repoWith("github:\n  project: none\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.initiativeLabel).toBe("initiative");
        expect(r.classification.initiativeType).toBe("");
    });

    it("resolves under issue types with no initiative type declared, so no epic fails for lack of one", () => {
        const r = resolveKindClassification(
            repoWith("github:\n  classification: types\n  epic-type: Epic\n  story-type: Story\n"),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.initiativeType).toBe("");
    });

    it("takes a declared initiative label and issue type from the settings", () => {
        const r = resolveKindClassification(
            repoWith("github:\n  classification: labels\n  initiative-label: theme\n  initiative-type: Initiative\n"),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.initiativeLabel).toBe("theme");
        expect(r.classification.initiativeType).toBe("Initiative");
    });

    it("resolves type-based classification when both types are declared", () => {
        const r = resolveKindClassification(
            repoWith("github:\n  classification: types\n  epic-type: Epic\n  story-type: Story\n"),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.epicType).toBe("Epic");
        expect(r.classification.storyType).toBe("Story");
    });
});

describe("classifyIssueKind — what an issue is filed as, under the declared mode", () => {
    const labels = {
        mode: "labels" as const,
        epicLabel: "epic",
        epicType: "Epic",
        storyLabel: "story",
        storyType: "Story",
        recordLabel: "decision-record",
        recordType: "Decision Record",
        initiativeLabel: "initiative",
        initiativeType: "",
    };
    const types = { ...labels, mode: "types" as const };
    const legacy = { ...labels, mode: "legacy-auto" as const };

    it("names an epic, a story and a record apart under label mode", () => {
        expect(classifyIssueKind(labels, { number: 211, labels: ["epic", "in-progress"], issueType: null })).toEqual({
            ok: true,
            kind: "epic",
        });
        expect(classifyIssueKind(labels, { number: 493, labels: ["story", "pipeline"], issueType: null })).toEqual({
            ok: true,
            kind: "story",
        });
        expect(classifyIssueKind(labels, { number: 495, labels: ["decision-record"], issueType: null })).toEqual({
            ok: true,
            kind: "record",
        });
    });

    it("calls anything carrying no declared marker `other`, never a story by default", () => {
        expect(classifyIssueKind(labels, { number: 491, labels: ["roadmap"], issueType: null })).toEqual({
            ok: true,
            kind: "other",
        });
        expect(classifyIssueKind(labels, { number: 491, labels: [], issueType: null })).toEqual({
            ok: true,
            kind: "other",
        });
    });

    it("reads an issue carrying the declared initiative marker as an initiative (record #786, D5)", () => {
        // The initiative one level above an epic has a parent-of relationship to the epic, so a
        // graph-shape check alone reads it as an epic's epic. Its own marker is what names it.
        expect(classifyIssueKind(labels, { number: 491, labels: ["Initiative"], issueType: null })).toEqual({
            ok: true,
            kind: "initiative",
        });
        const typed = { ...types, initiativeType: "Initiative" };
        expect(classifyIssueKind(typed, { number: 491, labels: [], issueType: "initiative" })).toEqual({
            ok: true,
            kind: "initiative",
        });
    });

    it("recognises no initiative by a marker the repository does not declare", () => {
        expect(classifyIssueKind(types, { number: 491, labels: [], issueType: "Initiative" })).toEqual({
            ok: true,
            kind: "other",
        });
        expect(
            classifyIssueKind({ ...labels, initiativeLabel: "" }, { number: 491, labels: ["initiative"], issueType: null }),
        ).toEqual({ ok: true, kind: "other" });
    });

    it("keeps an issue marked as an epic an epic, in a repository whose epic label is `initiative`", () => {
        const shared = { ...labels, epicLabel: "initiative" };
        expect(classifyIssueKind(shared, { number: 211, labels: ["initiative"], issueType: null })).toEqual({
            ok: true,
            kind: "epic",
        });
    });

    it("raises no mode mismatch for an initiative marked the other way, which nothing treated as a kind before", () => {
        // A repository on issue types that labels its hand-filed initiatives resolved them as
        // `other` before the initiative kind existed. It still does, rather than failing.
        expect(classifyIssueKind(types, { number: 491, labels: ["initiative"], issueType: null })).toEqual({
            ok: true,
            kind: "other",
        });
    });

    it("folds case on both markers, as GitHub's label namespace does", () => {
        expect(classifyIssueKind(labels, { number: 1, labels: ["Epic"], issueType: null })).toEqual({ ok: true, kind: "epic" });
        expect(classifyIssueKind(types, { number: 1, labels: [], issueType: "EPIC" })).toEqual({ ok: true, kind: "epic" });
    });

    it("classifies by issue type under type mode", () => {
        expect(classifyIssueKind(types, { number: 211, labels: [], issueType: "Epic" })).toEqual({ ok: true, kind: "epic" });
        expect(classifyIssueKind(types, { number: 493, labels: [], issueType: "Story" })).toEqual({ ok: true, kind: "story" });
    });

    it("errors when the settings declare labels but the issue is classified by type instead", () => {
        // Not a fallback: the declared mode is the repository's own statement of how it files
        // issues. Reading the other marker anyway would let a wrong `classification:` value keep
        // working silently, and the next stage that trusts the setting would disagree with this one.
        const r = classifyIssueKind(labels, { number: 211, labels: ["pipeline"], issueType: "Epic" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("classification-mode-mismatch");
        expect(r.error.message).toContain("#211");
        expect(r.error.message).toContain("labels");
    });

    it("errors when the settings declare types but the issue is classified by label instead", () => {
        const r = classifyIssueKind(types, { number: 493, labels: ["story"], issueType: null });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("classification-mode-mismatch");
        expect(r.error.message).toContain("#493");
        expect(r.error.message).toContain("types");
    });

    it("does not error when both markers are present and agree", () => {
        expect(classifyIssueKind(labels, { number: 211, labels: ["epic"], issueType: "Epic" })).toEqual({
            ok: true,
            kind: "epic",
        });
        expect(classifyIssueKind(types, { number: 211, labels: ["epic"], issueType: "Epic" })).toEqual({
            ok: true,
            kind: "epic",
        });
    });

    it("accepts either marker under legacy-auto, which cannot be inaccurate about a mode it never declared", () => {
        expect(classifyIssueKind(legacy, { number: 211, labels: ["epic"], issueType: null })).toEqual({ ok: true, kind: "epic" });
        expect(classifyIssueKind(legacy, { number: 211, labels: [], issueType: "Epic" })).toEqual({ ok: true, kind: "epic" });
    });
});

describe("isDeclaredInitiative — the one question the filer and the resolver both ask (record #786, D8, D11)", () => {
    it("reads the initiative label under labels, and under legacy-auto", () => {
        for (const settings of ["github:\n  classification: labels\n", "github:\n  project: none\n"]) {
            const c = readKindMarkers(repoWith(settings));
            expect(isDeclaredInitiative(c, { labels: ["Initiative"], issueType: null })).toBe(true);
            expect(isDeclaredInitiative(c, { labels: ["epic"], issueType: null })).toBe(false);
            expect(isDeclaredInitiative(c, { labels: [], issueType: null })).toBe(false);
        }
    });

    it("reads the declared initiative type under types, and ignores the label there", () => {
        const c = readKindMarkers(
            repoWith("github:\n  classification: types\n  epic-type: Epic\n  story-type: Story\n  initiative-type: Initiative\n"),
        );
        expect(isDeclaredInitiative(c, { labels: [], issueType: "Initiative" })).toBe(true);
        expect(isDeclaredInitiative(c, { labels: ["initiative"], issueType: null })).toBe(false);
        expect(isDeclaredInitiative(c, { labels: [], issueType: "Epic" })).toBe(false);
    });

    it("finds no initiative, and fails nothing, where the repository declares no initiative marker", () => {
        // Under `types` with no epic, story or initiative type the full rule refuses to resolve at
        // all. This reading must not: a stage asking "is this an initiative?" gains no failure.
        const c = readKindMarkers(repoWith("github:\n  classification: types\n"));
        expect(c.initiativeType).toBe("");
        expect(isDeclaredInitiative(c, { labels: ["initiative"], issueType: "Initiative" })).toBe(false);
    });

    it("keeps an issue marked as an epic an epic, where the two markers share a name", () => {
        const c = readKindMarkers(repoWith("github:\n  classification: labels\n  epic-label: initiative\n"));
        expect(isDeclaredInitiative(c, { labels: ["initiative"], issueType: null })).toBe(false);
    });

    it("agrees with the kind rule about every issue the rule can classify", () => {
        const root: string = repoWith("github:\n  classification: labels\n");
        const full = resolveKindClassification(root);
        expect(full.ok).toBe(true);
        if (!full.ok) return;
        for (const labels of [["initiative"], ["epic"], ["story"], ["decision-record"], ["bug"], ["epic", "initiative"]]) {
            const kind = classifyIssueKind(full.classification, { number: 1, labels, issueType: null });
            expect(kind.ok && kind.kind === "initiative").toBe(
                isDeclaredInitiative(readKindMarkers(root), { labels, issueType: null }),
            );
        }
    });

    it("asks for the issue type only when a declared type could decide the answer", () => {
        expect(initiativeNeedsIssueType(readKindMarkers(repoWith("github:\n  classification: labels\n  initiative-type: Initiative\n")))).toBe(false);
        expect(initiativeNeedsIssueType(readKindMarkers(repoWith("github:\n  project: none\n")))).toBe(false);
        expect(initiativeNeedsIssueType(readKindMarkers(repoWith("github:\n  initiative-type: Initiative\n")))).toBe(true);
        expect(initiativeNeedsIssueType(readKindMarkers(repoWith("github:\n  classification: types\n  initiative-type: Initiative\n")))).toBe(true);
    });
});
