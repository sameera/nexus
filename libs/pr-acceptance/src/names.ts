/**
 * Deterministic names and local paths for the live-acceptance harness.
 *
 * Exactly one scratch repository exists at a time, under one fixed name. That is
 * the whole isolation story at the repo level: teardown always has a single
 * unambiguous target, and an aborted run cannot accumulate near-identical
 * repositories that get progressively harder to tell apart from real ones.
 * Isolation *between* runs comes from fresh scenarios inside that one repo.
 *
 * The marker is the third leg of the delete guard. It is a file the harness
 * itself writes into the scratch repo at provision, carrying the repo's own
 * `owner/name` back to itself; a repo that does not carry a marker naming
 * exactly itself is never deleted, whatever its name.
 */

import * as os from "node:os";
import * as path from "node:path";

/** The one scratch repository name. Never derived from a run, a date, or an argument. */
export const SCRATCH_REPO_NAME = "nexus-pr-acceptance-scratch";

/** Repo-relative path of the provisioning marker. Fixed so teardown needs no provision state. */
export const MARKER_PATH = ".nexus-acceptance-harness";

/** The marker's first line. A repo without it is not ours. */
export const MARKER_SIGNATURE = "nexus-pr-acceptance-harness/v1";

export interface ScratchIdentity {
    owner: string;
    name: string;
    nameWithOwner: string;
}

export function scratchIdentity(owner: string): ScratchIdentity {
    return { owner, name: SCRATCH_REPO_NAME, nameWithOwner: `${owner}/${SCRATCH_REPO_NAME}` };
}

export interface MarkerFields {
    signature: string;
    /** The repo this marker was written into — cross-checked against the delete target. */
    nameWithOwner: string;
    /** The Nexus commit whose toolchain tree was seeded. Every recorded outcome is pinned to it. */
    toolchainCommit: string;
    provisionedAt: string;
}

export function renderMarker(f: Omit<MarkerFields, "signature">): string {
    return [
        `signature: ${MARKER_SIGNATURE}`,
        `nameWithOwner: ${f.nameWithOwner}`,
        `toolchainCommit: ${f.toolchainCommit}`,
        `provisionedAt: ${f.provisionedAt}`,
        "",
        "# Throwaway repository provisioned by the Nexus PR-flow live-acceptance harness.",
        "# It is deleted at teardown. Do not put anything here you want to keep.",
        "",
    ].join("\n");
}

/** Parse a marker; null unless it carries the signature and every field the guard reads. */
export function parseMarker(text: string): MarkerFields | null {
    const fields = new Map<string, string>();
    for (const line of text.split("\n")) {
        const m = /^([A-Za-z][A-Za-z0-9]*):\s*(.+?)\s*$/.exec(line);
        if (m) fields.set(m[1], m[2]);
    }
    if (fields.get("signature") !== MARKER_SIGNATURE) return null;
    const nameWithOwner = fields.get("nameWithOwner");
    const toolchainCommit = fields.get("toolchainCommit");
    const provisionedAt = fields.get("provisionedAt");
    if (!nameWithOwner || !toolchainCommit || !provisionedAt) return null;
    return { signature: MARKER_SIGNATURE, nameWithOwner, toolchainCommit, provisionedAt };
}

function harnessRoot(): string {
    return path.join(os.tmpdir(), "nexus-pr-acceptance");
}

/**
 * The disposable clone. Never the Nexus checkout: issue and PR targeting resolves
 * from the current checkout's remote, and the toolchain writes resolved defaults
 * back into config on first use, so the chain must run with cwd inside here.
 */
export function cloneDir(owner: string): string {
    return path.join(harnessRoot(), `${owner}-${SCRATCH_REPO_NAME}`, "clone");
}

/** Emitted evidence. A sibling of the clone, so removing the clone does not destroy the run's record. */
export function evidenceDir(owner: string): string {
    return path.join(harnessRoot(), `${owner}-${SCRATCH_REPO_NAME}`, "evidence");
}

export function scenarioBranch(scenarioId: string): string {
    return `acceptance/${scenarioId}`;
}
