/**
 * Hub-mode diff derivation for /nxs.distill (epic #54, STORY-54.01).
 *
 * After close-entry-migration, a hub-queue entry no longer shares history with the code it
 * describes: the close record's `range:` stamp is the only recomputable ground truth, and the
 * recorded SHAs resolve only inside the named member's sibling checkout. This tool resolves each
 * range item to its checkout via the workspace resolver (never re-deriving workspace shape),
 * verifies both recorded SHAs are reachable, and emits one diff per repo with `.nexus/queue/**`
 * excluded. All items must resolve before any diff is emitted — a missing checkout, an
 * unreachable SHA, or a missing/malformed stamp is a hard per-entry error. It never falls back
 * to the hub, never fabricates an empty or partial diff, and never clones, fetches, or
 * writes — it reads only.
 *
 * Usage:
 *   node .nexus/tools/derive-entry-diff.mjs --entry <queue-entry-dir> [--hub <hub-root>]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { resolveWorkspace, type ResolvedWorkspace } from "@nexus/workspace/resolve";
import { type Runner, defaultRunner } from "@nexus/close-migration/run";

const FULL_SHA = /^[0-9a-f]{40}$/;

export type DeriveProblem =
    | "missing-close-record"
    | "missing-range"
    | "malformed-range"
    | "not-a-workspace-hub"
    | "workspace-resolution-failed"
    | "unknown-repo"
    | "missing-checkout"
    | "unreachable-sha"
    | "git-diff-failed";

export interface DeriveDiagnostic {
    entry: string;
    problem: DeriveProblem;
    message: string;
}

export interface RangeItem { repo: string; base: string; head: string; }
export interface RepoDiff { repo: string; checkout: string; base: string; head: string; diff: string; }

export type DeriveResult =
    | { ok: true; entryName: string; diffs: RepoDiff[] }
    | { ok: false; errors: DeriveDiagnostic[] };

export type ParseRangeResult =
    | { ok: true; range: RangeItem[] }
    | { ok: false; error: DeriveDiagnostic };

/** Extract and validate the close record's `range:` stamp. Pure over the file contents. */
export function parseRange(entryDir: string): ParseRangeResult {
    const entry = path.basename(entryDir);
    const file = path.join(entryDir, "close-record.md");
    const fail = (problem: DeriveProblem, message: string): ParseRangeResult =>
        ({ ok: false, error: { entry, problem, message } });

    if (!fs.existsSync(file)) {
        return fail("missing-close-record",
            `${file} does not exist; only closed entries are drainable and hub mode reads the recorded range from close-record.md`);
    }
    const lines = fs.readFileSync(file, "utf8").split("\n");
    if (lines[0]?.trim() !== "---") {
        return fail("missing-range",
            `close-record.md in ${entry} has no frontmatter, so no 'range:' stamp; hub mode derives the diff only from the recorded range`);
    }
    const end = lines.slice(1).findIndex((l) => l.trim() === "---");
    if (end === -1) {
        return fail("missing-range", `close-record.md in ${entry} has an unterminated frontmatter block; no 'range:' stamp readable`);
    }
    let doc: unknown;
    try {
        doc = parse(lines.slice(1, end + 1).join("\n"));
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        return fail("malformed-range", `close-record.md in ${entry}: frontmatter is not valid YAML — ${detail}`);
    }
    const range = (doc as Record<string, unknown> | null)?.["range"];
    if (range === undefined || range === null) {
        return fail("missing-range",
            `close-record.md in ${entry} has no 'range:' stamp (expected a list of {repo, base, head} with full 40-hex SHAs); hub mode cannot derive this entry's diff without it`);
    }
    if (!Array.isArray(range) || range.length === 0) {
        return fail("malformed-range", `close-record.md in ${entry}: 'range:' must be a non-empty list of {repo, base, head}`);
    }
    const items: RangeItem[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < range.length; i++) {
        const item = range[i] as Record<string, unknown>;
        const bad = (detail: string): ParseRangeResult =>
            fail("malformed-range", `close-record.md in ${entry}: range[${i}] is malformed — ${detail} (expected {repo, base, head} with full 40-hex SHAs)`);
        if (typeof item !== "object" || item === null || Array.isArray(item)) return bad("not a mapping");
        const { repo, base, head } = item as { repo?: unknown; base?: unknown; head?: unknown };
        if (typeof repo !== "string" || repo.trim() === "") return bad("missing 'repo'");
        if (typeof base !== "string" || !FULL_SHA.test(base)) return bad(`'base' is not a full 40-hex SHA (got ${JSON.stringify(base ?? null)})`);
        if (typeof head !== "string" || !FULL_SHA.test(head)) return bad(`'head' is not a full 40-hex SHA (got ${JSON.stringify(head ?? null)})`);
        if (seen.has(repo)) return bad(`repo '${repo}' appears more than once`);
        seen.add(repo);
        items.push({ repo, base, head });
    }
    return { ok: true, range: items };
}

/** Match a recorded repo identity to its checkout: the hub first, then each declared member. */
function resolveCheckout(ws: ResolvedWorkspace, entry: string, item: RangeItem): { checkout: string } | { error: DeriveDiagnostic } {
    if (item.repo === ws.hub.normalizedRemote) {
        return { checkout: ws.hubRoot };
    }
    const member = ws.members.find((m) => m.normalizedRemote === item.repo);
    if (member === undefined) {
        return { error: { entry, problem: "unknown-repo",
            message: `range names repo '${item.repo}' but the workspace manifest declares no member (and no hub) with that remote identity; fix .nexus/config/workspace.yml or the stamp` } };
    }
    if (member.checkout === "missing") {
        return { error: { entry, problem: "missing-checkout",
            message: `member '${member.name}' (${item.repo}) is not checked out at the expected path ${member.expectedPath}; check it out there and re-run — the drain never falls back to the hub repo and never fabricates an empty diff` } };
    }
    return { checkout: member.expectedPath };
}

export function deriveEntryDiff(entryDir: string, hubDir: string, run: Runner = defaultRunner): DeriveResult {
    const entry = path.basename(entryDir);
    const parsed = parseRange(entryDir);
    if (!parsed.ok) return { ok: false, errors: [parsed.error] };

    const resolved = resolveWorkspace(hubDir);
    if (!resolved.ok) {
        return { ok: false, errors: [{ entry, problem: "workspace-resolution-failed", message: resolved.error.message }] };
    }
    if (resolved.workspace.mode !== "workspace") {
        return { ok: false, errors: [{ entry, problem: "not-a-workspace-hub",
            message: `${hubDir} has no hub manifest (.nexus/config/workspace.yml); derive-entry-diff runs only in a hub — single-repo distill derives its diff in place` }] };
    }
    const ws = resolved.workspace;

    // Pass 1 — resolve and verify EVERY item before emitting anything (no partial diffs).
    const errors: DeriveDiagnostic[] = [];
    const plan: Array<RangeItem & { checkout: string }> = [];
    for (const item of parsed.range) {
        const r = resolveCheckout(ws, entry, item);
        if ("error" in r) { errors.push(r.error); continue; }
        let bad = false;
        for (const [role, sha] of [["base", item.base], ["head", item.head]] as const) {
            const check = run("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: r.checkout });
            if (check.status !== 0) {
                errors.push({ entry, problem: "unreachable-sha",
                    message: `recorded ${role} ${sha} for repo '${item.repo}' is not reachable in ${r.checkout} — the checkout is behind or the stamp is wrong; update that checkout yourself and re-run (the drain never fetches, and derives no partial diff)` });
                bad = true;
            }
        }
        if (!bad) plan.push({ ...item, checkout: r.checkout });
    }
    if (errors.length > 0) return { ok: false, errors };

    // Pass 2 — emit one diff per repo, queue folder excluded, read-only.
    const diffs: RepoDiff[] = [];
    for (const item of plan) {
        const r = run("git", ["diff", `${item.base}...${item.head}`, "--", ".", ":(exclude).nexus/queue"], { cwd: item.checkout });
        if (r.status !== 0) {
            errors.push({ entry, problem: "git-diff-failed",
                message: `git diff ${item.base}...${item.head} failed in ${item.checkout}: ${r.stderr.trim()}` });
            continue;
        }
        diffs.push({ repo: item.repo, checkout: item.checkout, base: item.base, head: item.head, diff: r.stdout });
    }
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, entryName: entry, diffs };
}

export function renderRepoDiffs(entryName: string, diffs: RepoDiff[]): string {
    const blocks = diffs.map((d) =>
        `=== repo ${d.repo} checkout ${d.checkout} range ${d.base}...${d.head} ===\n${d.diff}`);
    return `entry ${entryName}: ${diffs.length} repo diff(s)\n${blocks.join("\n")}`;
}

export function renderDeriveFailure(errors: DeriveDiagnostic[]): string {
    const lines = [`Diff derivation failed: ${errors.length} problem(s) for entry ${errors[0].entry}`];
    for (const e of errors) lines.push(`  ${e.problem}: ${e.message}`);
    return lines.join("\n");
}

export function runCli(argv: string[]): number {
    let entryDir: string | undefined;
    let hubDir: string = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--entry") entryDir = argv[++i];
        else if (argv[i] === "--hub") hubDir = argv[++i] ?? hubDir;
    }
    if (entryDir === undefined) {
        process.stderr.write("usage: derive-entry-diff --entry <queue-entry-dir> [--hub <hub-root>]\n");
        return 2;
    }
    const result = deriveEntryDiff(path.resolve(entryDir), path.resolve(hubDir));
    if (!result.ok) {
        process.stderr.write(renderDeriveFailure(result.errors) + "\n");
        return 1;
    }
    process.stdout.write(renderRepoDiffs(result.entryName, result.diffs) + "\n");
    return 0;
}

function main(): void {
    process.exit(runCli(process.argv.slice(2)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
