import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMerge, draftFromExtractions, proposedVocabulary, readExtractions, recordExtraction } from "./concept-extraction.js";
import { recordInterview } from "./interview.js";
import { LEARNER_IGNORE_RULE } from "./learner-store.js";
import { LESSON_PHASE_ENTRY_POINT, SHARED_REFERENCES, readPhaseEntryPoint } from "./phase-references.js";
import { planDraftPath, readPlanDraft } from "./plan-draft.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { runWorkbookCli } from "./workbook-cli.js";

const COMPONENT_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..", "components");

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "concept-extraction-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), `${LEARNER_IGNORE_RULE}\n.nexus/tmp/\n`);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const ROADMAP: Roadmap = {
    name: "alpha",
    epics: [100],
    stories: [
        { number: 11, title: "Pin the plan", body: "BODY-ELEVEN: record the state a story had at approval.", epic: 100, blockedBy: [], external: [] },
        { number: 12, title: "Report drift", body: "BODY-TWELVE: compare the pinned state with the live one.", epic: 100, blockedBy: [11], external: [] },
    ],
};

type Pair = [string, string];

/** What a subagent hands back for one story. */
function listFor(story: number, introduces: Pair[], assumes: Pair[] = [], extra: Record<string, unknown> = {}): string {
    const entries = (pairs: Pair[]) => pairs.map(([id, gloss]) => ({ id, gloss }));
    return JSON.stringify({ story, introduces: entries(introduces), assumes: entries(assumes), ...extra });
}

/** A roadmap with its interview recorded and nothing extracted yet. */
function planned(roadmap: Roadmap = ROADMAP): string {
    const repo: string = initRepo();
    writeRoadmap(repo, roadmap);
    recordInterview(repo, roadmap, []);
    return repo;
}

function extractBoth(repo: string): void {
    recordExtraction(repo, ROADMAP, 11, listFor(11, [["pinned-state", "the state a plan records at approval"]]));
    recordExtraction(repo, ROADMAP, 12, listFor(12, [["drift", "a story moving after it was pinned"]], [["pinned-state", "the recorded state"]]));
}

interface Captured {
    cwd: string;
    out: string[];
    err: string[];
    stdout: (l: string) => void;
    stderr: (l: string) => void;
}
function io(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
}

function holdsNoStoryText(text: string): void {
    for (const story of ROADMAP.stories) {
        expect(text).not.toContain(story.body);
        expect(text).not.toContain(story.title);
    }
}

describe("a story's extraction returns a structured list", () => {
    it("returns the concepts the story introduces and the concepts it assumes", () => {
        const repo: string = planned();
        const result = recordExtraction(repo, ROADMAP, 12, listFor(12, [["drift", "a story moving after it was pinned"]], [["pinned-state", "the recorded state"]]));
        expect(result.ok && result.list.introduces.map((c) => c.id)).toEqual(["drift"]);
        expect(result.ok && result.list.assumes.map((c) => c.id)).toEqual(["pinned-state"]);
    });

    it("accepts only the list's own shape, whatever the story text asked for", () => {
        const repo: string = planned();
        expect(recordExtraction(repo, ROADMAP, 11, listFor(11, [["drift", "g"]], [], { builds: "handoff" })).ok).toBe(false);
        expect(recordExtraction(repo, ROADMAP, 11, listFor(12, [["drift", "g"]])).ok).toBe(false);
        expect(recordExtraction(repo, ROADMAP, 11, JSON.stringify({ story: 11, introduces: [{ id: "drift", gloss: "g", note: "x" }] })).ok).toBe(false);
    });

    it("holds a list to its size limits", () => {
        const repo: string = planned();
        const many: Pair[] = Array.from({ length: 13 }, (_, i) => [`concept-${String.fromCharCode(97 + i)}`, "g"]);
        expect(recordExtraction(repo, ROADMAP, 11, listFor(11, many)).ok).toBe(false);
        expect(recordExtraction(repo, ROADMAP, 11, listFor(11, [["drift", "one line\nand another"]])).ok).toBe(false);
        expect(recordExtraction(repo, ROADMAP, 11, listFor(11, [["drift", "x".repeat(161)]])).ok).toBe(false);
    });

    it("names what it refused without handing an unchecked value of any length back to the session", () => {
        const repo: string = planned();
        const injected: string = `INJECTED-${"x".repeat(5000)}`;
        const refusals = [
            recordExtraction(repo, ROADMAP, 11, JSON.stringify({ story: 11, introduces: [{ id: "drift", gloss: "g" }], [injected]: 1 })),
            recordExtraction(repo, ROADMAP, 11, JSON.stringify({ story: 11, introduces: [{ id: "drift", gloss: "g", [injected]: 1 }] })),
            recordExtraction(repo, ROADMAP, 11, JSON.stringify({ story: 11, introduces: [{ id: injected, gloss: "g" }] })),
            recordExtraction(repo, ROADMAP, 11, JSON.stringify({ story: injected, introduces: [{ id: "drift", gloss: "g" }] })),
        ];
        for (const refused of refusals) {
            expect(refused.ok).toBe(false);
            const problem: string = refused.ok ? "" : refused.problem;
            expect(problem.length).toBeLessThan(400);
            expect(problem).not.toContain("x".repeat(100));
        }
    });
});

describe("each story is read by its own unit", () => {
    it("hands one subagent its own story's text and no other story's", () => {
        const repo: string = planned();
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["extract", "alpha", "--story", "11"], captured)).toBe(0);
        expect(captured.out.join("\n")).toContain("BODY-ELEVEN");
        expect(captured.out.join("\n")).not.toContain("BODY-TWELVE");
    });

    it("starts the planning session from story numbers alone", () => {
        const repo: string = planned();
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["extract", "alpha"], captured)).toBe(0);
        expect((JSON.parse(captured.out.join("\n")) as { extract: number[] }).extract).toEqual([11, 12]);
        holdsNoStoryText(captured.out.join("\n"));
    });

    it("refuses a story that is not on the roadmap", () => {
        const repo: string = planned();
        expect(runWorkbookCli(["extract", "alpha", "--story", "99"], io(repo))).toBe(1);
    });

    it("loads no lesson-writing reference into an extraction subagent", () => {
        const extractor: string = fs.readFileSync(path.join(COMPONENT_ROOT, "agents", "nxs-concept-extractor.md"), "utf8");
        const lessonOnly: string[] = readPhaseEntryPoint(COMPONENT_ROOT, LESSON_PHASE_ENTRY_POINT).references.filter((r) => !SHARED_REFERENCES.includes(r));
        expect(lessonOnly.length).toBeGreaterThan(0);
        for (const reference of lessonOnly) expect(extractor).not.toContain(reference);
    });
});

describe("the planning session holds the lists and none of the text they came from", () => {
    it("passes a checked list back as identifiers and glosses only", () => {
        const repo: string = planned();
        const file: string = path.join(repo, "list.json");
        fs.writeFileSync(file, listFor(11, [["pinned-state", "the state a plan records at approval"]]));
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["extract", "alpha", "--story", "11", "--list", file], captured)).toBe(0);
        expect(captured.out.join("\n")).toContain("pinned-state");
        holdsNoStoryText(captured.out.join("\n"));
    });

    it("gives the merge step every proposed identifier and its glosses, and no story text", () => {
        const repo: string = planned();
        extractBoth(repo);
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["vocabulary", "alpha"], captured)).toBe(0);
        const shown = JSON.parse(captured.out.join("\n")) as { identifiers: { id: string }[] };
        expect(shown.identifiers.map((i) => i.id)).toEqual(["drift", "pinned-state"]);
        holdsNoStoryText(captured.out.join("\n"));
    });

    it("reports the draft it wrote without quoting any story", () => {
        const repo: string = planned();
        extractBoth(repo);
        const merge: string = path.join(repo, "merge.yml");
        fs.writeFileSync(merge, "concepts:\n  - [pinned-state]\n  - [drift]\n");
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["draft", "alpha", "--merge", merge], captured)).toBe(0);
        expect(readPlanDraft(repo, "alpha")?.slices.map((s) => s.story)).toEqual([11, 12]);
        holdsNoStoryText([...captured.out, ...captured.err].join("\n"));
    });
});

describe("a concept two stories need carries one identifier in both lists", () => {
    it("settles spelling and case in code", () => {
        const repo: string = planned();
        recordExtraction(repo, ROADMAP, 11, listFor(11, [["Pinned State", "the state a plan records"]]));
        recordExtraction(repo, ROADMAP, 12, listFor(12, [["drift", "g"]], [["pinned_state", "the recorded state"]]));
        const proposed = proposedVocabulary(readExtractions(repo, ROADMAP).current);
        expect(proposed.find((p) => p.id === "pinned-state")?.stories).toEqual([11, 12]);
    });

    it("applies the session's merge of two names for one concept to every list", () => {
        const repo: string = planned();
        recordExtraction(repo, ROADMAP, 11, listFor(11, [["pinned-state", "the state a plan records"]]));
        recordExtraction(repo, ROADMAP, 12, listFor(12, [["drift", "g"]], [["pin-snapshot", "the story as approved"]]));
        const result = draftFromExtractions(repo, ROADMAP, [["pinned-state", "pin-snapshot"], ["drift"]]);
        expect(result.ok).toBe(true);
        const slices = readPlanDraft(repo, "alpha")?.slices;
        expect(slices?.[0].concepts).toEqual(["pinned-state"]);
        expect(slices?.[1].assumes).toEqual(["pinned-state"]);
        expect(readPlanDraft(repo, "alpha")?.vocabulary?.map((v) => v.id)).toEqual(["drift", "pinned-state"]);
    });

    it("keeps every name the merge folded into a concept, so a list still holding that name reaches the one identifier", () => {
        const repo: string = planned();
        recordExtraction(repo, ROADMAP, 11, listFor(11, [["pinned-state", "the state a plan records"]]));
        recordExtraction(repo, ROADMAP, 12, listFor(12, [["drift", "g"]], [["pin-snapshot", "the story as approved"]]));
        expect(draftFromExtractions(repo, ROADMAP, [["pinned-state", "pin-snapshot"], ["drift"]]).ok).toBe(true);
        const vocabulary = readPlanDraft(repo, "alpha")?.vocabulary ?? [];
        const proposedBy12: string[] = readExtractions(repo, ROADMAP).current.find((list) => list.story === 12)?.assumes.map((c) => c.id) ?? [];
        expect(proposedBy12).toEqual(["pin-snapshot"]);
        expect(vocabulary.filter((v) => v.id === "pin-snapshot" || v.aliases.includes("pin-snapshot")).map((v) => v.id)).toEqual(["pinned-state"]);
    });

    it("refuses a merge that leaves an identifier unmapped, invents one, or splits one", () => {
        const proposed = [
            { id: "drift", glosses: ["g"], stories: [12] },
            { id: "pinned-state", glosses: ["g"], stories: [11] },
        ];
        expect(applyMerge(proposed, [["drift"]]).ok).toBe(false);
        expect(applyMerge(proposed, [["drift"], ["pinned-state", "brand-new"]]).ok).toBe(false);
        expect(applyMerge(proposed, [["drift", "pinned-state"], ["pinned-state"]]).ok).toBe(false);
        expect(applyMerge(proposed, [["drift"], ["pinned-state"]]).ok).toBe(true);
    });

    it("writes nothing when the merge is refused", () => {
        const repo: string = planned();
        extractBoth(repo);
        expect(draftFromExtractions(repo, ROADMAP, [["drift"]]).ok).toBe(false);
        expect(fs.existsSync(planDraftPath(repo, "alpha"))).toBe(false);
    });
});

describe("a story whose extraction fails stops the pass", () => {
    it("writes no stubs and names the story with no list", () => {
        const repo: string = planned();
        recordExtraction(repo, ROADMAP, 11, listFor(11, [["pinned-state", "g"]]));
        const result = draftFromExtractions(repo, ROADMAP, [["pinned-state"]]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.failed).toEqual([12]);
            expect(result.problem).toContain("#12");
        }
        expect(fs.existsSync(planDraftPath(repo, "alpha"))).toBe(false);
    });

    it("names every failed story, not only the first", () => {
        const repo: string = planned();
        recordExtraction(repo, ROADMAP, 11, "not: [a list");
        recordExtraction(repo, ROADMAP, 12, "");
        const captured: Captured = io(repo);
        const merge: string = path.join(repo, "merge.yml");
        fs.writeFileSync(merge, "concepts: []\n");
        expect(runWorkbookCli(["draft", "alpha", "--merge", merge], captured)).toBe(1);
        expect(captured.err.join("\n")).toContain("#11");
        expect(captured.err.join("\n")).toContain("#12");
        expect(fs.existsSync(planDraftPath(repo, "alpha"))).toBe(false);
    });

    it("reads a bare empty return as a failed extraction, and an explicit 'nothing' as a list", () => {
        const repo: string = planned();
        expect(recordExtraction(repo, ROADMAP, 11, listFor(11, [])).ok).toBe(false);
        expect(recordExtraction(repo, ROADMAP, 11, listFor(11, [], [], { nothing: true })).ok).toBe(true);
        expect(recordExtraction(repo, ROADMAP, 11, listFor(11, [["drift", "g"]], [], { nothing: true })).ok).toBe(false);
    });

    it("lets a failed re-extraction replace the list an earlier attempt left", () => {
        const repo: string = planned();
        extractBoth(repo);
        recordExtraction(repo, ROADMAP, 12, "{}");
        expect(readExtractions(repo, ROADMAP).missing).toEqual([12]);
    });

    it("re-extracts only the story whose text changed", () => {
        const repo: string = planned();
        extractBoth(repo);
        const edited: Roadmap = { ...ROADMAP, stories: [ROADMAP.stories[0], { ...ROADMAP.stories[1], body: "BODY-TWELVE, rewritten." }] };
        writeRoadmap(repo, edited);
        const captured: Captured = io(repo);
        runWorkbookCli(["extract", "alpha"], captured);
        expect((JSON.parse(captured.out.join("\n")) as { extract: number[] }).extract).toEqual([12]);
    });
});

describe("the pass reads the interview before anything else", () => {
    it("starts no extraction for a roadmap with no interview", () => {
        const repo: string = initRepo();
        writeRoadmap(repo, ROADMAP);
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["extract", "alpha"], captured)).toBe(1);
        expect(captured.err.join("\n")).toContain("interview");
        expect(captured.out).toEqual([]);
    });
});
