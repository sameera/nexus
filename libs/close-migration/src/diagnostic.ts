/**
 * Structured failure reporting for the close-migration helper.
 *
 * Same shape and style as the workspace resolver's Diagnostic — a fixed
 * kebab-case problem plus one human sentence naming the file, the entry, and
 * the defect (and how to fix it). Resolver diagnostics pass through verbatim;
 * this union only adds the migration's own failure modes.
 */

import { type Diagnostic } from "@nexus/workspace/manifest";

export type MigrationProblem =
    | "not-a-git-repo"
    | "wrong-role"
    | "entry-not-found"
    | "entry-conflict"
    | "hub-detached-head"
    | "hub-commit-failed"
    | "verify-mismatch"
    | "removal-failed";

export interface MigrationDiagnostic {
    file: string;
    entry?: string;
    problem: MigrationProblem | Diagnostic["problem"];
    message: string;
}
