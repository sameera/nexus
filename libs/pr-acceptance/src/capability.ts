/**
 * The capability preflight the harness runs *before* it creates anything.
 *
 * Two facts must hold before a scratch repository is worth creating: the
 * credential can delete a repository (otherwise teardown cannot remove what
 * provision is about to make, and the exercise leaks a repo), and all three
 * merge methods are available (each is a strategy under test — a disabled one
 * would surface much later as a confusing merge failure mid-run).
 *
 * Scope detection is deliberately conservative. A credential that does not
 * *report* `delete_repo` is treated as unable to delete, even though a
 * fine-grained token might in fact be able to: refusing costs a runbook step,
 * guessing costs an orphaned repository.
 */

import { type Result, fail, ok } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface AuthIdentity {
    login: string;
    scopes: string[];
}

export interface Capabilities extends AuthIdentity {
    canDelete: boolean;
}

export interface MergeMethods {
    squash: boolean;
    merge: boolean;
    rebase: boolean;
}

/** `gh auth status` prints the scopes line to stdout or stderr depending on version. */
function parseScopes(combined: string): string[] {
    const m = /Token scopes:\s*(.+)/.exec(combined);
    if (!m) return [];
    return m[1]
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter((s) => s.length > 0);
}

export function resolveAuth(run: Runner, cwd: string): Result<AuthIdentity> {
    const who = run("gh", ["api", "user", "--jq", ".login"], { cwd });
    const login = who.stdout.trim();
    if (who.status !== 0 || login === "") {
        return fail(
            "gh-unauthenticated",
            `gh could not report an authenticated identity (${who.stderr.trim() || "empty login"}); run \`gh auth login\` and retry.`,
        );
    }
    const status = run("gh", ["auth", "status"], { cwd });
    return ok({ login, scopes: parseScopes(`${status.stdout}\n${status.stderr}`) });
}

export function preflightCapabilities(run: Runner, cwd: string): Result<Capabilities> {
    const auth = resolveAuth(run, cwd);
    if (!auth.ok) return auth;
    const canDelete = auth.value.scopes.includes("delete_repo");
    if (!canDelete) {
        return fail(
            "missing-delete-scope",
            `the authenticated credential for "${auth.value.login}" does not report the \`delete_repo\` scope, so teardown could not delete the scratch repo this would create. ` +
                `Grant it with \`gh auth refresh -h github.com -s delete_repo\` and retry.`,
        );
    }
    return ok({ ...auth.value, canDelete });
}

export function resolveMergeMethods(run: Runner, cwd: string, nameWithOwner: string): Result<MergeMethods> {
    const r = run(
        "gh",
        ["repo", "view", nameWithOwner, "--json", "squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed"],
        { cwd },
    );
    if (r.status !== 0) {
        return fail("gh-failed", `gh repo view ${nameWithOwner} failed: ${r.stderr.trim() || "unknown gh error"}`);
    }
    try {
        const doc: unknown = JSON.parse(r.stdout);
        if (doc === null || typeof doc !== "object") throw new Error("expected an object");
        const d = doc as Record<string, unknown>;
        return ok({
            squash: d["squashMergeAllowed"] === true,
            merge: d["mergeCommitAllowed"] === true,
            rebase: d["rebaseMergeAllowed"] === true,
        });
    } catch (e) {
        return fail(
            "gh-failed",
            `gh repo view ${nameWithOwner} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

export function requireAllMergeMethods(m: MergeMethods, nameWithOwner: string): Result<MergeMethods> {
    const missing = [
        m.squash ? null : "squash",
        m.merge ? null : "merge",
        m.rebase ? null : "rebase",
    ].filter((x): x is string => x !== null);
    if (missing.length > 0) {
        return fail(
            "merge-methods-disabled",
            `${nameWithOwner} has these merge methods disabled: ${missing.join(", ")} — each is a strategy under test. ` +
                `Enable them (\`gh repo edit ${nameWithOwner} --enable-squash-merge --enable-merge-commit --enable-rebase-merge\`) and retry.`,
        );
    }
    return ok(m);
}
