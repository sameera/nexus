/**
 * Cross-repository issue references (concept "Provenance Reference"), wired into the four lanes
 * that write an epic, record, story or stub number into a surface that can be read outside the
 * repository it was filed into: /nxs.epic, /nxs.decision-record, /nxs.analyze and /nxs.close.
 * Pins that each lane loads the shared `nxs-issue-reference` skill rather than restating the
 * qualification rule, and pins the two `-R`/`$REPO_ARG` gaps this change closes alongside it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const SRC_DIR: string = __dirname;

function body(name: string): string {
    return fs.readFileSync(path.join(authoredComponentRoot(SRC_DIR), "commands", name), "utf8");
}

function skill(name: string): string {
    return fs.readFileSync(path.join(authoredComponentRoot(SRC_DIR), "skills", name, "SKILL.md"), "utf8");
}

const ANALYZE: string = body("nxs.analyze.md");
const CLOSE: string = body("nxs.close.md");
const EPIC: string = body("nxs.epic.md");
const RECORD: string = body("nxs.decision-record.md");
const SKILL: string = skill("nxs-issue-reference");

describe("nxs-issue-reference — the shared skill exists and states the rule once", () => {
    it("declares the frontmatter a skill needs", () => {
        expect(SKILL).toMatch(/^---\nname: nxs-issue-reference\n/);
        expect(SKILL).toContain("description:");
    });

    it("states the qualify-only-across-a-boundary rule and the three contexts", () => {
        expect(SKILL).toMatch(/qualify a reference only when its repository is known and differs/i);
        expect(SKILL).toMatch(/GitHub surface/);
        expect(SKILL).toMatch(/Local file/);
        expect(SKILL).toMatch(/Terminal report/);
    });

    it("states both corollaries that a model could otherwise over-apply the rule against", () => {
        expect(SKILL).toMatch(/close comment posted on the epic issue itself stays bare/i);
        expect(SKILL).toMatch(/story headings all stay bare/i);
    });
});

describe("/nxs.analyze loads the shared skill and qualifies references on the PR-review surface", () => {
    it("loads nxs-issue-reference rather than restating the rule", () => {
        expect(ANALYZE).toContain("nxs-issue-reference");
        expect(ANALYZE).toMatch(/load the \*\*`nxs-issue-reference`\*\* skill/i);
    });

    it("resolves STORY_REPO alongside ISSUES_REPO in Phase 0.5", () => {
        expect(ANALYZE).toContain('STORY_REPO="$(nexus config resolve story-repo --root "<root>")"');
    });

    it("carries a repo-aware placeholder for every reference in the summary and receipt templates", () => {
        expect(ANALYZE).toContain("epic <epic-ref>");
        expect(ANALYZE).toContain("record <record-ref>");
        expect(ANALYZE).toContain("STORY <story-ref> <title>");
    });

    it("stamps issues_repo beside repo in the PR-review machine block, omitted when they match", () => {
        expect(ANALYZE).toMatch(/issues_repo: <ISSUES_REPO>[^\n]*where epic\/record\/stories live/);
        expect(ANALYZE).toMatch(/OMIT.*whenever it equals `repo`/s);
    });

    it("carries -R <repoIdentity> on every gh pr review / gh pr comment call (the secondary bug)", () => {
        expect(ANALYZE).toContain('gh pr review <N> -R <repoIdentity> --approve --body-file "<scratch>/analyze-review.md"');
        expect(ANALYZE).toContain('gh pr review <N> -R <repoIdentity> --request-changes --body-file "<scratch>/analyze-review.md"');
        expect(ANALYZE).toContain('gh pr comment <N> -R <repoIdentity> --body-file "<scratch>/analyze-review.md"');
    });
});

describe("/nxs.close loads the shared skill and states the close-comment counter-case explicitly", () => {
    it("loads nxs-issue-reference rather than restating the rule", () => {
        expect(CLOSE).toContain("nxs-issue-reference");
        expect(CLOSE).toMatch(/load the \*\*`nxs-issue-reference`\*\* skill/i);
    });

    it("states that the close comment's own numbers stay bare, since that surface is $ISSUES_REPO", () => {
        expect(CLOSE).toMatch(/this comment is posted on the epic issue itself, in `\$ISSUES_REPO`/i);
    });

    it("stamps issues_repo in the close-record frontmatter and the close-comment machine block", () => {
        expect(CLOSE).toContain("issues_repo");
        expect(CLOSE).toMatch(/issues_repo: <ISSUES_REPO>\s+# where `epic`\/`record`\/stub numbers live/);
    });

    it("never passes the receipt's own record reference whole to --issue, which takes a bare number", () => {
        expect(CLOSE).toMatch(/never the\s*\n?\s*receipt's own `record`\/`record-ref` string taken whole/);
        expect(CLOSE).toMatch(/`--issue` takes a number, not a reference/);
    });

    it("qualifies epic/record/story references on the two terminal block reports and the completion report", () => {
        expect(CLOSE).toContain("Cannot close epic <epic-ref>:");
        expect(CLOSE).toContain("story <story-ref>");
        expect(CLOSE).toContain("GitHub epic issue: <epic-ref> — closed");
    });
});

describe("/nxs.epic keeps the materialized epic.md's own references bare and fixes two missing $REPO_ARG calls", () => {
    it("writes issues_repo beside link at filing time", () => {
        expect(EPIC).toMatch(/`issues_repo: "<owner>\/<repo>"` beside/);
    });

    it("states that the story headings and sequence table stay bare, and points at the shared skill", () => {
        expect(EPIC).toMatch(/story headings, the sequence table, `link` and `record` all stay bare/i);
        expect(EPIC).toContain("nxs-issue-reference");
    });

    it("carries $REPO_ARG on the re-decomposition comment and close (previously missing)", () => {
        expect(EPIC).toContain('gh issue comment <n> $REPO_ARG --body "Larger than one epic on planning');
        expect(EPIC).toContain('gh issue close <n> $REPO_ARG --reason "not planned"');
    });

    it("never builds the feature-nav issue URL from a bare gh repo view (the current-repo fallback bug)", () => {
        expect(EPIC).not.toMatch(/gh repo view --json url -q \.url`\) \+ `\/issues\/<EPIC>/);
        expect(EPIC).toMatch(/gh repo view \$REPO_ARG --json url -q\s*\n?\s*\.url/);
    });
});

describe("/nxs.decision-record loads the shared skill rather than restating the rule", () => {
    it("loads nxs-issue-reference", () => {
        expect(RECORD).toContain("nxs-issue-reference");
        expect(RECORD).toMatch(/load the \*\*`nxs-issue-reference`\*\* skill/i);
    });

    // The stage used to write one local artifact carrying story numbers — the workbook sources file
    // it pinned from at approval — and that file had to declare which repository those numbers lived
    // in. Pinning is the teaching stage's step now (epic #677), and this stage writes no local
    // artifact naming a story, so there is nothing left here for the declaration to sit on.
    it("writes no local artifact carrying a story number, so it declares no repository for one", () => {
        expect(RECORD).not.toContain("issues_repo: <ISSUES_REPO>");
    });
});
