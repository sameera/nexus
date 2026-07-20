#!/usr/bin/env tsx
/**
 * PR-worktree helper for /nxs.analyze --pr and /nxs.close --pr — the deterministic
 * git/gh mechanics of the post-merge flow, over the tested library
 * (@nexus/pr-worktree). Single-repo and hub only; a member repo is rejected.
 *
 * Subcommands (success prints one JSON object on stdout; a failure prints a named
 * diagnostic on stderr):
 *
 *   preflight --pr <N> --mode analyze|close
 *       Read-only. Resolve the role (rejecting member), the normalized repo
 *       identity, and the PR's state/SHAs. For --mode close this exits 1 unless
 *       the PR is merged — the gate before anything irreversible.
 *
 *   open --pr <N> --mode analyze
 *       Create a detached worktree at the PR head (fetched via pull/<N>/head, so
 *       forks work). Prints { wtPath, analyzedHead, base } — analyzedHead is the
 *       commit actually checked out (record it as the receipt head).
 *
 *   open --pr <N> --mode close --branch <distill/...>
 *       Create a worktree on a fresh distill branch cut from the trunk, then derive
 *       the merge-strategy-safe range (verified against the PR head). Prints
 *       { wtPath, range: { repo, base, head } } — full SHAs for the close record.
 *
 *   remove <wtPath>
 *       Force-remove a worktree and prune (safe from inside the target).
 *
 * Exit codes: 0 success · 1 a named diagnostic was printed · 2 usage error.
 */

import { resolveRole } from "@nexus/pr-worktree/identity";
import { resolvePr } from "@nexus/pr-worktree/pr";
import { deriveRange } from "@nexus/pr-worktree/range";
import { renderDiagnostic } from "@nexus/pr-worktree/render";
import { defaultRunner, git } from "@nexus/pr-worktree/run";
import { openAnalyzeWorktree, openCloseWorktree, removeWorktree } from "@nexus/pr-worktree/worktree";
import { type PrWorktreeDiagnostic } from "@nexus/pr-worktree/diagnostic";

interface Flags {
    pr?: number;
    mode?: string;
    branch?: string;
    positional: string[];
}

function parseFlags(argv: string[]): Flags {
    const flags: Flags = { positional: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--pr") flags.pr = Number(argv[++i]);
        else if (a === "--mode") flags.mode = argv[++i];
        else if (a === "--branch") flags.branch = argv[++i];
        else flags.positional.push(a);
    }
    return flags;
}

function emit(obj: unknown): never {
    process.stdout.write(JSON.stringify(obj) + "\n");
    process.exit(0);
}

function die(d: PrWorktreeDiagnostic): never {
    process.stderr.write(renderDiagnostic(d) + "\n");
    process.exit(1);
}

function usage(msg: string): never {
    process.stderr.write(`usage: pr_worktree.ts ${msg}\n`);
    process.exit(2);
}

function main(): void {
    const [subcommand, ...rest] = process.argv.slice(2);
    const flags = parseFlags(rest);

    if (subcommand === "preflight" || subcommand === "open") {
        if (flags.pr === undefined || Number.isNaN(flags.pr)) usage(`${subcommand} --pr <N> --mode analyze|close`);
        if (flags.mode !== "analyze" && flags.mode !== "close") usage(`${subcommand} --pr <N> --mode analyze|close`);

        const role = resolveRole(process.cwd());
        if (!role.ok) die(role.error);
        const { repoRoot, repoIdentity, role: roleName } = role.resolved;
        const requireMerged = flags.mode === "close";
        const pr = resolvePr(defaultRunner, repoRoot, flags.pr, { requireMerged });
        if (!pr.ok) die(pr.error);

        if (subcommand === "preflight") {
            emit({
                command: "preflight",
                role: roleName,
                repoRoot,
                repoIdentity,
                pr: {
                    number: pr.pr.number,
                    state: pr.pr.state,
                    merged: pr.pr.merged,
                    base: pr.pr.base,
                    head: pr.pr.head,
                    mergeCommitOid: pr.pr.mergeCommitOid,
                    commitCount: pr.pr.commitCount,
                    url: pr.pr.url,
                    crossRepo: pr.pr.crossRepo,
                    authorLogin: pr.pr.authorLogin,
                },
            });
        }

        // subcommand === "open"
        if (flags.mode === "analyze") {
            const wt = openAnalyzeWorktree(defaultRunner, repoRoot, flags.pr);
            if (!wt.ok) die(wt.error);
            emit({ command: "open", mode: "analyze", wtPath: wt.wtPath, analyzedHead: wt.head, base: pr.pr.base, repoIdentity });
        }

        // open close
        if (!flags.branch) usage("open --pr <N> --mode close --branch <distill/...>");
        const wt = openCloseWorktree(defaultRunner, repoRoot, flags.branch);
        if (!wt.ok) die(wt.error);
        // Fetch the PR head into the shared object store so the range can be verified
        // (disambiguates squash vs rebase). Best-effort — a deleted branch leaves it undefined.
        const fetched = defaultRunner("git", ["fetch", "origin", `pull/${flags.pr}/head`], { cwd: repoRoot });
        const prHead =
            fetched.status === 0
                ? (git(defaultRunner, repoRoot, "rev-parse", "--verify", "FETCH_HEAD") ?? undefined)
                : undefined;
        const range = deriveRange(defaultRunner, wt.wtPath, pr.pr, { verifyAgainstPrHead: prHead });
        if (!range.ok) die(range.error);
        emit({
            command: "open",
            mode: "close",
            wtPath: wt.wtPath,
            range: { repo: repoIdentity, base: range.range.base, head: range.range.head },
        });
    }

    if (subcommand === "remove") {
        const wtPath = flags.positional[0];
        if (!wtPath) usage("remove <wtPath>");
        const r = removeWorktree(defaultRunner, process.cwd(), wtPath);
        if (!r.ok) die(r.error);
        emit({ command: "remove", wtPath, removed: true });
    }

    usage("<preflight|open --pr <N> --mode analyze|close [--branch <b>] | remove <wtPath>>");
}

main();
