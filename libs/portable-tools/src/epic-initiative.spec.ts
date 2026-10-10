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

const STUBS: string = section(EPIC, "## Phase 2b — Emit decomposition stubs", "## Phase 3");
const UNDER: string = section(STUBS, "### Under an initiative", "## Phase 3");
const UNDER_FLAT: string = UNDER.replace(/\s+/g, " ");

describe("the initiative states the objective, the order, and what each epic reaches (story #707)", () => {
    it("resolves the initiative marker before the gate, through the shared settings (D5)", () => {
        expect(GATE).toContain("nexus config resolve initiative-label");
        expect(GATE).toContain("nexus config resolve initiative-type");
        expect(GATE).toContain("nexus config resolve classification");
    });

    it("offers only the flat filing, and names the missing setting, where no initiative type is declared (G17)", () => {
        expect(GATE_FLAT).toMatch(/`types`[^.]*`initiative-type` resolves to nothing[^.]*cannot mark an initiative/);
        expect(GATE_FLAT).toMatch(/offer only the flat filing/i);
        expect(GATE_FLAT).toMatch(/`github\.initiative-type`/);
        expect(GATE_FLAT).toMatch(/Propose no objective/);
    });

    it("files the initiative first, as its own one-item batch, with the initiative marker and no parent (D6, G7)", () => {
        expect(UNDER_FLAT).toMatch(/before step 4/i);
        expect(UNDER).toContain('nexus create-story "${RUN_DIR}/initiative"');
        expect(UNDER).toContain('--classification-label "<initiative-label>"');
        expect(UNDER).toContain('--classification-type "<initiative-type>"');
        const item: string = UNDER.match(/```markdown\n---\nref: "INITIATIVE"[\s\S]*?```/)?.[0] ?? "";
        expect(item).not.toBe("");
        expect(item).not.toMatch(/^parent:/m);
    });

    it("gives the initiative neither the epic marker nor the unplanned label (G11)", () => {
        const item: string = UNDER.match(/```markdown\n---\nref: "INITIATIVE"[\s\S]*?```/)?.[0] ?? "";
        expect(item).not.toMatch(/^labels:/m);
        expect(UNDER_FLAT).toMatch(/neither the epic classification nor the unplanned label/);
    });

    it("states the objective and one ordered list with a reach statement per stub, and no table (D7, G9, G10)", () => {
        const item: string = UNDER.match(/```markdown\n---\nref: "INITIATIVE"[\s\S]*?```/)?.[0] ?? "";
        expect(item).toContain("## Execution order");
        expect(item).toMatch(/^1\. STUB-<NN> <goal title> — <reach statement/m);
        expect(item).not.toMatch(/^\|/m);
        expect(UNDER_FLAT).toMatch(/no table and no other list of the stubs/);
        expect(UNDER_FLAT).toMatch(/exactly as (it was|they were) (accepted|shown) at the gate/);
    });

    it("keeps the initiative's number in the run folder, so a repeat files no second one (G16)", () => {
        expect(UNDER).toContain("--keep-manifest");
        expect(UNDER_FLAT).toMatch(/never files a second initiative/);
    });

    it("writes the stubs' issue numbers into the order once the stubs exist (D6, G8)", () => {
        expect(UNDER_FLAT).toMatch(/after step 4/i);
        expect(UNDER_FLAT).toMatch(/replace each `STUB-<NN>` with the `#<issue>`/);
        expect(UNDER).toMatch(/gh issue edit "\$\{INITIATIVE_URL\}" --body-file/);
        expect(UNDER_FLAT).toMatch(/changes nothing else/);
    });

    it("removes the run folder only after every initiative step is complete (D6)", () => {
        expect(UNDER_FLAT).toMatch(/Step 6 runs only after/);
    });
});

const ENTRY: string = section(EPIC, "## Phase 0 — Resolve entry mode", "## Interaction convention").replace(/\s+/g, " ");
const OVERSIZED: string = ENTRY.match(/\*\*When a promoted stub proves oversized\.\*\*.*$/)?.[0] ?? "";
const STUBS_FLAT: string = STUBS.replace(/\s+/g, " ");

describe("every stub in a coherent decomposition hangs under its initiative (story #708)", () => {
    it("names the initiative as each stub's parent, through the guarded filer and no other path (D6, G12)", () => {
        expect(UNDER).toContain('parent: "#<INITIATIVE>"');
        expect(UNDER_FLAT).toMatch(/the filer reads what that parent is filed as before it creates anything/i);
        expect(UNDER_FLAT).toMatch(/Never attach a stub by hand/);
    });

    it("no longer says a stub is never a sub-issue of anything (D8)", () => {
        expect(EPIC).not.toMatch(/never a sub-issue of\s+anything/);
        expect(STUBS_FLAT).toMatch(/A stub is a sub-issue only of an initiative, and never of an epic/);
        expect(STUBS_FLAT).toMatch(/No `parent:` key on a flat filing/);
    });

    it("reads the initiative's children back and compares them with the set (D9)", () => {
        expect(UNDER).toMatch(/gh api "repos\/<owner>\/<repo>\/issues\/\$\{INITIATIVE\}\/sub_issues"/);
        expect(UNDER_FLAT).toMatch(/every stub's number must be in that list/i);
    });

    it("reports the run incomplete and keeps the run folder when a stub is missing, then retries by re-running (G15)", () => {
        expect(UNDER_FLAT).toMatch(/If any stub is missing, the run is \*\*incomplete\*\*/);
        expect(UNDER_FLAT).toMatch(/keep the run folder/i);
        expect(UNDER_FLAT).toMatch(/re-run the same step 4 command\. The filer[^.]*retries the parent link/i);
        expect(UNDER_FLAT).toMatch(/Step 6 runs only after[^.]*every stub is one of its children/);
    });

    it("files the successors of a split stub under the same initiative, proposing no objective (D10, G20)", () => {
        expect(OVERSIZED).toMatch(/sits under an initiative/);
        expect(OVERSIZED).toMatch(/each successor names that same initiative as its `parent:`/);
        expect(OVERSIZED).toMatch(/Propose no objective/);
        expect(OVERSIZED).toMatch(/file no second initiative/i);
        expect(OVERSIZED).toMatch(/Do not edit the initiative's body/);
    });

    it("decides whether the stub's parent is an initiative from the declared marker", () => {
        expect(OVERSIZED).toMatch(/nexus config resolve initiative-label/);
        expect(OVERSIZED).toMatch(/Any other parent, or none, files the successors flat/);
    });

    it("promotes a stub under an initiative by the same steps, leaving it where it is (G21, G22)", () => {
        expect(ENTRY).toMatch(/\*\*Promotion is unchanged by an initiative\.\*\*/);
        expect(ENTRY).toMatch(/never detaches the stub, moves it, or edits the initiative/);
        expect(ENTRY).toMatch(/stories and its decision record are filed under the epic/);
    });

    it("names the resolver's refusal of an initiative among the diagnostics it reports verbatim (D11)", () => {
        expect(ENTRY).toMatch(/`is-an-initiative` \(the number is an initiative/);
    });

    it("documents the refusal where the resolver's contract is stated", () => {
        const skill: string = read("skills/nxs-epic-resolve/SKILL.md").replace(/\s+/g, " ");
        expect(skill).toMatch(/## Initiatives/);
        expect(skill).toMatch(/`is-an-initiative`/);
        expect(skill).toMatch(/adds no failure for an issue that is not an initiative/);
    });
});
