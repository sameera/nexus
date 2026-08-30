/**
 * Persisting the decisions this run reached (story #368).
 *
 * A repository that has never declared publishing configuration re-probes on every run until
 * someone tells it what it found. This writes that down once, through the shared add-only writer:
 * a key the repository already declares — including an explicit `auto` or `none` — is never
 * overwritten, and the filing target is never written at all, because an absent target means "the
 * current repository" and pinning it would silently redirect a later run.
 *
 * The wrapper prints nothing: it returns what it added, and the caller announces the seeding in its
 * own vocabulary, so both filers can share the assembly without sharing the wording (#387).
 */

import { type WriteReport, writeGithubBlock } from "../write.js";

export interface Decisions {
    /** The classification mode this run settled on. */
    classification: string;
    /** The project auto-discovery found, or null when this run ran no discovery. */
    discoveredProject?: string | null;
}

export function writeBackDecisions(projectRoot: string, decisions: Decisions): WriteReport {
    const values: Record<string, string> = {
        classification: decisions.classification === "types" ? "types" : "labels",
    };
    // Only the auto-discovery path yields a concrete project value to persist; an explicit or
    // declared-`none` target was already written down by whoever declared it.
    if (decisions.discoveredProject !== undefined) values["project"] = decisions.discoveredProject ?? "none";
    return writeGithubBlock(projectRoot, values);
}
