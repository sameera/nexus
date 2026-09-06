/**
 * The lightweight fix lane (epic #263). The lane's mechanism is a command definition, so what a
 * spec can hold it to is the rules its body actually states — the refusals it makes, the helpers
 * it reaches for, and the shape of the entry it writes. Each assertion pins a rule the epic's
 * acceptance criteria name; none of them re-tests the tooling those rules invoke, which has its
 * own specs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const SRC_DIR: string = __dirname;

function body(name: string): string {
    return fs.readFileSync(path.join(authoredComponentRoot(SRC_DIR), "commands", name), "utf8");
}

const FIX: string = body("nxs.fix.md");

describe("/nxs.fix resolves a reference before it writes (story #266)", () => {
    it("accepts the three provenance reference forms and says what each resolves against", () => {
        expect(FIX).toContain("acme/web-app#123");
        expect(FIX).toMatch(/bare number/);
        expect(FIX).toMatch(/the home repository/);
        expect(FIX).toMatch(/the named repository/);
    });

    it("determines whether the number is an issue or a pull request", () => {
        expect(FIX).toContain("gh pr view");
        expect(FIX).toContain("gh issue view");
    });

    it("refuses an epic and names /nxs.epic as the lane to use", () => {
        expect(FIX).toContain("nexus config resolve epic-label");
        expect(FIX).toMatch(/is an epic[\s\S]{0,400}\/nxs\.epic/);
    });

    it("refuses a colliding materialization directory for the same number", () => {
        expect(FIX).toMatch(/`\.nexus\/tmp\/epic-<n>\/` already exists/);
    });

    it("refuses a member repository and names the qualified form to run from the hub", () => {
        expect(FIX).toContain("nexus close-migration preflight");
        expect(FIX).toMatch(/member repository[\s\S]{0,600}\/nxs\.fix <owner>\/<repo>#<n>/);
    });

    it("takes the range from the worktree-free helper read, never a second derivation", () => {
        expect(FIX).toContain("nexus pr-worktree range --pr <n>");
        expect(FIX).not.toContain("pr-worktree open");
    });

    it("refuses a pull request that has not been merged", () => {
        expect(FIX).toMatch(/closed\s*\n?\s*without merging is a \*\*hard block\*\*|without merging, is a \*\*hard block\*\*/);
    });

    it("uses an explicit --range verbatim and does not prompt for one", () => {
        expect(FIX).toMatch(/--range <base>\.\.<head>` was given[\s\S]{0,200}verbatim/);
    });

    it("asks for the range rather than guessing a default when it cannot resolve one", () => {
        expect(FIX).toMatch(/Never fall back to a guessed default/);
        expect(FIX).toContain("HEAD~1");
    });

    it("records full commit SHAs, never a branch name and never a symbolic HEAD", () => {
        expect(FIX).toContain("git rev-parse --verify <ref>^{commit}");
        expect(FIX).toMatch(/branch name and a symbolic `HEAD` are never recorded/);
    });

    it("verifies the range head reached the trunk before anything is written", () => {
        expect(FIX).toContain("git merge-base --is-ancestor <head>");
        expect(FIX).toMatch(/not-landed\s*\n?\s*→ stop and write nothing/);
    });

    it("keeps the provenance the developer named rather than substituting the other artifact", () => {
        expect(FIX).toMatch(/pull request is never substituted for\s*\n?the issue it closes/);
    });
});

describe("/nxs.fix creates the entry from a resolved range (story #267)", () => {
    it("creates exactly two files under the ephemeral fix directory and reports both", () => {
        expect(FIX).toContain(".nexus/tmp/fix-<n>/epic.md");
        expect(FIX).toContain(".nexus/tmp/fix-<n>/close-record.md");
        expect(FIX).toMatch(/exactly two files/);
        expect(FIX).toContain("Run /nxs.distill to drain it");
    });

    it("creates nothing on GitHub and commits nothing", () => {
        expect(FIX).toMatch(/no issue, no comment, no branch, no pull request, no commit/);
    });

    it("gives epic.md a title, a canonical link, a fix slug and the entry kind, and no body", () => {
        expect(FIX).toMatch(/slug: fix-<n>/);
        expect(FIX).toContain("entry_kind: fix");
        expect(FIX).toMatch(/frontmatter only, \*\*no body\*\*/);
    });

    it("omits the feature key rather than guessing a value", () => {
        expect(FIX).toMatch(/omit this key entirely when they left it empty/);
        expect(FIX).toMatch(/Omit `feature` rather than writing a guessed value/);
    });

    it("gives close-record.md a literal analyze value, one range entry and the two prose sections", () => {
        expect(FIX).toContain("analyze: n/a — fix entry (no acceptance criteria)");
        expect(FIX).toMatch(/## Key Decisions/);
        expect(FIX).toMatch(/A fix entry has no decision record to deviate from/);
        expect(FIX).toMatch(/range:\s*\n\s*- repo:/);
    });

    it("gives close-record.md no record keys, no deferred scope and no process lesson", () => {
        expect(FIX).toMatch(/no `record` key and no `record_hash` key/);
        expect(FIX).toMatch(/no `## Deferred Scope` and no\s*\n?`?## Process Lesson`? section/);
    });

    it("asks for exactly two things, the reason required and the feature optional", () => {
        expect(FIX).toMatch(/exactly \*\*two\*\* things/);
        expect(FIX).toMatch(/Why the change mattered\*\* — \*\*required/);
        expect(FIX).toMatch(/feature the fix belongs to\*\* — \*\*optional/);
    });

    it("derives the description of the change from the diff instead of asking for it", () => {
        expect(FIX).toContain("git diff <base>..<head>");
        expect(FIX).toMatch(/Do not ask the developer to describe the change/);
    });

    it("warns about behaviours with no existing page but still writes the entry, failing soft", () => {
        expect(FIX).toMatch(/naming how many/);
        expect(FIX).toMatch(/write the entry anyway/i);
        expect(FIX).toMatch(/best-effort and fails soft/);
    });

    it("presents no approval checkpoint and writes no analyze receipt", () => {
        expect(FIX).toMatch(/no approval checkpoint/i);
        expect(FIX).toMatch(/Write \*\*no\*\*\s*\n?`analyze-receipt\.md`/);
    });

    it("qualifies a bare reference from a hub from the recorded range, keeping the number", () => {
        expect(FIX).toMatch(/hub, bare reference given\*\* → write `<owner>\/<repo>#<n>`/);
        expect(FIX).toMatch(/the number the developer gave, unchanged/);
    });
});
