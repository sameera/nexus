import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    LEARNER_IGNORE_RULE,
    LEARNER_PATH,
    LEARNER_RECORD_KINDS,
    UnignoredLearnerPathError,
    ensureLearnerIgnored,
    isLearnerFolderIgnored,
    learnerFolder,
    listLearnerRecords,
    readLearnerRecord,
    writeLearnerRecord,
} from "./learner-store";
import { WORKBOOK_STORE_PATH } from "./pipeline-stores";
import { LESSONS_DIRNAME, createWorkbook, openWorkbook } from "./workbook-store";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "learner-store-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

function sh(cwd: string, cmd: string, ...args: string[]): string {
    return execFileSync(cmd, args, { cwd, encoding: "utf8" }).replace(/\n$/, "");
}
function initRepo(): string {
    const dir = makeDir();
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    fs.writeFileSync(path.join(dir, ".gitignore"), ".nexus/tmp/\n");
    return dir;
}
function write(dir: string, rel: string, body: string): void {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
}

describe("everything the workbook retains about a person sits under one folder", () => {
    it("keeps the ledger, the progress, the learning records and the hint log in the learner's folder", () => {
        const repo = initRepo();
        createWorkbook(repo, "rdl");

        writeLearnerRecord(repo, "concept-ledger", "concepts.json", "{}\n");
        writeLearnerRecord(repo, "progress", "progress.json", "{}\n");
        writeLearnerRecord(repo, "learning-records", "2026-09-06.md", "learned\n");
        writeLearnerRecord(repo, "hint-log", "2026-09-06.md", "asked for a hint\n");

        for (const kind of ["concept-ledger", "progress", "learning-records", "hint-log"]) {
            expect(LEARNER_RECORD_KINDS).toContain(kind);
            expect(fs.existsSync(path.join(learnerFolder(repo), kind))).toBe(true);
        }
        // Nothing personal sits anywhere else in the store: the workbook holds only the workbooks,
        // and a workbook holds only the lessons an author writes and the pages they render to.
        const storeChildren = fs.readdirSync(path.join(repo, WORKBOOK_STORE_PATH)).sort();
        expect(storeChildren).toEqual([".learner", "rdl"]);
        expect(fs.readdirSync(path.join(repo, WORKBOOK_STORE_PATH, "rdl"))).toEqual([LESSONS_DIRNAME]);
    });

    it("reads a record back and enumerates the records of one kind in a stable order", () => {
        const repo = initRepo();
        createWorkbook(repo, "rdl");
        writeLearnerRecord(repo, "learning-records", "b.md", "second\n");
        writeLearnerRecord(repo, "learning-records", "a.md", "first\n");

        expect(readLearnerRecord(repo, "learning-records", "a.md")).toBe("first\n");
        expect(readLearnerRecord(repo, "learning-records", "missing.md")).toBeNull();
        expect(listLearnerRecords(repo, "learning-records")).toEqual(["a.md", "b.md"]);
    });
});

describe("one ignore rule excludes the learner's folder", () => {
    it("commits every lesson page and no personal record", () => {
        const repo = initRepo();
        const workbook = createWorkbook(repo, "rdl");
        write(repo, `${workbook.relativePath}/lesson-one.html`, "<p>one</p>\n");
        write(repo, `${workbook.relativePath}/lesson-two.html`, "<p>two</p>\n");
        writeLearnerRecord(repo, "progress", "progress.json", '{"at":"story-3"}\n');
        writeLearnerRecord(repo, "hint-log", "2026-09-06.md", "asked for a hint\n");

        sh(repo, "git", "add", "-A");
        sh(repo, "git", "commit", "-qm", "share the workbook");

        const tracked = sh(repo, "git", "ls-files").split("\n");
        expect(tracked).toContain(`${workbook.relativePath}/lesson-one.html`);
        expect(tracked).toContain(`${workbook.relativePath}/lesson-two.html`);
        expect(tracked.filter((f) => f.startsWith(`${LEARNER_PATH}/`))).toEqual([]);
    });

    it("needs no second rule when the store holds a second workbook", () => {
        const repo = initRepo();
        createWorkbook(repo, "first");
        createWorkbook(repo, "second");

        const rules = fs
            .readFileSync(path.join(repo, ".gitignore"), "utf8")
            .split("\n")
            .filter((l) => l.includes(".learner"));

        expect(rules).toEqual([LEARNER_IGNORE_RULE]);
        expect(isLearnerFolderIgnored(repo)).toBe(true);
    });

    it("adds the rule itself when the repository was set up before workbooks existed", () => {
        const repo = initRepo();
        expect(isLearnerFolderIgnored(repo)).toBe(false);

        expect(ensureLearnerIgnored(repo).added).toBe(true);
        expect(ensureLearnerIgnored(repo).added).toBe(false);
        expect(isLearnerFolderIgnored(repo)).toBe(true);
    });
});

describe("nothing writes a personal record until git confirms the path is ignored", () => {
    it("refuses the write and says why", () => {
        const repo = initRepo();
        fs.mkdirSync(path.join(repo, WORKBOOK_STORE_PATH), { recursive: true });

        expect(() => writeLearnerRecord(repo, "progress", "progress.json", "{}\n")).toThrow(
            UnignoredLearnerPathError,
        );
        expect(() => writeLearnerRecord(repo, "progress", "progress.json", "{}\n")).toThrow(
            /git does not ignore it/,
        );
        expect(fs.existsSync(path.join(learnerFolder(repo), "progress"))).toBe(false);
    });

    it("still refuses when the rule is removed after the workbook was created", () => {
        const repo = initRepo();
        createWorkbook(repo, "rdl");
        writeLearnerRecord(repo, "progress", "progress.json", "{}\n");

        fs.writeFileSync(path.join(repo, ".gitignore"), ".nexus/tmp/\n");

        expect(() => writeLearnerRecord(repo, "progress", "later.json", "{}\n")).toThrow(
            UnignoredLearnerPathError,
        );
    });

    it("honours a rule git reads from anywhere, not only the file this tool would write", () => {
        const repo = initRepo();
        fs.mkdirSync(path.join(repo, WORKBOOK_STORE_PATH), { recursive: true });
        fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), `${LEARNER_IGNORE_RULE}\n`);

        expect(ensureLearnerIgnored(repo).added).toBe(false);
        expect(fs.readFileSync(path.join(repo, ".gitignore"), "utf8")).not.toContain(".learner");
        expect(() => writeLearnerRecord(repo, "progress", "progress.json", "{}\n")).not.toThrow();
    });
});

describe("no learner record is an input to a lesson page", () => {
    it("reads every page from a checkout whose learner folder is empty", () => {
        const repo = initRepo();
        const workbook = createWorkbook(repo, "rdl");
        write(repo, `${workbook.relativePath}/lesson-one.html`, "<p>one</p>\n");
        write(repo, `${workbook.relativePath}/lesson-two.html`, "<p>two</p>\n");
        writeLearnerRecord(repo, "progress", "progress.json", '{"at":"story-3"}\n');

        const full = openWorkbook(repo, "rdl");
        fs.rmSync(learnerFolder(repo), { recursive: true, force: true });
        const empty = openWorkbook(repo, "rdl");

        expect(empty.pages).toEqual(["lesson-one.html", "lesson-two.html"]);
        expect(empty).toEqual(full);
    });
});
