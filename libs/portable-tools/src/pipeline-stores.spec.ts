import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deriveEntryDiff } from "./derive-entry-diff";
import {
    EXCLUDED_STORES,
    EXCLUDED_STORE_PATHS,
    WORKBOOK_STORE_PATH,
    excludePathspecs,
    isExcludedStorePath,
} from "./pipeline-stores";
import { createWorkbook, workbookStoreRoot } from "./workbook-store";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const COMMANDS_DIR: string = path.join(REPO_ROOT, "components", "commands");

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-stores-"));
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
function initRepo(dir: string, origin?: string): void {
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    if (origin !== undefined) sh(dir, "git", "remote", "add", "origin", origin);
    fs.writeFileSync(path.join(dir, ".gitignore"), ".nexus/tmp/\n");
}
function commitAll(dir: string, msg: string): string {
    sh(dir, "git", "add", "-A");
    sh(dir, "git", "commit", "-qm", msg);
    return sh(dir, "git", "rev-parse", "HEAD");
}
function write(dir: string, rel: string, body: string): void {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
}

describe("a workbook is created as a committed folder outside the queue", () => {
    it("puts the workbook in the store beside the queue, not inside it", () => {
        const repo = makeDir();
        initRepo(repo);

        const workbook = createWorkbook(repo, "roadmap-driven-learning");

        expect(fs.existsSync(workbook.root)).toBe(true);
        expect(workbook.relativePath).toBe(`${WORKBOOK_STORE_PATH}/roadmap-driven-learning`);
        expect(workbook.relativePath.startsWith(".nexus/queue")).toBe(false);
        expect(path.dirname(workbook.root)).toBe(workbookStoreRoot(repo));
    });

    it("leaves the workbook committable — git does not ignore it", () => {
        const repo = makeDir();
        initRepo(repo);
        const workbook = createWorkbook(repo, "roadmap-driven-learning");
        write(repo, `${workbook.relativePath}/lesson.html`, "<p>lesson</p>\n");

        commitAll(repo, "add workbook");

        const tracked = sh(repo, "git", "ls-files").split("\n");
        expect(tracked).toContain(`${workbook.relativePath}/lesson.html`);
    });

    it("holds more than one workbook, because a repository may teach more than one roadmap", () => {
        const repo = makeDir();
        initRepo(repo);

        const first = createWorkbook(repo, "one");
        const second = createWorkbook(repo, "two");
        const again = createWorkbook(repo, "one");

        expect(first.created).toBe(true);
        expect(second.created).toBe(true);
        expect(again.created).toBe(false);
        expect(fs.readdirSync(workbookStoreRoot(repo)).sort()).toEqual(["one", "two"]);
    });
});

describe("the excluded-store set has exactly one definition", () => {
    it("names the workbook store alongside the queue and the discovery store", () => {
        expect(EXCLUDED_STORE_PATHS).toEqual([".nexus/queue", ".nexus/discovery", WORKBOOK_STORE_PATH]);
    });

    it("justifies every member, so membership is reviewable rather than a bare path", () => {
        for (const store of EXCLUDED_STORES) {
            expect(store.why.trim().length).toBeGreaterThan(0);
        }
    });

    it("excludes each store entire, never a slice of one", () => {
        for (const spec of excludePathspecs()) {
            expect(spec).toMatch(/^:\(exclude\)\.nexus\/[a-z]+$/);
        }
    });

    it("recognises a path inside a store but not a sibling that merely shares a prefix", () => {
        expect(isExcludedStorePath(`${WORKBOOK_STORE_PATH}/rdl/lesson.html`)).toBe(true);
        expect(isExcludedStorePath(WORKBOOK_STORE_PATH)).toBe(true);
        expect(isExcludedStorePath(".nexus/workbooks/other.html")).toBe(false);
        expect(isExcludedStorePath("libs/portable-tools/src/render.ts")).toBe(false);
    });
});

describe("the command bodies derive their exclusions from that one definition", () => {
    const bodies: readonly string[] = ["nxs.analyze.md", "nxs.close.md", "nxs.distill.md"];

    it.each(bodies)("%s asks the executable for the set rather than listing it", (name) => {
        const body = fs.readFileSync(path.join(COMMANDS_DIR, name), "utf8");
        expect(body).toContain("nexus excluded-stores");
    });

    it.each(bodies)("%s states the set nowhere of its own, so the two cannot drift", (name) => {
        const body = fs.readFileSync(path.join(COMMANDS_DIR, name), "utf8");
        const restatements = body
            .split("\n")
            .filter((line) => /exclud/i.test(line) && EXCLUDED_STORE_PATHS.some((s) => line.includes(s)));
        expect(restatements).toEqual([]);
    });
});

describe("a derived behavioural diff withholds the workbook and nothing else", () => {
    // The workbook sits in the member repository whose roadmap it teaches, never in the hub
    // (record #450, invariant 6), so the range the drain reads names that member.
    function workspaceWithWorkbookChange(): { hub: string; entry: string } {
        const parent = makeDir();
        const hub = path.join(parent, "hub");
        initRepo(hub, "git@github.com:acme/hub.git");
        write(hub, ".nexus/config/workspace.yml",
            "hub:\n  name: hub\n  remote: git@github.com:acme/hub.git\nmembers:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n");
        commitAll(hub, "declare the workspace");

        const member = path.join(parent, "web-app");
        initRepo(member, "git@github.com:acme/web-app.git");
        write(member, ".nexus/config/hub.yml", "hub:\n  name: hub\n  remote: git@github.com:acme/hub.git\n");
        write(member, "libs/app/src/thing.ts", "export const before = 1;\n");
        const base = commitAll(member, "base");

        const workbook = createWorkbook(member, "rdl");
        write(member, `${workbook.relativePath}/lesson.html`, "<p>generated markup</p>\n");
        write(member, "libs/app/src/thing.ts", "export const before = 2;\n");
        const head = commitAll(member, "workbook page plus application source");

        const entry = path.join(hub, ".nexus", "queue", "epic-1");
        fs.mkdirSync(entry, { recursive: true });
        fs.writeFileSync(
            path.join(entry, "close-record.md"),
            `---\nrange:\n  - repo: github.com/acme/web-app\n    base: ${base}\n    head: ${head}\n---\n`,
        );
        return { hub, entry };
    }

    it("reports no workbook file for a range whose commits changed one", () => {
        const { hub, entry } = workspaceWithWorkbookChange();

        const result = deriveEntryDiff(entry, hub);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const changedFiles = result.diffs[0].diff
            .split("\n")
            .filter((l) => l.startsWith("+++ b/"))
            .map((l) => l.slice("+++ b/".length));
        expect(changedFiles.filter((f) => f.startsWith(`${WORKBOOK_STORE_PATH}/`))).toEqual([]);
        expect(result.diffs[0].diff).not.toContain("generated markup");
    });

    it("still reports every application source change in the same range", () => {
        const { hub, entry } = workspaceWithWorkbookChange();

        const result = deriveEntryDiff(entry, hub);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.diffs[0].diff).toContain("libs/app/src/thing.ts");
        expect(result.diffs[0].diff).toContain("export const before = 2;");
    });
});
