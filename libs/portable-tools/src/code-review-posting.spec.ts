/**
 * Story #920, decision record #921 — `/nxs.code-review` posts the approved ranking as one review.
 *
 * The lead chooses the verdict in the run before anything is posted (G9). The skill writes the
 * review and hands it, with the verdict, to `nexus review-post`, which runs the checks and posts
 * (D3: G11, G12, G22). Body-only findings travel in the review body (D4: G2, G10). The lead sees
 * the link, the inline-comment count and the body-only count (G13, G19).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { DISPATCH_NAMES } from "./nexus-cli.js";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);
const SKILL: string = fs.readFileSync(path.join(ROOT, "skills", "nxs.code-review", "SKILL.md"), "utf8");
const BODY: string = SKILL.slice(SKILL.indexOf("\n---", 3));

/** One `# ` section's body, up to the next `# ` heading, with line wraps folded to spaces. */
function step(heading: string): string {
    const start: number = BODY.indexOf(heading);
    expect(start, `missing section ${heading}`).toBeGreaterThan(-1);
    const rest: string = BODY.slice(start + heading.length);
    const next: number = rest.search(/\n# /);
    return (next === -1 ? rest : rest.slice(0, next)).replace(/\s+/g, " ");
}

const VERDICT: string = step("# Step 6 — The lead chooses the verdict");
const WRITE: string = step("# Step 7 — Write the review");
const POST: string = step("# Step 8 — Post through `nexus review-post`");
const REPORT: string = step("# Step 9 — Report");

describe("/nxs.code-review posts nothing until the lead chooses a verdict (G9)", () => {
    it("asks the lead for request changes, comment or approve, with a way not to post", () => {
        expect(VERDICT).toMatch(/AskUserQuestion/);
        for (const option of ["**Request changes**", "**Comment**", "**Approve**", "**Do not post**"]) {
            expect(VERDICT).toContain(option);
        }
        expect(VERDICT).toMatch(/Without a verdict .* nothing is posted/);
    });

    it("recommends a verdict but leaves the choice to the lead", () => {
        expect(VERDICT).toMatch(/Recommend \*\*request changes\*\* when any finding in "Fix in this pull request" has high severity/);
        expect(VERDICT).toMatch(/The lead chooses/);
    });

    it("asks before it posts", () => {
        expect(BODY.indexOf("# Step 6")).toBeLessThan(BODY.indexOf("nexus review-post --pr"));
    });
});

describe("/nxs.code-review posts only through nexus review-post (D3)", () => {
    it("hands the review and the verdict to the posting command, a name the executable answers to", () => {
        expect(POST).toMatch(/nexus review-post --pr <pr-number> --repo <owner\/repo> --review \S+ --verdict <request-changes\|comment\|approve>/);
        expect(DISPATCH_NAMES).toContain("review-post");
    });

    it("never posts to the pull request itself", () => {
        expect(BODY).not.toMatch(/gh pr review|gh pr comment|-X POST|--method POST/);
    });

    it("confirms a second review on the same head with the lead before posting one (G12)", () => {
        expect(POST).toMatch(/second-review-unconfirmed/);
        expect(POST).toMatch(/AskUserQuestion/);
        expect(POST).toMatch(/Only when the lead confirms, run the same command again with `--confirm-second`/);
    });

    it("never posts again when GitHub reported a failure but a review landed anyway", () => {
        expect(POST).toMatch(/post-uncertain/);
        expect(POST).toMatch(/Do not run the command again/);
    });

    it("shows every comment problem unchanged and does not retry (G11)", () => {
        expect(POST).toMatch(/comment-check-failed/);
        expect(POST).toMatch(/every problem/);
        expect(POST).toMatch(/Do not move a line, drop a comment or retry/);
    });
});

describe("/nxs.code-review writes one review carrying every finding (D4: G2, G10)", () => {
    it("puts the ranking in the body and carries each body-only finding there in full", () => {
        expect(WRITE).toMatch(/`body` — the ranking/);
        expect(WRITE).toMatch(/carries each body-only finding in full/);
    });

    it("gives each finding location inside the changed lines one inline comment, and lists the rest as body-only", () => {
        expect(WRITE).toMatch(/`comments` — one entry per finding location that is not body-only/);
        expect(WRITE).toMatch(/`bodyOnly` — one entry per body-only finding/);
        expect(WRITE).toMatch(/Every finding appears in `comments` or `bodyOnly`/);
    });
});

describe("/nxs.code-review writes the review for the pull request's author", () => {
    it("opens the body with the verdict, the finding that drives it and what fits in this pull request", () => {
        expect(WRITE).toMatch(/written for the pull request's author/);
        expect(WRITE).toMatch(/the verdict, the finding that drives it, and which findings fit in this pull request/);
        expect(WRITE).toMatch(/if you agree/);
    });

    it("carries a ranking table with each finding's four ratings, then the suggested order", () => {
        expect(WRITE).toMatch(/table/);
        for (const column of ["probability", "severity", "fix effort", "regression risk"]) expect(WRITE).toContain(column);
        expect(WRITE).toMatch(/`### Suggested order`/);
    });

    it("tells the author how to fix each finding, in prose and never as a suggestion block", () => {
        expect(WRITE).toMatch(/what goes wrong in a concrete case, then the fix/);
        expect(WRITE).toMatch(/No `suggestion` block/);
        expect(WRITE).toMatch(/follow-up.*suggests? opening an issue/i);
    });
});

describe("/nxs.code-review reports the posted review (G13, G19)", () => {
    it("shows the link, the inline-comment count and the body-only count", () => {
        expect(REPORT).toMatch(/link/);
        expect(REPORT).toMatch(/inline comments/);
        expect(REPORT).toMatch(/only in the review body/);
    });
});
