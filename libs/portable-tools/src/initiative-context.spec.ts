/**
 * An initiative carries the planning context of its epics (epic #850, decision record #961).
 *
 * The folder and the pointer sentence are code, asserted through the `nexus initiative-context`
 * verb a command body calls. What `/nxs.epic` shows the lead, keeps and files is markdown a model
 * follows, so the guarantees the record states about it are asserted against the authored command.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { INITIATIVE_STORE_PATH } from "@nexus/workspace/pipeline-stores";
import { parsePointer } from "./initiative-context";
import { DISPATCH_NAMES, runNexusCli, type CliIo } from "./nexus-cli";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const AUTHORED: string = path.join(REPO_ROOT, "components");

function read(rel: string): string {
    return fs.readFileSync(path.join(AUTHORED, rel), "utf8");
}

/** The text from one heading up to the next `stop` heading. */
function section(body: string, heading: string, stop: string): string {
    const start: number = body.indexOf(heading);
    if (start === -1) return "";
    const rest: string = body.slice(start + heading.length);
    const next: number = rest.indexOf(`\n${stop}`);
    return next === -1 ? rest : rest.slice(0, next);
}

function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

async function cli(...argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
    const out: string[] = [];
    const err: string[] = [];
    const io: CliIo = { cwd: REPO_ROOT, stdout: (s) => out.push(s), stderr: (s) => err.push(s) };
    const code: number = await runNexusCli(["initiative-context", ...argv], io);
    return { code, out, err };
}

describe("nexus initiative-context names one folder per initiative (story #851, D1)", () => {
    it("puts initiative N's context in the initiative store, named for its issue number", async () => {
        const r = await cli("path", "--initiative", "832");
        expect(r.code).toBe(0);
        expect(r.out).toEqual([path.join(REPO_ROOT, INITIATIVE_STORE_PATH, "initiative-832")]);
    });

    it("keeps the store outside the queue and the discovery store (G1)", async () => {
        const r = await cli("path", "--initiative", "#832");
        expect(path.relative(REPO_ROOT, r.out[0])).not.toMatch(/^\.nexus\/(queue|discovery)\//);
    });

    it("refuses a path request with no initiative number", async () => {
        const r = await cli("path");
        expect(r.code).toBe(2);
        expect(r.out).toEqual([]);
    });

    it("refuses a malformed number and an unknown subverb", async () => {
        expect((await cli("path", "--initiative", "abc")).code).toBe(2);
        expect((await cli("move")).code).toBe(2);
    });

    it("is a dispatch name a command body may write", () => {
        expect(DISPATCH_NAMES).toContain("initiative-context path");
        expect(DISPATCH_NAMES).toContain("initiative-context pointer");
    });
});

describe("the initiative body names where the context is kept (story #851, D3)", () => {
    it("drafts the pointer with a placeholder before the initiative has a number", async () => {
        const r = await cli("pointer");
        expect(r.code).toBe(0);
        expect(r.out[0]).toContain("<INITIATIVE>");
        expect(parsePointer(r.out[0])).toBeNull();
    });

    it("names the same folder `path` names once the number is filled in", async () => {
        const drafted: string = (await cli("pointer")).out[0];
        const filled: string = drafted.replace("<INITIATIVE>", "832");
        expect(filled).toBe((await cli("pointer", "--initiative", "832")).out[0]);
        expect(filled).toContain(`\`${path.relative(REPO_ROOT, (await cli("path", "--initiative", "832")).out[0])}/\``);
        expect(parsePointer(`Objective.\n\n## Planning context\n\nSummary.\n\n${filled}\n`)).toBe(832);
    });

    it("recognises no pointer in a body that never carried one", () => {
        expect(parsePointer("Objective.\n\n## Execution order\n\n1. #12 Goal — reached\n")).toBeNull();
    });
});

const EPIC: string = read("commands/nxs.epic.md");
const GATE: string = section(EPIC, "## Phase 2 — Right-size gate", "## Phase 2b");
const GATE_FLAT: string = flat(GATE);
const STUBS: string = section(EPIC, "## Phase 2b — Emit decomposition stubs", "## Phase 3");
const UNDER: string = section(STUBS, "### Under an initiative", "## Phase 3");
const UNDER_FLAT: string = flat(UNDER);
const ITEM: string = UNDER.match(/```markdown\n---\nref: "INITIATIVE"[\s\S]*?```/)?.[0] ?? "";

describe("filing an initiative keeps the planning context that produced it (story #851)", () => {
    it("shows the split reasoning, the deferred scope and the summary at the consent gate (D2, G5)", () => {
        expect(GATE).toContain("**Why this split:**");
        expect(GATE).toContain("**Deferred:**");
        expect(GATE).toContain("**Context summary:**");
        expect(GATE).toContain("nexus initiative-context pointer");
    });

    it("repeats all of it inside the consent question, so nothing kept was off screen (D2, D3, G5)", () => {
        expect(GATE_FLAT).toMatch(
            /Repeat the proposal inside the `AskUserQuestion` call itself[^.]*the split reasoning, the deferred scope, the context summary and the pointer sentence/,
        );
    });

    it("repeats the split table inside the consent question, because the kept context holds it (D2, G5)", () => {
        expect(UNDER_FLAT).toMatch(/`context\.md`: [^.]*the split table/);
        expect(GATE_FLAT).toMatch(/Repeat the proposal inside the `AskUserQuestion` call itself[^.]*the split table/);
    });

    it("keeps only text the lead supplied or saw at the gate, and never the typed description (D2, G5, G7, G29)", () => {
        expect(GATE_FLAT).toMatch(/The context holds only text the lead supplied or saw at this gate/);
        expect(GATE_FLAT).toMatch(/The lead's typed capability description is never kept/);
        expect(UNDER_FLAT).toMatch(/Never write the run's `source\.md` or the lead's typed capability description into the context/);
    });

    it("keeps every resolved discovery decision in full, pointing nowhere into the discovery folder (D2, G6)", () => {
        expect(UNDER_FLAT).toMatch(/`discovery\.md` \(discovery mode only\): the discovery document, then every resolved ticket[^.]*in full with its decision and its reasoning/);
        expect(UNDER_FLAT).toMatch(/no line of this file may point into it/);
    });

    it("keeps and files nothing before the lead answers, and keeps nothing on a decline (G4, G25)", () => {
        expect(GATE_FLAT).toMatch(/Nothing is created on GitHub before it, and no context is kept anywhere before it/);
        expect(GATE_FLAT).toMatch(/filed flat: exactly the issues, labels and links a flat filing files, with no initiative and no parent link\. No context is kept anywhere/);
    });

    it("files the initiative first, then copies the context into the folder the toolkit names (D1, D3, G1)", () => {
        const filed: number = UNDER.indexOf('nexus create-story "${RUN_DIR}/initiative"');
        const copied: number = UNDER.indexOf('nexus initiative-context path --initiative "${INITIATIVE}"');
        expect(filed).toBeGreaterThan(-1);
        expect(copied).toBeGreaterThan(filed);
        expect(UNDER_FLAT).toMatch(/Write nothing under the queue or the discovery folder/);
    });

    it("carries the summary and the placeholder pointer in the body, and still no table (D3, G8)", () => {
        expect(ITEM).toContain("## Planning context");
        expect(ITEM).toContain("<the context summary, exactly as shown at the gate>");
        expect(ITEM).toMatch(/<the pointer sentence[^>]*<INITIATIVE> placeholder>/);
        expect(ITEM).not.toMatch(/^\|/m);
    });

    it("fills the number in the run's existing single body edit, and nowhere else (D3, G8, G28)", () => {
        expect(UNDER_FLAT).toMatch(/replace the pointer's `<INITIATIVE>` placeholder with `\$\{INITIATIVE\}`/);
        expect(UNDER_FLAT).toMatch(/this is the run's own single edit to the initiative's body/);
        expect(UNDER.match(/gh issue edit/g)).toHaveLength(1);
    });

    it("repeats safely: one initiative, one context folder (G9)", () => {
        expect(UNDER_FLAT).toMatch(/never files a second initiative/);
        expect(UNDER_FLAT).toMatch(/A repeat copies the same files over themselves, so the initiative still has exactly one context folder/);
    });

    it("deletes the run folder only once the context is in place and the body names the number (G10)", () => {
        expect(UNDER_FLAT).toMatch(/\*\*Step 6 runs only after\*\*[^.]*its context is in its store folder[^.]*names every stub and its own context folder by issue number/);
    });

    it("commits nothing, and leaves the folder for the lead to commit (G3)", () => {
        expect(UNDER_FLAT).toMatch(/Do not commit the folder: the lead commits it/);
        expect(STUBS).toMatch(/also commit and push the initiative's context folder/);
    });
});

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "initiative-plan-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

describe("nexus initiative-context check-plan refuses a plan it cannot keep (story #852, D4)", () => {
    it("accepts a plan that exists and has content, naming it", async () => {
        const dir: string = makeDir();
        const plan: string = path.join(dir, "session-plan.md");
        fs.writeFileSync(plan, "# Plan\n\nDecided: one store per initiative.\n");
        const r = await cli("check-plan", "--plan", plan);
        expect(r.code).toBe(0);
        expect(JSON.parse(r.out[0])).toMatchObject({ path: plan, name: "session-plan.md", keptAs: "plan-session-plan.md" });
    });

    it("refuses a missing plan and names the file (G11)", async () => {
        const plan: string = path.join(makeDir(), "nowhere.md");
        const r = await cli("check-plan", "--plan", plan);
        expect(r.code).toBe(1);
        expect(r.out).toEqual([]);
        expect(r.err.join("\n")).toMatch(/missing-plan/);
        expect(r.err.join("\n")).toContain(plan);
    });

    it("refuses an empty plan and names the file (G11)", async () => {
        const plan: string = path.join(makeDir(), "blank.md");
        fs.writeFileSync(plan, "  \n\n");
        const r = await cli("check-plan", "--plan", plan);
        expect(r.code).toBe(1);
        expect(r.err.join("\n")).toMatch(/empty-plan/);
        expect(r.err.join("\n")).toContain(plan);
    });

    it("refuses a folder named as a plan", async () => {
        const dir: string = makeDir();
        const r = await cli("check-plan", "--plan", dir);
        expect(r.code).toBe(1);
        expect(r.err.join("\n")).toContain(dir);
    });

    it("needs the plan named", async () => {
        expect((await cli("check-plan")).code).toBe(2);
    });
});

const ENTRY: string = flat(section(EPIC, "# User Input", "## Phase 1"));
const SOURCE: string = flat(section(EPIC, "## Phase 4 — Write the draft", "## Phase 4b"));

describe("a lead attaches a design plan to the initiative being filed (story #852)", () => {
    it("takes the plan by its own argument, checked before anything is drafted (D4, G11)", () => {
        expect(ENTRY).toMatch(/\*\*`--plan <path>`\*\*/);
        expect(ENTRY).toContain("nexus initiative-context check-plan --plan <path>");
        expect(ENTRY).toMatch(/Non-zero exit → stop before drafting and report the diagnostic verbatim/);
    });

    it("accepts it only where an initiative can be filed, and says why elsewhere (D4)", () => {
        expect(ENTRY).toMatch(/`--plan` is accepted only in intent mode and discovery mode/);
        expect(ENTRY).toMatch(/promotion mode and `--from` refuse it/i);
    });

    it("feeds the plan to the decomposition after the typed description (D4, G30)", () => {
        expect(SOURCE).toMatch(/then the attached plan, verbatim, under a heading naming its file/);
    });

    it("names the plan beside the objective inside the consent question (D4, G12)", () => {
        expect(GATE).toContain("**Attached plan:**");
        expect(GATE_FLAT).toMatch(/the objective and the attached plan's file name in the question text/);
    });

    it("keeps the plan byte for byte, only when an initiative is filed (D4, G12)", () => {
        expect(UNDER).toContain('cp "<plan path>" "${RUN_DIR}/initiative/context/<keptAs>"');
        expect(UNDER_FLAT).toMatch(/byte for byte/);
    });

    it("says the plan was kept nowhere whenever no initiative is filed (D4, G13)", () => {
        expect(GATE_FLAT).toMatch(/\*\*An attached plan with no initiative\.\*\*.*?the plan was kept nowhere, and the run says so/);
        for (const path of [/declines/, /cannot mark an initiative/, /one-goal split/, /fits a single epic/]) {
            expect(GATE_FLAT.match(/\*\*An attached plan with no initiative\.\*\*.*?(?=\*\*Do NOT proceed)/)?.[0] ?? "").toMatch(path);
        }
    });
});

const PROMOTION: string = flat(section(EPIC, "**Promotion under an initiative also reads the initiative's kept context.**", "    - `$ARGUMENTS` contains **`--discovery"));
const RAZOR: string = read("skills/nxs-razor/SKILL.md");

describe("planning a stub under an initiative reads the initiative's context (story #853)", () => {
    it("looks the context up before drafting, through the one shared lookup (D5, G21)", () => {
        expect(PROMOTION).toContain("nexus initiative-context lookup --issue <n>");
        expect(PROMOTION).toMatch(/Before anything is drafted/);
    });

    it("stops before drafting, naming where the context was expected, when the checkout lacks it (D5, G15)", () => {
        expect(PROMOTION).toMatch(/Non-zero exit → stop before drafting and report the diagnostic verbatim\.\*\* `context-missing`[^.]*names a kept context that this checkout does not hold; it names where the context was expected/);
    });

    it("reads the body alone and says so when no context is kept (D5)", () => {
        expect(PROMOTION).toMatch(/\*\*`body-only`\*\*: the initiative has no kept context\. Say that no additional context was found/);
    });

    it("proceeds exactly as before for a stub with no initiative above it (G14)", () => {
        expect(PROMOTION).toMatch(/\*\*`no-initiative`\*\*: the stub has no initiative above it\. Promotion proceeds exactly as it does without this step/);
    });

    it("treats the context as asked, within the stub's own goal, and keeps a sibling's work out of scope (D6, G18, G19)", () => {
        expect(PROMOTION).toMatch(/part of what the lead asked for, within the stub's own goal/);
        expect(PROMOTION).toMatch(/an item the context assigns to another stub under the same initiative goes under Out of Scope, naming that stub\. It never becomes a story, and never a deferred stub/);
    });

    it("widens the razor's promotion-mode source text to match (D6, G18)", () => {
        const row: string = RAZOR.split("\n").find((line) => line.startsWith("| promotion |")) ?? "";
        expect(row).toMatch(/under an initiative, then the initiative's body and each file of its kept context, verbatim, each under a heading naming its origin/);
        expect(SOURCE).toContain('nexus initiative-context lookup --issue <n> --out "${DRAFT_DIR}/initiative-context.md"');
    });

    it("builds the reading list without the context (D6, G20)", () => {
        expect(SOURCE).toMatch(/pass `--input "\$\{DRAFT_DIR\}\/stub-source\.md"` instead\.\*\* The reading list is built from the stub body and the draft, never from the initiative's context/);
    });

    it("copies no part of the context into a filed issue, and still leaves the stub where it is (G16, G26)", () => {
        expect(PROMOTION).toMatch(/No part of the context is copied into a filed issue body or comment/);
        expect(PROMOTION).toMatch(/Promotion never detaches the stub, moves it, or edits the initiative/);
    });
});

const RECORD: string = read("commands/nxs.decision-record.md");
const RECORD_READ: string = flat(section(RECORD, "## Phase 0.45 — Read the initiative's kept context", "## Phase 0.5"));
const RECORD_ANALYSIS: string = flat(section(RECORD, "## Phase 1 — Architectural analysis", "## Phase 2"));

describe("the decision record reads the initiative's context (story #854)", () => {
    it("looks the context up before analysis, through the same lookup stub planning uses (D5, D7, G21)", () => {
        expect(RECORD_READ).toContain('nexus initiative-context lookup --issue <epic-issue> --out "${QDIR}/initiative-context.md"');
        expect(RECORD.indexOf("## Phase 0.45")).toBeLessThan(RECORD.indexOf("## Phase 1 — Architectural analysis"));
    });

    it("reads it on every path, revision included (D7, G21)", () => {
        expect(RECORD_READ).toMatch(/This runs on every path \(normal, import and revision\)/);
        expect(flat(RECORD)).toMatch(/Then run \*\*Phase 0\.4\*\* and \*\*Phase 0\.45\*\* \(both run on every path, revision included\)/);
    });

    it("stops before drafting when the checkout lacks a context the initiative names (D5, G15)", () => {
        expect(RECORD_READ).toMatch(/Non-zero exit → stop before drafting and report the diagnostic verbatim\.\*\* `context-missing`[^.]*it names where the context was expected/);
    });

    it("runs exactly as today for an epic with no initiative above it (G14)", () => {
        expect(RECORD_READ).toMatch(/\*\*`no-initiative`\*\*: the epic has no initiative above it\. Continue exactly as today/);
    });

    it("passes the context to the architect as settled decisions, stated with their reasoning (D7, G22)", () => {
        expect(RECORD_ANALYSIS).toMatch(/`INITIATIVE_CONTEXT` from Phase 0\.45, when present\):\*\* pass it the same way, as decisions \*\*already settled\*\*/);
        expect(RECORD_ANALYSIS).toMatch(/states each design decision the context settled in the record as decided, with the context's reasoning/);
    });

    it("turns a settled decision with no reasoning into an open clarification (D7, G23)", () => {
        expect(RECORD_ANALYSIS).toMatch(/A settled decision \*\*with no reasoning\*\* in the context becomes an \*\*Open Clarification\*\*\. Never invent the missing \*why\*/);
    });

    it("follows the epic where it and the context disagree, and names the departure (D7, G24)", () => {
        expect(RECORD_ANALYSIS).toMatch(/\*\*The epic wins\.\*\*[^.]*\.[^.]*the record follows the epic and names the departure from the context/);
    });

    it("copies no part of the context into the record or a comment, and never edits the initiative (G16)", () => {
        expect(RECORD_READ).toMatch(/This command never edits the initiative or its context folder,\*\* and copies no part of the context into the record or a comment/);
    });
});
