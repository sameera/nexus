/**
 * Structured failure reporting for the live-acceptance harness.
 *
 * Same shape and style as the pr-worktree and close-migration diagnostics — a
 * fixed kebab-case problem plus one human sentence naming the offending input
 * and how to fix it. The harness refuses far more often than it repairs (it
 * holds a repository-delete capability), so every refusal path has its own
 * problem code and every code is reachable from a spec.
 */

export type PrAcceptanceProblem =
    /** `gh` is not authenticated, or its identity could not be read. */
    | "gh-unauthenticated"
    /**
     * The token lacks `delete_repo` and the operator did not opt into manual cleanup,
     * so nothing named would delete what provision would create.
     */
    | "missing-delete-scope"
    /** The scratch repo does not have all three merge methods enabled. */
    | "merge-methods-disabled"
    /** A repo of the scratch name exists but is not ours — never touched. */
    | "scratch-repo-exists"
    /** No provisioned scratch repo to operate on. */
    | "scratch-repo-missing"
    /** The provisioning marker is absent, unparseable, or names a different repo. */
    | "marker-mismatch"
    /** The delete target's owner is not the expected owner. */
    | "owner-mismatch"
    /** The delete target's name is not the deterministic scratch name. */
    | "name-mismatch"
    /** A guarded operation would have touched the Nexus repo itself. */
    | "host-repo-mutation"
    /** A `gh` invocation failed. */
    | "gh-failed"
    /** A `git` invocation failed. */
    | "git-failed"
    /** The disposable clone could not be created or is not usable. */
    | "clone-failed"
    /** A scenario could not be seeded to the shape the flow's preconditions need. */
    | "scenario-failed"
    /** A merge by the requested strategy failed or produced no merge commit. */
    | "merge-failed"
    /** A derived range's changed-file set does not equal the PR's authoritative set. */
    | "range-mismatch"
    /** No analyze receipt block was found on the PR. */
    | "receipt-missing"
    /** A receipt block was found but could not be parsed. */
    | "receipt-malformed"
    /** Local residue survived teardown. */
    | "residue-remains"
    | "usage";

export interface PrAcceptanceDiagnostic {
    problem: PrAcceptanceProblem;
    message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: PrAcceptanceDiagnostic };

export function fail<T>(problem: PrAcceptanceProblem, message: string): Result<T> {
    return { ok: false, error: { problem, message } };
}

export function ok<T>(value: T): Result<T> {
    return { ok: true, value };
}
