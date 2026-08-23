/**
 * The `nexus` CLI entrypoint (STORY-60.01). Pins the user-visible verb surface: `nexus deploy`
 * installs the vendored component payload into the invoking repo, usage errors are named and
 * non-zero, and the bundled artifact runs to completion on a plain `node` binary in a checkout
 * with no in-repo toolchain — resolving its payload beside itself (the vendored posture).
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBundle } from "./bundle";
import { runNexusCli, VERB_NAMES, type CliIo } from "./nexus-cli";
import { copyComponentTree, COMPONENT_PAYLOAD_DIRNAME } from "./vendor-components";

let tmpDirs: string[] = [];

function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function makePayload(): string {
    const dir: string = makeTmpDir("cli-payload-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(dir, "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "epic\n");
    fs.writeFileSync(path.join(dir, "skills", "nxs-setup", "SKILL.md"), "setup\n");
    return dir;
}

interface CapturedIo extends CliIo {
    out: string[];
    err: string[];
}

function makeIo(cwd: string): CapturedIo {
    const out: string[] = [];
    const err: string[] = [];
    return {
        cwd,
        out,
        err,
        stdout: (s: string): void => {
            out.push(s);
        },
        stderr: (s: string): void => {
            err.push(s);
        },
    };
}

describe("verb dispatch", () => {
    it("prints usage and exits 0 on --help", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli(["--help"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("nexus deploy");
    });

    it("prints usage and exits 2 when no verb is given", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli([], io)).toBe(2);
        expect(io.err.join("\n")).toContain("usage");
    });

    it("names an unknown verb and exits 2", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli(["frobnicate"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("frobnicate");
    });

    it("--help names every registered verb, including the three new resolvers (story #272)", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli(["--help"], io)).toBe(0);
        const help: string = io.out.join("\n");
        expect(help).toContain("nexus abs-doc-path");
        expect(help).toContain("nexus epic-resolve");
        expect(help).toContain("nexus record-digest");
    });

    it("--help names the worktree and migration verbs (story #273)", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli(["--help"], io)).toBe(0);
        const help: string = io.out.join("\n");
        expect(help).toContain("nexus pr-worktree");
        expect(help).toContain("nexus close-migration");
    });

    it("VERB_NAMES is derived from the registry and lists every registered verb", () => {
        expect(VERB_NAMES).toEqual(
            expect.arrayContaining([
                "deploy",
                "workspace",
                "abs-doc-path",
                "epic-resolve",
                "record-digest",
                "pr-worktree",
                "close-migration",
            ]),
        );
        expect(new Set(VERB_NAMES).size).toBe(VERB_NAMES.length);
    });
});

describe("nexus deploy", () => {
    it("installs the payload into the invoking repo", async () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("cli-repo-");
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["deploy", "--payload", payload], io);

        expect(code).toBe(0);
        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic\n");
        expect(io.out.join("\n")).toContain("deployed");
    });

    it("re-running converges to an identical component set and still exits 0", async () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("cli-repo-");

        expect(await runNexusCli(["deploy", "--payload", payload], makeIo(repo))).toBe(0);
        expect(await runNexusCli(["deploy", "--payload", payload], makeIo(repo))).toBe(0);
        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic\n");
    });

    it("fails with a named error when the payload directory does not exist", async () => {
        const repo: string = makeTmpDir("cli-repo-");
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["deploy", "--payload", path.join(repo, "missing")], io);

        expect(code).toBe(1);
        expect(io.err.join("\n")).toContain("payload");
    });
});

describe("nexus abs-doc-path", () => {
    function makeAbsDocPathRepo(settingsYaml?: string): string {
        const repo: string = makeTmpDir("cli-abs-doc-path-repo-");
        fs.mkdirSync(path.join(repo, ".git"));
        if (settingsYaml !== undefined) {
            fs.mkdirSync(path.join(repo, ".nexus", "config"), { recursive: true });
            fs.writeFileSync(path.join(repo, ".nexus", "config", "settings.yml"), settingsYaml);
        }
        return repo;
    }

    it("prints one absolute URL per relative path", async () => {
        const repo: string = makeAbsDocPathRepo(["cross-ref:", "  docs-root: https://github.com/acme/app/blob/main/docs"].join("\n"));
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["abs-doc-path", "docs/a.md", "docs/b.md"], io);

        expect(code).toBe(0);
        expect(io.out.join("\n")).toBe(
            ["https://github.com/acme/app/blob/main/docs/a.md", "https://github.com/acme/app/blob/main/docs/b.md"].join("\n"),
        );
    });

    it("exits 3 (not the generic usage code 2) when no path is given", async () => {
        const io: CapturedIo = makeIo(makeAbsDocPathRepo());
        expect(await runNexusCli(["abs-doc-path"], io)).toBe(3);
    });

    it("exits 1 with a named diagnostic when the cross-ref URL disagrees with the resolved docs root", async () => {
        const repo: string = makeAbsDocPathRepo(["cross-ref:", "  docs-root: https://github.com/acme/app/blob/main/other"].join("\n"));
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["abs-doc-path", "docs/a.md"], io);

        expect(code).toBe(1);
        expect(io.err.join("\n")).toContain("disagrees with the resolved docs root");
    });
});

describe("nexus epic-resolve (registration only — network path covered by the migration-axis parity corpus)", () => {
    it("exits 2 with a usage diagnostic when --epic is missing", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-epic-resolve-"));
        expect(await runNexusCli(["epic-resolve"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("--epic");
    });
});

describe("nexus record-digest (registration only — network path covered by the migration-axis parity corpus)", () => {
    it("exits 2 with a usage diagnostic when --issue is missing", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-record-digest-"));
        expect(await runNexusCli(["record-digest"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("--issue");
    });
});

describe("nexus pr-worktree (registration only — git/gh effect path covered by the migration-axis parity corpus)", () => {
    it("exits 2 with a usage diagnostic when --pr is missing", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-pr-worktree-"));
        expect(await runNexusCli(["pr-worktree", "preflight"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("--pr");
    });

    it("exits 2 with a usage diagnostic when remove has no wtPath", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-pr-worktree-"));
        expect(await runNexusCli(["pr-worktree", "remove"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("remove");
    });

    it("names an unknown subcommand and exits 2", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-pr-worktree-"));
        expect(await runNexusCli(["pr-worktree", "bogus"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("usage");
    });
});

describe("nexus close-migration (registration only — full effect covered by the migration-axis parity corpus)", () => {
    it("preflight resolves single-repo mode from a plain git repo", async () => {
        const repo: string = makeTmpDir("cli-close-migration-");
        execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
        const io: CapturedIo = makeIo(repo);

        expect(await runNexusCli(["close-migration", "preflight", repo], io)).toBe(0);
        expect(io.out.join("\n")).toContain("single-repo mode");
    });

    it("exits 2 with a usage diagnostic when migrate has no entry-dir", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-close-migration-"));
        expect(await runNexusCli(["close-migration", "migrate"], io)).toBe(2);
    });

    it("names an unknown subcommand and exits 2", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-close-migration-"));
        expect(await runNexusCli(["close-migration", "bogus"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("usage");
    });
});

describe("bare-runtime portability (epic #60 success metric)", () => {
    it("the bundled nexus.mjs deploys on plain node, resolving its payload beside itself", async () => {
        // Arrange a distributable: bundle + vendored payload side by side, no node_modules anywhere.
        const toolsDir: string = makeTmpDir("cli-tools-");
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath: string = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);
        copyComponentTree(makePayload(), path.join(toolsDir, COMPONENT_PAYLOAD_DIRNAME));
        const repo: string = makeTmpDir("cli-bare-repo-");

        const stdout: string = execFileSync(process.execPath, [bundlePath, "deploy"], {
            cwd: repo,
            encoding: "utf8",
        });

        expect(stdout).toContain("deployed");
        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic\n");
    });

    it("the bundled nexus.mjs runs abs-doc-path on plain node with no installed packages", async () => {
        const toolsDir: string = makeTmpDir("cli-tools-abs-doc-path-");
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath: string = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);
        const repo: string = makeTmpDir("cli-bare-repo-abs-doc-path-");
        fs.mkdirSync(path.join(repo, ".git"));

        const stdout: string = execFileSync(process.execPath, [bundlePath, "abs-doc-path", "docs/a.md"], {
            cwd: repo,
            encoding: "utf8",
        });

        expect(stdout.trim()).toContain("{username|orgname}/{reponame}");
    });

    it("the bundled nexus.mjs runs close-migration on plain node with no installed packages", async () => {
        const toolsDir: string = makeTmpDir("cli-tools-close-migration-");
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath: string = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);
        const repo: string = makeTmpDir("cli-bare-repo-close-migration-");
        execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });

        const stdout: string = execFileSync(process.execPath, [bundlePath, "close-migration", "preflight", repo], {
            cwd: repo,
            encoding: "utf8",
        });

        expect(stdout).toContain("single-repo mode");
    });

    it("the bundled nexus.mjs runs pr-worktree on plain node with no installed packages", async () => {
        const toolsDir: string = makeTmpDir("cli-tools-pr-worktree-");
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath: string = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);
        const repo: string = makeTmpDir("cli-bare-repo-pr-worktree-");
        execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });

        // No worktree is registered at this path; `remove` is a no-op success — proves the verb
        // resolves every module it touches (identity/worktree/diagnostic/render) on a bare runtime
        // without needing gh or a real PR.
        const stdout: string = execFileSync(
            process.execPath,
            [bundlePath, "pr-worktree", "remove", path.join(repo, "nonexistent-worktree")],
            { cwd: repo, encoding: "utf8" },
        );

        expect(stdout).toContain('"removed":true');
    });
});
