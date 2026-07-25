import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { type EvidenceRecord, readEvidence, renderEvidence, writeEvidence } from "./evidence.js";
import { makeTempDir } from "./harness-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

function record(over: Partial<EvidenceRecord> = {}): EvidenceRecord {
    return {
        stage: "range:squash",
        observedAt: "2026-07-25",
        toolchainCommit: "a".repeat(40),
        scratchRepo: "sameera/nexus-pr-acceptance-scratch",
        verdict: "pass",
        detail: { base: "b".repeat(40), head: "c".repeat(40), fileSetsEqual: true },
        diagnostics: [],
        ...over,
    };
}

describe("writeEvidence", () => {
    it("records an outcome pinned to a commit and a date", () => {
        const dir = makeTempDir(tracked);
        const r = writeEvidence(dir, record());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(fs.existsSync(r.value)).toBe(true);
        expect(path.basename(r.value)).toContain("2026-07-25");
    });

    it("refuses an outcome with no observation date — it would not be evidence", () => {
        const dir = makeTempDir(tracked);
        const r = writeEvidence(dir, record({ observedAt: "" }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("date");
    });

    it("refuses an outcome that names no toolchain commit — it could never be re-checked", () => {
        const dir = makeTempDir(tracked);
        const r = writeEvidence(dir, record({ toolchainCommit: "  " }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("commit");
    });

    it("keeps one file per stage, so a run's stages do not overwrite each other", () => {
        const dir = makeTempDir(tracked);
        writeEvidence(dir, record({ stage: "range:squash" }));
        writeEvidence(dir, record({ stage: "range:rebase" }));
        expect(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length).toBe(2);
    });
});

describe("readEvidence", () => {
    it("returns nothing for a directory that was never written to", () => {
        expect(readEvidence(path.join(makeTempDir(tracked), "missing"))).toEqual([]);
    });

    it("drops entries missing their pins rather than counting them toward the record", () => {
        const dir = makeTempDir(tracked);
        writeEvidence(dir, record({ stage: "good" }));
        fs.writeFileSync(path.join(dir, "2026-07-25-unpinned.json"), JSON.stringify({ stage: "bad", observedAt: "2026-07-25" }));
        fs.writeFileSync(path.join(dir, "2026-07-25-corrupt.json"), "{not json");
        const all = readEvidence(dir);
        expect(all.map((r) => r.stage)).toEqual(["good"]);
    });
});

describe("renderEvidence", () => {
    it("says so explicitly when there is nothing recorded", () => {
        expect(renderEvidence([])).toContain("No evidence");
    });

    it("pins the run to its commit, repo, and date", () => {
        const md = renderEvidence([record()]);
        expect(md).toContain("a".repeat(40));
        expect(md).toContain("sameera/nexus-pr-acceptance-scratch");
        expect(md).toContain("2026-07-25");
    });

    it("states a verdict per stage", () => {
        const md = renderEvidence([
            record({ stage: "range:squash", verdict: "pass" }),
            record({ stage: "range:rebase", verdict: "fail" }),
            record({ stage: "review-publish", verdict: "not-exercised" }),
        ]);
        expect(md).toContain("range:squash");
        expect(md).toContain("PASS");
        expect(md).toContain("FAIL");
        expect(md).toContain("NOT EXERCISED");
    });

    it("carries observed identifiers and diagnostic text verbatim", () => {
        const md = renderEvidence([
            record({
                detail: { base: "b".repeat(40), derivedFiles: ["docs/a.md", "docs/b.md"] },
                diagnostics: ["pr-worktree range-ambiguous: PR #13 landed as 1 commit-parent"],
            }),
        ]);
        expect(md).toContain("b".repeat(40));
        expect(md).toContain("docs/a.md, docs/b.md");
        expect(md).toContain("pr-worktree range-ambiguous: PR #13 landed as 1 commit-parent");
    });

    it("renders an empty observation list readably rather than as blank", () => {
        const md = renderEvidence([record({ detail: { derivedFiles: [] } })]);
        expect(md).toContain("(none)");
    });
});
