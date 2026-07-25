/**
 * The triple guard on repository deletion.
 *
 * The harness holds a repository-delete capability, and the only thing between it
 * and a real repository is the argument it is given. So deletion is permitted
 * only when three independent facts agree: the target's **name** is the one
 * deterministic scratch name, its **owner** is the owner the harness resolved
 * from the current credential, and it carries a **marker the harness itself
 * wrote** naming exactly that `owner/name` back. Any mismatch refuses without
 * deleting; there is no override flag.
 *
 * Pure — the caller fetches the marker text from the remote and passes it in, so
 * every refusal branch is reachable from a spec with no network.
 */

import { type Result, fail, ok } from "./diagnostic.js";
import {
    MARKER_SIGNATURE,
    type MarkerFields,
    SCRATCH_REPO_NAME,
    type ScratchIdentity,
    parseMarker,
} from "./names.js";

export interface DeleteGuardInput {
    /** Owner of the repository about to be deleted. */
    owner: string;
    /** Name of the repository about to be deleted. */
    name: string;
    /** The owner the harness resolved from the authenticated credential. */
    expectedOwner: string;
    /** Contents of the marker file read back from the remote; null when absent. */
    markerText: string | null;
}

export function verifyDeleteGuard(input: DeleteGuardInput): Result<MarkerFields> {
    const target = `${input.owner}/${input.name}`;

    if (input.name !== SCRATCH_REPO_NAME) {
        return fail(
            "name-mismatch",
            `refusing to delete ${target}: only the deterministic scratch repo "${SCRATCH_REPO_NAME}" may be deleted by this harness.`,
        );
    }
    if (input.owner !== input.expectedOwner) {
        return fail(
            "owner-mismatch",
            `refusing to delete ${target}: the authenticated owner is "${input.expectedOwner}", not "${input.owner}".`,
        );
    }
    const marker = input.markerText === null ? null : parseMarker(input.markerText);
    if (marker === null) {
        return fail(
            "marker-mismatch",
            `refusing to delete ${target}: no readable "${MARKER_SIGNATURE}" provisioning marker — the harness did not create this repository.`,
        );
    }
    if (marker.nameWithOwner !== target) {
        return fail(
            "marker-mismatch",
            `refusing to delete ${target}: its provisioning marker names "${marker.nameWithOwner}" instead (expected signature ${MARKER_SIGNATURE}).`,
        );
    }
    return ok(marker);
}

/**
 * Assert that something the harness just created landed on the scratch repo.
 *
 * Issue and PR targeting resolves from the current checkout's remote, so a
 * harness command run from the wrong working directory would file against the
 * Nexus repo itself. That is the one mutation the epic forbids outright, and it
 * is silent — the command succeeds and looks normal. So every created URL is
 * checked back against the scratch identity before the run continues.
 */
export function assertScratchTarget(observedUrl: string, scratch: ScratchIdentity, what: string): Result<string> {
    const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\//.exec(observedUrl);
    if (m === null) {
        return fail("host-repo-mutation", `could not tell which repository the ${what} landed on from "${observedUrl}".`);
    }
    if (m[1] !== scratch.nameWithOwner) {
        return fail(
            "host-repo-mutation",
            `the ${what} landed on ${m[1]}, not the scratch repo ${scratch.nameWithOwner} — every live mutation must land on the scratch repo. ` +
                `Re-run with the working directory inside the disposable clone.`,
        );
    }
    return ok(observedUrl);
}
