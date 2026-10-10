/**
 * The two repositories a published verdict names, resolved by the toolkit rather than handed to it
 * (epic #751, decision record #764, invariants 3 and 4).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalIssuesRepo, fetchRecordIn, issuesRepoSlug, onIssuesHost, resolveVerdictRepos, sameIssuesRepo } from "./verdict-repos.js";
import { type Runner } from "./run.js";

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

describe("issuesRepoSlug — the one parse of the issues repository (#906)", () => {
    it("reads owner/repo, host/owner/repo, and a URL with or without a trailing slash or .git", () => {
        for (const configured of ["acme/issues", "github.com/acme/issues", "https://github.com/acme/issues", "https://github.com/acme/issues/", "https://github.com/acme/issues.git", "acme/issues.git", "git@github.com:acme/issues.git"]) {
            expect(issuesRepoSlug(configured), configured).toEqual({ owner: "acme", repo: "issues" });
        }
    });
});

describe("canonicalIssuesRepo — the one written form close uses (#906)", () => {
    it("keeps the host a configured form names, folding github.com's aliases, and owner/repo alone when it names none", () => {
        expect(canonicalIssuesRepo("acme/issues")).toBe("acme/issues");
        expect(canonicalIssuesRepo("Acme/Plan")).toBe("Acme/Plan");
        expect(canonicalIssuesRepo("https://GitHub.com/Acme/Issues")).toBe("github.com/Acme/Issues");
        for (const configured of ["https://github.com/acme/issues/", "git@github.com:acme/issues.git", "git@github.com-work:acme/issues.git", "github.com/acme/issues"]) {
            expect(canonicalIssuesRepo(configured), configured).toBe("github.com/acme/issues");
        }
        expect(canonicalIssuesRepo("ssh://git@ghe.corp:22/acme/issues.git")).toBe("ghe.corp/acme/issues");
        expect(canonicalIssuesRepo("not a repo")).toBe("not a repo");
    });

    it("sends gh api calls for an issues repository on a stated host to that host", () => {
        const calls: string[][] = [];
        const run = onIssuesHost((cmd: string, args: string[]) => {
            calls.push([cmd, ...args]);
            return { status: 0, stdout: "", stderr: "" };
        }, "ghe.corp/acme/issues");
        run("gh", ["api", "graphql"], { cwd: "/" });
        run("gh", ["issue", "view", "5"], { cwd: "/" });
        run("gh", ["issue", "view", "6", "--repo", "acme/issues"], { cwd: "/" });
        run("gh", ["issue", "close", "7", "-R", "ghe.other/acme/issues"], { cwd: "/" });
        run("gh", ["api", "--hostname=ghe.other", "graphql"], { cwd: "/" });
        expect(calls).toEqual([
            ["gh", "api", "--hostname", "ghe.corp", "graphql"],
            ["gh", "issue", "view", "5"],
            ["gh", "issue", "view", "6", "--repo", "ghe.corp/acme/issues"],
            ["gh", "issue", "close", "7", "-R", "ghe.other/acme/issues"],
            ["gh", "api", "--hostname=ghe.other", "graphql"],
        ]);
    });
});

describe("sameIssuesRepo — one issues repository in any written form (#906)", () => {
    it("matches across forms and a form with no host either way, but not two stated hosts that differ", () => {
        expect(sameIssuesRepo("acme/app", "https://github.com/Acme/App")).toBe(true);
        expect(sameIssuesRepo("git@github.com-work:acme/app.git", "github.com/acme/app")).toBe(true);
        expect(sameIssuesRepo("acme/app", "ghe.corp/acme/app")).toBe(true);
        expect(sameIssuesRepo("github.com/acme/app", "ghe.corp/acme/app")).toBe(false);
    });
});

describe("fetchRecordIn — a record read in any written form of the issues repository (#906)", () => {
    it.each([
        ["github.com/acme/plan", "github.com"],
        ["https://github.com/acme/plan", "github.com"],
        ["ghe.corp/acme/plan", "ghe.corp"],
        ["git@ghe.corp:acme/plan.git", "ghe.corp"],
    ])("reads %s on its host by its owner/repo path", (repo, host) => {
        const calls: string[][] = [];
        const run: Runner = (cmd, args) => {
            calls.push([cmd, ...args]);
            return { status: 1, stdout: "", stderr: "stop" };
        };
        fetchRecordIn(run, "/", 9, repo);
        expect(calls).toEqual([["gh", "api", "--hostname", host, "repos/acme/plan/issues/9"]]);
    });

    it("reads acme/plan, or the checkout's own repository, on gh's own host", () => {
        const calls: string[][] = [];
        const run: Runner = (cmd, args) => {
            calls.push([cmd, ...args]);
            return { status: 1, stdout: "", stderr: "stop" };
        };
        fetchRecordIn(run, "/", 9, "acme/plan");
        fetchRecordIn(run, "/", 9, null);
        expect(calls).toEqual([
            ["gh", "api", "repos/acme/plan/issues/9"],
            ["gh", "api", "repos/{owner}/{repo}/issues/9"],
        ]);
    });
});
