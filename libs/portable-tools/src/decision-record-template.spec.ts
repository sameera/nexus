/**
 * The approval-first decision record (epic #787, story #788).
 *
 * The record stage fills a template and follows its own instructions; neither is visible in a
 * type. What a lead meets is the drafted record's shape, so the shape is asserted here where it is
 * set: the section order of the template the stage fills (G1), the fields every decision entry
 * carries (G3), the tiers the stage applies (G4), and the old-format template a revision of an
 * old-format record is still drafted from (D11).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { SEEDED_TEMPLATES } from "./seed-templates";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const MASTER_DIR: string = path.join(REPO_ROOT, "common", "templates");
const PROJECT_DIR: string = path.join(REPO_ROOT, ".nexus", "config", "templates");
const NEW_TEMPLATE = "decision-record-template.md";
const OLD_TEMPLATE = "decision-record-template-v1.md";

function read(file: string): string {
    return fs.readFileSync(file, "utf8");
}

function component(rel: string): string {
    return read(path.join(REPO_ROOT, "components", rel));
}

/** The template's own headings of one level, with guidance comments removed first. */
function headings(template: string, level: "##" | "###" | "####"): string[] {
    const visible: string = template.replace(/<!--[\s\S]*?-->/g, "");
    const pattern = new RegExp(`^${level} (.+)$`, "gm");
    return [...visible.matchAll(pattern)].map((match: RegExpMatchArray) => match[1].trim());
}

/** The body of one `##` section, up to the next `##` heading. */
function section(template: string, name: string): string {
    const start: number = template.indexOf(`\n## ${name}\n`);
    expect(start, `section ${name}`).toBeGreaterThanOrEqual(0);
    const rest: string = template.slice(start + 1);
    const next: number = rest.indexOf("\n## ", 1);
    return next === -1 ? rest : rest.slice(0, next);
}

const TEMPLATES: [string, string][] = [
    ["the master", path.join(MASTER_DIR, NEW_TEMPLATE)],
    ["the project copy", path.join(PROJECT_DIR, NEW_TEMPLATE)],
];

describe.each(TEMPLATES)("%s of the record template (D1)", (_label: string, file: string) => {
    const template: string = read(file);

    it("orders the sections approval contract first and explanation last (G1)", () => {
        expect(headings(template, "##")).toEqual([
            "How it works",
            "Approval brief",
            "Guarantees",
            "Risks and dependencies",
            "Concept-store changes",
            "Design rationale and mechanism",
        ]);
    });

    it("puts the Mechanism, with its Terms, before the Decisions and reasons in the appendix", () => {
        const appendix: string = section(template, "Design rationale and mechanism");
        expect(headings(appendix, "###")).toEqual(["Mechanism", "Decisions and reasons"]);
        expect(appendix.indexOf("**Terms**")).toBeLessThan(appendix.indexOf("### Decisions and reasons"));
    });

    it("carries none of the old sections the new ones replace", () => {
        for (const old of ["Summary", "Chosen Approach", "Key Decisions", "Constraints & Invariants", "Open Clarifications"]) {
            expect(headings(template, "##")).not.toContain(old);
        }
    });

    it("groups the Approval brief by what the approver has to do", () => {
        const brief: string = section(template, "Approval brief");
        for (const group of ["Resolve before approval", "Choices with trade-offs", "Before implementation", "Committed follow-up"]) {
            expect(brief, group).toContain(`**${group}**`);
        }
        expect(brief).toMatch(/Revision delta/);
    });

    it("gives a guarantee that only preserves today's behaviour a group of its own", () => {
        expect(headings(section(template, "Guarantees"), "###")).toContain("Existing behaviour to preserve");
    });

    it("gives every decision entry the fields a reviewer checks it by (G3)", () => {
        const decisions: string = section(template, "Design rationale and mechanism");
        for (const field of ["Decision", "Why", "Trade-off", "Epic commitment affected", "Delivered by", "Guarantees"]) {
            expect(decisions, field).toMatch(new RegExp(`^- \\*\\*${field}:\\*\\*`, "m"));
        }
        expect(decisions).toMatch(/Refuted viable alternative/);
    });

    it("has the drafter write an empty field as `none`, so an omission cannot pass for an absence", () => {
        expect(template).toMatch(/`none`/);
    });

    it("states the length of How it works as a guideline that caps nothing (G2)", () => {
        expect(section(template, "How it works")).toMatch(/guideline, not a limit/i);
    });
});

describe("the old-format record template (D11)", () => {
    it("ships beside the new one, so a revision of an old-format record has its template", () => {
        expect(SEEDED_TEMPLATES).toContain(NEW_TEMPLATE);
        expect(SEEDED_TEMPLATES).toContain(OLD_TEMPLATE);
    });

    it.each([
        ["the master", path.join(MASTER_DIR, OLD_TEMPLATE)],
        ["the project copy", path.join(PROJECT_DIR, OLD_TEMPLATE)],
    ])("keeps the old sections in %s", (_label: string, file: string) => {
        const sections: string[] = headings(read(file), "##");
        expect(sections).toContain("Key Decisions");
        expect(sections).toContain("Constraints & Invariants");
        expect(sections).not.toContain("Guarantees");
    });

    it("is what the stage drafts a revision of a record approved in the old format from", () => {
        const stage: string = component("commands/nxs.decision-record.md").replace(/\s+/g, " ");
        expect(stage).toContain(`.nexus/config/templates/${OLD_TEMPLATE}`);
        expect(stage).toMatch(/approved in the old format/i);
    });
});

describe("the record stage drafts the approval-first record", () => {
    const stage: string = component("commands/nxs.decision-record.md");
    const flat: string = stage.replace(/\s+/g, " ");

    function tierRow(sizes: RegExp): string {
        const row: string | undefined = stage.split("\n").find((line: string) => sizes.test(line));
        expect(row, String(sizes)).toBeDefined();
        return row as string;
    }

    it("requires How it works, Guarantees and the decisions for a small or medium epic (D2, G4)", () => {
        const row: string = tierRow(/^\s*\| \*\*S\*\* or \*\*M\*\* \|/);
        for (const required of ["How it works", "Guarantees", "Decisions and reasons"]) {
            expect(row, required).toContain(required);
        }
        expect(row).not.toMatch(/Key Decisions|Constraints & Invariants/);
    });

    it("requires every section of a large epic except Concept-store changes, which appears only with an entry (G4)", () => {
        const row: string = tierRow(/^\s*\| \*\*L\*\* or \*\*XL\*\* \|/);
        expect(row).toMatch(/Concept-store changes/);
        expect(row).toMatch(/states why/);
    });

    it("never tiers out the Approval brief (G4)", () => {
        expect(flat).toMatch(/Approval brief appears at every size/i);
    });

    it("writes How it works and the Approval brief itself, from the architect's decisions", () => {
        expect(flat).toMatch(/The architect does not write the brief/);
    });

    it("lists a trade-off once, under Resolve before approval when its decision is there (G5)", () => {
        expect(flat).toMatch(/every decision with a trade-off appears (in the brief )?exactly once/i);
        expect(flat).toMatch(/not repeated under "Choices with trade-offs"/);
    });

    it("labels every guarantee and every risk in the razor's two-valued form", () => {
        expect(flat).toMatch(/Label every guarantee and every risk/);
    });

    it("checks story coverage against the decisions and guarantees", () => {
        expect(flat).toMatch(/addressed by a decision or a guarantee/);
    });
});

describe("the architect in decision-record mode (D1)", () => {
    const architect: string = component("agents/nxs-architect.md");

    it("is asked for each field a decision entry carries", () => {
        for (const field of ["Trade-off", "Epic commitment affected", "Delivered by", "Guarantees"]) {
            expect(architect, field).toContain(`**${field}**`);
        }
    });

    it("groups its guarantees by what a reviewer checks", () => {
        expect(architect).toMatch(/Existing behaviour to preserve/);
    });

    it("no longer returns the sections the stage now writes itself", () => {
        expect(headings(architect, "###")).not.toContain("Summary");
        expect(headings(architect, "###")).not.toContain("Chosen Approach");
    });
});

/** The body of one `##` phase of the stage, up to the next `##` heading. */
function phase(stage: string, name: string): string {
    const start: number = stage.indexOf(`\n## ${name}`);
    expect(start, `phase ${name}`).toBeGreaterThanOrEqual(0);
    const rest: string = stage.slice(start + 1);
    const next: number = rest.indexOf("\n## ", 1);
    return (next === -1 ? rest : rest.slice(0, next)).replace(/\s+/g, " ");
}

describe("the checkpoint checks promised epic and story changes against the live issues (story #791, D8, D10)", () => {
    const stage: string = component("commands/nxs.decision-record.md");
    const checkpoint: string = phase(stage, "Phase 3.5");
    const flat: string = stage.replace(/\s+/g, " ");

    it("runs the amendment check on the labelled draft before it renders the cut list (G15)", () => {
        const check: number = checkpoint.indexOf('nexus record-amendments --draft "<scratch>/record-body.labelled.md"');
        expect(check).toBeGreaterThanOrEqual(0);
        expect(check).toBeLessThan(checkpoint.indexOf("nexus razor-offer"));
        expect(check).toBeLessThan(checkpoint.indexOf("render the cut list"));
    });

    it("stops the run, filing nothing, when the check cannot read an issue", () => {
        expect(checkpoint).toMatch(/A non-zero exit stops the run: file nothing\.\*\* Either an issue could not be read/);
    });

    it("writes an amended change's status with the date it was checked (G15)", () => {
        expect(checkpoint).toContain("`amended (verified <checked>)`");
    });

    it("keeps a pending change pending, adds a model-added BLOCKER naming the wording to apply and what the issue says today, and lists it first (G16)", () => {
        expect(checkpoint).toMatch(/Status stays `pending`\. Add a \*\*BLOCKER\*\* risk/);
        expect(checkpoint).toMatch(/labelled `\[inferred\]`/);
        expect(checkpoint).toMatch(/Apply this exact wording: "<new>"\. <saysToday>/);
        expect(checkpoint).toMatch(/list the change \*\*first\*\* under "Resolve before approval"/);
        expect(checkpoint).toMatch(/Checked <checked>: <saysToday>/);
    });

    it("leaves an unresolved change as written, for the cross-reference check", () => {
        expect(checkpoint).toMatch(/\*\*`unresolved`\*\* → leave the line as written/);
    });

    it("never makes the change itself (D10)", () => {
        expect(checkpoint).toMatch(/The stage never makes the change itself\.\*\* It does not edit the text of the epic issue or of any story issue/);
    });

    it("states that the stage never edits the text of the epic or a story, and that moving the epic's labels is its one write to the epic (G17, G25)", () => {
        expect(flat).toMatch(/never edits the text of the epic issue or of any story issue\*\*, on any path/);
        expect(flat).toMatch(/Its one write to the epic issue is moving the epic's labels/);
        expect(flat).toMatch(/It never touches a story issue\./);
    });

    it("edits no issue body but the record's, and changes only labels on the epic", () => {
        const edits: string[] = [...stage.matchAll(/gh issue edit (\S+)[^\n]*/g)].map((m: RegExpMatchArray) => m[0]);
        expect(edits.length).toBeGreaterThan(0);
        for (const edit of edits) {
            if (edit.startsWith("gh issue edit <epic-issue>")) {
                expect(edit, edit).not.toMatch(/--body|--title/);
                expect(edit, edit).toMatch(/-label/);
            } else {
                expect(edit, edit).toMatch(/^gh issue edit (<record>|\$RECORD) /);
            }
        }
    });

    it("records a design split as an Epic commitment affected, never as an edit to the story", () => {
        expect(flat).not.toMatch(/split is an edit to/);
        expect(flat).not.toMatch(/as an edit to that story/);
        expect(component("agents/nxs-architect.md").replace(/\s+/g, " ")).not.toMatch(/as an edit to that story/);
    });
});
