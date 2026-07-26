#!/usr/bin/env tsx
/**
 * Record-digest helper — the single program every stage invokes to obtain the canonical digest of a
 * decision-record sub-issue's body (epic #139, STORY-139.02, decision-record Invariant 6). The
 * design stage, the conformance gate, close, and the drain all stamp or verify this value; none of
 * them may re-derive it in a command's prose or an ad-hoc shell call, or the canonicalisation rule
 * would exist once per call site and drift.
 *
 * It fetches the body from GitHub itself (Invariant 7 — never locally submitted text), applies the
 * stated canonicalisation rule (line endings normalised, per-line trailing whitespace stripped,
 * trailing blank lines stripped, nothing else), and prints the FULL hexadecimal SHA-256 — never a
 * truncated form (Invariant 9).
 *
 * Usage (success prints one JSON object on stdout; a failure prints a diagnostic on stderr):
 *
 *   record_digest.ts --issue <N> [--repo <owner/repo>] [--dir <startDir>]
 *       Print { issue, repo, state, stateReason, approved, digest }.
 *       `approved` is true only for a record closed as completed — a record closed as
 *       **not planned** is a withdrawn design and blocks exactly as an open one does.
 *
 * Read-only: it fetches and hashes; it never edits, closes, comments, or labels.
 *
 * Exit codes: 0 success · 1 a named diagnostic was printed · 2 usage error.
 */

import { fetchRecord } from "@nexus/record-digest/fetch";
import { defaultRunner } from "@nexus/record-digest/run";

interface Flags {
    issue?: number;
    repo?: string;
    dir?: string;
}

function parseFlags(argv: string[]): Flags {
    const flags: Flags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--issue") flags.issue = Number(argv[++i]);
        else if (a === "--repo") flags.repo = argv[++i];
        else if (a === "--dir") flags.dir = argv[++i];
    }
    return flags;
}

function main(): void {
    const flags = parseFlags(process.argv.slice(2));
    if (flags.issue === undefined || Number.isNaN(flags.issue) || flags.issue <= 0) {
        process.stderr.write("usage: record_digest.ts --issue <N> [--repo <owner/repo>] [--dir <startDir>]\n");
        process.exit(2);
    }

    const result = fetchRecord(defaultRunner, flags.dir ?? process.cwd(), flags.issue, flags.repo ?? null);
    if (!result.ok) {
        process.stderr.write(`record-digest ${result.error.problem}: ${result.error.message}\n`);
        process.exit(1);
    }

    const { issue, repo, state, stateReason, approved, digest } = result.record;
    process.stdout.write(JSON.stringify({ issue, repo, state, stateReason, approved, digest }) + "\n");
    process.exit(0);
}

main();
