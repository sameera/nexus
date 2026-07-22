#!/usr/bin/env tsx
/**
 * Epic-resolver helper — the single producer of the materialized epic (decision record: "one
 * resolver keyed on the epic issue number is the shared substrate"). Every pipeline stage that
 * needs the planned epic without a committed planning file runs this, over the tested library
 * (@nexus/epic-resolve).
 *
 * It takes an epic issue number, resolves the target repo (single-repo local, or the workspace hub
 * via @nexus/workspace #38), fetches the epic body + story sub-issues + native blocked_by graph,
 * and writes a deterministic, byte-identical `epic.md` to an ephemeral, gitignored path. Read-only
 * against GitHub and every checkout; fail-closed — any unfetchable referenced issue exits non-zero
 * with no output written (never a partial epic).
 *
 * Usage (success prints one JSON object on stdout; a failure prints a diagnostic on stderr):
 *
 *   epic_resolve.ts --epic <N> [--out <path>] [--dir <startDir>]
 *       Resolve epic issue #N and write the materialized epic.md. Prints
 *       { epic, targetRoot, outPath }. --out overrides the default gitignored path
 *       (<targetRoot>/.nexus/tmp/epic-<N>/epic.md); --dir sets the checkout to resolve from
 *       (default: the current working directory).
 *
 * Exit codes: 0 success · 1 a named diagnostic was printed · 2 usage error.
 */

import { type EpicResolveDiagnostic } from "@nexus/epic-resolve/diagnostic";
import { renderDiagnostic } from "@nexus/epic-resolve/render";
import { resolveEpic } from "@nexus/epic-resolve/resolve";
import { defaultRunner } from "@nexus/epic-resolve/run";
import { writeMaterializedEpic } from "@nexus/epic-resolve/write";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";

interface Flags {
    epic?: number;
    out?: string;
    dir?: string;
}

function parseFlags(argv: string[]): Flags {
    const flags: Flags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--epic") flags.epic = Number(argv[++i]);
        else if (a === "--out") flags.out = argv[++i];
        else if (a === "--dir") flags.dir = argv[++i];
    }
    return flags;
}

function emit(obj: unknown): never {
    process.stdout.write(JSON.stringify(obj) + "\n");
    process.exit(0);
}

function die(d: EpicResolveDiagnostic): never {
    process.stderr.write(renderDiagnostic(d) + "\n");
    process.exit(1);
}

function usage(msg: string): never {
    process.stderr.write(`usage: epic_resolve.ts ${msg}\n`);
    process.exit(2);
}

/** The repo whose issues to query: the workspace hub, or the single-repo checkout. */
function targetRoot(startDir: string): string {
    const resolved = resolveWorkspace(startDir);
    if (!resolved.ok) {
        process.stderr.write(renderWorkspaceStatus(resolved) + "\n");
        process.exit(1);
    }
    return resolved.workspace.mode === "workspace" ? resolved.workspace.hubRoot : resolved.workspace.root;
}

function main(): void {
    const flags = parseFlags(process.argv.slice(2));
    if (flags.epic === undefined || Number.isNaN(flags.epic) || flags.epic <= 0) {
        usage("--epic <N> [--out <path>] [--dir <startDir>]");
    }

    const root = targetRoot(flags.dir ?? process.cwd());
    const resolved = resolveEpic(defaultRunner, root, flags.epic);
    if (!resolved.ok) die(resolved.error);

    const outPath = writeMaterializedEpic(root, flags.epic, resolved.markdown, flags.out);
    emit({ epic: flags.epic, targetRoot: root, outPath });
}

main();
