/**
 * The cross-ref capability's docs-root strip and URL-agreement behavior (epic #74, STORY-74.03),
 * driven as a subprocess through the maintainer's from-source command shape — `tsx nexus-cli.ts
 * abs-doc-path` — which is the one command shape that runs a verb with no build step. It replaced
 * the standalone skill script story #302 deleted.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const NEXUS_CLI_SRC: string = path.join(REPO_ROOT, "libs", "portable-tools", "src", "nexus-cli.ts");

let tmpDirs: string[] = [];

function makeRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cross-ref-docs-root-"));
    tmpDirs.push(dir);
    fs.mkdirSync(path.join(dir, ".nexus", "config"), { recursive: true });
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function writeSettings(repo: string, docsRootUrl: string): void {
    fs.writeFileSync(
        path.join(repo, ".nexus", "config", "settings.yml"),
        `cross-ref:\n  docs-root: ${docsRootUrl}\n`,
    );
}

function writeHubManifest(repo: string, docsRootOverride?: string): void {
    const docsRootLine = docsRootOverride ? `\n  docs-root: ${docsRootOverride}` : "";
    fs.writeFileSync(
        path.join(repo, ".nexus", "config", "workspace.yml"),
        `hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git${docsRootLine}\nmembers: []\n`,
    );
}

interface CliResult {
    status: number;
    stdout: string;
    stderr: string;
}

function run(cwd: string, args: string[]): CliResult {
    try {
        const stdout = execFileSync(TSX_BIN, [NEXUS_CLI_SRC, "abs-doc-path", ...args], { cwd, encoding: "utf8" });
        return { status: 0, stdout, stderr: "" };
    } catch (error) {
        const err = error as { status: number; stdout: string; stderr: string };
        return { status: err.status, stdout: err.stdout, stderr: err.stderr };
    }
}

describe("cross-ref URL building strips the resolved docs root (epic #74, STORY-74.03)", () => {
    it("single-repo: docs/ prefix stripped, URL unchanged from pre-epic behavior", () => {
        const repo = makeRepo();
        writeSettings(repo, "https://github.com/acme/docs-hub/blob/main/docs");

        const result = run(repo, ["docs/readme.md"]);

        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe("https://github.com/acme/docs-hub/blob/main/docs/readme.md");
    });

    it("hub with a repo-root docs root: nothing stripped, path maps straight onto the root URL", () => {
        const repo = makeRepo();
        writeHubManifest(repo);
        writeSettings(repo, "https://github.com/acme/docs-hub/blob/main");

        const result = run(repo, ["concepts.md"]);

        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe("https://github.com/acme/docs-hub/blob/main/concepts.md");
    });

    it("hub with an explicit nested docs-root override strips exactly that prefix", () => {
        const repo = makeRepo();
        writeHubManifest(repo, "handbook");
        writeSettings(repo, "https://github.com/acme/docs-hub/blob/main/handbook");

        const result = run(repo, ["handbook/readme.md"]);

        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe("https://github.com/acme/docs-hub/blob/main/handbook/readme.md");
    });

    it("strips the resolved prefix exactly once — a repeated docs/ segment survives past the first", () => {
        const repo = makeRepo();
        writeSettings(repo, "https://github.com/acme/docs-hub/blob/main/docs");

        const result = run(repo, ["docs/docs-legacy/readme.md"]);

        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe("https://github.com/acme/docs-hub/blob/main/docs/docs-legacy/readme.md");
    });

    it("surfaces a mismatch as operator error: repo-root docs root but a URL still ending in /docs", () => {
        const repo = makeRepo();
        writeHubManifest(repo); // resolved docs root: "." (repo root)
        writeSettings(repo, "https://github.com/acme/docs-hub/blob/main/docs"); // URL still points at /docs

        const result = run(repo, ["concepts.md"]);

        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr.toLowerCase()).toContain("disagree");
    });

    it("surfaces a mismatch as operator error: docs/ resolved root but a URL pointing at the repo root", () => {
        const repo = makeRepo(); // single-repo → resolved docs root: "docs"
        writeSettings(repo, "https://github.com/acme/docs-hub/blob/main"); // URL points at repo root

        const result = run(repo, ["docs/readme.md"]);

        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr.toLowerCase()).toContain("disagree");
    });
});
