/**
 * The release changelog and the release identity (story #312). The changelog is the only surface
 * that can report a change in what a stage decides once the components stop appearing in an
 * adopter's own diff, so these tests check what an entry says — and check the live entry, not
 * only a fixture.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
    checkReleaseEntry,
    checkReleaseIdentity,
    NO_BEHAVIOUR_CHANGE,
    parseChangelog,
    PIPELINE_STAGES,
    type ReleaseEntry,
} from "./release-notes";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const CHANGELOG_PATH: string = path.join(REPO_ROOT, "CHANGELOG.md");
const PROCEDURE_PATH: string = path.join(REPO_ROOT, "docs", "delivery", "release-procedure.md");

const declaredVersion: string = fs.readFileSync(path.join(REPO_ROOT, "VERSION"), "utf8").trim();
const manifestVersion: string = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).version;
const entries: ReleaseEntry[] = parseChangelog(fs.readFileSync(CHANGELOG_PATH, "utf8"));

const changed = { touchedComponentBody: true, changedStageBehaviour: true, breakingChange: false };

describe("one tag, one registry version, one releases-page entry (AC1)", () => {
    it("the manifest, the changelog and a tag all name what VERSION declares", () => {
        expect(
            checkReleaseIdentity({
                declared: declaredVersion,
                manifest: manifestVersion,
                changelog: entries[0].version,
                tag: `v${declaredVersion}`,
            }),
        ).toEqual([]);
    });

    it("names each half of a disagreement", () => {
        const findings: string[] = checkReleaseIdentity({
            declared: "0.2.0",
            manifest: "0.1.0",
            changelog: "0.2.0",
            tag: "v0.3.0",
        });
        expect(findings.join("\n")).toContain("the published manifest names 0.1.0");
        expect(findings.join("\n")).toContain("the git tag names 0.3.0");
    });
});

describe("the written procedure is followable end to end (AC2)", () => {
    it("covers every step from choosing the version to publishing the releases-page entry", () => {
        const procedure: string = fs.readFileSync(PROCEDURE_PATH, "utf8");
        for (const step of ["VERSION", "CHANGELOG.md", "nexus:pin-bundles", "git tag", "npm publish", "npm install -g"]) {
            expect(procedure, step).toContain(step);
        }
        // A reader who has to guess the stage vocabulary has to ask a question.
        for (const stage of PIPELINE_STAGES) {
            expect(procedure, stage).toContain(stage);
        }
    });
});

describe("an entry speaks adopter language (AC3, AC4)", () => {
    it("the live entry passes every rule", () => {
        expect(checkReleaseEntry(entries[0], changed)).toEqual([]);
    });

    it("the live entry names a stage a lead runs", () => {
        const namesAStage = (item: string): boolean =>
            PIPELINE_STAGES.some((stage) => new RegExp(`\\b${stage}\\b`, "i").test(item));
        expect(entries[0].items.some(namesAStage)).toBe(true);
    });

    it("rejects a commit subject", () => {
        const findings: string[] = checkReleaseEntry({ version: "1.0.0", items: ["fix: stamp the version"] }, changed);
        expect(findings.join("\n")).toContain("is a commit subject");
    });

    it("rejects a file path", () => {
        const findings: string[] = checkReleaseEntry(
            { version: "1.0.0", items: ["Rewrote libs/portable-tools/src/parity.ts for the close stage"] },
            changed,
        );
        expect(findings.join("\n")).toContain("names a file path");
    });

    it("rejects a library version", () => {
        const findings: string[] = checkReleaseEntry(
            { version: "1.0.0", items: ["Bumped esbuild to 0.28.1 for the distill stage"] },
            changed,
        );
        expect(findings.join("\n")).toContain("names a library version");
    });

    it("requires an item naming the stage when a component body changed", () => {
        const findings: string[] = checkReleaseEntry(
            { version: "1.0.0", items: ["Some wording was improved."] },
            changed,
        );
        expect(findings.join("\n")).toContain("must name the stage");
    });

    it("accepts an item that names the stage and what a lead will experience", () => {
        expect(
            checkReleaseEntry(
                { version: "1.0.0", items: ["The close stage now refuses an epic whose record is unapproved."] },
                changed,
            ),
        ).toEqual([]);
    });
});

describe("a release that changed no stage behaviour says so (AC5)", () => {
    it("requires the explicit statement rather than an absent entry", () => {
        const findings: string[] = checkReleaseEntry(
            { version: "1.0.1", items: ["Nothing much."] },
            { touchedComponentBody: false, changedStageBehaviour: false, breakingChange: false },
        );
        expect(findings.join("\n")).toContain("must say so explicitly");
    });

    it("accepts the explicit statement", () => {
        expect(
            checkReleaseEntry(
                { version: "1.0.1", items: [NO_BEHAVIOUR_CHANGE] },
                { touchedComponentBody: false, changedStageBehaviour: false, breakingChange: false },
            ),
        ).toEqual([]);
    });

    it("an entry with no items is a finding, never silence", () => {
        expect(checkReleaseEntry({ version: "1.0.1", items: [] }, changed).join("\n")).toContain("has no items");
    });
});

describe("below 1.0 a breaking change is said in words (invariant 16)", () => {
    const broke = { touchedComponentBody: true, changedStageBehaviour: true, breakingChange: true };

    it("requires the word, because the version number does not carry the signal", () => {
        const findings: string[] = checkReleaseEntry(
            { version: "0.2.0", items: ["The close stage now refuses an epic whose record is unapproved."] },
            broke,
        );
        expect(findings.join("\n")).toContain("breaking");
    });

    it("accepts an entry that says so", () => {
        expect(
            checkReleaseEntry(
                {
                    version: "0.2.0",
                    items: [
                        "Breaking: the close stage now refuses an epic whose record is unapproved, so a " +
                            "pipeline that closed one before must approve the record first.",
                    ],
                },
                broke,
            ),
        ).toEqual([]);
    });

    it("says nothing about a release that broke nothing", () => {
        expect(
            checkReleaseEntry(
                { version: "0.2.0", items: ["The close stage now names the record it checked against."] },
                changed,
            ),
        ).toEqual([]);
    });

    it("leaves the wording to the version number once 1.0 is out, where the number carries it", () => {
        expect(
            checkReleaseEntry(
                { version: "2.0.0", items: ["The close stage now refuses an epic whose record is unapproved."] },
                broke,
            ),
        ).toEqual([]);
    });
});

describe("the procedure records what the suite does not check (record #334, ADDRESS risks)", () => {
    const procedure: string = fs.readFileSync(PROCEDURE_PATH, "utf8");

    it("states that the entry's coverage is the author's judgement, not the suite's", () => {
        expect(procedure).toContain("coverage");
        expect(procedure).toMatch(/the suite checks[^.]*language/i);
    });

    it("hands the author the diff that shows which component bodies this release moved", () => {
        expect(procedure).toContain("git diff --name-only");
    });

    it("states the breaking-change rule a pre-1.0 entry has to follow", () => {
        expect(procedure.toLowerCase()).toContain("breaking");
    });

    // Story #399: the release declares one runtime, so the prerequisite the procedure records is
    // the Node floor — and it must not claim an interpreter floor the manifest no longer declares.
    it("records that the declared Node floor is the whole of the prerequisite answer", () => {
        expect(procedure).toMatch(/node floor/i);
        expect(procedure).not.toMatch(/python|interpreter floor/i);
    });
});

describe("the release is one tagged artifact (AC1)", () => {
    it("the changelog's newest entry is the version a tag would name", () => {
        const tags: string = execFileSync("git", ["tag", "--list", `v${declaredVersion}`], {
            cwd: REPO_ROOT,
            encoding: "utf8",
        }).trim();
        // The tag is cut after this lands, so it may not exist yet; what must hold now is that
        // when it is cut it can only name the one version every other surface already names.
        expect(tags === "" || tags === `v${declaredVersion}`).toBe(true);
        expect(entries[0].version).toBe(declaredVersion);
        expect(manifestVersion).toBe(declaredVersion);
    });
});
