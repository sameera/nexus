/**
 * `nexus concept-invariants` — the invariant lister analyze uses (epic #896, story #900, D10).
 * It reads the epic's listed pages as they stood at the change's base, never at its head, lists each
 * live numbered invariant and marks those a declared change covers.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractInvariants, listConceptInvariants, runConceptInvariants, type InvariantReport } from "./concept-invariants";

const PAGE = [
    "---",
    'title: "Distiller"',
    "status: active",
    "---",
    "",
    "# Distiller",
    "",
    "## Key Invariants",
    "",
    "1. The distiller writes the store.",
    "2. ~~An old rule that was dropped.~~",
    "3. ~~Old wording.~~ The new wording of the rule, which wraps",
    "   onto a second line.",
    "",
    "## Integration Points",
    "",
    "- [other](other.md) — x",
    "",
].join("\n");

describe("extractInvariants", () => {
    it("lists numbered invariants, skips a wholly struck one and joins wrapped lines", () => {
        expect(extractInvariants(PAGE)).toEqual([
            { number: 1, text: "The distiller writes the store." },
            { number: 3, text: "The new wording of the rule, which wraps onto a second line." },
        ]);
    });

    it("returns nothing for a page with no Key Invariants section", () => {
        expect(extractInvariants("# P\n\n## Summary\n\n1. not an invariant\n")).toEqual([]);
    });
});

describe("listConceptInvariants", () => {
    const pages: Record<string, string | undefined> = { distiller: PAGE, gone: undefined };

    it("marks an invariant covered when a declared change quotes it, and leaves the others to be judged", () => {
        const report: InvariantReport = listConceptInvariants(["distiller"], (n) => pages[n], [{ page: "distiller", old: "The distiller writes   the store." }]);
        expect(report.invariants).toEqual([
            { page: "distiller", number: 1, text: "The distiller writes the store.", covered: true },
            { page: "distiller", number: 3, text: "The new wording of the rule, which wraps onto a second line.", covered: false },
        ]);
        expect(report.sentence).toMatch(/2 concept invariants/);
        expect(report.sentence).toMatch(/1 covered/);
    });

    it("covers nothing when there is no record", () => {
        expect(listConceptInvariants(["distiller"], (n) => pages[n], []).invariants.every((i) => !i.covered)).toBe(true);
    });

    it("names a listed page it cannot find and checks the rest", () => {
        const report: InvariantReport = listConceptInvariants(["gone", "distiller"], (n) => pages[n], []);
        expect(report.missing).toEqual(["gone"]);
        expect(report.invariants).toHaveLength(2);
        expect(report.sentence).toMatch(/gone/);
    });

    it("states that none were checked because the epic lists no pages", () => {
        const report: InvariantReport = listConceptInvariants([], () => undefined, []);
        expect(report.invariants).toEqual([]);
        expect(report.sentence).toMatch(/none were checked/i);
        expect(report.sentence).toMatch(/lists no concept pages/i);
    });
});

describe("runConceptInvariants", () => {
    let dir = "";
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    function git(...args: string[]): string {
        return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    }

    function repo(): string {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "concept-inv-"));
        git("init", "-q", "-b", "main");
        git("config", "user.email", "t@t");
        git("config", "user.name", "t");
        fs.mkdirSync(path.join(dir, ".nexus", "concepts"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".nexus", "concepts", "distiller.md"), PAGE);
        fs.writeFileSync(path.join(dir, "epic.md"), '---\nconcepts: ["distiller", "gone"]\n---\n# Epic\n');
        git("add", "-A");
        git("commit", "-q", "-m", "base");
        const base: string = git("rev-parse", "HEAD").trim();
        // The change under review rewrites the invariant it would break.
        fs.writeFileSync(path.join(dir, ".nexus", "concepts", "distiller.md"), PAGE.replace("The distiller writes the store.", "Anything goes."));
        git("commit", "-q", "-am", "head");
        return base;
    }

    function run(argv: string[]): { code: number; out: string; err: string } {
        const out: string[] = [];
        const err: string[] = [];
        const code: number = runConceptInvariants(argv, { cwd: dir, stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
        return { code, out: out.join("\n"), err: err.join("\n") };
    }

    it("reads the pages as they stood at the base, so the change cannot rewrite what it is checked against", () => {
        const base: string = repo();
        const result = run(["--epic", "epic.md", "--base", base]);
        expect(result.code).toBe(0);
        const report = JSON.parse(result.out) as InvariantReport;
        expect(report.invariants[0].text).toBe("The distiller writes the store.");
        expect(report.missing).toEqual(["gone"]);
    });

    it("marks a covered invariant from the record's declared changes", () => {
        const base: string = repo();
        fs.writeFileSync(
            path.join(dir, "record.md"),
            '## Guarantees\n\n- G1. A. (D1)\n\n## Concept-store changes\n\nThis record read the concept page distiller.\n\n- distiller page: "The distiller writes the store." becomes "It writes more." (D1)\n',
        );
        const report = JSON.parse(run(["--epic", "epic.md", "--base", base, "--record", "record.md"]).out) as InvariantReport;
        expect(report.invariants[0].covered).toBe(true);
        expect(report.invariants[1].covered).toBe(false);
    });

    it("stops and prints nothing when the store cannot be read while the list is not empty", () => {
        repo();
        const result = run(["--epic", "epic.md", "--base", "0000000000000000000000000000000000000000"]);
        expect(result.code).toBe(1);
        expect(result.out).toBe("");
        expect(result.err).toMatch(/cannot be read/);
    });

    it("reports an empty list without needing a readable base", () => {
        repo();
        fs.writeFileSync(path.join(dir, "epic2.md"), "---\nconcepts: []\n---\n");
        const result = run(["--epic", "epic2.md", "--base", "0000000000000000000000000000000000000000"]);
        expect(result.code).toBe(0);
        expect((JSON.parse(result.out) as InvariantReport).sentence).toMatch(/none were checked/i);
    });
});
