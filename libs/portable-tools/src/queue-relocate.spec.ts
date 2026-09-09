import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultRunner } from "@nexus/workspace/run";
import { relocateQueue, renderRelocateFailure, renderRelocateOutcome } from "./queue-relocate.js";

function sh(cwd: string, cmd: string, ...args: string[]): string {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
    }
    return r.stdout.replace(/\n$/, "");
}

function initRepo(dir: string, origin?: string): void {
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    if (origin) {
        sh(dir, "git", "remote", "add", "origin", origin);
    }
}

function commitAll(dir: string, msg: string): string {
    sh(dir, "git", "add", "-A");
    sh(dir, "git", "commit", "-qm", msg);
    return sh(dir, "git", "rev-parse", "HEAD");
}

function writeCloseRecord(entryDir: string, repo: string): void {
    fs.mkdirSync(entryDir, { recursive: true });
    fs.writeFileSync(path.join(entryDir, "epic.md"), "# epic\n");
    fs.writeFileSync(
        entryDir + "/close-record.md",
        [
            "---",
            "range:",
            `  - repo: ${repo}`,
            '    base: "' + "a1".repeat(20) + '"',
            '    head: "' + "b2".repeat(20) + '"',
            "---",
            "# close record",
            "",
        ].join("\n"),
    );
}

describe("relocateQueue", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function buildWorkspace(): { parent: string; hubRoot: string; memberRoot: string } {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-relocate-"));
        tmpDirs.push(parent);

        const hubRoot = path.join(parent, "docs-hub");
        initRepo(hubRoot);
        fs.mkdirSync(path.join(hubRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(hubRoot, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n" +
                "members:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n",
        );
        commitAll(hubRoot, "init hub");

        const memberRoot = path.join(parent, "web-app");
        initRepo(memberRoot, "git@github.com:acme/web-app.git");
        fs.mkdirSync(path.join(memberRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(memberRoot, ".nexus", "config", "hub.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
        );

        return { parent, hubRoot, memberRoot };
    }

    it("copies a stranded entry into the hub queue, commits it, and leaves the member copy", () => {
        const { hubRoot, memberRoot } = buildWorkspace();
        const entryDir = path.join(memberRoot, ".nexus", "queue", "epic-9");
        writeCloseRecord(entryDir, "github.com/acme/web-app");

        const result = relocateQueue(hubRoot, defaultRunner);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.outcome.relocated).toHaveLength(1);
        expect(result.outcome.relocated[0].entry).toBe("epic-9");
        expect(fs.existsSync(path.join(hubRoot, ".nexus", "queue", "epic-9", "epic.md"))).toBe(true);
        // Never removed from the member.
        expect(fs.existsSync(entryDir)).toBe(true);
        expect(result.outcome.relocated[0].removeCommand).toContain("epic-9");

        const status = sh(hubRoot, "git", "status", "--porcelain");
        expect(status).toBe("");
    });

    it("is idempotent: a second run copies nothing and reports zero", () => {
        const { hubRoot, memberRoot } = buildWorkspace();
        const entryDir = path.join(memberRoot, ".nexus", "queue", "epic-9");
        writeCloseRecord(entryDir, "github.com/acme/web-app");

        const first = relocateQueue(hubRoot, defaultRunner);
        expect(first.ok).toBe(true);

        const second = relocateQueue(hubRoot, defaultRunner);
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(second.outcome.relocated).toHaveLength(0);
        expect(second.outcome.alreadyPresent).toHaveLength(1);
    });

    it("gates every entry before copying any: one bad entry refuses the whole run", () => {
        const { hubRoot, memberRoot } = buildWorkspace();
        writeCloseRecord(path.join(memberRoot, ".nexus", "queue", "epic-9"), "github.com/acme/web-app");
        // epic-10 has no close-record.md at all.
        fs.mkdirSync(path.join(memberRoot, ".nexus", "queue", "epic-10"), { recursive: true });
        fs.writeFileSync(path.join(memberRoot, ".nexus", "queue", "epic-10", "epic.md"), "# epic\n");

        const result = relocateQueue(hubRoot, defaultRunner);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors.some((e) => e.entry === "epic-10")).toBe(true);
        // Nothing was created for the good entry either.
        expect(fs.existsSync(path.join(hubRoot, ".nexus", "queue", "epic-9"))).toBe(false);
    });

    it("refuses an entry whose range names a repository the hub does not declare", () => {
        const { hubRoot, memberRoot } = buildWorkspace();
        writeCloseRecord(path.join(memberRoot, ".nexus", "queue", "epic-9"), "github.com/acme/unknown-repo");

        const result = relocateQueue(hubRoot, defaultRunner);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("unknown-repo");
    });

    it("refuses a run that starts outside the hub", () => {
        const { memberRoot } = buildWorkspace();
        const result = relocateQueue(memberRoot, defaultRunner);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0].problem).toBe("must-run-from-hub");
    });

    it("renders a failure and an outcome as readable text", () => {
        const { hubRoot, memberRoot } = buildWorkspace();
        fs.mkdirSync(path.join(memberRoot, ".nexus", "queue", "epic-11"), { recursive: true });
        const failed = relocateQueue(hubRoot, defaultRunner);
        expect(failed.ok).toBe(false);
        if (!failed.ok) {
            expect(renderRelocateFailure(failed.errors)).toContain("epic-11");
        }

        writeCloseRecord(path.join(memberRoot, ".nexus", "queue", "epic-11"), "github.com/acme/web-app");
        const ok = relocateQueue(hubRoot, defaultRunner);
        expect(ok.ok).toBe(true);
        if (ok.ok) {
            expect(renderRelocateOutcome(ok.outcome)).toContain("epic-11");
        }
    });
});
