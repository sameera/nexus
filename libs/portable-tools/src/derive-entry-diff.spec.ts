import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Runner } from "@nexus/close-migration/run";
import { deriveEntryDiff, parseRange, renderDeriveFailure, renderRepoDiffs, runCli } from "./derive-entry-diff";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const TOOL_SRC: string = path.join(__dirname, "derive-entry-diff.ts");

let tmpDirs: string[] = [];
function makeParent(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "derive-entry-diff-"));
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
    if (origin) sh(dir, "git", "remote", "add", "origin", origin);
}
function commitAll(dir: string, msg: string): string {
    sh(dir, "git", "add", "-A");
    sh(dir, "git", "commit", "-qm", msg);
    return sh(dir, "git", "rev-parse", "HEAD");
}
function write(dir: string, rel: string, content: string): void {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}

/** Hub `docs-hub` declaring members web-app + api; each member gets a base and a head commit. */
interface HubFixture {
    hubRoot: string;
    web: { root: string; base: string; head: string };
    api: { root: string; base: string; head: string };
}
function buildHubFixture(parent: string): HubFixture {
    const hubRoot = path.join(parent, "docs-hub");
    initRepo(hubRoot, "git@github.com:acme/docs-hub.git");
    write(hubRoot, ".nexus/config/workspace.yml",
        "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n" +
        "members:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n" +
        "  - name: api\n    remote: git@github.com:acme/api.git\n");
    commitAll(hubRoot, "init hub");

    const webRoot = path.join(parent, "web-app");
    initRepo(webRoot, "git@github.com:acme/web-app.git");
    write(webRoot, "src/app.ts", "export const v = 1;\n");
    const webBase = commitAll(webRoot, "base");
    write(webRoot, "src/app.ts", "export const v = 2;\n");
    write(webRoot, ".nexus/queue/some-entry/epic.md", "# queued epic\n"); // must be excluded
    const webHead = commitAll(webRoot, "head");

    const apiRoot = path.join(parent, "api");
    initRepo(apiRoot, "git@github.com:acme/api.git");
    write(apiRoot, "lib/server.ts", "export const port = 80;\n");
    const apiBase = commitAll(apiRoot, "base");
    write(apiRoot, "lib/server.ts", "export const port = 8080;\n");
    const apiHead = commitAll(apiRoot, "head");

    return { hubRoot, web: { root: webRoot, base: webBase, head: webHead }, api: { root: apiRoot, base: apiBase, head: apiHead } };
}

/** Writes a hub-queue entry whose close record stamps the given range items. */
function writeEntry(hubRoot: string, items: Array<{ repo: string; base: string; head: string }>): string {
    const entryDir = path.join(hubRoot, ".nexus", "queue", "demo-epic-ab12cd34");
    const range = items.map((i) => `  - repo: ${i.repo}\n    base: ${i.base}\n    head: ${i.head}`).join("\n");
    write(hubRoot, ".nexus/queue/demo-epic-ab12cd34/epic.md", "---\nlink: \"#3\"\n---\n# epic\n");
    write(hubRoot, ".nexus/queue/demo-epic-ab12cd34/close-record.md",
        `---\ntitle: "Close Record: Demo"\nepic: #3\nfeature: "Demo"\ndate: 2026-07-01\nrange:\n${range}\n---\n\n# Close Record: Demo\n`);
    return entryDir;
}

describe("deriveEntryDiff — happy paths", () => {
    it("AC1: single-repo range, identical diff, queue excluded", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/web-app", base: web.base, head: web.head }]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.diffs).toHaveLength(1);
        expect(result.diffs[0].repo).toBe("github.com/acme/web-app");
        expect(result.diffs[0].checkout).toBe(web.root);

        const expectedDiff = execFileSync("git", ["diff", `${web.base}...${web.head}`, "--", ".", ":(exclude).nexus/queue"], { cwd: web.root, encoding: "utf8" });
        expect(result.diffs[0].diff).toBe(expectedDiff);
        expect(result.diffs[0].diff).toContain("src/app.ts");
        expect(result.diffs[0].diff).not.toContain(".nexus/queue");
    });

    it("AC2: cross-repo range, one diff per repo, no cross-attribution", () => {
        const parent = makeParent();
        const { hubRoot, web, api } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [
            { repo: "github.com/acme/web-app", base: web.base, head: web.head },
            { repo: "github.com/acme/api", base: api.base, head: api.head },
        ]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.diffs).toHaveLength(2);
        expect(result.diffs[0].repo).toBe("github.com/acme/web-app");
        expect(result.diffs[1].repo).toBe("github.com/acme/api");
        expect(result.diffs[0].diff).toContain("src/app.ts");
        expect(result.diffs[0].diff).not.toContain("lib/server.ts");
        expect(result.diffs[1].diff).toContain("lib/server.ts");
        expect(result.diffs[1].diff).not.toContain("src/app.ts");
    });

    it("hub-own entry: range naming the hub itself resolves in hubRoot", () => {
        const parent = makeParent();
        const { hubRoot } = buildHubFixture(parent);
        const hubBase = sh(hubRoot, "git", "rev-parse", "HEAD");
        write(hubRoot, "README.md", "# docs hub\n\nUpdated.\n");
        const hubHead = commitAll(hubRoot, "update readme");
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/docs-hub", base: hubBase, head: hubHead }]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.diffs).toHaveLength(1);
        expect(result.diffs[0].checkout).toBe(hubRoot);
        expect(result.diffs[0].diff).toContain("README.md");
    });
});

describe("deriveEntryDiff — hard errors (invariant 5)", () => {
    it("AC3: missing checkout", () => {
        const parent = makeParent();
        const { hubRoot, api } = buildHubFixture(parent);
        fs.rmSync(api.root, { recursive: true, force: true });
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/api", base: api.base, head: api.head }]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].problem).toBe("missing-checkout");
        expect(result.errors[0].message).toContain("api");
        expect(result.errors[0].message).toContain("github.com/acme/api");
        expect(result.errors[0].message).toContain(path.join(parent, "api"));
    });

    it("AC4: behind checkout / unreachable head", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const fabricatedSha = "a".repeat(40);
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/web-app", base: web.base, head: fabricatedSha }]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("unreachable-sha");
        expect(result.errors[0].message).toContain(fabricatedSha);
        expect(result.errors[0].message).toContain("github.com/acme/web-app");
        expect(result.errors[0].message).toContain(web.root);
    });

    it("no partial diff: one item unreachable ⇒ zero diffs emitted", () => {
        const parent = makeParent();
        const { hubRoot, web, api } = buildHubFixture(parent);
        const fabricatedSha = "b".repeat(40);
        const entryDir = writeEntry(hubRoot, [
            { repo: "github.com/acme/web-app", base: web.base, head: web.head },
            { repo: "github.com/acme/api", base: api.base, head: fabricatedSha },
        ]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors.some((e) => e.problem === "unreachable-sha")).toBe(true);
    });

    it("missing stamp (risk item): no range: key at all", () => {
        const parent = makeParent();
        const { hubRoot } = buildHubFixture(parent);
        const entryDir = path.join(hubRoot, ".nexus", "queue", "demo-epic-ab12cd34");
        write(hubRoot, ".nexus/queue/demo-epic-ab12cd34/epic.md", "---\nlink: \"#3\"\n---\n# epic\n");
        write(hubRoot, ".nexus/queue/demo-epic-ab12cd34/close-record.md",
            "---\ntitle: \"Close Record: Demo\"\nepic: #3\nfeature: \"Demo\"\ndate: 2026-07-01\n---\n\n# Close Record: Demo\n");

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("missing-range");
        expect(result.errors[0].message).toContain("close-record.md");
        expect(result.errors[0].message).toContain("range:");
    });

    it("malformed stamp: range item missing head, and a 7-char base", () => {
        const parent = makeParent();
        const { hubRoot } = buildHubFixture(parent);
        const entryDir = path.join(hubRoot, ".nexus", "queue", "demo-epic-ab12cd34");
        write(hubRoot, ".nexus/queue/demo-epic-ab12cd34/epic.md", "---\nlink: \"#3\"\n---\n# epic\n");
        write(hubRoot, ".nexus/queue/demo-epic-ab12cd34/close-record.md",
            "---\ntitle: \"Close Record: Demo\"\nepic: #3\nfeature: \"Demo\"\ndate: 2026-07-01\nrange:\n  - repo: github.com/acme/web-app\n    base: ca5265b\n---\n\n# Close Record: Demo\n");

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("malformed-range");
        expect(result.errors[0].message).toContain("range[0]");
    });

    it("duplicate repo in range list", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [
            { repo: "github.com/acme/web-app", base: web.base, head: web.head },
            { repo: "github.com/acme/web-app", base: web.base, head: web.head },
        ]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("malformed-range");
    });

    it("missing close record", () => {
        const parent = makeParent();
        const { hubRoot } = buildHubFixture(parent);
        const entryDir = path.join(hubRoot, ".nexus", "queue", "demo-epic-ab12cd34");
        write(hubRoot, ".nexus/queue/demo-epic-ab12cd34/epic.md", "---\nlink: \"#3\"\n---\n# epic\n");

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("missing-close-record");
    });

    it("unknown repo named in range", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/ghost", base: web.base, head: web.head }]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("unknown-repo");
        expect(result.errors[0].message).toContain("github.com/acme/ghost");
    });

    it("not a hub: hubDir has no manifest", () => {
        const parent = makeParent();
        const { web } = buildHubFixture(parent);
        const entryDir = path.join(parent, "nowhere");
        write(parent, "nowhere/close-record.md",
            `---\ntitle: x\nrange:\n  - repo: github.com/acme/web-app\n    base: ${web.base}\n    head: ${web.head}\n---\n`);

        const result = deriveEntryDiff(entryDir, web.root);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("not-a-workspace-hub");
    });

    it("git diff failure surfaces via an injected Runner", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/web-app", base: web.base, head: web.head }]);

        const failingDiffRunner: Runner = (cmd, args, opts) => {
            if (args[0] === "diff") {
                return { status: 128, stdout: "", stderr: "boom" };
            }
            const r = execFileSync(cmd, args, { cwd: opts.cwd, encoding: "utf8" });
            return { status: 0, stdout: r, stderr: "" };
        };

        const result = deriveEntryDiff(entryDir, hubRoot, failingDiffRunner);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("git-diff-failed");
        expect(result.errors[0].message).toContain("boom");
    });

    it("workspace resolution failure (malformed manifest) surfaces as workspace-resolution-failed", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        write(hubRoot, ".nexus/config/workspace.yml", "hub: [unterminated\n");
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/web-app", base: web.base, head: web.head }]);

        const result = deriveEntryDiff(entryDir, hubRoot);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("workspace-resolution-failed");
    });
});

describe("parseRange", () => {
    it("valid YAML frontmatter yields items", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md",
            "---\nrange:\n  - repo: github.com/acme/web-app\n    base: " + "a".repeat(40) + "\n    head: " + "b".repeat(40) + "\n---\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.range).toEqual([{ repo: "github.com/acme/web-app", base: "a".repeat(40), head: "b".repeat(40) }]);
    });

    it("file not starting with --- yields missing-range", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md", "# no frontmatter\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("missing-range");
    });

    it("YAML syntax error in frontmatter yields malformed-range", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md", "---\nrange: [unterminated\n---\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("malformed-range");
    });

    it("unterminated frontmatter block yields missing-range", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md", "---\ntitle: x\nno closing delimiter\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("missing-range");
    });

    it("empty range list yields malformed-range", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md", "---\nrange: []\n---\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("malformed-range");
        expect(result.error.message).toContain("non-empty");
    });

    it("a range item that is not a mapping yields malformed-range", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md", "---\nrange:\n  - just-a-string\n---\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("malformed-range");
        expect(result.error.message).toContain("not a mapping");
    });

    it("a range item missing 'repo' yields malformed-range", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md",
            "---\nrange:\n  - base: " + "a".repeat(40) + "\n    head: " + "b".repeat(40) + "\n---\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("malformed-range");
        expect(result.error.message).toContain("missing 'repo'");
    });

    it("a range item whose 'head' is not a full 40-hex SHA yields malformed-range", () => {
        const parent = makeParent();
        const dir = path.join(parent, "entry");
        write(parent, "entry/close-record.md",
            "---\nrange:\n  - repo: github.com/acme/web-app\n    base: " + "a".repeat(40) + "\n    head: deadbeef\n---\n");
        const result = parseRange(dir);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("malformed-range");
        expect(result.error.message).toContain("'head' is not a full 40-hex SHA");
    });
});

describe("CLI (subprocess)", () => {
    it("success: exits 0, stdout carries the repo header and SHAs", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/web-app", base: web.base, head: web.head }]);

        const stdout = execFileSync(TSX_BIN, [TOOL_SRC, "--entry", entryDir, "--hub", hubRoot], { encoding: "utf8" });
        expect(stdout).toContain("=== repo github.com/acme/web-app");
        expect(stdout).toContain(web.base);
        expect(stdout).toContain(web.head);
    });

    it("failure: missing-checkout fixture exits 1 and names the problem", () => {
        const parent = makeParent();
        const { hubRoot, api } = buildHubFixture(parent);
        fs.rmSync(api.root, { recursive: true, force: true });
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/api", base: api.base, head: api.head }]);

        try {
            execFileSync(TSX_BIN, [TOOL_SRC, "--entry", entryDir, "--hub", hubRoot], { encoding: "utf8" });
            expect.unreachable("expected non-zero exit");
        } catch (error) {
            const err = error as { status: number; stderr: string };
            expect(err.status).toBe(1);
            expect(err.stderr).toContain("missing-checkout");
            expect(err.stderr).toContain(path.join(parent, "api"));
        }
    });

    it("usage: no --entry exits 2 with a usage message", () => {
        try {
            execFileSync(TSX_BIN, [TOOL_SRC], { encoding: "utf8" });
            expect.unreachable("expected non-zero exit");
        } catch (error) {
            const err = error as { status: number; stderr: string };
            expect(err.status).toBe(2);
            expect(err.stderr).toContain("usage:");
        }
    });
});

describe("runCli (in-process)", () => {
    function captureWrites(fn: () => number): { status: number; stdout: string; stderr: string } {
        const outChunks: string[] = [];
        const errChunks: string[] = [];
        const originalOut = process.stdout.write.bind(process.stdout);
        const originalErr = process.stderr.write.bind(process.stderr);
        process.stdout.write = ((chunk: string) => { outChunks.push(chunk.toString()); return true; }) as typeof process.stdout.write;
        process.stderr.write = ((chunk: string) => { errChunks.push(chunk.toString()); return true; }) as typeof process.stderr.write;
        try {
            const status = fn();
            return { status, stdout: outChunks.join(""), stderr: errChunks.join("") };
        } finally {
            process.stdout.write = originalOut;
            process.stderr.write = originalErr;
        }
    }

    it("returns 2 and writes usage when --entry is absent", () => {
        const result = captureWrites(() => runCli([]));
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("usage:");
    });

    it("returns 0 and renders the per-repo diff header on success", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/web-app", base: web.base, head: web.head }]);

        const result = captureWrites(() => runCli(["--entry", entryDir, "--hub", hubRoot]));
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(`=== repo github.com/acme/web-app checkout ${web.root} range ${web.base}...${web.head} ===`);
    });

    it("defaults --hub to the current working directory when omitted", () => {
        const parent = makeParent();
        const { hubRoot, web } = buildHubFixture(parent);
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/web-app", base: web.base, head: web.head }]);

        const originalCwd = process.cwd();
        process.chdir(hubRoot);
        try {
            const result = captureWrites(() => runCli(["--entry", entryDir]));
            expect(result.status).toBe(0);
        } finally {
            process.chdir(originalCwd);
        }
    });

    it("returns 1 and renders every diagnostic on failure", () => {
        const parent = makeParent();
        const { hubRoot, api } = buildHubFixture(parent);
        fs.rmSync(api.root, { recursive: true, force: true });
        const entryDir = writeEntry(hubRoot, [{ repo: "github.com/acme/api", base: api.base, head: api.head }]);

        const result = captureWrites(() => runCli(["--entry", entryDir, "--hub", hubRoot]));
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Diff derivation failed: 1 problem(s)");
        expect(result.stderr).toContain("missing-checkout");
    });
});

describe("renderRepoDiffs / renderDeriveFailure", () => {
    it("renderRepoDiffs joins one header block per repo diff", () => {
        const rendered = renderRepoDiffs("demo-entry", [
            { repo: "github.com/acme/web-app", checkout: "/repos/web-app", base: "a".repeat(40), head: "b".repeat(40), diff: "diff --git a/x b/x\n" },
        ]);
        expect(rendered).toContain("entry demo-entry: 1 repo diff(s)");
        expect(rendered).toContain("=== repo github.com/acme/web-app checkout /repos/web-app");
        expect(rendered).toContain("diff --git a/x b/x");
    });

    it("renderDeriveFailure lists every diagnostic under the failing entry", () => {
        const rendered = renderDeriveFailure([
            { entry: "demo-entry", problem: "missing-checkout", message: "member 'api' is not checked out" },
            { entry: "demo-entry", problem: "unreachable-sha", message: "sha not reachable" },
        ]);
        expect(rendered).toContain("Diff derivation failed: 2 problem(s) for entry demo-entry");
        expect(rendered).toContain("missing-checkout: member 'api' is not checked out");
        expect(rendered).toContain("unreachable-sha: sha not reachable");
    });
});
