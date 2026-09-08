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
const LANDED_REFERENCE: string = fs.readFileSync(
    path.join(authoredComponentRoot(SRC_DIR), "skills", "nxs-landed-reference", "SKILL.md"),
    "utf8",
);

describe("/nxs.fix delegates reference and range resolution to the shared skill (story #266, revised by story #484)", () => {
    it("loads the nxs-landed-reference skill instead of restating its rules", () => {
        expect(FIX).toContain("nxs-landed-reference");
        expect(FIX).toMatch(/load the \*\*`nxs-landed-reference`\*\* skill/i);
        expect(FIX).toContain("Skill");
    });

    it("no longer restates the reference forms, the range order or the qualification rule itself", () => {
        expect(FIX).not.toContain("acme/web-app#123");
        expect(FIX).not.toMatch(/--range <base>\.\.<head>` was given[\s\S]{0,200}verbatim/);
    });

    it("still refuses an epic and names /nxs.epic as the lane to use (fix-specific, not shared)", () => {
        expect(FIX).toContain("nexus config resolve epic-label");
        expect(FIX).toMatch(/is an epic[\s\S]{0,400}\/nxs\.epic/);
    });

    it("still refuses a colliding materialization directory for the same number (fix-specific, not shared)", () => {
        expect(FIX).toMatch(/`\.nexus\/tmp\/epic-<n>\/` already exists/);
    });

    it("substitutes its own command name into the shared member-checkout refusal", () => {
        expect(FIX).toMatch(/substituting `\/nxs\.fix` for `<lane-command>`/);
    });

    it("keeps the provenance the developer named rather than substituting the other artifact", () => {
        expect(FIX).toMatch(/pull request is never substituted for\s*\n?the issue it closes/);
    });
});

describe("nxs-landed-reference holds the rules shared by every landed-work lane (story #484)", () => {
    it("accepts the three provenance reference forms and says what each resolves against", () => {
        expect(LANDED_REFERENCE).toContain("acme/web-app#123");
        expect(LANDED_REFERENCE).toMatch(/bare number/);
        expect(LANDED_REFERENCE).toMatch(/the home repository/);
        expect(LANDED_REFERENCE).toMatch(/the named repository/);
    });

    it("determines whether the number is an issue or a pull request", () => {
        expect(LANDED_REFERENCE).toContain("gh pr view");
        expect(LANDED_REFERENCE).toContain("gh issue view");
    });

    it("refuses a member repository before any lookup, naming the calling lane's own command", () => {
        expect(LANDED_REFERENCE).toContain("nexus close-migration preflight");
        expect(LANDED_REFERENCE).toMatch(/member repository[\s\S]{0,600}<lane-command> <owner>\/<repo>#<n>/);
    });

    it("takes the range from the worktree-free helper read, never a second derivation", () => {
        expect(LANDED_REFERENCE).toContain("nexus pr-worktree range --pr <n>");
        expect(LANDED_REFERENCE).not.toContain("pr-worktree open");
    });

    it("refuses a pull request that has not been merged", () => {
        expect(LANDED_REFERENCE).toMatch(/closed\s*\n?\s*without merging is a \*\*hard block\*\*|without merging, is a \*\*hard block\*\*/);
    });

    it("uses an explicit --range verbatim and does not prompt for one", () => {
        expect(LANDED_REFERENCE).toMatch(/--range <base>\.\.<head>` was given[\s\S]{0,200}verbatim/);
    });

    it("asks for the range rather than guessing a default when it cannot resolve one", () => {
        expect(LANDED_REFERENCE).toMatch(/Never fall back to a guessed default/);
        expect(LANDED_REFERENCE).toContain("HEAD~1");
    });

    it("records full commit SHAs, never a branch name and never a symbolic HEAD", () => {
        expect(LANDED_REFERENCE).toContain("git rev-parse --verify <ref>^{commit}");
        expect(LANDED_REFERENCE).toMatch(/branch name and a symbolic `HEAD` are never recorded/);
    });

    it("verifies the range head reached the trunk before anything is written", () => {
        expect(LANDED_REFERENCE).toContain("git merge-base --is-ancestor <head>");
        expect(LANDED_REFERENCE).toMatch(/not-landed\s*\n?\s*→ stop and write nothing/);
    });

    it("qualifies a bare reference from a hub from the recorded range, keeping the number", () => {
        expect(LANDED_REFERENCE).toMatch(/hub, bare reference given\*\* → write `<owner>\/<repo>#<n>`/);
        expect(LANDED_REFERENCE).toMatch(/the number the developer gave, unchanged/);
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
});

const DISTILL: string = body("nxs.distill.md");

describe("/nxs.distill drains a fix entry (story #268)", () => {
    it("discovers a fix directory as a drainable entry alongside an ephemeral epic entry", () => {
        expect(DISTILL).toMatch(/`\.nexus\/tmp\/epic-<n>\/`, \*\*`\.nexus\/tmp\/fix-<n>\/`, or `\.nexus\/tmp\/intake-<n>\/`\*\*/);
    });

    it("skips a fix directory missing either file, the same way it skips an epic entry", () => {
        expect(DISTILL).toMatch(/a fix or intake directory missing either file is skipped exactly as an epic directory\s*\n?\s*missing/);
    });

    it("takes the entry kind from the header, never the directory name, and blocks a disagreement", () => {
        expect(DISTILL).toContain("entry-kind-mismatch");
        expect(DISTILL).toMatch(/never from its location or its directory name/);
    });

    it("bounds a fix entry's deltas to updates carrying one decision log entry and nothing else", () => {
        expect(DISTILL).toMatch(/Every delta\s*\n?must be `action: update` against a page that \*\*already exists\*\*/);
        expect(DISTILL).toMatch(/no `touches_added`, no `touches_removed`, no\s*\n?`domain`/);
    });

    it("sources the appended entry's heading from the reference recorded in the entry's link", () => {
        expect(DISTILL).toMatch(/`source` is the reference recorded in the entry's `epic\.md` `link`/);
    });

    it("hard-blocks a rationale that maps to no existing page and leaves the directory in place", () => {
        expect(DISTILL).toContain("no-existing-page");
        expect(DISTILL).toMatch(/leave the entry directory in place for a later run/);
    });

    it("runs the reciprocity fan-out and the atlas regeneration, and expects no change from either", () => {
        expect(DISTILL).toMatch(/empty by construction, not by a special case/);
        expect(DISTILL).toMatch(/atlas regeneration is a no-op for the same reason and is\s*\n?\s*likewise still run/);
    });

    it("removes nothing for a fix entry and reports no missing removal target", () => {
        expect(DISTILL).toMatch(/no committed removal target at all/);
        expect(DISTILL).toMatch(/report no missing removal target/);
    });

    it("names, for each fix entry, the page it changes and the entry it appends, at the checkpoint", () => {
        expect(DISTILL).toMatch(/Fix entries — the page each one changes and the entry it appends/);
    });

    it("leaves an epic entry's drain unchanged, including one discovered in the same run", () => {
        expect(DISTILL).toMatch(/Draining an epic entry is unchanged by this,\s*\n?\s*including an epic entry discovered in the same run as a fix entry/);
    });

    it("keeps the two-test merge precondition as the gate on a recorded range head", () => {
        expect(DISTILL).toContain("git merge-base --is-ancestor <range.head>");
        expect(DISTILL).toMatch(/two-test form/);
    });
});

describe("/nxs.distill blocks the PR when a fix entry breaks the razor (story #269)", () => {
    it("runs the validator in append-only-log mode against a fix entry's pages", () => {
        expect(DISTILL).toContain("nexus validate-concepts --append-only-log --base HEAD");
    });

    it("adds the mode to the existing checks rather than replacing them", () => {
        expect(DISTILL).toMatch(/\*\*added to\*\* the invocation, never substituted for it/);
        expect(DISTILL).toMatch(/every existing check above\s*\n?\s*still runs against the same pages/);
    });

    it("does not apply the mode to an epic entry drained in the same run", () => {
        expect(DISTILL).toMatch(/Apply the mode only to a fix entry's pages/);
        expect(DISTILL).toMatch(/validated by its own invocation,\s*\n?\s*without the flag/);
    });

    it("never passes a regenerated anchor sidecar to the mode", () => {
        expect(DISTILL).toMatch(/never the regenerated anchor sidecars/);
    });

    it("blocks the PR with a message naming the entry, the page, and the design-change remedy", () => {
        expect(DISTILL).toMatch(/A non-zero exit from any of these blocks the PR/);
        expect(DISTILL).toMatch(/<fix local-id> \(<provenance ref>\) — <slug> changed outside the entry it gained/);
        expect(DISTILL).toMatch(/design\s*\n?change, not a fix\. Plan it with \/nxs\.epic/);
    });

    it("establishes that the validator enforces the mode, blaming an old install rather than a missing file", () => {
        expect(DISTILL).toContain("nexus --help | grep -q -- --append-only-log");
        expect(DISTILL).toMatch(/mode-unavailable → refuse the fix entry/);
        expect(DISTILL).toMatch(/remedy is to update the install/);
    });
});

const ANALYZE: string = body("nxs.analyze.md");

describe("/nxs.analyze refuses a fix entry (story #270)", () => {
    it("stops on entry_kind: fix and says the check is undefined, not optional", () => {
        expect(ANALYZE).toContain("entry_kind: fix");
        expect(ANALYZE).toMatch(/does not run against a fix entry/);
        expect(ANALYZE).toMatch(/acceptance criteria, its success metrics, and a decision record's invariants/);
        expect(ANALYZE).toMatch(/none of the three/);
    });

    it("writes no receipt and modifies no file in the entry", () => {
        expect(ANALYZE).toMatch(/Write no\s*\n?`analyze-receipt\.md` and modify no file in the entry/);
    });

    it("leaves an epic entry's behaviour unchanged", () => {
        expect(ANALYZE).toMatch(/An entry without `entry_kind: fix` is an epic entry, and everything below is unchanged/);
    });
});
