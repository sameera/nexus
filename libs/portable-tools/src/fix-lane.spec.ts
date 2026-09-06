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
