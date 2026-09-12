/**
 * Range-list diff derivation for /nxs.distill (epic #54, STORY-54.01; epic #214, story #506).
 *
 * After close-entry-migration, a hub-queue entry no longer shares history with the code it
 * describes: the close record's `range:` stamp is the only recomputable ground truth, and the
 * recorded SHAs resolve only inside the named repo's checkout. This tool resolves every range
 * item to its checkout — via the workspace resolver in a hub, or against the current checkout's
 * own identity in single-repo mode, the one reader shared by both (decision record #513) —
 * verifies both recorded SHAs are reachable, and emits one diff per **range entry** (never
 * collapsed per repo — an epic closed over several pull requests in one repo stamps several
 * entries there, and each is read) with every pipeline store withheld — the set is named once in
 * `pipeline-stores.ts` and read from there, never restated here (record #450, invariants 4-5).
 * All items must resolve before any diff is emitted — a missing checkout, an unreachable SHA, an
 * unorderable pair of heads, or a missing/malformed stamp is a hard per-entry error. It never
 * falls back to the hub, never fabricates an empty or partial diff, and never clones, fetches, or
 * writes — it reads only.
 *
 * Usage:
 *   node <tools-dir>/nexus.mjs derive-entry-diff --entry <queue-entry-dir> [--hub <hub-root>]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { resolveWorkspace, type ResolvedWorkspace } from "@nexus/workspace/resolve";
import { type Runner, defaultRunner } from "@nexus/workspace/run";
import { resolveRole } from "@nexus/pr-worktree/identity";
import { excludePathspecs } from "./pipeline-stores.js";

const FULL_SHA = /^[0-9a-f]{40}$/;

export type DeriveProblem =
    | "missing-close-record"
    | "missing-range"
    | "malformed-range"
    | "not-a-checkout"
    | "member-unsupported"
    | "workspace-resolution-failed"
    | "unknown-repo"
    | "missing-checkout"
    | "unreachable-sha"
    | "unorderable-range"
    | "git-diff-failed";

export interface DeriveDiagnostic {
    entry: string;
    problem: DeriveProblem;
    message: string;
}

export interface RangeItem { repo: string; base: string; head: string; pr?: number; }
export interface RepoDiff { repo: string; checkout: string; base: string; head: string; pr?: number; diff: string; }

export type DeriveResult =
    | { ok: true; entryName: string; diffs: RepoDiff[] }
    | { ok: false; errors: DeriveDiagnostic[] };

export type ParseRangeResult =
    | { ok: true; range: RangeItem[] }
    | { ok: false; error: DeriveDiagnostic };

/**
 * The marker every close-record writer anchors its machine block to — `/nxs.close`, `/nxs.fix`
 * and `/nxs.intake` alike (record #176, invariant 5: the block is mandatory in every mode). The
 * `range:` stamp lives inside the fenced YAML that follows it, which is why that is the position
 * this reader reads first.
 */
export const CLOSE_RECORD_MARKER = "<!-- nexus:close-record -->";

/** The fenced YAML that follows the marker: an opening ```/```yaml line, then content, then a closing fence. */
const MARKER_FENCE = /(?:^|\n)```(?:yaml)?[^\n]*\n([\s\S]*?)\n```/;

type StampSource =
    | { ok: true; yaml: string; origin: string }
    | { ok: false; problem: DeriveProblem; message: string };

/**
 * Locate the YAML carrying the `range:` stamp. The marker-anchored block is the authoritative
 * position and is tried first; leading frontmatter stays readable behind it so an entry written
 * in that older shape still drains. Pure over the file contents.
 */
function findStampYaml(text: string, entry: string): StampSource {
    const marker = text.indexOf(CLOSE_RECORD_MARKER);
    if (marker >= 0) {
        const fence = MARKER_FENCE.exec(text.slice(marker + CLOSE_RECORD_MARKER.length));
        if (fence === null) {
            return { ok: false, problem: "missing-range",
                message: `close-record.md in ${entry} carries the ${CLOSE_RECORD_MARKER} marker but no fenced YAML block follows it; the 'range:' stamp is read from that block` };
        }
        return { ok: true, yaml: fence[1], origin: "the close-record machine block" };
    }
    const lines = text.split("\n");
    if (lines[0]?.trim() !== "---") {
        return { ok: false, problem: "missing-range",
            message: `close-record.md in ${entry} carries neither the ${CLOSE_RECORD_MARKER} machine block nor frontmatter, so no 'range:' stamp; hub mode derives the diff only from the recorded range` };
    }
    const end = lines.slice(1).findIndex((l) => l.trim() === "---");
    if (end === -1) {
        return { ok: false, problem: "missing-range",
            message: `close-record.md in ${entry} has an unterminated frontmatter block; no 'range:' stamp readable` };
    }
    return { ok: true, yaml: lines.slice(1, end + 1).join("\n"), origin: "frontmatter" };
}

/** Extract and validate the close record's `range:` stamp. Pure over the file contents. */
export function parseRange(entryDir: string): ParseRangeResult {
    const entry = path.basename(entryDir);
    const file = path.join(entryDir, "close-record.md");
    const fail = (problem: DeriveProblem, message: string): ParseRangeResult =>
        ({ ok: false, error: { entry, problem, message } });

    if (!fs.existsSync(file)) {
        return fail("missing-close-record",
            `${file} does not exist; only closed entries are drainable, and the recorded range is read from close-record.md`);
    }
    const stamp = findStampYaml(fs.readFileSync(file, "utf8"), entry);
    if (!stamp.ok) return fail(stamp.problem, stamp.message);
    let doc: unknown;
    try {
        doc = parse(stamp.yaml);
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        return fail("malformed-range", `close-record.md in ${entry}: ${stamp.origin} is not valid YAML — ${detail}`);
    }
    const range = (doc as Record<string, unknown> | null)?.["range"];
    if (range === undefined || range === null) {
        return fail("missing-range",
            `close-record.md in ${entry} has no 'range:' stamp (expected a list of {repo, base, head} with full 40-hex SHAs); this entry's diff cannot be derived without it`);
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
        const { repo, base, head, pr } = item as { repo?: unknown; base?: unknown; head?: unknown; pr?: unknown };
        if (typeof repo !== "string" || repo.trim() === "") return bad("missing 'repo'");
        if (typeof base !== "string" || !FULL_SHA.test(base)) return bad(`'base' is not a full 40-hex SHA (got ${JSON.stringify(base ?? null)})`);
        if (typeof head !== "string" || !FULL_SHA.test(head)) return bad(`'head' is not a full 40-hex SHA (got ${JSON.stringify(head ?? null)})`);
        // `pr` (epic #214, story #507) is the pull request this entry came from — stamped by
        // /nxs.close since record #509's revision. Optional: an entry written before that
        // revision carries none, and this reader never invents or resolves one over the network.
        if (pr !== undefined && (typeof pr !== "number" || !Number.isInteger(pr) || pr <= 0)) {
            return bad(`'pr' is not a positive integer (got ${JSON.stringify(pr)})`);
        }
        // A repo may appear in more than one entry (epic #214, story #506) — an epic closed over
        // several pull requests in one repo stamps several entries there. Only an *identical*
        // repeat (same repo, same base, same head) stays a malformed stamp: that is a stamping
        // defect, never a two-pull-request epic.
        const key = `${repo}\u0000${base}\u0000${head}`;
        if (seen.has(key)) return bad(`range entry for repo '${repo}' with base ${base} and head ${head} is repeated`);
        seen.add(key);
        items.push(pr === undefined ? { repo, base, head } : { repo, base, head, pr });
    }
    return { ok: true, range: items };
}

/** Match a recorded repo identity to its checkout: the hub first, then each declared member. */
function resolveHubCheckout(ws: ResolvedWorkspace, entry: string, item: RangeItem): { checkout: string } | { error: DeriveDiagnostic } {
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

/** Match a recorded repo identity against this single checkout's own identity — never another. */
function resolveSingleRepoCheckout(
    repoRoot: string,
    repoIdentity: string,
    entry: string,
    item: RangeItem,
): { checkout: string } | { error: DeriveDiagnostic } {
    if (item.repo !== repoIdentity) {
        return { error: { entry, problem: "unknown-repo",
            message: `range names repo '${item.repo}' but this checkout's identity is '${repoIdentity}'; single-repo mode resolves an entry only against its own identity, never another repo's` } };
    }
    return { checkout: repoRoot };
}

/**
 * Within one repo, order its range entries by ancestry of their recorded heads (decision record
 * #513): every recorded head is a trunk commit, so the set is totally ordered. Two heads that
 * cannot be ordered by ancestry (diverged, or unrelated) stop the entry — no order is guessed.
 */
function orderByAncestry<T extends { head: string }>(
    run: Runner,
    checkout: string,
    items: T[],
): { ok: true; ordered: T[] } | { ok: false; headA: string; headB: string } {
    if (items.length <= 1) return { ok: true, ordered: items };
    const isAncestor = (a: string, b: string): boolean =>
        a !== b && run("git", ["merge-base", "--is-ancestor", a, b], { cwd: checkout }).status === 0;
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            const aBeforeB = isAncestor(items[i].head, items[j].head);
            const bBeforeA = isAncestor(items[j].head, items[i].head);
            if (aBeforeB === bBeforeA) {
                return { ok: false, headA: items[i].head, headB: items[j].head };
            }
        }
    }
    const ordered = [...items].sort((a, b) => (isAncestor(a.head, b.head) ? -1 : 1));
    return { ok: true, ordered };
}

export function deriveEntryDiff(entryDir: string, hubDir: string, run: Runner = defaultRunner): DeriveResult {
    const entry = path.basename(entryDir);
    const parsed = parseRange(entryDir);
    if (!parsed.ok) return { ok: false, errors: [parsed.error] };

    const resolved = resolveWorkspace(hubDir);
    if (!resolved.ok) {
        return { ok: false, errors: [{ entry, problem: "workspace-resolution-failed", message: resolved.error.message }] };
    }

    // The one reader shared by hub and single-repo mode (decision record #513): each range item
    // resolves to its checkout either via the workspace manifest, or — when this checkout
    // declares no workspace — against this checkout's own identity.
    let resolveItem: (item: RangeItem) => { checkout: string } | { error: DeriveDiagnostic };
    if (resolved.workspace.mode === "workspace") {
        const ws = resolved.workspace;
        resolveItem = (item) => resolveHubCheckout(ws, entry, item);
    } else {
        const role = resolveRole(hubDir, run);
        if (!role.ok) {
            const problem: DeriveProblem = role.error.problem === "member-unsupported" ? "member-unsupported" : "not-a-checkout";
            return { ok: false, errors: [{ entry, problem, message: role.error.message }] };
        }
        const { repoRoot, repoIdentity } = role.resolved;
        resolveItem = (item) => resolveSingleRepoCheckout(repoRoot, repoIdentity, entry, item);
    }

    // Pass 1 — resolve and verify EVERY item before emitting anything (no partial diffs).
    const errors: DeriveDiagnostic[] = [];
    const plan: Array<RangeItem & { checkout: string }> = [];
    // A repository-level failure (missing checkout, undeclared repo) is reported once per
    // repository, not once per range entry (epic #214, story #508) — a range-entry-level failure
    // (unreachable SHA, unorderable heads) still names its own entry.
    const seenRepoFailures = new Set<string>();
    for (const item of parsed.range) {
        const r = resolveItem(item);
        if ("error" in r) {
            const dedupeKey = `${r.error.problem}:${item.repo}`;
            if (!seenRepoFailures.has(dedupeKey)) { seenRepoFailures.add(dedupeKey); errors.push(r.error); }
            continue;
        }
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

    // Pass 1.5 — order each repo's entries by ancestry (decision record #513); never a span from
    // one entry's start to another's end, in any mode, for any purpose (invariant 3).
    const repoOrder: string[] = [];
    const byRepo = new Map<string, Array<RangeItem & { checkout: string }>>();
    for (const item of plan) {
        if (!byRepo.has(item.repo)) { byRepo.set(item.repo, []); repoOrder.push(item.repo); }
        byRepo.get(item.repo)!.push(item);
    }
    const ordered: Array<RangeItem & { checkout: string }> = [];
    for (const repo of repoOrder) {
        const group = byRepo.get(repo)!;
        const result = orderByAncestry(run, group[0].checkout, group);
        if (!result.ok) {
            errors.push({ entry, problem: "unorderable-range",
                message: `repo '${repo}': heads ${result.headA} and ${result.headB} cannot be ordered by ancestry; no order is guessed — check the stamp` });
            continue;
        }
        ordered.push(...result.ordered);
    }
    if (errors.length > 0) return { ok: false, errors };

    // Pass 2 — emit one diff per range entry, every pipeline store excluded, read-only. The set
    // comes from the one definition (pipeline-stores.ts); nothing here restates it.
    const diffs: RepoDiff[] = [];
    for (const item of ordered) {
        const r = run("git", ["diff", `${item.base}...${item.head}`, "--", ".", ...excludePathspecs()], { cwd: item.checkout });
        if (r.status !== 0) {
            errors.push({ entry, problem: "git-diff-failed",
                message: `git diff ${item.base}...${item.head} failed in ${item.checkout}: ${r.stderr.trim()}` });
            continue;
        }
        diffs.push({
            repo: item.repo, checkout: item.checkout, base: item.base, head: item.head,
            ...(item.pr === undefined ? {} : { pr: item.pr }), diff: r.stdout,
        });
    }
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, entryName: entry, diffs };
}

export function renderRepoDiffs(entryName: string, diffs: RepoDiff[]): string {
    const blocks = diffs.map((d) => {
        const prSuffix = d.pr === undefined ? "" : ` pr ${d.pr}`;
        return `=== repo ${d.repo} checkout ${d.checkout} range ${d.base}...${d.head}${prSuffix} ===\n${d.diff}`;
    });
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

// No self-exec guard here (decision record #277): the process boundary lives once, in the
// dispatcher (`nexus-cli.ts`) — never in the capability itself, which must be import-safe.
