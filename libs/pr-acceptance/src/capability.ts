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
 *
 * That refusal is the default, not the only path. `delete_repo` is a broad,
 * irreversible grant on a maintainer's whole account, and a maintainer may
 * reasonably decline to hold it for a runbook exercise — so `manualTeardown`
 * lets them take the run and delete the scratch repo by hand instead. It is an
 * explicit opt-in and never inferred from an absent scope: the original
 * guarantee, that nothing is created which cannot be cleaned up, becomes a
 * choice the operator makes on the command line rather than one the harness
 * makes silently on their behalf. `canDelete` keeps reporting what the
 * credential actually carries, so the opt-in never launders a missing scope
 * into an apparent capability.
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

/** Who removes the scratch repository once the exercise is over. */
export type RemoteTeardown = "automatic" | "manual";

export interface PreflightOptions {
    /**
     * The maintainer has explicitly accepted deleting the scratch repo by hand.
     * Set only from the CLI's `--manual-teardown` flag — never inferred.
     */
    manualTeardown?: boolean;
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

export function preflightCapabilities(run: Runner, cwd: string, o: PreflightOptions = {}): Result<Capabilities> {
    const auth = resolveAuth(run, cwd);
    if (!auth.ok) return auth;
    const canDelete = auth.value.scopes.includes("delete_repo");
    if (!canDelete && o.manualTeardown !== true) {
        return fail(
            "missing-delete-scope",
            `the authenticated credential for "${auth.value.login}" does not report the \`delete_repo\` scope, so teardown could not delete the scratch repo this would create. ` +
                `Grant it with \`gh auth refresh -h github.com -s delete_repo\` and retry, ` +
                `or re-run with \`--manual-teardown\` to take the run anyway and delete the scratch repo yourself afterwards.`,
        );
    }
    return ok({ ...auth.value, canDelete });
}

/**
 * The disposition every stage reports and the runbook records. Manual wins in
 * both directions: an opt-in overrides a credential that could delete, and a
 * credential that cannot delete is manual whether or not anyone opted in.
 */
export function remoteTeardownMode(caps: Capabilities, manualTeardown: boolean): RemoteTeardown {
    return manualTeardown || !caps.canDelete ? "manual" : "automatic";
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
