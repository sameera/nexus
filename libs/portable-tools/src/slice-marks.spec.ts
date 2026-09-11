import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultRunner, type Runner } from "@nexus/workspace/run";
import { draftFromExtractions, extractionsDir, recordExtraction } from "./concept-extraction.js";
import { allHandoffs } from "./handoffs.js";
import { FOCUS_SLOT, recordInterview } from "./interview.js";
import { LEARNER_IGNORE_RULE, learnerFolder, readLearnerRecord } from "./learner-store.js";
import { planDraftPath, readPlanDraft } from "./plan-draft.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { runWorkbookCli } from "./workbook-cli.js";

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "slice-marks-"));
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
        { number: 21, title: "Resolve the roadmap", body: "Order stories across epics.", epic: 100, blockedBy: [], external: [] },
        { number: 22, title: "Render the page", body: "Turn lesson markdown into HTML.", epic: 100, blockedBy: [21], external: [] },
        { number: 23, title: "Report a cycle", body: "Name the stories that block each other.", epic: 100, blockedBy: [21], external: [] },
    ],
};

const FOCUS: string = "FOCUS-WORDS: how the resolver orders stories";
const REASON: string = "REASON-WORDS: this story is the ordering itself";

/** A roadmap whose interview recorded this focus, or none. */
function repoWith(focus: string | null, roadmap: Roadmap = ROADMAP): string {
    const repo: string = initRepo();
    writeRoadmap(repo, roadmap);
    recordInterview(repo, roadmap, focus === null ? [] : [{ slot: FOCUS_SLOT, question: "What did you come to learn?", answer: focus }]);
    return repo;
}

function listFor(story: number, verdict?: boolean): string {
    return JSON.stringify({
        story,
        introduces: [{ id: `concept-${story}`, gloss: "what this story teaches" }],
        ...(verdict === undefined ? {} : { serves: verdict, reason: REASON }),
    });
}

function mergeFor(stories: readonly number[]): string[][] {
    return stories.map((n) => [`concept-${n}`]);
}

function marks(repo: string): string[] {
    return (readPlanDraft(repo, "alpha")?.slices ?? []).map((s) => s.builds);
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

/** Run the whole pass at the command line, recording every command it runs. */
function runPass(repo: string, verdicts: Record<number, boolean> | null, calls: string[][]): Captured {
    const spy: Runner = (cmd, args, opts) => {
        calls.push([cmd, ...args]);
        return defaultRunner(cmd, args, opts);
    };
    for (const story of ROADMAP.stories) {
        // Where the extractor agent writes its proposal before handing it to the check.
        const file: string = path.join(extractionsDir(repo, "alpha"), `${story.number}.proposed.yml`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, listFor(story.number, verdicts?.[story.number]));
        expect(runWorkbookCli(["extract", "alpha", "--story", String(story.number), "--list", file], io(repo), spy)).toBe(0);
    }
    const merge: string = path.join(repo, "merge.yml");
    fs.writeFileSync(merge, `concepts:\n${ROADMAP.stories.map((s) => `  - [concept-${s.number}]`).join("\n")}\n`);
    const captured: Captured = io(repo);
    expect(runWorkbookCli(["draft", "alpha", "--merge", merge], captured, spy)).toBe(0);
    return captured;
}

describe("every slice carries exactly one mark", () => {
    it("marks each slice of a planned roadmap learner or handoff", () => {
        const repo: string = repoWith(FOCUS);
        runPass(repo, { 21: true, 22: false, 23: true }, []);
        expect(marks(repo)).toHaveLength(ROADMAP.stories.length);
        for (const mark of marks(repo)) expect(["learner", "handoff"]).toContain(mark);
    });
});

describe("a recorded focus marks what serves it learner and the rest handoff", () => {
    it("marks a slice whose story serves the focus learner, and one whose story does not handoff", () => {
        const repo: string = repoWith(FOCUS);
        runPass(repo, { 21: true, 22: false, 23: true }, []);
        expect(marks(repo)).toEqual(["learner", "handoff", "learner"]);
    });

    it("counts a list with no verdict as unreadable when the learner named a focus", () => {
        const repo: string = repoWith(FOCUS);
        expect(recordExtraction(repo, ROADMAP, 21, listFor(21)).ok).toBe(false);
        expect(recordExtraction(repo, ROADMAP, 21, JSON.stringify({ story: 21, introduces: [{ id: "a", gloss: "g" }], serves: "yes", reason: "r" })).ok).toBe(false);
    });

    it("keeps the focus words and the verdict reasons off every stub, and files a reason as a personal record", () => {
        const repo: string = repoWith(FOCUS);
        runPass(repo, { 21: true, 22: false, 23: true }, []);
        const derived: string = [
            fs.readFileSync(planDraftPath(repo, "alpha"), "utf8"),
            ...fs.readdirSync(extractionsDir(repo, "alpha")).map((f) => fs.readFileSync(path.join(extractionsDir(repo, "alpha"), f), "utf8")),
        ].join("\n");
        expect(derived).not.toContain("FOCUS-WORDS");
        expect(derived).not.toContain("REASON-WORDS");
        expect(readLearnerRecord(repo, "focus-verdicts", "alpha.json")).toContain("REASON-WORDS");
        expect(execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" })).not.toContain(".nexus");
    });

    it("leaves no reason behind in a proposal the check refused", () => {
        const repo: string = repoWith(FOCUS);
        const file: string = path.join(extractionsDir(repo, "alpha"), "21.proposed.yml");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ story: 21, introduces: [], serves: true, reason: REASON }));
        expect(runWorkbookCli(["extract", "alpha", "--story", "21", "--list", file], io(repo))).toBe(1);
        for (const f of fs.readdirSync(extractionsDir(repo, "alpha"))) {
            expect(fs.readFileSync(path.join(extractionsDir(repo, "alpha"), f), "utf8")).not.toContain("REASON-WORDS");
        }
    });

    it("still writes the draft when the focus matched no story, and says so", () => {
        const repo: string = repoWith(FOCUS);
        const captured: Captured = runPass(repo, { 21: false, 22: false, 23: false }, []);
        expect(marks(repo)).toEqual(["handoff", "handoff", "handoff"]);
        expect(captured.out.join("\n")).toContain("matched no story");
    });
});

describe("a learner who named no focus has every slice marked learner", () => {
    it("marks every slice learner", () => {
        const repo: string = repoWith(null);
        runPass(repo, null, []);
        expect(marks(repo)).toEqual(["learner", "learner", "learner"]);
    });

    it("requests no verdict, so a list carrying one is refused", () => {
        const repo: string = repoWith(null);
        expect(recordExtraction(repo, ROADMAP, 21, listFor(21, false)).ok).toBe(false);
    });

    it("marks a story added after the interview learner too, rather than reading the old story list", () => {
        const repo: string = repoWith(null);
        const grown: Roadmap = {
            ...ROADMAP,
            stories: [...ROADMAP.stories, { number: 24, title: "Added later", body: "New work.", epic: 100, blockedBy: [], external: [] }],
        };
        writeRoadmap(repo, grown);
        for (const story of grown.stories) recordExtraction(repo, grown, story.number, listFor(story.number));
        const result = draftFromExtractions(repo, grown, mergeFor(grown.stories.map((s) => s.number)));
        expect(result.ok).toBe(true);
        expect(marks(repo)).toEqual(["learner", "learner", "learner", "learner"]);
    });
});

describe("the pass reads the recorded focus and asks the learner nothing", () => {
    it("hands each subagent the focus words the interview recorded", () => {
        const repo: string = repoWith(FOCUS);
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["extract", "alpha", "--story", "21"], captured)).toBe(0);
        expect((JSON.parse(captured.out.join("\n")) as { focus?: string }).focus).toBe(FOCUS);
    });

    it("hands a subagent no focus when the whole roadmap is in focus", () => {
        const repo: string = repoWith(null);
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["extract", "alpha", "--story", "21"], captured)).toBe(0);
        expect((JSON.parse(captured.out.join("\n")) as { focus?: string }).focus).toBeUndefined();
    });
});

describe("a slice marked handoff builds nothing", () => {
    it("records no handoff, writes no prompt and starts no session", () => {
        const repo: string = repoWith(FOCUS);
        const calls: string[][] = [];
        runPass(repo, { 21: true, 22: false, 23: false }, calls);
        expect(marks(repo)).toContain("handoff");
        expect(allHandoffs(repo)).toEqual([]);
        expect(fs.existsSync(path.join(learnerFolder(repo), "handoffs"))).toBe(false);
        for (const call of calls) expect(call.slice(0, 2)).toEqual(["git", "check-ignore"]);
    });
});
