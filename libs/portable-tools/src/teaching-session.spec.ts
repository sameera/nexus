// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner, defaultRunner } from "@nexus/close-migration/run";
import { PROBE_SCRATCH_PATH } from "./fence-probe";
import { allHandoffs } from "./handoffs";
import { type LiveStory } from "./teaching-plan";
import { runTeachingSession, type SessionInputs, type SessionResult } from "./teaching-session";
import { type AuthoredProse } from "./lesson-writer";
import { readPage } from "./workbook-page-fixtures";
import { PLAN_FILENAME } from "./workbook-plan";
import { createWorkbook, lessonsDir, workbookRoot } from "./workbook-store";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "teaching-session-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const SUITE: string[] = ["fake-suite", "--all"];
const GRADING: string[] = ["fake-grade"];

interface SliceSpec {
    story: number;
    lesson?: string;
    builds: "learner" | "handoff";
    test: string;
    concepts: string[];
}

const SLICES: SliceSpec[] = [
    { story: 460, lesson: "01-drift.md", builds: "learner", test: "tests/drift.spec.ts", concepts: ["pinned state", "drift"] },
    { story: 461, lesson: "02-widget.md", builds: "learner", test: "tests/widget.spec.ts", concepts: ["predict then reveal"] },
    { story: 462, lesson: "03-drill.md", builds: "learner", test: "tests/drill.spec.ts", concepts: ["cold retrieval"] },
    { story: 464, builds: "handoff", test: "tests/handoff.spec.ts", concepts: ["the fence"] },
    { story: 465, lesson: "04-fence.md", builds: "learner", test: "tests/fence.spec.ts", concepts: ["the probe"] },
];

function planText(slices: readonly SliceSpec[] = SLICES): string {
    const lines: string[] = [
        "repo: nexus",
        "epic: 407",
        `suite: ${JSON.stringify(SUITE)}`,
        `grading: ${JSON.stringify(GRADING)}`,
        "slices:",
    ];
    for (const slice of slices) {
        lines.push(`  - story: ${slice.story}`);
        if (slice.lesson !== undefined) lines.push(`    lesson: ${slice.lesson}`);
        lines.push(
            `    builds: ${slice.builds}`,
            `    branch: feat/${slice.story}-slice`,
            `    concepts: [${slice.concepts.join(", ")}]`,
            "    pinning_test:",
            `      file: ${slice.test}`,
            "      text: |",
            `        it("pins #${slice.story}", () => {});`,
            "    pinned:",
            `      title: Story ${slice.story} teaches something`,
            `      body: As a learner, I want slice ${slice.story}.`,
        );
    }
    return lines.join("\n") + "\n";
}

function makeRepo(slices: readonly SliceSpec[] = SLICES): string {
    const dir = makeDir();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), "");
    createWorkbook(dir, "rdl");
    fs.writeFileSync(path.join(workbookRoot(dir, "rdl"), PLAN_FILENAME), planText(slices));
    return dir;
}

/** Every test file the probe finds already passing — the fence's answer, decided by the fixture. */
function materialized(repo: string): string[] {
    const root = path.join(repo, PROBE_SCRATCH_PATH);
    const found: string[] = [];
    const walk = (dir: string, prefix: string): void => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const next = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
            if (entry.isDirectory()) walk(path.join(dir, entry.name), next);
            else found.push(next);
        }
    };
    walk(root, "");
    return found;
}

interface Fixture {
    /** Whether the declared suite passes. */
    suite: boolean;
    /** The pinning tests that already pass when the probe runs them. */
    passing: string[];
    /** Every command the session invoked, as an argument vector. */
    invoked: string[][];
}

function makeRunner(fixture: Fixture): Runner {
    return (cmd, args, opts): RunResult => {
        fixture.invoked.push([cmd, ...args]);
        if (cmd === SUITE[0]) return { status: fixture.suite ? 0 : 1, stdout: "one test failed", stderr: "" };
        if (cmd === GRADING[0]) {
            const probed: string[] = materialized(opts.cwd);
            const passes: boolean = probed.some((file) => fixture.passing.includes(file));
            return { status: passes ? 0 : 1, stdout: "", stderr: "" };
        }
        return defaultRunner(cmd, args, opts);
    };
}

const LIVE: Record<number, LiveStory> = Object.fromEntries(
    SLICES.map((slice) => [
        slice.story,
        { title: `Story ${slice.story} teaches something`, body: `As a learner, I want slice ${slice.story}.`, closed: false },
    ]),
);

function prose(drill = true): AuthoredProse {
    return {
        theory: "The theory half, written for this learner at this moment.",
        ...(drill ? { drill: { question: "What was that idea?", answer: "This idea." } } : {}),
    };
}

interface RunOptions {
    suite?: boolean;
    passing?: string[];
    live?: Record<number, LiveStory | null>;
    prose?: AuthoredProse;
    fixture?: Fixture;
}

function teach(repo: string, options: RunOptions = {}): { result: SessionResult; fixture: Fixture } {
    const fixture: Fixture = options.fixture ?? {
        suite: options.suite ?? true,
        passing: options.passing ?? [],
        invoked: [],
    };
    const live: Record<number, LiveStory | null> = options.live ?? LIVE;
    const inputs: SessionInputs = {
        repoRoot: repo,
        slug: "rdl",
        read: (story) => live[story] ?? null,
        prose: options.prose,
        run: makeRunner(fixture),
        now: () => "2026-09-07T12:00:00.000Z",
    };
    return { result: runTeachingSession(inputs), fixture };
}

/** The hint log the grading epic writes, which this session only ever reads. */
function writeHintLog(repo: string, contents: string): void {
    const log = path.join(repo, ".nexus", "workbook", ".learner", "hint-log", "hints.json");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(log, contents);
}

/** The learner writes the pinning test where the lesson said to, which finishes that exercise. */
function finish(repo: string, test: string): void {
    fs.mkdirSync(path.join(repo, path.dirname(test)), { recursive: true });
    fs.writeFileSync(path.join(repo, test), "it('pins', () => {});\n");
}

/** Teach one whole lesson: the brief, then the prose that answers it. */
function teachOne(repo: string, options: RunOptions = {}): SessionResult {
    const briefed = teach(repo, options).result;
    const drill: boolean = briefed.outcome.kind === "brief" && briefed.outcome.brief.drill !== null;
    return teach(repo, { ...options, prose: prose(drill) }).result;
}

describe("a workbook opened at its first lesson holds exactly one written lesson", () => {
    it("writes the lesson the learner is up to and leaves every later slice a stub", () => {
        const repo = makeRepo();

        const result = teachOne(repo);

        expect(result.outcome.kind).toBe("written");
        expect(fs.readdirSync(lessonsDir(repo, "rdl"))).toEqual(["01-drift.md"]);
        const page = readPage(fs.readFileSync(path.join(workbookRoot(repo, "rdl"), "01-drift.html"), "utf8"));
        expect(page.navigation).toEqual([
            "Story 460 teaches something",
            "Story #461 — not yet written",
            "Story #462 — not yet written",
            "Story #465 — not yet written",
        ]);
    });

    it("names the story, the branch, the pinning test and the grading command in the exercise", () => {
        const repo = makeRepo();

        const result = teachOne(repo);

        expect(result.outcome.report).toContain("#460");
        expect(result.outcome.report).toContain("feat/460-slice");
        expect(result.outcome.report).toContain("tests/drift.spec.ts");
        expect(result.outcome.report).toContain("fake-grade");
    });

    it("opens the lesson it wrote and hands the exercise over", () => {
        const repo = makeRepo();

        const result = teachOne(repo);

        if (result.outcome.kind !== "written") throw new Error(`expected a lesson, got ${result.outcome.kind}`);
        expect(fs.existsSync(result.outcome.page)).toBe(true);
        expect(result.outcome.report).toContain(result.outcome.page);
    });

    it("opens the lesson again rather than rewriting it while its exercise is unfinished", () => {
        const repo = makeRepo();
        teachOne(repo);
        const before = fs.readFileSync(path.join(lessonsDir(repo, "rdl"), "01-drift.md"), "utf8");

        const again = teachOne(repo);

        expect(again.outcome.kind).toBe("open");
        expect(fs.readFileSync(path.join(lessonsDir(repo, "rdl"), "01-drift.md"), "utf8")).toBe(before);
    });

    it("writes the next lesson once the current exercise is finished", () => {
        const repo = makeRepo();
        teachOne(repo);
        finish(repo, "tests/drift.spec.ts");

        const next = teachOne(repo);

        expect(next.outcome.kind).toBe("written");
        expect(fs.readdirSync(lessonsDir(repo, "rdl")).sort()).toEqual(["01-drift.md", "02-widget.md"]);
    });
});

describe("a session that finds a story changed teaches no lesson for it", () => {
    it("names the story that was rewritten and stops before its lesson", () => {
        const repo = makeRepo();
        const rewritten = { ...LIVE, 460: { ...LIVE[460], body: "Something else entirely." } };

        const result = teach(repo, { live: rewritten, prose: prose(false) }).result;

        expect(result.outcome.kind).toBe("drift");
        expect(result.outcome.report).toContain("#460");
        expect(fs.existsSync(lessonsDir(repo, "rdl"))).toBe(true);
        expect(fs.readdirSync(lessonsDir(repo, "rdl"))).toEqual([]);
    });

    it("names a story closed since the plan was pinned, and writes nothing for it", () => {
        const repo = makeRepo();
        const closed = { ...LIVE, 460: { ...LIVE[460], closed: true } };

        const result = teach(repo, { live: closed, prose: prose(false) }).result;

        expect(result.outcome.kind).toBe("drift");
        expect(result.outcome.report).toContain("closed");
    });

    it("says it could not verify a story, in different words from drift, and still writes nothing", () => {
        const repo = makeRepo();

        const result = teach(repo, { live: { 460: null }, prose: prose(false) }).result;

        expect(result.outcome.kind).toBe("drift");
        expect(result.outcome.report).toContain("could not be read");
        expect(fs.readdirSync(lessonsDir(repo, "rdl"))).toEqual([]);
    });

    it("reports drift on a later slice and teaches the current one anyway", () => {
        const repo = makeRepo();
        const laterDrift = { ...LIVE, 465: { ...LIVE[465], closed: true } };

        const result = teachOne(repo, { live: laterDrift });

        expect(result.outcome.kind).toBe("written");
        expect(result.drift.map((f) => f.story)).toEqual([465]);
    });
});

describe("no lesson is written while the suite is failing", () => {
    it("names the red suite, rather than the finished exercise, as what stops the next lesson", () => {
        const repo = makeRepo();
        teachOne(repo);
        finish(repo, "tests/drift.spec.ts");

        const result = teach(repo, { suite: false, prose: prose(false) }).result;

        expect(result.outcome.kind).toBe("suite-red");
        expect(fs.readdirSync(lessonsDir(repo, "rdl"))).toEqual(["01-drift.md"]);
    });

    it("writes nothing and says the suite is red", () => {
        const repo = makeRepo();

        const result = teach(repo, { suite: false, prose: prose(false) }).result;

        expect(result.outcome.kind).toBe("suite-red");
        expect(fs.readdirSync(lessonsDir(repo, "rdl"))).toEqual([]);
    });

    it("runs the full declared suite as an argument vector, never a shell string", () => {
        const repo = makeRepo();

        const { fixture } = teach(repo, { prose: prose(false) });

        expect(fixture.invoked).toContainEqual(SUITE);
    });

    it("moves no git state: it creates, switches, merges, commits and pushes nothing", () => {
        const repo = makeRepo();

        const { fixture } = teach(repo, { prose: prose(false) });

        const gitVerbs = fixture.invoked.filter((v) => v[0] === "git").map((v) => v[1]);
        expect(gitVerbs.every((verb) => verb === "check-ignore")).toBe(true);
    });
});

describe("a drill opens the session on a concept met at least one lesson earlier", () => {
    it("offers no drill in a first session, and goes straight to the lesson", () => {
        const repo = makeRepo();

        const briefed = teach(repo).result;

        if (briefed.outcome.kind !== "brief") throw new Error(`expected a brief, got ${briefed.outcome.kind}`);
        expect(briefed.outcome.brief.drill).toBeNull();
    });

    /** Two lessons written and finished, so the third session has something cold to ask about. */
    function twoLessonsIn(repo: string): void {
        teachOne(repo);
        finish(repo, "tests/drift.spec.ts");
        teachOne(repo);
        finish(repo, "tests/widget.spec.ts");
    }

    it("drills a concept from an earlier lesson, never one from the lesson just finished", () => {
        const repo = makeRepo();
        twoLessonsIn(repo);

        const briefed = teach(repo).result;

        if (briefed.outcome.kind !== "brief") throw new Error(`expected a brief, got ${briefed.outcome.kind}`);
        expect(briefed.outcome.brief.drill).not.toBe("predict then reveal");
        expect(["pinned state", "drift"]).toContain(briefed.outcome.brief.drill);
    });

    it("picks the concept the learner has taken more hints on when two are equally overdue", () => {
        const repo = makeRepo();
        twoLessonsIn(repo);
        writeHintLog(repo, JSON.stringify({ "pinned state": 3, drift: 1 }));

        const briefed = teach(repo).result;

        if (briefed.outcome.kind !== "brief") throw new Error(`expected a brief, got ${briefed.outcome.kind}`);
        expect(briefed.outcome.brief.drill).toBe("pinned state");
    });

    it("writes the drill into the lesson as a question whose answer is withheld until asked for", () => {
        const repo = makeRepo();
        twoLessonsIn(repo);
        teachOne(repo);

        const page = readPage(fs.readFileSync(path.join(workbookRoot(repo, "rdl"), "03-drill.html"), "utf8"));
        expect(page.visibleText).toContain("What was that idea?");
        expect(page.visibleText).not.toContain("This idea.");
        expect(page.controls.some((c) => c.content.includes("This idea."))).toBe(true);
    });
});

describe("a handoff slice produces a prompt, and the session pauses", () => {
    /** Teach the three learner slices, so the plan's next slice is the handoff. */
    function upToTheHandoff(repo: string): void {
        for (const slice of SLICES.slice(0, 3)) {
            teachOne(repo);
            finish(repo, slice.test);
        }
    }

    it("neither builds nor teaches the slice, and writes a prompt naming everything the agent needs", () => {
        const repo = makeRepo();
        upToTheHandoff(repo);

        const result = teach(repo, { prose: prose(false) }).result;

        if (result.outcome.kind !== "handoff") throw new Error(`expected a handoff, got ${result.outcome.kind}`);
        const prompt = fs.readFileSync(result.outcome.promptPath, "utf8");
        expect(prompt).toContain("nexus");
        expect(prompt).toContain("feat/464-slice");
        expect(prompt).toContain("#407");
        expect(prompt).toContain("#464");
        expect(prompt).toContain("#465");
        expect(prompt).toContain("/nxs.analyze");
        expect(prompt).toContain("/nxs.close");
        expect(fs.readdirSync(lessonsDir(repo, "rdl")).sort()).toEqual(["01-drift.md", "02-widget.md", "03-drill.md"]);
    });

    it("still hands the slice off while the suite is red, because a handoff writes no lesson", () => {
        const repo = makeRepo();
        upToTheHandoff(repo);

        const result = teach(repo, { suite: false, prose: prose(false) }).result;

        expect(result.outcome.kind).toBe("handoff");
    });

    it("keeps the prompt out of the workbook, where it could never be read as a page", () => {
        const repo = makeRepo();
        upToTheHandoff(repo);

        const result = teach(repo, { prose: prose(false) }).result;

        if (result.outcome.kind !== "handoff") throw new Error(`expected a handoff, got ${result.outcome.kind}`);
        expect(result.outcome.promptPath).toContain(".learner");
        expect(fs.readdirSync(workbookRoot(repo, "rdl"))).not.toContain(path.basename(result.outcome.promptPath));
    });

    it("resumes at the story that was handed off rather than treating the next slice as fresh", () => {
        const repo = makeRepo();
        upToTheHandoff(repo);
        teach(repo, { prose: prose(false) });

        const resumed = teach(repo, { passing: [], prose: prose(false) }).result;

        expect(resumed.outcome.kind).toBe("unintegrated");
        expect(resumed.outcome.report).toContain("#464");
    });

    it("records exactly one pause, and does not record a second while that one is open", () => {
        const repo = makeRepo();
        upToTheHandoff(repo);
        teach(repo, { prose: prose(false) });
        teach(repo, { prose: prose(false) });

        expect(allHandoffs(repo)).toHaveLength(1);
    });
});

describe("the suite runs on the return, and a pinning test that already passes is a breached fence", () => {
    function pausedAtTheHandoff(repo: string): void {
        for (const slice of SLICES.slice(0, 3)) {
            teachOne(repo);
            finish(repo, slice.test);
        }
        teach(repo, { prose: prose(false) });
    }

    it("writes no lesson while the suite is red, and leaves the handoff open", () => {
        const repo = makeRepo();
        pausedAtTheHandoff(repo);

        const result = teach(repo, { suite: false, passing: ["tests/handoff.spec.ts"], prose: prose(false) }).result;

        expect(result.outcome.kind).toBe("suite-red");
        expect(allHandoffs(repo)[0].resolvedAt).toBeNull();
    });

    it("never reads a probe result taken on a red suite as a breach", () => {
        const repo = makeRepo();
        pausedAtTheHandoff(repo);

        const result = teach(repo, {
            suite: false,
            passing: ["tests/handoff.spec.ts", "tests/fence.spec.ts"],
            prose: prose(false),
        }).result;

        expect(result.outcome.kind).toBe("suite-red");
    });

    it("reports that the handed-off work reached into the learner's slice, and names it", () => {
        const repo = makeRepo();
        pausedAtTheHandoff(repo);

        const result = teach(repo, {
            passing: ["tests/handoff.spec.ts", "tests/fence.spec.ts"],
            prose: prose(false),
        }).result;

        if (result.outcome.kind !== "breach") throw new Error(`expected a breach, got ${result.outcome.kind}`);
        expect(result.outcome.story).toBe(465);
        expect(result.outcome.report).toContain("#465");
        expect(fs.readdirSync(lessonsDir(repo, "rdl"))).not.toContain("04-fence.md");
    });

    it("resolves the pause and writes the next lesson on a green suite and an intact fence", () => {
        const repo = makeRepo();
        pausedAtTheHandoff(repo);

        const briefed = teach(repo, { passing: ["tests/handoff.spec.ts"] }).result;
        expect(briefed.outcome.kind).toBe("brief");
        const result = teach(repo, { passing: ["tests/handoff.spec.ts"], prose: prose(true) }).result;

        expect(result.outcome.kind).toBe("written");
        expect(fs.readdirSync(lessonsDir(repo, "rdl"))).toContain("04-fence.md");
        expect(allHandoffs(repo)[0].resolvedAt).not.toBeNull();
    });

    it("sweeps the probe's scratch path at the start of every session, whatever a crash left there", () => {
        const repo = makeRepo();
        const litter = path.join(repo, PROBE_SCRATCH_PATH, "tests", "left-behind.spec.ts");
        fs.mkdirSync(path.dirname(litter), { recursive: true });
        fs.writeFileSync(litter, "it('fails forever', () => { throw new Error('boom'); });\n");

        teach(repo, { prose: prose(false) });

        expect(fs.existsSync(path.join(repo, PROBE_SCRATCH_PATH))).toBe(false);
    });
});

describe("a second run of the same session reaches the same verdict", () => {
    it("picks the same drill and hands out the same brief", () => {
        const repo = makeRepo();
        teachOne(repo);
        finish(repo, "tests/drift.spec.ts");
        teachOne(repo);
        finish(repo, "tests/widget.spec.ts");

        const first = teach(repo).result;
        const second = teach(repo).result;

        expect(second.outcome).toEqual(first.outcome);
    });

    it("says the hint log could not be read rather than quietly ranking a worse drill", () => {
        const repo = makeRepo();
        teachOne(repo);
        finish(repo, "tests/drift.spec.ts");
        teachOne(repo);
        finish(repo, "tests/widget.spec.ts");
        writeHintLog(repo, "{ not json");

        const result = teach(repo).result;

        expect(result.skipped.join(" ")).toContain("hint log");
        expect(result.outcome.kind).toBe("brief");
    });
});

describe("a workbook whose every slice is taught and finished", () => {
    it("reports that there is nothing left to teach", () => {
        const repo = makeRepo();
        for (const slice of SLICES.slice(0, 3)) {
            teachOne(repo);
            finish(repo, slice.test);
        }
        teach(repo, { prose: prose(false) });
        finish(repo, "tests/handoff.spec.ts");
        teachOne(repo, { passing: ["tests/handoff.spec.ts"] });
        finish(repo, "tests/fence.spec.ts");

        const result = teach(repo).result;

        expect(result.outcome.kind).toBe("done");
    });
});

describe("a workbook with no plan of slices teaches nothing", () => {
    it("says what a teaching plan must name rather than guessing one", () => {
        const repo = makeDir();
        execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
        fs.writeFileSync(path.join(repo, ".gitignore"), "");
        createWorkbook(repo, "rdl");

        const result = teach(repo).result;

        expect(result.outcome.kind).toBe("no-plan");
        expect(result.outcome.report).toContain("pinned");
    });
});
