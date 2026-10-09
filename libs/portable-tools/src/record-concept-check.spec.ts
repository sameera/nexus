/**
 * `nexus record-concept-check` — the quote check and the concept-section rules at the record
 * checkpoint (epic #896, story #899, D8 and D9).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkConceptSection, runRecordConceptCheck, type ConceptProblem } from "./record-concept-check";
import type { StorePage } from "./reading-list";

const PAGE_TEXT: Record<string, string> = {
    distiller: "# Distiller\n\nIt infers the concept mapping itself.\nThe pipeline emits no structured\nconcept list.\n",
};

function record(opts: { section: string; tradeOff?: string }): string {
    return [
        "## Guarantees",
        "",
        "- G1. A thing. (D4)",
        "",
        "## Concept-store changes",
        "",
        opts.section,
        "",
        "## Design rationale and mechanism",
        "",
        "### Decisions and reasons",
        "",
        "#### D4 — A decision",
        "",
        "- **Decision:** a thing.",
        "- **Why:** a reason.",
        `- **Trade-off:** ${opts.tradeOff ?? "It reverses the recorded reasoning that a list made early guesses boundaries."}`,
        "- **Delivered by:** #899",
        "- **Guarantees:** G1",
        "",
    ].join("\n");
}

const PAGES: StorePage[] = [{ name: "distiller", title: "Distiller", aliases: [], touches: [], status: "active" }];
const read = (name: string): string | undefined => PAGE_TEXT[name];

function problems(body: string): ConceptProblem[] {
    return checkConceptSection(body, PAGES, read);
}

const PAGES_READ = "This record read the concept page distiller.";
const CHANGE = '- distiller page: "It infers the concept mapping itself." becomes "It infers; the list is never a drain input." (D4)';

describe("checkConceptSection", () => {
    it("passes a change whose quote appears on the page and whose decision states a trade-off", () => {
        expect(problems(record({ section: `${PAGES_READ}\n\n${CHANGE}` }))).toEqual([]);
    });

    it("matches a quote that the page hard-wraps, with whitespace normalised", () => {
        const change = '- distiller page: "The pipeline emits no structured concept list." becomes "The list is read." (D4)';
        expect(problems(record({ section: `${PAGES_READ}\n\n${change}` }))).toEqual([]);
    });

    it("stops a quote that does not appear on the page, naming the line", () => {
        const change = '- distiller page: "It never infers anything." becomes "x" (D4)';
        const found = problems(record({ section: `${PAGES_READ}\n\n${change}` }));
        expect(found).toHaveLength(1);
        expect(found[0].message).toMatch(/does not appear/);
        expect(found[0].line).toBeGreaterThan(0);
    });

    it("stops a change to a page that does not exist", () => {
        const change = '- ghost page: "x" becomes "y" (D4)';
        expect(problems(record({ section: `${PAGES_READ}\n\n${change}` }))[0].message).toMatch(/no page|not found/i);
    });

    it("stops a change that cites no decision", () => {
        const change = '- distiller page: "It infers the concept mapping itself." becomes "y".';
        expect(problems(record({ section: `${PAGES_READ}\n\n${change}` }))[0].message).toMatch(/cite/i);
    });

    it("stops a change line it cannot read as old and new wording, because it cannot be checked", () => {
        expect(problems(record({ section: `${PAGES_READ}\n\n- distiller page needs a rewrite (D4)` }))[0].message).toMatch(/cannot be read/i);
    });

    it("refuses a cited decision whose trade-off is none", () => {
        const found = problems(record({ section: `${PAGES_READ}\n\n${CHANGE}`, tradeOff: "none" }));
        expect(found.map((p) => p.message).join(" ")).toMatch(/trade-off/i);
    });

    it("refuses a cited decision that is not in the record", () => {
        const change = CHANGE.replace("(D4)", "(D9)");
        expect(problems(record({ section: `${PAGES_READ}\n\n${change}` })).map((p) => p.message).join(" ")).toMatch(/D9/);
    });

    it("requires the no-change sentence when the design changes no page", () => {
        expect(problems(record({ section: PAGES_READ })).map((p) => p.message).join(" ")).toMatch(/No concept-store change\./);
        expect(problems(record({ section: `${PAGES_READ}\n\nNo concept-store change.` }))).toEqual([]);
    });

    it("requires the pages-read sentence", () => {
        expect(problems(record({ section: "No concept-store change." })).map((p) => p.message).join(" ")).toMatch(/pages-read/);
    });

    it("refuses the no-change sentence beside a stated change", () => {
        expect(problems(record({ section: `${PAGES_READ}\n\nNo concept-store change.\n\n${CHANGE}` })).length).toBeGreaterThan(0);
    });

    it("leaves a record with no Concept-store changes section alone, as an earlier record is", () => {
        expect(problems("## Guarantees\n\n- G1. A thing. (D1)\n")).toEqual([]);
    });
});

describe("runRecordConceptCheck", () => {
    let dir = "";
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    function setup(section: string): { argv: string[]; run: () => { code: number; out: string } } {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "concept-check-"));
        fs.mkdirSync(path.join(dir, "concepts"));
        fs.writeFileSync(path.join(dir, "concepts", "distiller.md"), `---\ntitle: "Distiller"\nstatus: active\n---\n${PAGE_TEXT.distiller}`);
        fs.writeFileSync(path.join(dir, "record.md"), record({ section }));
        const argv: string[] = ["--draft", "record.md", "--store", "concepts"];
        return {
            argv,
            run: () => {
                const out: string[] = [];
                const code: number = runRecordConceptCheck(argv, { cwd: dir, stdout: (l) => out.push(l), stderr: (l) => out.push(l) });
                return { code, out: out.join("\n") };
            },
        };
    }

    it("exits 0 for a clean record and 1, naming the line, for a mismatch", () => {
        expect(setup(`${PAGES_READ}\n\n${CHANGE}`).run().code).toBe(0);
        const bad = setup(`${PAGES_READ}\n\n- distiller page: "nope" becomes "y" (D4)`).run();
        expect(bad.code).toBe(1);
        expect(bad.out).toMatch(/does not appear/);
    });
});
