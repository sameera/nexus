// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runWorkbookCli, type WorkbookCliIo } from "./workbook-cli";
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

describe("the verb says what it needs", () => {
    it("rejects a subverb it does not have", () => {
        const io = makeIo(initRepo());

        expect(runWorkbookCli(["renders", "rdl"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("renders");
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
