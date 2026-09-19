import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PLAN_FILENAME } from "./workbook-plan";
import { createWorkbook, lessonsDir, readLessons, readWorkbookPlan, workbookRoot, writtenLessonFiles } from "./workbook-store";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-store-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

function repoWithWorkbook(): string {
    const dir = makeDir();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), "");
    createWorkbook(dir, "rdl");
    return dir;
}

function authorLesson(repo: string, file: string, title: string): void {
    fs.writeFileSync(path.join(lessonsDir(repo, "rdl"), file), `---\ntitle: ${title}\n---\n\nProse.\n`);
}

function slice(story: number, lesson: string): string {
    return [
        `  - story: ${story}`,
        `    lesson: ${lesson}`,
        "    builds: learner",
        "    branch: feat/x",
        "    concepts: [c]",
        "    pinning_test:",
        "      file: x.spec.ts",
        "      text: |",
        "        it('x', () => {});",
        "    pinned:",
        `      title: Story ${story}`,
        "      body: A story body.",
    ].join("\n");
}

function writePlan(repo: string, stories: readonly [number, string][]): void {
    const text: string = [
        "repo: nexus",
        "epic: 407",
        "suite: [npx, nx, test, lib]",
        "grading: [npx, nx, test, lib]",
        "slices:",
        ...stories.map(([story, lesson]) => slice(story, lesson)),
        "",
    ].join("\n");
    fs.writeFileSync(path.join(workbookRoot(repo, "rdl"), PLAN_FILENAME), text);
}

describe("a slice with no lesson yet is a stub the workbook skips", () => {
    it("reads only the lessons that have been written, in plan order", () => {
        const repo = repoWithWorkbook();
        writePlan(repo, [[460, "01-drift.md"], [464, "02-handoff.md"], [465, "03-fence.md"]]);
        authorLesson(repo, "02-handoff.md", "Handoff");
        authorLesson(repo, "01-drift.md", "Drift");

        expect(readLessons(repo, "rdl").map((l) => l.file)).toEqual(["01-drift.md", "02-handoff.md"]);
    });

    it("still refuses a lesson the plan does not name, which has no place in the workbook", () => {
        const repo = repoWithWorkbook();
        writePlan(repo, [[460, "01-drift.md"]]);
        authorLesson(repo, "01-drift.md", "Drift");
        authorLesson(repo, "stray.md", "Stray");

        expect(() => readLessons(repo, "rdl")).toThrow(/stray\.md/);
    });

    it("names the lesson files that have been written, so the stubs can be told apart", () => {
        const repo = repoWithWorkbook();
        writePlan(repo, [[460, "01-drift.md"], [464, "02-handoff.md"]]);
        authorLesson(repo, "01-drift.md", "Drift");

        expect(writtenLessonFiles(repo, "rdl")).toEqual(["01-drift.md"]);
    });

    it("reads the plan back, and says there is none when the workbook declares no slices", () => {
        const repo = repoWithWorkbook();
        expect(readWorkbookPlan(repo, "rdl")).toBeNull();

        writePlan(repo, [[460, "01-drift.md"]]);
        expect(readWorkbookPlan(repo, "rdl")?.slices[0].story).toBe(460);
    });

    it("keeps ordering by a plain lessons list, which a workbook with no slices still uses", () => {
        const repo = repoWithWorkbook();
        authorLesson(repo, "a.md", "A");
        authorLesson(repo, "b.md", "B");
        fs.writeFileSync(path.join(workbookRoot(repo, "rdl"), PLAN_FILENAME), "lessons:\n  - b.md\n  - a.md\n");

        expect(readLessons(repo, "rdl").map((l) => l.file)).toEqual(["b.md", "a.md"]);
    });
});
