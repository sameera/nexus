/**
 * The razor's authoring contract (epic #284).
 *
 * The razor is a rule set with one normative home, loaded by three drafting stages and enforced by
 * one checker. Nothing about that arrangement is visible in a type: the skill is markdown, the
 * stages are markdown, and the tokens they agree on are strings the checker parses. So the parts
 * that must agree are asserted here — the label vocabulary, the name of the materialized source
 * artifact, and which stages load the skill — because a divergence between them is exactly the
 * failure the single normative home exists to prevent.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const AUTHORED: string = path.join(REPO_ROOT, "components");

function read(rel: string): string {
    return fs.readFileSync(path.join(AUTHORED, rel), "utf8");
}

const RAZOR = "skills/nxs-razor/SKILL.md";

describe("the razor skill", () => {
    it("is a loadable component with the name the stages address it by", () => {
        const body: string = read(RAZOR);
        expect(body.startsWith("---\n")).toBe(true);
        expect(body).toMatch(/^name: nxs-razor$/m);
    });

    it("states the two-valued label vocabulary and both of its inline tokens", () => {
        const body: string = read(RAZOR);
        expect(body).toContain("[asked:");
        expect(body).toContain("[inferred]");
        expect(body).toMatch(/two-valued/);
    });

    it("names the materialized source artifact and forbids checking against a live source", () => {
        const body: string = read(RAZOR);
        expect(body).toContain("source.md");
        expect(body).toMatch(/that file and nothing else/);
    });

    it("states the citation comparison as normalized containment with a word floor", () => {
        const body: string = read(RAZOR);
        expect(body).toMatch(/normalized substring containment/i);
        expect(body).toMatch(/four words/);
    });

    it("states that no drafting-time token reaches a filed body", () => {
        const body: string = read(RAZOR);
        expect(body).toMatch(/assertion mode/);
    });
});

describe("the epic drafting stage", () => {
    it("loads the razor rather than restating it", () => {
        expect(read("commands/nxs.epic.md")).toContain("nxs-razor");
    });

    it("materializes the run's source text beside the draft", () => {
        expect(read("commands/nxs.epic.md")).toContain("${DRAFT_DIR}/source.md");
    });

    it("files from a derived body whose cleanliness is asserted, not remembered", () => {
        const body: string = read("commands/nxs.epic.md");
        expect(body).toContain("razor-check");
        expect(body).toMatch(/--assert-clean/);
    });
});

describe("the razor's counted limits and content rules", () => {
    it("state the acceptance-criteria range and the ceiling's stated-reason escape", () => {
        const body: string = read(RAZOR);
        expect(body).toMatch(/three to five/i);
        expect(body).toMatch(/stated reason/i);
    });

    it("state one limit for assumptions and out-of-scope items, with no escape", () => {
        expect(read(RAZOR)).toMatch(/no more than five/i);
    });

    it("never require an item to be generated to satisfy a floor", () => {
        expect(read(RAZOR)).toMatch(/no minimum-count check/i);
    });

    it("ban a personas table and a mechanism-naming acceptance criterion", () => {
        const body: string = read(RAZOR);
        expect(body).toMatch(/personas table/i);
        expect(body).toMatch(/mechanism/i);
    });

    it("state the necessity question as one durable line", () => {
        expect(read(RAZOR)).toMatch(/smallest usable version/i);
    });
});

describe("the epic template", () => {
    const template: string = read("commands/nxs.epic.md");

    it("restates each counted limit beside the heading it bounds", () => {
        // The observed failure was a heading's presence beating a rule stated far from it, so the
        // number has to sit where the model is writing — pointing at the skill, not replacing it.
        const headings: RegExp[] = [/#### Acceptance Criteria[^\n]*\n?[^\n]*3–5/, /## Assumptions[^\n]*max 5/, /## Out of Scope[^\n]*max 5/];
        for (const heading of headings) expect(template).toMatch(heading);
    });

    it("restates the deviations-only personas rule as a ban on the table beside the heading", () => {
        expect(template).toMatch(/## Personas[^\n]*no table/);
    });

    it("carries the necessity answer as a line of the epic body, so it reaches the filed issue", () => {
        expect(template).toContain("## Smallest Usable Version");
    });
});

describe("the epic gate", () => {
    const gate: string = read("agents/nxs-epic-gate.md");

    it("invokes the one checker rather than counting the razor's limits itself", () => {
        expect(gate).toContain("nexus razor-check");
        expect(gate.replace(/\s+/g, " ")).toContain("Never count acceptance criteria or section items yourself");
    });

    it("is handed the materialized source text, not a live source", () => {
        expect(gate).toContain("source.md");
        expect(read("commands/nxs.epic.md")).toMatch(/Source text: \$\{DRAFT_DIR\}\/source\.md/);
    });

    it("blocks the digest on a blocking razor finding", () => {
        expect(read("commands/nxs.epic.md")).toMatch(/blocking razor finding[^\n]*do not render the Phase 5\ndigest/i);
    });

    it("reports a suspected mechanism as an observation the reviewer decides, not a verdict", () => {
        expect(gate).toMatch(/it does not block filing/);
    });

    it("still makes no edit and creates no issue", () => {
        expect(gate).toMatch(/No persisted report and no edits/);
        expect(gate).toMatch(/do not create or modify GitHub issues/i);
    });
});
