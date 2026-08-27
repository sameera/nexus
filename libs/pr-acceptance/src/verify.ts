/**
 * The mechanical assertions the harness makes and reports.
 *
 * The epic's success metrics are mechanical — "zero silently-wrong ranges", an
 * analyze receipt that is exactly current or detectably stale, "teardown leaves
 * zero residue" — so the checks behind them are mechanical too: file-set equality
 * against the pull request's own changed-file set, exact full-identifier equality
 * for receipt currency, and enumeration of worktrees and branches for residue.
 * Operator judgment is confined to the prose parts of the acceptance record.
 *
 * A failed check is a **verdict**, not an error: it is the evidence the run
 * exists to collect, so it is returned as a `pass: false` result carrying the
 * observed identifiers and any diagnostic verbatim. Only a broken tool — git
 * refusing, `gh` returning nonsense — is an error.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Result, fail, ok } from "./diagnostic.js";
import { type Runner, git } from "./run.js";

const FULL_SHA = /^[0-9a-f]{40}$/;

/** The exact three-dot diff the distiller recomputes later, queue and discovery excluded. */
export function changedFileSet(run: Runner, cwd: string, base: string, head: string): string[] | null {
    const out = git(run, cwd, "diff", "--name-only", `${base}...${head}`, "--", ".", ":(exclude).nexus/queue", ":(exclude).nexus/discovery");
    if (out === null) return null;
    return [...new Set(out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0))].sort();
}

function isAncestor(run: Runner, cwd: string, a: string, b: string): boolean {
    return run("git", ["merge-base", "--is-ancestor", a, b], { cwd }).status === 0;
}

// ---------------------------------------------------------------------------
// Range derivation, reached through the helper CLI the close record is stamped from
// ---------------------------------------------------------------------------

export interface HelperContext {
    run: Runner;
    clonePath: string;
    /** The Nexus checkout the helper CLI is invoked from. */
    toolRoot: string;
}

export interface HelperRange {
    wtPath: string;
    repo: string;
    base: string;
    head: string;
}

/**
 * Drive `pr_worktree.ts open --mode close` — the unit whose output is stamped
 * into the close record, and the one that can be re-run per merge strategy in
 * seconds without re-running a whole close.
 */
export function deriveRangeViaHelper(ctx: HelperContext, prNumber: number, branch: string): Result<HelperRange> {
    const r = ctx.run(
        "tsx",
        [
            path.join(ctx.toolRoot, ".claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts"),
            "open",
            "--pr",
            String(prNumber),
            "--mode",
            "close",
            "--branch",
            branch,
        ],
        { cwd: ctx.clonePath },
    );
    if (r.status !== 0) {
        // The helper's own named diagnostic, verbatim — the record quotes it.
        return fail("range-mismatch", r.stderr.trim() || `the range helper exited ${r.status} with no diagnostic.`);
    }
    try {
        const doc = JSON.parse(r.stdout.trim().split("\n").pop() ?? "") as Record<string, unknown>;
        const range = doc["range"] as Record<string, string> | undefined;
        if (!range || typeof range["base"] !== "string" || typeof range["head"] !== "string") {
            throw new Error("no range in the helper's output");
        }
        return ok({
            wtPath: typeof doc["wtPath"] === "string" ? doc["wtPath"] : "",
            repo: range["repo"] ?? "",
            base: range["base"],
            head: range["head"],
        });
    } catch (e) {
        return fail(
            "range-mismatch",
            `the range helper's output could not be read as JSON (${e instanceof Error ? e.message : String(e)}): ${r.stdout.trim()}`,
        );
    }
}

export interface PrEndpoints {
    number: number;
    state: string;
    merged: boolean;
    /** baseRefOid — the PR base tip. */
    base: string;
    /** headRefOid — the PR branch tip. */
    head: string;
    mergeCommitOid: string | null;
    commitCount: number;
}

export function prEndpoints(run: Runner, cwd: string, prNumber: number): Result<PrEndpoints> {
    const r = run(
        "gh",
        ["pr", "view", String(prNumber), "--json", "state,mergedAt,baseRefOid,headRefOid,mergeCommit,commits"],
        { cwd },
    );
    if (r.status !== 0) return fail("gh-failed", `gh pr view ${prNumber} failed: ${r.stderr.trim()}`);
    try {
        const d = JSON.parse(r.stdout) as Record<string, unknown>;
        const mc = d["mergeCommit"];
        return ok({
            number: prNumber,
            state: typeof d["state"] === "string" ? d["state"] : "UNKNOWN",
            merged: typeof d["mergedAt"] === "string" && d["mergedAt"].length > 0,
            base: typeof d["baseRefOid"] === "string" ? d["baseRefOid"] : "",
            head: typeof d["headRefOid"] === "string" ? d["headRefOid"] : "",
            mergeCommitOid:
                mc !== null && typeof mc === "object" && typeof (mc as Record<string, unknown>)["oid"] === "string"
                    ? (mc as Record<string, string>)["oid"]
                    : null,
            commitCount: Array.isArray(d["commits"]) ? d["commits"].length : 0,
        });
    } catch (e) {
        return fail("gh-failed", `gh pr view ${prNumber} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
}

/** The pull request's own changed-file set, as GitHub reports it. */
export function prChangedFiles(run: Runner, cwd: string, prNumber: number): Result<string[]> {
    const r = run("gh", ["pr", "view", String(prNumber), "--json", "files", "--jq", ".files[].path"], { cwd });
    if (r.status !== 0) return fail("gh-failed", `gh pr view ${prNumber} --json files failed: ${r.stderr.trim()}`);
    const files = r.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith(".nexus/queue"))
        .sort();
    return ok([...new Set(files)]);
}

export interface RangeVerifyInput {
    prNumber: number;
    /** The derived range under test. */
    base: string;
    head: string;
    /** The PR's own endpoints — the authoritative diff is `prBase...prHead`. */
    prBase: string;
    prHead: string;
    /** GitHub's own changed-file list for the PR, as a cross-check. */
    ghFiles?: string[];
    trunkRef?: string;
}

export interface RangeVerdict {
    prNumber: number;
    base: string;
    head: string;
    fullShas: boolean;
    baseIsAncestorOfHead: boolean;
    baseReachableOnTrunk: boolean;
    headReachableOnTrunk: boolean;
    derivedFiles: string[];
    authoritativeFiles: string[];
    fileSetsEqual: boolean;
    /** Cross-check against GitHub's own file list; null when it was not supplied. */
    ghFileSetsEqual: boolean | null;
    nonEmptyDiff: boolean;
    pass: boolean;
    notes: string[];
}

function sameSet(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * A derived range is accepted only when its changed-file set, queue excluded,
 * exactly equals the pull request's, and both endpoints are full-length
 * identifiers reachable on the trunk. Anything less is reported as a failure with
 * the observed values — never smoothed over.
 */
export function verifyRange(run: Runner, cwd: string, input: RangeVerifyInput): Result<RangeVerdict> {
    const trunkRef = input.trunkRef ?? "origin/main";
    const notes: string[] = [];

    const derivedFiles = changedFileSet(run, cwd, input.base, input.head);
    if (derivedFiles === null) {
        return fail("git-failed", `could not diff the derived range ${input.base}...${input.head} in ${cwd}.`);
    }
    const authoritativeFiles = changedFileSet(run, cwd, input.prBase, input.prHead);
    if (authoritativeFiles === null) {
        return fail(
            "git-failed",
            `could not diff the authoritative PR range ${input.prBase}...${input.prHead} in ${cwd} (is the PR head fetched?).`,
        );
    }

    const fullShas = FULL_SHA.test(input.base) && FULL_SHA.test(input.head);
    if (!fullShas) notes.push(`range endpoints are not both full 40-character SHAs: base=${input.base} head=${input.head}`);

    const baseIsAncestorOfHead = isAncestor(run, cwd, input.base, input.head);
    if (!baseIsAncestorOfHead) notes.push(`base ${input.base} is not an ancestor of head ${input.head}`);

    const baseReachableOnTrunk = isAncestor(run, cwd, input.base, trunkRef);
    const headReachableOnTrunk = isAncestor(run, cwd, input.head, trunkRef);
    if (!baseReachableOnTrunk) notes.push(`base ${input.base} is not reachable on ${trunkRef} after the branch delete`);
    if (!headReachableOnTrunk) notes.push(`head ${input.head} is not reachable on ${trunkRef} after the branch delete`);

    const fileSetsEqual = sameSet(derivedFiles, authoritativeFiles);
    if (!fileSetsEqual) {
        notes.push(
            `derived file set != PR file set — derived: [${derivedFiles.join(", ")}]; PR ${input.prBase}...${input.prHead}: [${authoritativeFiles.join(", ")}]`,
        );
    }

    let ghFileSetsEqual: boolean | null = null;
    if (input.ghFiles) {
        const gh = [...new Set(input.ghFiles.filter((f) => !f.startsWith(".nexus/queue")))].sort();
        ghFileSetsEqual = sameSet(derivedFiles, gh);
        if (!ghFileSetsEqual) notes.push(`derived file set != GitHub's own file list for PR #${input.prNumber}: [${gh.join(", ")}]`);
    }

    const nonEmptyDiff = derivedFiles.length > 0;
    if (!nonEmptyDiff) notes.push("the derived range has an empty diff (queue excluded); it would distill nothing");

    return ok({
        prNumber: input.prNumber,
        base: input.base,
        head: input.head,
        fullShas,
        baseIsAncestorOfHead,
        baseReachableOnTrunk,
        headReachableOnTrunk,
        derivedFiles,
        authoritativeFiles,
        fileSetsEqual,
        ghFileSetsEqual,
        nonEmptyDiff,
        pass:
            fullShas &&
            baseIsAncestorOfHead &&
            baseReachableOnTrunk &&
            headReachableOnTrunk &&
            fileSetsEqual &&
            nonEmptyDiff,
        notes,
    });
}

// ---------------------------------------------------------------------------
// The analyze receipt, read back the way /nxs.close --pr reads it
// ---------------------------------------------------------------------------

export const RECEIPT_MARKER = "<!-- nexus:analyze-receipt -->";

export interface AnalyzeReceipt {
    epic: string;
    /**
     * The writer stamp (story #306): the toolkit release that wrote the receipt, or null for a
     * receipt written before the stamp existed. Null is an unknown writer, never a failure, and a
     * stamp differing from the reader's own release changes nothing about how the receipt is read
     * — this is a fact recorded for later, not a gate.
     */
    nexusVersion: string | null;
    pr: number | null;
    date: string;
    /** The commit actually analyzed — compared for exact equality against the PR head. */
    head: string;
    mode: string;
    findings: Record<string, number>;
}

export function parseReceiptBlock(body: string): AnalyzeReceipt | null {
    const i = body.indexOf(RECEIPT_MARKER);
    if (i < 0) return null;
    const fence = /```(?:yaml)?\s*\n([\s\S]*?)```/.exec(body.slice(i + RECEIPT_MARKER.length));
    if (fence === null) return null;
    const fields = new Map<string, string>();
    for (const line of fence[1].split("\n")) {
        const m = /^\s*([A-Za-z][A-Za-z0-9_-]*):\s*(.+?)\s*$/.exec(line);
        if (m) fields.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    }
    const head = fields.get("head");
    if (head === undefined) return null;
    const findings: Record<string, number> = {};
    for (const [, k, v] of (fields.get("findings") ?? "").matchAll(/([a-z]+)\s*:\s*(\d+)/g)) {
        findings[k] = Number(v);
    }
    return {
        epic: fields.get("epic") ?? "",
        nexusVersion: fields.get("nexus_version")?.trim() || null,
        pr: fields.has("pr") ? Number(fields.get("pr")) : null,
        date: fields.get("date") ?? "",
        head,
        mode: fields.get("mode") ?? "",
        findings,
    };
}

export interface ReceiptVerdict {
    prNumber: number;
    found: boolean;
    /** Where the receipt was published. A single-account scratch repo always takes the comment fallback. */
    source: "review" | "comment" | null;
    receipt: AnalyzeReceipt | null;
    /** The PR head at read-back time. */
    prHead: string;
    /** Exact full-identifier equality — the currency test /nxs.close --pr applies. */
    current: boolean;
    /** Commits that landed after analysis, when that can be counted. */
    staleNote: string | null;
    rawBody: string;
}

interface Candidate {
    body: string;
    at: string;
    source: "review" | "comment";
}

function collectCandidates(doc: Record<string, unknown>): Candidate[] {
    const out: Candidate[] = [];
    const push = (arr: unknown, source: "review" | "comment", timeKey: string): void => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
            if (item === null || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            const body = typeof rec["body"] === "string" ? rec["body"] : "";
            if (!body.includes(RECEIPT_MARKER)) continue;
            out.push({ body, at: typeof rec[timeKey] === "string" ? rec[timeKey] : "", source });
        }
    };
    push(doc["reviews"], "review", "submittedAt");
    push(doc["comments"], "comment", "createdAt");
    return out;
}

export function verifyReceipt(run: Runner, cwd: string, prNumber: number): Result<ReceiptVerdict> {
    const r = run("gh", ["pr", "view", String(prNumber), "--json", "reviews,comments,headRefOid"], { cwd });
    if (r.status !== 0) return fail("gh-failed", `gh pr view ${prNumber} --json reviews,comments failed: ${r.stderr.trim()}`);
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(r.stdout) as Record<string, unknown>;
    } catch (e) {
        return fail("gh-failed", `gh pr view ${prNumber} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    const prHead = typeof doc["headRefOid"] === "string" ? doc["headRefOid"] : "";

    const candidates = collectCandidates(doc).sort((a, b) => a.at.localeCompare(b.at));
    const newest = candidates[candidates.length - 1];
    if (newest === undefined) {
        return ok({
            prNumber,
            found: false,
            source: null,
            receipt: null,
            prHead,
            current: false,
            staleNote: null,
            rawBody: "",
        });
    }
    const receipt = parseReceiptBlock(newest.body);
    if (receipt === null) {
        return fail(
            "receipt-malformed",
            `PR #${prNumber} carries a ${RECEIPT_MARKER} block that could not be parsed; the reader cannot obtain a verdict or an analyzed head from it.`,
        );
    }
    const current = receipt.head !== "" && receipt.head === prHead;
    let staleNote: string | null = null;
    if (!current) {
        const count = git(run, cwd, "rev-list", "--count", `${receipt.head}..${prHead}`);
        staleNote =
            count === null
                ? `analyzed head ${receipt.head} != PR head ${prHead}`
                : `analyzed head ${receipt.head} != PR head ${prHead}; ${count} commit(s) landed after analysis`;
    }
    return { ok: true, value: { prNumber, found: true, source: newest.source, receipt, prHead, current, staleNote, rawBody: newest.body } };
}

// ---------------------------------------------------------------------------
// Residue
// ---------------------------------------------------------------------------

/** Branch prefix every harness-created branch carries in any checkout. */
export const HARNESS_BRANCH_PREFIX = "acceptance/";

export interface ResidueVerdict {
    /** Worktrees registered in the Nexus checkout that the harness or the flow could have created. */
    hostWorktrees: string[];
    /** Harness-created branches in the Nexus checkout. */
    hostBranches: string[];
    /** Worktrees still registered in the disposable clone (close/distill leave one behind). */
    cloneWorktrees: string[];
    cloneExists: boolean;
    clean: boolean;
}

function worktreePaths(run: Runner, cwd: string): string[] {
    const out = git(run, cwd, "worktree", "list", "--porcelain") ?? "";
    return out
        .split("\n")
        .filter((l) => l.startsWith("worktree "))
        .map((l) => path.resolve(l.slice("worktree ".length)));
}

export function verifyResidue(run: Runner, hostRepoRoot: string, clonePath: string): Result<ResidueVerdict> {
    const hostAll = worktreePaths(run, hostRepoRoot);
    // The primary worktree is the checkout itself; anything past it is a registration
    // some run left behind.
    const hostWorktrees = hostAll.slice(1);

    const branches = git(run, hostRepoRoot, "branch", "--list", `${HARNESS_BRANCH_PREFIX}*`) ?? "";
    const hostBranches = branches
        .split("\n")
        .map((l) => l.replace(/^[*+]?\s*/, "").trim())
        .filter((l) => l.length > 0);

    const cloneExists = fs.existsSync(clonePath);
    const cloneWorktrees = cloneExists ? worktreePaths(run, clonePath).slice(1) : [];

    return ok({
        hostWorktrees,
        hostBranches,
        cloneWorktrees,
        cloneExists,
        clean: hostWorktrees.length === 0 && hostBranches.length === 0 && cloneWorktrees.length === 0 && !cloneExists,
    });
}
