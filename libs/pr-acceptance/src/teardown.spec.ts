import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { teardown } from "./teardown.js";
import { MARKER_PATH, MARKER_SIGNATURE, SCRATCH_REPO_NAME } from "./names.js";
import { type Route, callsMatching, fakeRunner, initRepo, makeTempDir, sh, writeCommit } from "./harness-fixtures.js";
import { defaultRunner } from "./run.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

const NWO = `sameera/${SCRATCH_REPO_NAME}`;

const LOGIN: Route = { match: "gh api user", result: { stdout: "sameera\n" } };
const SCOPES: Route = { match: "gh auth status", result: { stdout: "Token scopes: 'repo', 'delete_repo'\n" } };
const EXISTS: Route = { match: "gh repo view", result: { stdout: JSON.stringify({ url: `https://github.com/${NWO}` }) } };
const GONE: Route = { match: "gh repo view", result: { status: 1, stderr: "Could not resolve to a Repository" } };
const OWN_MARKER: Route = {
    match: `gh api repos/${NWO}/contents/${MARKER_PATH}`,
    result: {
        stdout: Buffer.from(
            `signature: ${MARKER_SIGNATURE}\nnameWithOwner: ${NWO}\ntoolchainCommit: ${"a".repeat(40)}\nprovisionedAt: 2026-07-20\n`,
        ).toString("base64"),
    },
};
const NO_MARKER: Route = { match: "gh api repos/", result: { status: 1, stderr: "Not Found" } };

/** A host checkout plus a clone that carries a worktree, under the harness's temp root. */
function world(opts: { hostWorktree?: boolean; hostBranch?: boolean; cloneWorktree?: boolean } = {}) {
    const host = path.join(makeTempDir(tracked), "nexus");
    initRepo(host);
    writeCommit(host, "a.txt", "a\n", "C0");

    // The clone lives under the harness temp root, as it does in a real run.
    const harnessRoot = path.join(os.tmpdir(), "nexus-pr-acceptance", `spec-${process.pid}-${Math.random().toString(16).slice(2)}`);
    tracked.push(harnessRoot);
    const clone = path.join(harnessRoot, "clone");
    initRepo(clone);
    writeCommit(clone, "a.txt", "a\n", "C0");

    if (opts.cloneWorktree) {
        sh(clone, "git", "worktree", "add", "--detach", path.join(harnessRoot, "wt"), "HEAD");
    }
    if (opts.hostWorktree) {
        sh(host, "git", "worktree", "add", "--detach", path.join(harnessRoot, "host-wt"), "HEAD");
    }
    if (opts.hostBranch) {
        sh(host, "git", "branch", "acceptance/leftover");
    }
    return { host, clone, harnessRoot };
}

function runner(routes: Route[]) {
    return fakeRunner(routes, defaultRunner);
}

describe("teardown", () => {
    it("deletes the scratch repo and leaves zero local residue", () => {
        const w = world({ cloneWorktree: true, hostBranch: true });
        const run = runner([LOGIN, SCOPES, EXISTS, OWN_MARKER, { match: "gh repo delete" }]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok ? "ok" : r.error).toBe("ok");
        if (!r.ok) return;
        expect(r.value.remoteDeleted).toBe(true);
        expect(r.value.residue.clean).toBe(true);
        expect(fs.existsSync(w.clone)).toBe(false);
        expect(sh(w.host, "git", "worktree", "list")).not.toContain("host-wt");
        expect(sh(w.host, "git", "branch", "--list")).not.toContain("acceptance/leftover");
    });

    it("removes a worktree the flow left registered in the host checkout", () => {
        const w = world({ hostWorktree: true });
        const run = runner([LOGIN, SCOPES, EXISTS, OWN_MARKER, { match: "gh repo delete" }]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.removedLocal.some((p) => p.includes("host-wt"))).toBe(true);
        expect(r.value.residue.hostWorktrees).toEqual([]);
    });

    it("keeps the repo and prints its URL on keep-alive, while still removing local residue", () => {
        const w = world({ cloneWorktree: true });
        const run = runner([LOGIN, SCOPES, EXISTS, OWN_MARKER]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: true });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.remoteDeleted).toBe(false);
        expect(r.value.survivingUrl).toBe(`https://github.com/${NWO}`);
        expect(callsMatching(run, "gh repo delete")).toEqual([]);
        expect(fs.existsSync(w.clone)).toBe(false);
        expect(r.value.residue.clean).toBe(true);
    });

    it("refuses to delete a repo that does not carry the harness's own marker", () => {
        const w = world();
        const run = runner([LOGIN, SCOPES, EXISTS, NO_MARKER]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("marker-mismatch");
        expect(callsMatching(run, "gh repo delete")).toEqual([]);
    });

    it("still removes local residue when the remote delete is refused", () => {
        const w = world({ cloneWorktree: true });
        const run = runner([LOGIN, SCOPES, EXISTS, NO_MARKER]);
        teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(fs.existsSync(w.clone)).toBe(false);
    });

    it("converges when run twice — a repo that is already gone is success", () => {
        const w = world();
        const run = runner([LOGIN, SCOPES, GONE]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.remoteDeleted).toBe(false);
        expect(r.value.residue.clean).toBe(true);
        expect(callsMatching(run, "gh repo delete")).toEqual([]);
    });

    it("needs no state from provision — it derives its targets from the deterministic name", () => {
        const w = world();
        fs.rmSync(w.clone, { recursive: true, force: true });
        const run = runner([LOGIN, SCOPES, EXISTS, OWN_MARKER, { match: "gh repo delete" }]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.nameWithOwner).toBe(NWO);
        expect(r.value.remoteDeleted).toBe(true);
    });

    it("never removes an unrelated worktree the maintainer keeps in the host checkout", () => {
        const w = world();
        const mine = path.join(makeTempDir(tracked), "my-feature-wt");
        sh(w.host, "git", "worktree", "add", "--detach", mine, "HEAD");
        const run = runner([LOGIN, SCOPES, EXISTS, OWN_MARKER, { match: "gh repo delete" }]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(fs.existsSync(mine)).toBe(true);
        // It is reported as residue, but it is the maintainer's to remove, not the harness's.
        expect(r.value.residue.hostWorktrees.length).toBe(1);
        expect(r.value.removedLocal.some((p) => p.includes("my-feature-wt"))).toBe(false);
    });

    it("never removes a branch outside the harness prefix", () => {
        const w = world();
        sh(w.host, "git", "branch", "feature/mine");
        const run = runner([LOGIN, SCOPES, EXISTS, OWN_MARKER, { match: "gh repo delete" }]);
        teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(sh(w.host, "git", "branch", "--list")).toContain("feature/mine");
    });

    it("leaves the run's emitted evidence in place", () => {
        const w = world();
        const run = runner([LOGIN, SCOPES, EXISTS, OWN_MARKER, { match: "gh repo delete" }]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.evidencePath).toContain("evidence");
        expect(r.value.evidencePath.startsWith(w.clone)).toBe(false);
    });

    it("reports a failing remote delete instead of claiming the repo is gone", () => {
        const w = world();
        const run = runner([
            LOGIN,
            SCOPES,
            EXISTS,
            OWN_MARKER,
            { match: "gh repo delete", result: { status: 1, stderr: "must have admin rights" } },
        ]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
        expect(r.error.message).toContain("admin rights");
    });

    it("fails clearly when gh cannot report an identity to derive the target from", () => {
        const w = world();
        const run = runner([{ match: "gh api user", result: { status: 1, stderr: "not logged in" } }]);
        const r = teardown(run, { sourceRepoRoot: w.host, cloneDir: w.clone, keepAlive: false });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-unauthenticated");
    });
});
