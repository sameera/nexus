/**
 * The solo lane's range resolver (epic #799, story #803). Each case builds a real repository with
 * a bare upstream and asks the CLI, the way `/nxs.ship` does.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli.js";

function sh(cwd: string, ...args: string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commit(repo: string, file: string, text: string): string {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), text);
    sh(repo, "add", "-A");
    sh(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", file);
    return sh(repo, "rev-parse", "HEAD");
}

function repo(withUpstream: boolean): { dir: string; root: string } {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "ship-range-"));
    sh(dir, "init", "-q", "-b", "main");
    const root: string = commit(dir, "a.txt", "a\n");
    if (withUpstream) {
        const bare: string = fs.mkdtempSync(path.join(os.tmpdir(), "ship-range-origin-"));
        sh(bare, "init", "-q", "--bare");
        sh(dir, "remote", "add", "origin", bare);
        sh(dir, "push", "-q", "origin", "main");
    }
    return { dir, root };
}

async function range(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
    const out: string[] = [];
    const err: string[] = [];
    const io: CliIo = { cwd, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) };
    const code: number = await runNexusCli(["ship-range", ...args], io, { home: cwd });
    return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("nexus ship-range (story #803)", () => {
    it("with --since, is the commits after the ref up to the current commit, as full identifiers", async () => {
        const { dir, root } = repo(false);
        commit(dir, "b.txt", "b\n");
        const head: string = commit(dir, "c.txt", "c\n");
        const r = await range(dir, "--since", root.slice(0, 7));
        expect(r.code).toBe(0);
        expect(JSON.parse(r.out)).toMatchObject({ base: root, head, source: "since", commits: 2 });
    });

    it("without --since, is the commits the upstream tracking ref lacks", async () => {
        const { dir, root } = repo(true);
        const head: string = commit(dir, "b.txt", "b\n");
        const r = await range(dir);
        expect(r.code).toBe(0);
        expect(JSON.parse(r.out)).toMatchObject({ base: root, head, source: "upstream", ref: "origin/main", commits: 1 });
    });

    it("refuses an empty range — on the trunk after a push — and names --since", async () => {
        const { dir } = repo(true);
        const r = await range(dir);
        expect(r.code).toBe(1);
        expect(r.err).toContain("range-empty");
        expect(r.err).toContain("--since");
    });

    it("counts a range that only touches the pipeline stores as empty", async () => {
        const { dir } = repo(true);
        commit(dir, ".nexus/queue/epic-1/me/notes-x.md", "n\n");
        const r = await range(dir);
        expect(r.code).toBe(1);
        expect(r.err).toContain("range-empty");
    });

    it("refuses no upstream and no --since, naming --since", async () => {
        const { dir } = repo(false);
        commit(dir, "b.txt", "b\n");
        const r = await range(dir);
        expect(r.code).toBe(1);
        expect(r.err).toContain("range-no-upstream");
        expect(r.err).toContain("--since");
    });

    it("refuses a --since that is not an ancestor of the current commit, naming --since", async () => {
        const { dir } = repo(false);
        sh(dir, "checkout", "-q", "-b", "side");
        const side: string = commit(dir, "s.txt", "s\n");
        sh(dir, "checkout", "-q", "main");
        commit(dir, "b.txt", "b\n");
        const r = await range(dir, "--since", side);
        expect(r.code).toBe(1);
        expect(r.err).toContain("range-since-not-ancestor");
        expect(r.err).toContain("--since");
    });
});
