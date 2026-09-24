/**
 * The two repositories a published verdict names, resolved by the toolkit rather than handed to it
 * (epic #751, decision record #764, invariants 3 and 4).
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveVerdictRepos, resolveVerdictRoots } from "./verdict-repos.js";
import { defaultRunner, type Runner } from "./run.js";

const made: string[] = [];

function checkout(settings?: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verdict-repos-"));
    made.push(dir);
    if (settings !== undefined) {
        fs.mkdirSync(path.join(dir, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".nexus", "config", "settings.yml"), settings);
    }
    return dir;
}

function ghRepo(nameWithOwner: string): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "repo" && args[1] === "view") {
            return { status: 0, stdout: `${nameWithOwner}\n`, stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

/** Answers `gh repo view` by the directory it runs in, as a hub and a member checkout would. */
function ghRepoByCwd(byCwd: Record<string, string>): Runner {
    return (cmd, args, opts) => {
        const nameWithOwner = opts?.cwd !== undefined ? byCwd[opts.cwd] : undefined;
        if (cmd === "gh" && args[0] === "repo" && args[1] === "view" && nameWithOwner !== undefined) {
            return { status: 0, stdout: `${nameWithOwner}\n`, stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

const ghBroken: Runner = () => ({ status: 1, stdout: "", stderr: "could not determine the repository" });

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("resolveVerdictRepos", () => {
    it("reads the issues repository the checkout declares, beside the code repository it sits in", () => {
        const dir = checkout("github:\n  epic-repo: geo-nexus/docs\n");
        const r = resolveVerdictRepos(ghRepo("geo-nexus/giccp"), dir);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "geo-nexus/docs", repo: "geo-nexus/giccp" });
    });

    it("falls back to the checkout's own repository when nothing declares an issues repository", () => {
        const r = resolveVerdictRepos(ghRepo("sameera/nexus"), checkout());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "sameera/nexus", repo: "sameera/nexus" });
    });

    it("never resolves an empty issues repository, even when the declared value is blank", () => {
        const r = resolveVerdictRepos(ghRepo("sameera/nexus"), checkout("github:\n  issues-repo:\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos.issuesRepo).toBe("sameera/nexus");
    });

    it("stops the run when the repository cannot be resolved at all", () => {
        const r = resolveVerdictRepos(ghBroken, checkout());
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("repo-unresolved");
    });
});

describe("resolveVerdictRepos across a hub and a member checkout (#783)", () => {
    it("names the code repository from the member and the issues repository from the hub", () => {
        const hub = checkout("github:\n  epic-repo: geo-nexus/docs\n");
        const member = checkout();
        const run = ghRepoByCwd({ [hub]: "geo-nexus/docs", [member]: "geo-nexus/giccp" });
        const r = resolveVerdictRepos(run, hub, member);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "geo-nexus/docs", repo: "geo-nexus/giccp" });
    });

    it("falls back to the hub's own repository, not the member's, when the hub declares none", () => {
        const hub = checkout();
        const member = checkout("github:\n  epic-repo: geo-nexus/giccp\n");
        const run = ghRepoByCwd({ [hub]: "geo-nexus/docs", [member]: "geo-nexus/giccp" });
        const r = resolveVerdictRepos(run, hub, member);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "geo-nexus/docs", repo: "geo-nexus/giccp" });
    });

    it("stops the run when the member's repository cannot be resolved", () => {
        const hub = checkout();
        const member = checkout();
        const r = resolveVerdictRepos(ghRepoByCwd({ [hub]: "geo-nexus/docs" }), hub, member);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("repo-unresolved");
        expect(r.error.message).toContain(member);
    });
});

function git(cwd: string, ...args: string[]): void {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
}

function gitRepo(dir: string, files: Record<string, string> = {}): string {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "spec@example.com");
    git(dir, "config", "user.name", "spec");
    for (const [rel, body] of Object.entries({ "base.txt": "base\n", ...files })) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
    }
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "init");
    return dir;
}

/** A hub and a sibling member, laid out the way a real workspace sits on disk. */
function workspace(): { hub: string; member: string } {
    const parent = fs.realpathSync(checkout());
    const hub = gitRepo(path.join(parent, "docs"), {
        ".nexus/config/workspace.yml":
            "hub:\n  name: docs\n  remote: git@github.com:geo-nexus/docs.git\n" +
            "members:\n  - name: giccp\n    remote: git@github.com:geo-nexus/giccp.git\n",
    });
    const member = gitRepo(path.join(parent, "giccp"), {
        ".nexus/config/hub.yml": "hub:\n  name: docs\n  remote: git@github.com:geo-nexus/docs.git\n",
    });
    return { hub, member };
}

describe("resolveVerdictRoots (#783)", () => {
    it("reads the code side from the member and the issues side from the hub", () => {
        const { hub, member } = workspace();
        const r = resolveVerdictRoots(defaultRunner, member);
        expect(r).toEqual({ ok: true, roots: { codeRoot: member, issuesRoot: hub } });
    });

    it("gives the same answer from a directory inside the member", () => {
        const { hub, member } = workspace();
        fs.mkdirSync(path.join(member, "src"));
        const r = resolveVerdictRoots(defaultRunner, path.join(member, "src"));
        expect(r).toEqual({ ok: true, roots: { codeRoot: member, issuesRoot: hub } });
    });

    it("still finds the hub from a member worktree that sits nowhere near it, as an analyze worktree does", () => {
        const { hub, member } = workspace();
        const wt = path.join(fs.realpathSync(checkout()), "pr-640-analyze");
        git(member, "worktree", "add", "-q", "--detach", wt);
        const r = resolveVerdictRoots(defaultRunner, wt);
        expect(r).toEqual({ ok: true, roots: { codeRoot: wt, issuesRoot: hub } });
    });

    it("keeps both sides on the hub when run from the hub", () => {
        const { hub } = workspace();
        const r = resolveVerdictRoots(defaultRunner, hub);
        expect(r).toEqual({ ok: true, roots: { codeRoot: hub, issuesRoot: hub } });
    });

    it("keeps both sides on the checkout in a single-repo project", () => {
        const solo = gitRepo(path.join(fs.realpathSync(checkout()), "solo"));
        const r = resolveVerdictRoots(defaultRunner, solo);
        expect(r).toEqual({ ok: true, roots: { codeRoot: solo, issuesRoot: solo } });
    });

    it("stops the run when the member's hub is not checked out beside it", () => {
        const member = gitRepo(path.join(fs.realpathSync(checkout()), "giccp"), {
            ".nexus/config/hub.yml": "hub:\n  name: docs\n  remote: git@github.com:geo-nexus/docs.git\n",
        });
        const r = resolveVerdictRoots(defaultRunner, member);
        expect(r.ok).toBe(false);
    });
});
