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
import { AC_CEILING, SECTION_LIMIT } from "@nexus/scope-razor/check";

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

    it("names all three drafting-time vocabularies the assertion covers", () => {
        const body: string = read(RAZOR).replace(/\s+/g, " ");
        expect(body).toMatch(/template placeholder/i);
        expect(body).toMatch(/observation marker/i);
        expect(body).toContain("{{…}}");
    });

    it("gives the observation marker one asserted sentinel rather than a bare warning symbol", () => {
        expect(read(RAZOR)).toContain("⚠️ razor:");
    });

    it("locates the materialized source text inside the checkout's run folder, not harness session scratch", () => {
        // Decision record #646 moved DRAFT_DIR to RUN_DIR, a folder *inside* the checkout under the
        // gitignored .nexus/tmp/planning/<run-name>/ (libs/epic-resolve/src/planning-dir.ts). The
        // razor is the higher-precedence text nxs.epic.md defers to on disagreement, so a stale claim
        // that source.md lives in harness session scratch would contradict the shipped location.
        const body: string = read(RAZOR);
        expect(body).not.toMatch(/harness session (scratch|temp)/i);
        expect(body).toMatch(/RUN_DIR/);
        expect(body).toMatch(/inside the checkout/i);
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

    it("asserts the story work-items too, so no filed body is clean only by transcription", () => {
        // The epic body is asserted and each story body is copied out of it — but a copy made by
        // hand is exactly the remembered-not-checked mode the derived body exists to end, and for a
        // six-story epic six of the seven bodies that reach GitHub are copies.
        expect(workItemStep()).toMatch(/razor-check[^\n]*--assert-clean/);
    });

    it("asserts them over the work-item files themselves, before create-story files any of them", () => {
        const step: string = workItemStep();
        expect(step).toContain("STORY-*.md");
        expect(step).toMatch(/file nothing/i);
    });
});

/** Phase 6's story-work-item step — from where the work-items are written to where they are filed. */
function workItemStep(): string {
    const phase: string = read("commands/nxs.epic.md");
    const start: number = phase.indexOf("3. **Write transient story work-items**");
    const end: number = phase.indexOf("4. **Create the story issues:**", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return phase.slice(start, end);
}

/** The numerals §5 writes its limits as words in; a limit cell ends with the number it bounds. */
const NUMERALS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** The rows of §5's table, so the numbers can be read out of the normative statement of them. */
function limitRows(skill: string): string[] {
    const start: number = skill.indexOf("## 5. The counted limits");
    const section: string = skill.slice(start, skill.indexOf("\n## ", start + 1));
    return section.split("\n").filter((line: string) => line.startsWith("| ") && !line.startsWith("| What"));
}

/** The number a limit cell bounds — the last numeral word in it ("three to five", "no more than five"). */
function limitOf(row: string): number {
    const words: string[] = row.split("|")[2].trim().toLowerCase().split(/\s+/);
    return NUMERALS[words[words.length - 1]];
}

describe("the razor's counted limits and content rules", () => {
    it("pin the checker's constants to the table, so a divergence fails a build rather than passing silently", () => {
        // §5 states the numbers and the checker implements them. Two copies that agree today drift
        // in silence; this is the assertion that makes the second copy answerable to the first.
        const rows: string[] = limitRows(read(RAZOR));
        expect(rows).toHaveLength(3);
        expect(limitOf(rows[0])).toBe(AC_CEILING);
        expect(limitOf(rows[1])).toBe(SECTION_LIMIT);
        expect(limitOf(rows[2])).toBe(SECTION_LIMIT);
    });

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

describe("the two gate conventions", () => {
    const skill: string = read(RAZOR);
    const flat: string = skill.replace(/\s+/g, " ");

    it("is one shared shape with a convention per gate, not one convention asserted for both", () => {
        expect(skill).toMatch(/## 8\. The gate conventions/);
        expect(flat).toContain("no implementation");
        expect(flat).toMatch(/### The shared shape/);
        expect(flat).toMatch(/### The planning gate's convention: addition/);
        expect(flat).toMatch(/### The design-record checkpoint's convention: removal/);
    });

    it("keeps the shared shape the two gates still have in common", () => {
        expect(flat).toMatch(/empty selection is identical to plain approval/i);
        expect(flat).toMatch(/refused, with the reason stated and the route named, never silently ignored/);
    });

    it("names addition as the planning gate's default and states what a plain approval files", () => {
        expect(flat).toMatch(/The default is \*\*addition\*\*/);
        expect(flat).toMatch(/A plain approval files the smallest usable version, and nothing else/);
        expect(flat).toMatch(/At least one story is always filed/);
    });

    it("names removal as the checkpoint's action and says why that gate has nothing to add to", () => {
        expect(flat).toMatch(/The action is \*\*removal\*\*/);
        expect(flat).toMatch(/a refuted alternative is not scope/i);
        expect(flat).toMatch(/nothing to add to/i);
    });

    it("renders the default as one pre-ticked list, where a number flips the line it names", () => {
        expect(flat).toMatch(/A ticked line is what a plain approval files/);
        expect(flat).toMatch(/A number flips the line it names/);
        expect(flat).toMatch(/one typed selection carries both directions/i);
    });

    it("writes the ticks into the prose, because a per-item widget cannot arrive pre-ticked", () => {
        expect(flat).toMatch(/cannot arrive pre-ticked/);
        expect(flat).toMatch(/an untouched box would read as \*drop it\*/);
        expect(flat).toMatch(/ticks are therefore \*\*written into the prose\*\*/);
    });

    it("orders each band by what it unlocks and says why a value ranking is refused", () => {
        expect(flat).toMatch(/what each item unlocks, and never a ranking by predicted value/);
        expect(flat).toMatch(/scoring its own additions/);
    });

    it("keeps a story opt-in either way and a sub-story criterion opt-out", () => {
        expect(flat).toMatch(/Opt-in where the necessity answer excludes it, opt-out where it includes it/);
        expect(flat).toMatch(/An \*\*asked-for\*\* criterion is not listed at all/);
        expect(flat).toMatch(/file with no criteria at all/);
    });

    it("ticks a boundary of either provenance, because the reviewer approves the whole boundary", () => {
        expect(flat).toMatch(/An assumption or an out-of-scope item\*\*, listed whatever its provenance and ticked/);
        expect(flat).toMatch(/boundary the smallest usable version \(§7\) was drawn inside/);
        expect(flat).toMatch(/\*\*Both provenances are listed\*\*/);
    });

    it("delivers the list verbatim in a fenced block, so the ticks and the numbers survive rendering", () => {
        expect(flat).toMatch(/fenced code block/);
        expect(flat).toMatch(/markdown list syntax/i);
        expect(flat).toMatch(/the tick and the number are the two things the selection names/i);
    });

    it("states that this file governs where a drafting stage's own wording disagrees with it", () => {
        expect(flat).toMatch(/Where a restatement and this file disagree, this file governs/);
        expect(flat).toMatch(/this page governs where a stage's own wording disagrees with it/i);
    });
});

describe("the approval digest", () => {
    const epic: string = read("commands/nxs.epic.md").replace(/\s+/g, " ");

    it("renders the filed set as one pre-ticked checklist the reviewer reads the default off", () => {
        expect(epic).toContain("### The filed set — untick to drop, tick to add");
        expect(epic).toMatch(/a ticked line is what a plain approval files/i);
        expect(epic).toMatch(/Type the numbers you want to flip, or nothing to take it as ticked/);
    });

    it("gives every number one meaning, so no group reads differently from another", () => {
        expect(epic).toMatch(/every number flips exactly one line/i);
        expect(epic).toMatch(/One typed selection carries the whole decision/);
    });

    it("renders the stories and the boundaries once, in the checklist and not also in the digest body", () => {
        expect(epic).toMatch(/\*\*The stories and the boundaries are not rendered here\.\*\*/);
        expect(epic).toMatch(/hold two sets in their head and diff them/);
    });

    it("keeps the ticks in prose rather than as question-widget checkboxes", () => {
        expect(epic).toMatch(/Do \*\*not\*\* render this as `AskUserQuestion` checkboxes/);
        expect(epic).toMatch(/cannot arrive pre-ticked/);
    });

    it("renders the checklist inside a fenced block rather than as live markdown", () => {
        expect(epic).toMatch(/inside a fenced code block/i);
        expect(epic).toMatch(/Do \*\*not\*\* render the checklist as live markdown/);
    });

    it("carries the ticked set into the question, because mid-turn markdown may not be seen", () => {
        expect(epic).toMatch(/mid-turn markdown is not guaranteed to reach the reviewer's screen/);
        expect(epic).toMatch(/carry the ticked set into the question itself/i);
    });

    it("offers three actions, so adding scope is one choice rather than a re-run", () => {
        expect(epic).toContain("**approve with changes**");
        expect(epic).toContain("**approve** —");
    });

    it("sorts the asked-for stories ahead of the model-added ones, each with the fragment that claims it", () => {
        expect(epic).toMatch(/asked-for before model-added/);
        expect(epic).toMatch(/you asked: "<the story's asked fragment, verbatim>"/);
    });

    it("orders the checklist by what each item unlocks, and leaves the reason for that to the razor", () => {
        expect(epic).toMatch(/in the order the `## Implementation Order` block unlocks it/);
        expect(epic).not.toMatch(/scoring its own additions/);
    });

    it("points at the razor for what a tick governs rather than restating the convention", () => {
        expect(epic).not.toMatch(/applies every listed removal/);
        expect(epic).toMatch(/What a tick governs, and why each kind is listed the way it is, is nxs-razor §8/);
        expect(epic).toMatch(/read §8 rather than re-deriving it\s+here/);
    });

    it("states only what a plain approval files, which is the gate's own behaviour and not the rule", () => {
        expect(epic).toMatch(/every model-added criterion\s+on it, and every boundary/);
    });

    it("discards what the reviewer does not take rather than banking it", () => {
        expect(epic).toMatch(/is discarded and leaves no trace anywhere/);
    });

    it("treats an untick the same as an item that arrived unticked, by the story's provenance", () => {
        expect(epic).toMatch(/the treatment follows the story's provenance, never how it came to be unticked/);
    });

    it("re-derives the necessity line from the filed set, since it reaches the issue", () => {
        expect(epic).toMatch(/Re-derive the `## Smallest Usable Version` line from the filed story set/);
    });

    it("treats an empty selection as a plain approval", () => {
        expect(epic).toMatch(/empty selection is identical to a plain approval/i);
    });

    it("applies the approved set before any issue is created", () => {
        expect(epic).toMatch(/before\*\* Phase 6 derives the filing body/);
    });

    it("re-checks closure over the approved set before it edits the draft's graph", () => {
        expect(epic).toMatch(/Re-check closure over the filed set — before any edit, over the graph as drafted/);
        expect(epic).toMatch(/nexus razor-check --draft "\$\{DRAFT_DIR\}\/epic\.md" --filed/);
    });

    it("re-parents nothing on the reviewer's behalf, so the apply-time arm can still fire", () => {
        expect(epic).toMatch(/nothing is re-parented on their behalf/i);
        expect(epic).toMatch(/no cascade follows and no edge is re-parented/i);
    });

    it("re-derives what the story set determined over the filed set", () => {
        expect(epic).toMatch(/re-derive what the story set determined/i);
    });

    it("takes the checklist's ticks, order and numbering from the checker rather than by hand", () => {
        expect(epic).toMatch(/nexus razor-offer --draft/);
        expect(epic).toMatch(/\*\*Transcribe it; derive nothing\.\*\*/);
    });

    it("derives the filing body with the checker, which asserts what it wrote", () => {
        expect(epic).toMatch(/nexus razor-check --draft "\$\{DRAFT_DIR\}\/epic\.md" --derive/);
    });

    it("writes the deferral count in the form the floor reads back", () => {
        expect(epic).toMatch(/\*\*deferred:\*\* <n> story\|stories/);
        expect(epic).toMatch(/`deferred:` line counts one story/);
    });
});

describe("the other drafting stages", () => {
    const record: string = read("commands/nxs.decision-record.md").replace(/\s+/g, " ");
    const discover: string = read("commands/nxs.discover.md").replace(/\s+/g, " ");

    it("load the razor rather than restating it", () => {
        expect(record).toContain("nxs-razor");
        expect(discover).toContain("nxs-razor");
        expect(record).toMatch(/this command restates none of it/);
    });

    it("render the record's cut list inside a fenced block, for the same reason the epic gate does", () => {
        expect(record).toMatch(/inside a fenced code block/i);
    });

    it("take the record cut list's content and numbering from the checker rather than rendering it by hand", () => {
        expect(record).toMatch(/nexus razor-offer --draft .* --record/);
        expect(record).toMatch(/\*\*Transcribe it; derive nothing\.\*\*/);
    });

    it("show the reviewer every invariant and every risk the model added, not the alternatives alone", () => {
        expect(record).toMatch(/every invariant and every risk the model added/i);
    });

    it("keep an invariant or a risk the lead asked for off the list, since striking one is a revise", () => {
        expect(record).toMatch(/an invariant or a risk the lead asked for is not listed/i);
    });

    it("let one typed selection cover every kind the list holds, so a number means one thing", () => {
        expect(record).toMatch(/One typed selection covers every kind the list holds/);
    });

    it("label the record's invariants and risks in the same two-valued form", () => {
        expect(record).toMatch(/Label every invariant and every risk/);
        expect(record).toContain("[inferred]");
    });

    it("label a discovery's questions and open entries, but never a resolution", () => {
        expect(discover).toContain("[inferred]");
        expect(discover).toMatch(/Resolutions are never labelled/);
    });

    it("check their own drafts with the shared checker and gain no gate agent", () => {
        expect(record).toContain("nexus razor-check");
        expect(discover).toContain("nexus razor-check");
        expect(record).toMatch(/no gate agent and gains none/);
    });

    it("check each asked fragment against the source text that stage was given", () => {
        expect(record).toMatch(/Materialize the run's source text/);
        expect(discover).toMatch(/Materialize the run's source text beside the discovery/);
    });

    it("strip the labels before the record body is filed, and assert that none survived", () => {
        expect(record).toContain("--assert-clean");
    });

    it("leave discovery's routing constraint intact while permitting the shared skill", () => {
        expect(discover).toMatch(/This is a routing constraint, not a ban on loading guidance/);
    });
});

describe("a refuted alternative", () => {
    const template: string = fs.readFileSync(path.join(REPO_ROOT, "common", "templates", "decision-record-template.md"), "utf8");
    const record: string = read("commands/nxs.decision-record.md").replace(/\s+/g, " ");

    it("points its template restatement at the section that states the rule normatively", () => {
        expect(template).toContain("nxs-razor §9");
        expect(read("agents/nxs-architect.md")).toContain("nxs-razor §9");
    });

    it("has no standing slot, fixed line or placeholder in the decision template", () => {
        expect(template).not.toMatch(/^- \*\*Refuted alternative:\*\*/m);
        expect(template).not.toContain("VIABLE_ALTERNATIVE_AND_WHY_IT_LOST");
    });

    it("is stated as offered-not-required where the architect authors", () => {
        expect(read("agents/nxs-architect.md")).toMatch(/offered, not required/);
        expect(read("agents/nxs-architect.md")).toContain("nxs-razor");
    });

    it("carries no provenance label, because viability rather than provenance discriminates it", () => {
        expect(read(RAZOR).replace(/\s+/g, " ")).toMatch(/The provenance rule does not reach here/);
    });

    it("is reported as a non-blocking observation when its reason names no trade-off", () => {
        expect(record).toMatch(/non-blocking observation/);
        expect(record).toMatch(/names no trade-off/);
    });

    it("is judged by the formatting stage rather than by the agent that wrote it", () => {
        expect(record).toMatch(/you are not the architect/i);
    });
});

describe("the record's pre-filing checkpoint", () => {
    const record: string = read("commands/nxs.decision-record.md").replace(/\s+/g, " ");

    it("gives the gate the command already refers to a phase of its own", () => {
        expect(record).toContain("## Phase 3.5 — Pre-filing checkpoint (MANDATORY STOP)");
    });

    it("precedes every path that creates or updates the record sub-issue", () => {
        expect(record).toMatch(/before every path that creates or updates the record sub-issue/i);
        expect(record).toMatch(/including `--revise`/);
    });

    it("lists every refuted alternative numbered and grouped by its decision", () => {
        expect(record).toContain("Refuted alternatives");
        expect(record).toMatch(/under the decision it belongs to/);
    });

    it("removes the named alternatives before any issue is created or updated", () => {
        expect(record).toMatch(/before any issue is created or updated/);
    });

    it("keeps the proceed-without-a-record exit the existing reference promises", () => {
        expect(record).toContain("**no record**");
    });

    it("treats an empty selection as plain approval", () => {
        expect(record).toMatch(/Naming nothing is identical to plain approval/);
    });

    it("asserts that no observation marker or placeholder token reaches the filed body", () => {
        expect(record).toMatch(/template placeholder token/i);
        expect(record).toMatch(/observation marker/i);
        expect(record).toContain("--assert-clean");
    });

    it("derives the filing body after the checkpoint, so the body is the one the reviewer approved", () => {
        expect(record).toContain("## Phase 3.6 — Derive the filing body");
        expect(record).toMatch(/before\*\* Phase 3\.6 derives the filing body/);
    });

    it("renders its observation with the sentinel the assertion looks for", () => {
        expect(read("commands/nxs.decision-record.md")).toContain("⚠️ razor: names no trade-off");
    });

    it("renders one pre-ticked checklist, so a plain approval is the set the reviewer read", () => {
        expect(record).toMatch(/every line arrives ticked/i);
        expect(record).toMatch(/\[x\]/);
    });

    it("flips exactly one line per number typed, the planning gate's idiom", () => {
        expect(record).toMatch(/a number .{0,40}flips (exactly )?one line/i);
    });

    it("keeps all four exits beside the checklist, the proceed-without-a-record one included", () => {
        expect(record).toContain("**approve as drafted**");
        expect(record).toContain("**approve with cuts**");
        expect(record).toContain("**revise**");
        expect(record).toContain("**no record**");
    });

    it("fetches the approved body only where there is one to freeze against", () => {
        expect(record).toMatch(/--approved-body/);
        expect(record).toMatch(/only when the (epic's )?record sub-issue is closed/i);
    });

    it("states the reason a frozen line refuses, and names the route that can change it", () => {
        expect(record).toMatch(/refused/i);
        expect(record).toMatch(/Phase 4\.5/);
    });
});

describe("the refusal the two gates share", () => {
    it("names approved content on the razor page, so the page and the record stage state one rule", () => {
        expect(read(RAZOR).replace(/\s+/g, " ")).toMatch(/a prior run already filed and approved/i);
    });
});

describe("the draft-time ordering block", () => {
    const skill: string = read(RAZOR);
    const epic: string = read("commands/nxs.epic.md");

    it("is stated normatively in the skill, keyed on story titles rather than positions", () => {
        expect(skill).toContain("## Implementation Order");
        expect(skill.replace(/\s+/g, " ")).toMatch(/titles are the only stable name a story has/i);
    });

    it("is written while the epic is drafted, not assigned after approval", () => {
        expect(epic).toContain("## Implementation Order");
        expect(epic.replace(/\s+/g, " ")).toMatch(/order the stories while you draft them/i);
    });

    it("is what the digest renders each story's blockers from, so the reviewer decides with the graph in view", () => {
        expect(digestSection().replace(/\s+/g, " ")).toMatch(/waits on/i);
    });

    it("is what filing derives its refs from, so the filed ordering is the one shown at approval", () => {
        expect(epic.replace(/\s+/g, " ")).toMatch(/derive .{0,40}from the draft's `## Implementation Order` block/i);
    });

    it("dies at filing, because the native dependency edges own the graph once the issues exist", () => {
        expect(epic.replace(/\s+/g, " ")).toMatch(/ordering block dies here/i);
        expect(skill.replace(/\s+/g, " ")).toMatch(/never read again/i);
    });
});

/** Phase 5's digest, from its heading to the phase that files. */
function digestSection(): string {
    const command: string = read("commands/nxs.epic.md");
    const start: number = command.indexOf("## Phase 5 — Approval digest");
    const end: number = command.indexOf("## Phase 6 — File the epic", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return command.slice(start, end);
}

describe("the closure rule", () => {
    const skill: string = read(RAZOR);
    const epic: string = read("commands/nxs.epic.md");

    it("lives in the shared checker, not in a gate's prose a model can drop", () => {
        expect(skill).toMatch(/## 11\. The closure rule/);
        expect(skill.replace(/\s+/g, " ")).toMatch(/both times in `nexus razor-check` rather than in a gate's prose/);
    });

    it("is one rule applied twice — over the named set while drafting, and over the approved set at apply time", () => {
        expect(skill.replace(/\s+/g, " ")).toMatch(/At drafting time.*At apply time/s);
        expect(skill.replace(/\s+/g, " ")).toMatch(/before any issue is created/);
    });

    it("blocks before the gate renders, so a set that cannot run is never shown to a reviewer", () => {
        expect(skill.replace(/\s+/g, " ")).toMatch(/blocks \*before the gate renders\*/);
        expect(epic.replace(/\s+/g, " ")).toMatch(/never reaches the reviewer/i);
    });

    it("names both stories when a named story waits on an excluded one", () => {
        expect(skill.replace(/\s+/g, " ")).toMatch(/names both stories and the draft it is in/);
    });

    it("raises nothing where there is no smallest-usable-version section, and adds no minimum-count rule", () => {
        expect(skill.replace(/\s+/g, " ")).toMatch(/carries no `## Smallest Usable Version` section raises \*\*no finding\*\*/);
        expect(skill.replace(/\s+/g, " ")).toMatch(/no minimum-count check of any kind/);
    });
});

describe("a story's own provenance label", () => {
    const epic: string = read("commands/nxs.epic.md");

    it("is written on the story heading, because it is what decides whether the story is filed", () => {
        expect(epic.replace(/\s+/g, " ")).toMatch(/label every story heading/i);
    });

    it("keeps the vocabulary two-valued at the granularity it now governs", () => {
        expect(read(RAZOR).replace(/\s+/g, " ")).toMatch(/the story heading itself/i);
        expect(read(RAZOR).replace(/\s+/g, " ")).toMatch(/No third value/);
    });
});

describe("re-deriving what the story set determined", () => {
    const epic: string = read("commands/nxs.epic.md").replace(/\s+/g, " ");

    it("is one step, not a rule that lives on the removal path", () => {
        expect(epic).toMatch(/one step, in one place/i);
    });

    it("fires on any difference between the drafted story set and the filed one, in either direction", () => {
        expect(epic).toMatch(/differs from the drafted one[^.]*in either direction/i);
    });

    it("re-derives the size rollup from the filed story set rather than the draft as first written", () => {
        expect(epic).toMatch(/`complexity` rollup[^.]*from the filed story set/i);
    });

    it("re-derives the design warrant, so additions that carry the epic past the threshold carry it", () => {
        expect(epic).toContain("needs-design");
        expect(epic).toMatch(/additions that carry the epic past it must gain the label/i);
    });

    it("re-derives or removes a sizing warning written before the change", () => {
        expect(epic).toMatch(/re-derived, or removed/);
        expect(epic).toMatch(/describes the story set that was actually filed/i);
    });

    it("re-checks closure and re-runs the gate in the same step", () => {
        expect(epic).toMatch(/Re-check closure over the filed set/i);
        expect(epic).toMatch(/re-run the gate/i);
    });
});

describe("asked-for scope the smallest usable version excludes", () => {
    const epic: string = read("commands/nxs.epic.md");
    const flat: string = epic.replace(/\s+/g, " ");

    it("leaves as one epic stub issue, through the producer the oversized path already uses", () => {
        expect(epic).toContain("8. **File the deferral stub");
        expect(flat).toMatch(/the same stub producer Phase 2b uses/i);
    });

    it("is filed only after the epic's own issues exist, and only on an explicit approval", () => {
        expect(flat).toMatch(/after the epic issue and every story issue exist/i);
        expect(flat).toMatch(/Nothing is created before an explicit approval/i);
    });

    it("never carries scope the reviewer declined, and never carries model-added scope", () => {
        expect(flat).toMatch(/never carries a story the drafting model added/i);
    });

    it("carries story titles only — no acceptance criteria and no provenance label", () => {
        expect(flat).toMatch(/story titles only/i);
        expect(flat).toMatch(/no acceptance criteria/i);
    });

    it("names its originating epic by issue number, and never a path into session scratch", () => {
        expect(flat).toMatch(/deferred from #\$\{EPIC\}/);
        expect(flat).toMatch(/never any part of `source\.md`/i);
    });

    it("creates nothing when the smallest usable version needs every asked-for story", () => {
        expect(flat).toMatch(/file no stub/i);
    });

    it("records the stub's number back on the draft, so a re-run does not file a second one", () => {
        expect(flat).toMatch(/deferral_link/);
    });

    it("terminates: a planning run that consumes a single-story deferral defers nothing further", () => {
        expect(flat).toMatch(/defers nothing further/i);
        expect(flat).toMatch(/\*\*deferred:\*\* <n> story\|stories/i);
    });
});
