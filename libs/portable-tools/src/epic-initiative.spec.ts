/**
 * A coherent decomposition files an initiative (epic #705, decision record #786).
 *
 * `/nxs.epic` is markdown a model follows, so what the lead is asked, when, and what each answer
 * files is visible nowhere in a type. The parts of that contract the record states as guarantees are
 * asserted here against the authored command, because a later edit that restores the old wording —
 * a recommended option, an objective the model may withhold, a stub that is never a sub-issue of
 * anything — would otherwise pass every other check.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const AUTHORED: string = path.join(REPO_ROOT, "components");

function read(rel: string): string {
    return fs.readFileSync(path.join(AUTHORED, rel), "utf8");
}

/**
 * The text from one heading up to the next `stop` heading. The stop is named rather than derived
 * from heading depth, because the command's fenced examples carry headings of their own.
 */
function section(body: string, heading: string, stop: string): string {
    const start: number = body.indexOf(heading);
    if (start === -1) return "";
    const rest: string = body.slice(start + heading.length);
    const next: number = rest.indexOf(`\n${stop}`);
    return next === -1 ? rest : rest.slice(0, next);
}

const EPIC: string = read("commands/nxs.epic.md");
const GATE: string = section(EPIC, "## Phase 2 — Right-size gate", "## Phase 2b");
const GATE_FLAT: string = GATE.replace(/\s+/g, " ");

describe("the lead decides whether a decomposition serves one objective (story #706)", () => {
    it("offers the filing option in two versions on both oversized gates (D1)", () => {
        expect(GATE).toMatch(/^\| \*\*split-initiative\*\* \|/m);
        expect(GATE).toMatch(/^\| \*\*split-flat\*\* \|/m);
        expect(GATE).toMatch(/^\| \*\*stubs-initiative\*\* \|/m);
        expect(GATE).toMatch(/^\| \*\*stubs-flat\*\* \|/m);
    });

    it("marks neither version as recommended (D1)", () => {
        const rows: string[] = GATE.split("\n").filter((line) => /^\| \*\*(split|stubs)-(initiative|flat)\*\* \|/.test(line));
        expect(rows).toHaveLength(4);
        for (const row of rows) expect(row).not.toMatch(/recommended/i);
        expect(GATE_FLAT).toMatch(/Neither version of the filing option is marked as recommended/);
    });

    it("names the two versions as the canonical verbs the choice tool is called with", () => {
        const convention: string = section(EPIC, "## Interaction convention — actionable choice gates", "## Prose convention");
        for (const verb of ["split-initiative", "split-flat", "stubs-initiative", "stubs-flat"]) {
            expect(convention).toContain(`\`${verb}\``);
        }
    });

    it("always proposes an objective for two or more goals, and never lets the model withhold it (D2)", () => {
        expect(GATE_FLAT).toMatch(/With two or more goals, \*\*always propose an objective\*\*/);
        expect(GATE_FLAT).toMatch(/You may not withhold it/);
        expect(GATE_FLAT).toMatch(/The lead's decline is the only filter/);
    });

    it("proposes no objective for a one-goal decomposition (D3)", () => {
        expect(GATE_FLAT).toMatch(/With one goal there is no set to group[^.]*files the stub flat, and propose no objective/);
    });

    it("proposes no objective on any other path that files stubs (D3, G3)", () => {
        const others: string = GATE_FLAT.match(/\*\*No other path proposes an objective\.\*\*[^\n]*?no initiative\./)?.[0] ?? "";
        expect(others).toMatch(/deferral stub/);
        expect(others).toMatch(/`nexus close` files for deferred scope \(however many\)/);
        expect(others).toMatch(/intake lane's follow-ups/);
        expect(others).toMatch(/one-goal decomposition/);
        expect(others).toMatch(/successors of a stub that already sits under an initiative/);
    });

    it("takes the objective from the discovery's destination, in its own words (D4, G5)", () => {
        expect(GATE_FLAT).toMatch(/\*\*Discovery mode:\*\* the objective is the discovery's destination, copied in its own words/);
        expect(GATE_FLAT).toMatch(/It may claim nothing the description does not/);
    });

    it("shows the objective, the order and every reach statement before the lead chooses (D4, G6)", () => {
        expect(GATE).toContain("**Proposed objective:**");
        expect(GATE).toContain("**Execution order, and how much of the objective each reaches:**");
        expect(GATE_FLAT).toMatch(/accepts or declines the objective, the order and the reach statements as \*\*one unit\*\*/);
        expect(GATE_FLAT).toMatch(/Repeat the proposal inside the `AskUserQuestion` call/);
    });

    it("counts a reworded objective as an acceptance in the lead's words (D1)", () => {
        expect(GATE_FLAT).toMatch(/rewords the objective counts as accepting it, in the lead's words/);
    });

    it("creates nothing before the lead has answered (G1)", () => {
        expect(GATE_FLAT).toMatch(/\*\*Do NOT proceed without an explicit choice\.\*\* Nothing is created on GitHub before it/);
    });

    it("files a declined proposal exactly as a flat filing, with no initiative and no parent link (G4)", () => {
        expect(GATE_FLAT).toMatch(
            /\*\*split-flat\*\* \(L\) \/ \*\*stubs-flat\*\* \(XL\/XXL\)[^\n]*?exactly the issues, labels and links a flat filing files, with no initiative and no parent link/,
        );
        expect(GATE_FLAT).toMatch(/Declining needs no reason and is not an error/);
    });
});
