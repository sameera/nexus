/**
 * Story #919, decision record #921 — `/nxs.code-review` ranks a pull request's review findings.
 *
 * The findings come only from Claude Code's own `/code-review`, run without its posting or fixing
 * options and with the lead's effort level passed through (D1: G1, G2, G3, G4, G8, G14). The run
 * refuses when that review cannot be run (D5: G20). Each finding is moved to its line at the pull
 * request's head before ranking (D6: G6), and the rating scales, group rules and numbering order
 * ship fixed in the skill (D2: G5, G7, G16, G17). The skill ships under the name a personal skill
 * may already use, so installing replaces it (G15).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);
const SKILL_PATH: string = path.join(ROOT, "skills", "nxs.code-review", "SKILL.md");
const SKILL: string = fs.readFileSync(SKILL_PATH, "utf8");

const FRONTMATTER: string = SKILL.slice(0, SKILL.indexOf("\n---", 3));
const BODY: string = SKILL.slice(FRONTMATTER.length);

/** One `# ` or `## ` section's body, up to the next heading of that level or higher, with line wraps folded to spaces. */
function section(heading: string): string {
    const start: number = BODY.indexOf(heading);
    expect(start, `missing section ${heading}`).toBeGreaterThan(-1);
    const level: string = heading.slice(0, heading.indexOf(" ") + 1);
    const rest: string = BODY.slice(start + heading.length);
    const next: RegExpMatchArray | null = rest.match(new RegExp(`\\n#{1,${level.length - 1}} `));
    return (next === null ? rest : rest.slice(0, next.index)).replace(/\s+/g, " ");
}

describe("/nxs.code-review ships as a Nexus skill under its own name (G15)", () => {
    it("is authored at skills/nxs.code-review, the path an installed personal skill of that name holds", () => {
        expect(fs.existsSync(SKILL_PATH)).toBe(true);
        expect(FRONTMATTER).toMatch(/^name: nxs\.code-review$/m);
        expect(FRONTMATTER).toMatch(/^description: .+$/m);
    });
});

describe("/nxs.code-review takes its findings only from Claude Code's /code-review (D1)", () => {
    const review: string = section("# Step 1 — Run Claude Code's review");

    it("runs Claude Code's code-review skill on the pull request (G1)", () => {
        expect(review).toMatch(/`code-review` skill/);
        expect(review).toMatch(/pull request reference/);
    });

    it("passes the lead's effort level through unchanged (G4)", () => {
        expect(review).toMatch(/effort level/);
        expect(review).toMatch(/unchanged/);
        for (const level of ["low", "medium", "high", "xhigh", "max"]) {
            expect(BODY).toContain(level);
        }
    });

    it("never passes the review's posting or fixing options (G3)", () => {
        expect(review).toMatch(/Never pass `--comment` or `--fix`/);
    });

    it("adds no finding of its own and drops none the review returned (G1, G2)", () => {
        expect(BODY).toMatch(/Add no finding of your own/);
        expect(BODY).toMatch(/Drop no finding/);
    });

    it("ends the run, posting nothing, when the review returns no findings (G8)", () => {
        const none: string = section("# Step 2 — End on no findings");
        expect(none).toMatch(/returned no findings/);
        expect(none).toMatch(/posts nothing/);
        expect(BODY.indexOf("# Step 2 — End on no findings")).toBeLessThan(BODY.indexOf("# Step 3"));
    });

    it("changes no file and opens no issue (G14)", () => {
        const scope: string = section("# Scope");
        expect(scope).toMatch(/changes no file/);
        expect(scope).toMatch(/opens no issue/);
        expect(scope).toMatch(/suggest/);
    });
});

describe("/nxs.code-review refuses when Claude Code's review cannot be run (D5, G20)", () => {
    const refusal: string = section("## When the review cannot be run");

    it("names what is missing, reviews nothing and posts nothing", () => {
        expect(refusal).toMatch(/names what is missing/);
        expect(refusal).toMatch(/review nothing yourself/i);
        expect(refusal).toMatch(/post nothing/);
    });

    it("refuses before any finding is shown", () => {
        expect(BODY.indexOf("## When the review cannot be run")).toBeLessThan(BODY.indexOf("# Step 3"));
    });
});

describe("/nxs.code-review shows each finding at its line at the pull request's head (D6, G6)", () => {
    const move: string = section("# Step 3 — Move each finding to its line at the head");

    it("reads each finding's file at the head commit and moves the finding to where its expected text sits", () => {
        expect(move).toMatch(/head commit/);
        expect(move).toMatch(/expected text/);
        expect(move).toMatch(/line at the head/);
    });

    it("marks every finding outside the changed lines before the lead sees the ranking (G18)", () => {
        expect(move).toMatch(/body-only/);
        expect(move).toMatch(/changed lines/);
    });
});

describe("/nxs.code-review rates, groups and numbers findings by fixed rules (D2)", () => {
    const scales: string = section("## Rating scales");
    const groups: string = section("## Group rules");
    const numbering: string = section("## Numbering order");

    it("defines a scale for each of the four axes (G5)", () => {
        expect(scales).toMatch(/Probability.*certain.*high.*medium.*low/s);
        expect(scales).toMatch(/Severity/);
        for (const level of ["High", "Medium", "Low", "Negligible"]) {
            expect(scales).toContain(`**${level}**`);
        }
        expect(scales).toMatch(/Fix effort.*very low.*high/s);
        expect(scales).toMatch(/Regression risk.*none.*high/s);
    });

    it("takes Low and Negligible severity from the lead's personal skill, as D2's base (G5)", () => {
        expect(scales).toMatch(/\*\*Low\*\*: a loud false failure, or local-only confusion/);
        expect(scales).toMatch(/\*\*Negligible\*\*: performance or tidiness only/);
    });

    it("checks the four groups in a fixed order and puts each finding in the first one it matches (G7, G16)", () => {
        const order: number[] = ["Follow-up issues", "Fix in this pull request", "Fix if the author agrees", "Optional"].map((g) =>
            groups.indexOf(`**${g}**`),
        );
        expect(order.every((i) => i > -1)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(groups).toMatch(/first group it matches/);
        expect(groups).toMatch(/exactly one group/);
    });

    it("numbers findings by group, then severity, probability and lowest effort, with ties in review order (G7, G17)", () => {
        expect(numbering).toMatch(/fix in this pull request, fix if the author agrees, optional, follow-up issues/);
        expect(numbering).toMatch(/severity, highest first, then probability, highest first, then fix effort, lowest first/);
        expect(numbering).toMatch(/Ties keep the order/);
    });

    it("lets no finding lose its group to judgment: one that fits no earlier rule lands in a later group", () => {
        expect(groups).toMatch(/every remaining finding/);
    });
});

describe("/nxs.code-review shows the ranking to the lead (G5, G6, G18)", () => {
    const show: string = section("# Step 5 — Show the ranking");

    it("shows each finding's number, ratings and head line, grouped, with the body-only mark", () => {
        expect(show).toMatch(/number/);
        expect(show).toMatch(/head line/);
        expect(show).toMatch(/body-only/);
        expect(show).toMatch(/rating/i);
    });
});
