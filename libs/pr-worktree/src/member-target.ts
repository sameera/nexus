/**
 * Resolve which checkout an analyze-mode PR reference targets.
 *
 * Analyze mode is the epic #211 opening in the --pr role gate: a bare PR number keeps today's
 * meaning (this checkout's own repository), while a repo-qualified reference or a pull-request
 * URL may name a declared member of the workspace the current checkout is a hub of (decision
 * record #495). The reference is matched only against the hub's own manifest — no remote, path,
 * or repository name may originate anywhere else — and every git/gh operation for the run is then
 * rooted at the resolved target, never at the hub.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { canonicalRemoteUrl } from "@nexus/workspace/canonical-remote";
import { QUALIFIED_ISSUE_REF_RE } from "@nexus/workspace/issue-ref";
import { normalizeRemote } from "@nexus/workspace/remote";
import { type ResolvedMember, resolveWorkspace } from "@nexus/workspace/resolve";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner, defaultRunner, git } from "./run.js";

export interface ParsedPrReference {
    /** Lowercased "owner/repo", or null for a bare PR number (today's meaning). */
    repo: string | null;
    number: number;
    /** The lowercased forge host a pull-request URL names; absent for the other forms, which name none. */
    host?: string;
    /** The port a pull-request URL names, kept apart from `host` so a caller decides what to do with it. */
    port?: string;
}

const BARE_RE = /^(\d+)$/;
const URL_RE = /^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)\/?$/i;

/** Parse a `--pr` argument into its optional repository qualifier and PR number. */
export function parsePrReference(ref: string): ParsedPrReference | null {
    const trimmed = ref.trim();

    const bare = BARE_RE.exec(trimmed);
    if (bare) return { repo: null, number: Number(bare[1]) };

    const qualified = QUALIFIED_ISSUE_REF_RE.exec(trimmed);
    if (qualified) return { repo: `${qualified[1]}/${qualified[2]}`.toLowerCase(), number: Number(qualified[3]) };

    const url = URL_RE.exec(trimmed);
    if (url) {
        const authority = /^(?:[^@]*@)?([^:@]+)(?::(\d+))?$/.exec(url[1].toLowerCase());
        if (authority === null) return null;
        // www.github.com is github.com; another host keeps its own name.
        const host = authority[1] === "www.github.com" ? "github.com" : authority[1];
        const parsed: ParsedPrReference = { repo: `${url[2]}/${url[3]}`.toLowerCase(), number: Number(url[4]), host };
        // A scheme's default port names nothing the bare host does not.
        const port = authority[2];
        return port === undefined || port === "443" || port === "80" ? parsed : { ...parsed, port };
    }

    return null;
}

/**
 * The forge a host names, as gh addresses it: github.com for github.com's SSH aliases
 * (`github.com-work`, `ssh.github.com`), the host itself otherwise, lowercased.
 */
export function forgeHost(host: string): string {
    const h = host.toLowerCase();
    return h === "github.com" || h.endsWith(".github.com") || h.startsWith("github.com-") ? "github.com" : h;
}

/**
 * The `host/owner/repo` a pull-request reference lives in. A URL names its forge; `owner/repo#N`
 * lives on the checkout's own, `own` as canonicalRepoRef gives it; a bare number is the checkout's
 * own repository. `owner/repo` alone when no host is known; null for a bare number with no `own`.
 */
export function prRepoOnForge(ref: ParsedPrReference, own: string | null): string | null {
    const [ownHost, ...ownPath] = own === null ? [] : own.split("/");
    if (ref.repo === null) return own === null ? null : [forgeHost(ownHost), ...ownPath].join("/");
    const host = ref.host ?? (ownHost === undefined ? undefined : forgeHost(ownHost));
    return host === undefined ? ref.repo : `${host}/${ref.repo}`;
}

/** The repository a pull-request reference names, as close prints and compares it: `owner/repo`, host-qualified only off github.com. */
export function prRepoName(ref: ParsedPrReference, own: string | null): string | null {
    const repo = prRepoOnForge(ref, own);
    return repo === null ? null : repo.toLowerCase().replace(/^github\.com\//, "");
}

export interface AnalyzeTarget {
    repoRoot: string;
    repoIdentity: string;
    role: "single-repo" | "hub" | "member";
}

export type ResolveAnalyzeTargetResult =
    | { ok: true; target: AnalyzeTarget }
    | { ok: false; error: PrWorktreeDiagnostic };

/**
 * GitHub repository identity is case-insensitive on host and path, unlike the byte-exact
 * comparison {@link normalizeRemote} otherwise preserves for self-hosted, case-sensitive forges —
 * so this match lowercases both sides rather than reusing that comparison verbatim.
 */
function memberMatches(member: ResolvedMember, repoRef: string): boolean {
    return member.normalizedRemote.toLowerCase() === `github.com/${repoRef}`.toLowerCase();
}

export function resolveAnalyzeTarget(
    startDir: string,
    run: Runner = defaultRunner,
    prRef: string,
): ResolveAnalyzeTargetResult {
    const parsed = parsePrReference(prRef);
    if (!parsed) {
        return {
            ok: false,
            error: {
                problem: "malformed-pr-reference",
                message: `'${prRef}' is not a recognized PR reference; expected a bare number, 'owner/repo#N', or a pull-request URL.`,
            },
        };
    }

    const repoRoot = git(run, startDir, "rev-parse", "--show-toplevel");
    if (repoRoot === null) {
        return {
            ok: false,
            error: { problem: "not-a-git-repo", message: `${startDir} is not inside a git checkout; the --pr flow must run inside one.` },
        };
    }

    if (parsed.repo === null) {
        const hasManifest = fs.existsSync(path.join(repoRoot, ".nexus", "config", "workspace.yml"));
        const hasPointer = fs.existsSync(path.join(repoRoot, ".nexus", "config", "hub.yml"));
        const role: AnalyzeTarget["role"] = hasManifest ? "hub" : hasPointer ? "member" : "single-repo";
        // The canonical remote, not `origin`: a lead working from a fork has an `origin` naming
        // their own copy, and the PR being analyzed was opened against the repository `upstream`
        // names.
        const remoteUrl = canonicalRemoteUrl(run, repoRoot);
        const identity = remoteUrl ? normalizeRemote(remoteUrl) : path.basename(repoRoot);
        return { ok: true, target: { repoRoot, repoIdentity: identity, role } };
    }

    const resolved = resolveWorkspace(repoRoot);
    if (!resolved.ok) {
        return { ok: false, error: { problem: resolved.error.problem, message: resolved.error.message } };
    }
    if (resolved.workspace.mode !== "workspace") {
        return {
            ok: false,
            error: {
                problem: "undeclared-member",
                message: `'${parsed.repo}' is not a declared member: ${repoRoot} declares no workspace at all.`,
            },
        };
    }

    const member = resolved.workspace.members.find((m) => memberMatches(m, parsed.repo as string));
    if (!member) {
        const declared = resolved.workspace.members.map((m) => m.normalizedRemote).join(", ") || "(none)";
        return {
            ok: false,
            error: {
                problem: "undeclared-member",
                message: `'${parsed.repo}' is not a declared member of this workspace; declared members: ${declared}.`,
            },
        };
    }
    if (member.checkout === "missing") {
        return {
            ok: false,
            error: {
                problem: "member-checkout-missing",
                message: `declared member '${member.name}' is not checked out where expected; expected it at ${member.expectedPath}.`,
            },
        };
    }
    return {
        ok: true,
        target: { repoRoot: member.expectedPath, repoIdentity: member.normalizedRemote, role: "member" },
    };
}
