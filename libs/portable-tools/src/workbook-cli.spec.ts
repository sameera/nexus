// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner, defaultRunner } from "@nexus/workspace/run";
import { WORKBOOK_SUBVERBS, readProse, runWorkbookCli, type WorkbookCliIo } from "./workbook-cli";
import { readPage } from "./workbook-page-fixtures";
import { LESSONS_DIRNAME, workbookRoot } from "./workbook-store";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-cli-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

interface Captured extends WorkbookCliIo {
    out: string[];
    err: string[];
}
function makeIo(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, out, err, stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
}

function initRepo(): string {
    const dir = makeDir();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "spec@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "spec"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), "");
    return dir;
}

function authorLesson(repo: string, slug: string, file: string, title: string, body: string): void {
    const dir = path.join(workbookRoot(repo, slug), LESSONS_DIRNAME);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), `---\ntitle: ${title}\n---\n\n${body}\n`);
}

/** Everything a lesson author does before a learner has a workbook to read. */
function makeWorkbookWithLessons(): { repo: string; io: Captured } {
    const repo = initRepo();
    const io = makeIo(repo);
    expect(runWorkbookCli(["create", "rdl"], io)).toBe(0);
    authorLesson(repo, "rdl", "the-store.md", "The workbook store", "The store sits beside the queue.");
    authorLesson(repo, "rdl", "the-renderer.md", "The renderer", "The renderer turns prose into a page.");
    return { repo, io };
}

describe("a lesson author turns prose into pages", () => {
    it("makes the workbook and excludes the learner folder with one rule", () => {
        const repo = initRepo();
        const io = makeIo(repo);

        expect(runWorkbookCli(["create", "rdl"], io)).toBe(0);

        expect(fs.existsSync(path.join(workbookRoot(repo, "rdl"), LESSONS_DIRNAME))).toBe(true);
        expect(fs.readFileSync(path.join(repo, ".gitignore"), "utf8")).toContain(".learner/");
    });

    it("renders every authored lesson to a page a learner opens from disk", () => {
        const { repo, io } = makeWorkbookWithLessons();

        expect(runWorkbookCli(["render", "rdl"], io)).toBe(0);

        const page = readPage(fs.readFileSync(path.join(workbookRoot(repo, "rdl"), "the-store.html"), "utf8"));
        expect(page.title).toBe("The workbook store");
        expect(page.visibleText).toContain("The store sits beside the queue.");
        expect(page.assets.every((url) => url.startsWith("./"))).toBe(true);
        expect(io.out.join("\n")).toContain("the-store.html");
    });

    it("renders the lessons in the order the plan gives them", () => {
        const { repo, io } = makeWorkbookWithLessons();
        fs.writeFileSync(
            path.join(workbookRoot(repo, "rdl"), "plan.yml"),
            "lessons:\n  - the-renderer.md\n  - the-store.md\n",
        );

        expect(runWorkbookCli(["render", "rdl"], io)).toBe(0);

        const page = readPage(fs.readFileSync(path.join(workbookRoot(repo, "rdl"), "the-store.html"), "utf8"));
        expect(page.navigation).toEqual(["The renderer", "The workbook store"]);
    });

    it("names the lesson that failed and leaves no page to read", () => {
        const { repo, io } = makeWorkbookWithLessons();
        authorLesson(repo, "rdl", "bad.md", "Bad", "A <div>card</div> in the prose.");

        expect(runWorkbookCli(["render", "rdl"], io)).toBe(1);

        expect(io.err.join("\n")).toContain("bad.md");
        expect(fs.readdirSync(workbookRoot(repo, "rdl"))).toEqual([LESSONS_DIRNAME]);
    });

    it("says there is nothing to render when no lesson has been authored", () => {
        const repo = initRepo();
        const io = makeIo(repo);
        runWorkbookCli(["create", "rdl"], io);

        expect(runWorkbookCli(["render", "rdl"], io)).toBe(1);
        expect(io.err.join("\n")).toContain("nothing to render");
    });
});

describe("a paused workbook resumes at the handed-off story", () => {
    it("comes back to the story the last session handed off", () => {
        const { repo, io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);
        expect(runWorkbookCli(["handoff", "rdl", "--story", "#447", "--note", "stuck on the seam"], io)).toBe(0);

        const session = makeIo(repo);
        expect(runWorkbookCli(["session", "rdl"], session)).toBe(0);

        expect(session.out.join("\n")).toContain("#447");
    });

    it("lists every outstanding handoff, and stops listing one once it is resolved", () => {
        const { repo, io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);
        runWorkbookCli(["handoff", "rdl", "--story", "#447"], io);
        runWorkbookCli(["handoff", "rdl", "--story", "#448"], io);

        const listed = makeIo(repo);
        runWorkbookCli(["session", "rdl"], listed);
        expect(listed.out.join("\n")).toContain("#447");
        expect(listed.out.join("\n")).toContain("#448");

        runWorkbookCli(["resolve", "rdl", "handoff-0002.md"], makeIo(repo));
        const after = makeIo(repo);
        runWorkbookCli(["session", "rdl"], after);

        expect(after.out.join("\n")).toContain("#447");
        expect(after.out.join("\n")).not.toContain("#448");
    });

    it("starts at the first page when nothing was handed off", () => {
        const { repo, io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);

        const session = makeIo(repo);
        expect(runWorkbookCli(["session", "rdl"], session)).toBe(0);

        expect(session.out.join("\n")).toContain("no handoff is outstanding");
    });

    it("refuses a handoff that names no story", () => {
        const { repo, io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);

        const bad = makeIo(repo);
        expect(runWorkbookCli(["handoff", "rdl"], bad)).toBe(2);
        expect(bad.err.join("\n")).toContain("--story");
    });
});

describe("a committed page that no longer matches its lesson fails the check", () => {
    it("passes while every page is what its lesson renders to", () => {
        const { io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);

        expect(runWorkbookCli(["check", "rdl"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("matches");
    });

    it("fails and names the page someone edited instead of re-rendering", () => {
        const { repo, io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);
        fs.writeFileSync(path.join(workbookRoot(repo, "rdl"), "the-store.html"), "<p>edited by hand</p>\n");

        expect(runWorkbookCli(["check", "rdl"], io)).toBe(1);

        expect(io.err.join("\n")).toContain("the-store.html");
        expect(io.err.join("\n")).toContain("render");
    });

    it("fails and leaves the drifted page in place rather than repairing it", () => {
        const { repo, io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);
        const page = path.join(workbookRoot(repo, "rdl"), "the-store.html");
        fs.writeFileSync(page, "<p>edited by hand</p>\n");

        runWorkbookCli(["check", "rdl"], io);

        expect(fs.readFileSync(page, "utf8")).toBe("<p>edited by hand</p>\n");
    });

    it("fails when a lesson was authored but never rendered", () => {
        const { repo, io } = makeWorkbookWithLessons();
        runWorkbookCli(["render", "rdl"], io);
        authorLesson(repo, "rdl", "the-widgets.md", "The widgets", "A widget resolves from the library.");

        expect(runWorkbookCli(["check", "rdl"], io)).toBe(1);
        expect(io.err.join("\n")).toContain("the-widgets.html");
    });

    it("says there is nothing to check when no lesson has been authored", () => {
        const repo = initRepo();
        const io = makeIo(repo);
        runWorkbookCli(["create", "rdl"], io);

        expect(runWorkbookCli(["check", "rdl"], io)).toBe(1);
        expect(io.err.join("\n")).toContain("nothing to");
    });
});

describe("the verb says what it needs", () => {
    it("rejects a subverb it does not have", () => {
        const io = makeIo(initRepo());

        expect(runWorkbookCli(["renders", "rdl"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("renders");
    });

    it("offers every subverb it dispatches, so the usage line cannot go stale as verbs are added", () => {
        const io = makeIo(initRepo());
        runWorkbookCli(["renders", "rdl"], io);
        const offered: string = io.err.join("\n").split("\n").find((line) => line.startsWith("usage:")) ?? "";

        for (const subverb of WORKBOOK_SUBVERBS) expect(offered).toContain(subverb);
    });

    it("rejects an unknown flag and a missing workbook name", () => {
        const io = makeIo(initRepo());

        expect(runWorkbookCli(["render", "rdl", "--wat"], io)).toBe(2);
        expect(runWorkbookCli(["render"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("--wat");
    });

    it("says a workbook holds no page yet rather than starting a session on nothing", () => {
        const repo = initRepo();
        const io = makeIo(repo);
        runWorkbookCli(["create", "rdl"], io);

        expect(runWorkbookCli(["session", "rdl"], io)).toBe(1);
        expect(io.err.join("\n")).toContain("render");
    });
});


describe("a teaching session writes the one lesson the learner is up to", () => {
    const SUITE: string[] = ["fake-suite"];

    function planText(): string {
        return [
            "repo: nexus",
            "epic: 407",
            `suite: ${JSON.stringify(SUITE)}`,
            'grading: ["fake-grade"]',
            "slices:",
            "  - story: 460",
            "    lesson: 01-drift.md",
            "    builds: learner",
            "    branch: feat/460-drift",
            "    concepts: [pinned state]",
            "    pinning_test:",
            "      file: tests/drift.spec.ts",
            "      text: |",
            '        it("pins", () => {});',
            "    pinned:",
            "      title: A re-scoped story stops",
            "      body: As a learner, I want the check.",
            "",
        ].join("\n");
    }

    /** A repository whose issue state, suite and probe are all decided by the fixture. */
    function teachingRepo(options: { suite?: boolean; live?: string | null } = {}): { repo: string; run: Runner } {
        const repo = initRepo();
        const io = makeIo(repo);
        expect(runWorkbookCli(["create", "rdl"], io)).toBe(0);
        fs.writeFileSync(path.join(workbookRoot(repo, "rdl"), "plan.yml"), planText());
        const live: string | null =
            options.live === undefined
                ? JSON.stringify({ title: "A re-scoped story stops", body: "As a learner, I want the check.", closedAt: null })
                : options.live;
        const run: Runner = (cmd, args, opts): RunResult => {
            if (cmd === "gh") {
                return live === null
                    ? { status: 1, stdout: "", stderr: "no such issue" }
                    : { status: 0, stdout: live, stderr: "" };
            }
            if (cmd === SUITE[0]) return { status: options.suite === false ? 1 : 0, stdout: "", stderr: "" };
            if (cmd === "fake-grade") return { status: 1, stdout: "", stderr: "" };
            return defaultRunner(cmd, args, opts);
        };
        return { repo, run };
    }

    it("hands out a brief naming the lesson to write, and writes nothing yet", () => {
        const { repo, run } = teachingRepo();
        const io = makeIo(repo);

        expect(runWorkbookCli(["teach", "rdl"], io, run)).toBe(0);

        expect(io.out.join("\n")).toContain("01-drift.md");
        expect(fs.readdirSync(path.join(workbookRoot(repo, "rdl"), LESSONS_DIRNAME))).toEqual([]);
    });

    it("writes the lesson and its page once the prose comes back", () => {
        const { repo, run } = teachingRepo();
        const io = makeIo(repo);
        const prose = path.join(repo, "theory.md");
        fs.writeFileSync(prose, "A plan pins what was approved.\n");

        expect(runWorkbookCli(["teach", "rdl", "--prose", prose], io, run)).toBe(0);

        const page = readPage(fs.readFileSync(path.join(workbookRoot(repo, "rdl"), "01-drift.html"), "utf8"));
        expect(page.title).toBe("A re-scoped story stops");
        expect(page.visibleText).toContain("A plan pins what was approved.");
        expect(page.visibleText).toContain("tests/drift.spec.ts");
    });

    it("takes the drill's question and answer from the prose file's front matter", () => {
        const repo = initRepo();
        const file = path.join(repo, "prose.md");
        fs.writeFileSync(file, "---\nquestion: What was that idea?\nanswer: This idea.\n---\n\nThe theory half.\n");

        expect(readProse(file)).toEqual({
            theory: "\nThe theory half.\n",
            drill: { question: "What was that idea?", answer: "This idea." },
        });
    });

    it("takes each revisited concept's question and answer from the prose file's front matter", () => {
        const repo = initRepo();
        const file = path.join(repo, "prose.md");
        fs.writeFileSync(
            file,
            [
                "---",
                "question: What was that idea?",
                "answer: This idea.",
                "revisit:",
                "  - concept: pinned state",
                "    question: What does a pin hold?",
                "    answer: The title and body as approved.",
                "---",
                "",
                "The theory half.",
                "",
            ].join("\n"),
        );

        expect(readProse(file)).toEqual({
            theory: "\nThe theory half.\n",
            drill: { question: "What was that idea?", answer: "This idea." },
            revisit: [{ concept: "pinned state", question: "What does a pin hold?", answer: "The title and body as approved." }],
        });
    });

    it("carries a revisit with no drill, because a lesson can ask again without a cold drill", () => {
        const repo = initRepo();
        const file = path.join(repo, "prose.md");
        fs.writeFileSync(
            file,
            ["---", "revisit:", "  - concept: drift", "    question: Q?", "    answer: A.", "---", "", "Theory.", ""].join("\n"),
        );

        expect(readProse(file)).toEqual({
            theory: "\nTheory.\n",
            revisit: [{ concept: "drift", question: "Q?", answer: "A." }],
        });
    });

    it("drops a revisit entry that names no concept, question and answer, so nothing asks with nothing behind it", () => {
        const repo = initRepo();
        const file = path.join(repo, "prose.md");
        fs.writeFileSync(file, ["---", "revisit:", "  - concept: drift", "    question: Q?", "---", "", "Theory.", ""].join("\n"));

        expect(readProse(file)).toEqual({ theory: "\nTheory.\n" });
    });

    it("takes a prose file with no front matter as the theory half alone", () => {
        const repo = initRepo();
        const file = path.join(repo, "prose.md");
        fs.writeFileSync(file, "The theory half.\n");

        expect(readProse(file)).toEqual({ theory: "The theory half.\n" });
    });

    it("stops and reports when the story could not be read, rather than teaching past it", () => {
        const { repo, run } = teachingRepo({ live: null });
        const io = makeIo(repo);

        expect(runWorkbookCli(["teach", "rdl"], io, run)).toBe(1);

        expect(io.err.join("\n")).toContain("could not be read");
    });

    it("stops while the declared suite is red, and writes no lesson", () => {
        const { repo, run } = teachingRepo({ suite: false });
        const io = makeIo(repo);
        const prose = path.join(repo, "theory.md");
        fs.writeFileSync(prose, "Prose.\n");

        expect(runWorkbookCli(["teach", "rdl", "--prose", prose], io, run)).toBe(1);

        expect(io.err.join("\n")).toContain("suite");
        expect(fs.readdirSync(path.join(workbookRoot(repo, "rdl"), LESSONS_DIRNAME))).toEqual([]);
    });

    it("refuses to record a pause at a story this workbook's plan does not teach", () => {
        const { repo, run } = teachingRepo();
        const io = makeIo(repo);

        expect(runWorkbookCli(["handoff", "rdl", "--story", "999"], io, run)).toBe(2);

        expect(io.err.join("\n")).toContain("999");
        expect(fs.existsSync(path.join(repo, ".nexus", "workbook", ".learner", "handoffs"))).toBe(false);
    });

    it("records a pause at a story the plan does teach", () => {
        const { repo, run } = teachingRepo();
        const io = makeIo(repo);

        expect(runWorkbookCli(["handoff", "rdl", "--story", "460"], io, run)).toBe(0);

        expect(io.out.join("\n")).toContain("460");
    });
});

describe("a concept the learner took a hint on is asked about again in the lesson the session writes", () => {
    const SUITE: string[] = ["fake-suite"];

    /** Two learner slices, so the second lesson has a finished first lesson behind it. */
    function planText(): string {
        return [
            "repo: nexus",
            "epic: 407",
            `suite: ${JSON.stringify(SUITE)}`,
            'grading: ["fake-grade"]',
            "slices:",
            "  - story: 460",
            "    lesson: 01-drift.md",
            "    builds: learner",
            "    branch: feat/460-drift",
            "    concepts: [pinned state]",
            "    pinning_test:",
            "      file: tests/drift.spec.ts",
            "      text: |",
            '        it("pins", () => {});',
            "    pinned:",
            "      title: Story 460",
            "      body: As a learner, I want slice 460.",
            "  - story: 461",
            "    lesson: 02-widget.md",
            "    builds: learner",
            "    branch: feat/461-widget",
            "    concepts: [predict then reveal]",
            "    pinning_test:",
            "      file: tests/widget.spec.ts",
            "      text: |",
            '        it("pins", () => {});',
            "    pinned:",
            "      title: Story 461",
            "      body: As a learner, I want slice 461.",
            "",
        ].join("\n");
    }

    /** Answers `gh` about whichever story it was asked about, and keeps the suite green. */
    function runner(): Runner {
        return (cmd, args, opts): RunResult => {
            if (cmd === "gh") {
                const story = args[2];
                return {
                    status: 0,
                    stdout: JSON.stringify({ title: `Story ${story}`, body: `As a learner, I want slice ${story}.`, closedAt: null }),
                    stderr: "",
                };
            }
            if (cmd === SUITE[0]) return { status: 0, stdout: "", stderr: "" };
            if (cmd === "fake-grade") return { status: 1, stdout: "", stderr: "" };
            return defaultRunner(cmd, args, opts);
        };
    }

    function writeProse(repo: string, name: string, lines: string[]): string {
        const file = path.join(repo, name);
        fs.writeFileSync(file, lines.join("\n"));
        return file;
    }

    it("names the concept in the brief and writes it into the page once the prose comes back", () => {
        const repo = initRepo();
        const run = runner();
        expect(runWorkbookCli(["create", "rdl"], makeIo(repo))).toBe(0);
        fs.writeFileSync(path.join(workbookRoot(repo, "rdl"), "plan.yml"), planText());

        // The first lesson is written and its exercise finished.
        expect(runWorkbookCli(["teach", "rdl"], makeIo(repo), run)).toBe(0);
        const first = writeProse(repo, "first.md", ["Pinned state is what was approved.", ""]);
        expect(runWorkbookCli(["teach", "rdl", "--prose", first], makeIo(repo), run)).toBe(0);
        fs.mkdirSync(path.join(repo, "tests"), { recursive: true });
        fs.writeFileSync(path.join(repo, "tests", "drift.spec.ts"), "it('pins', () => {});\n");

        // The learner took a hint on the concept that lesson taught.
        const log = path.join(repo, ".nexus", "workbook", ".learner", "hint-log", "hints.json");
        fs.mkdirSync(path.dirname(log), { recursive: true });
        fs.writeFileSync(log, JSON.stringify({ "pinned state": 2 }));

        const briefing = makeIo(repo);
        expect(runWorkbookCli(["teach", "rdl"], briefing, run)).toBe(0);
        expect(briefing.out.join("\n")).toContain("pinned state");

        const second = writeProse(repo, "second.md", [
            "---",
            "revisit:",
            "  - concept: pinned state",
            "    question: What does a pin hold?",
            "    answer: The title and body as approved.",
            "---",
            "",
            "A widget reveals its answer.",
            "",
        ]);
        expect(runWorkbookCli(["teach", "rdl", "--prose", second], makeIo(repo), run)).toBe(0);

        const page = readPage(fs.readFileSync(path.join(workbookRoot(repo, "rdl"), "02-widget.html"), "utf8"));
        expect(page.visibleText).toContain("What does a pin hold?");
    });
});
