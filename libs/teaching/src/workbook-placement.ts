/**
 * Where a workbook lives (epic #405, decision record #450, invariant 6).
 *
 * A workbook is a reading surface for one repository's roadmap, so in a workspace with a hub and
 * members it belongs to the member repository whose roadmap it teaches — not to the hub. The queue
 * lives in the hub because the distiller reads it; nothing ever drains a workbook, and a learner
 * reading about a member's roadmap is reading about that member.
 *
 * The rule is enforced rather than documented: {@link assertWorkbookHome} refuses to make a
 * workbook in a hub checkout, so no caller can put one there by passing the wrong root, and
 * {@link resolveWorkbookHome} is how a command finds the right root in the first place.
 *
 * This module never re-derives workspace shape. It asks the one resolver
 * (`@nexus/workspace/resolve`) and reads the answer.
 */

import * as path from "node:path";
import { resolveWorkspace, type ResolveResult, type ResolvedMember } from "@nexus/workspace/resolve";

/** The repository a workbook belongs in, and why that repository. */
export interface ResolvedWorkbookHome {
    /** The checkout the workbook store lives under. */
    repoRoot: string;
    /** The member's name, or the repository's own root path in single-repo mode. */
    repo: string;
    /** How the home was decided. */
    mode: "single-repo" | "member";
}

export type WorkbookHomeResult = { ok: true; home: ResolvedWorkbookHome } | { ok: false; message: string };

/** Raised instead of creating a workbook in a hub checkout. */
export class HubWorkbookError extends Error {
    readonly hubRoot: string;
    constructor(hubRoot: string, members: readonly string[]) {
        super(
            `refusing to make a workbook in the hub checkout ${hubRoot}: a workbook teaches one ` +
            `repository's roadmap, so it lives in the member repository whose roadmap it teaches. ` +
            `Run this in that member's checkout, or name it — the workspace declares: ` +
            `${members.length === 0 ? "(no members)" : members.join(", ")}.`,
        );
        this.name = "HubWorkbookError";
        this.hubRoot = hubRoot;
    }
}

/** True when `child` is `parent` or sits inside it. */
function within(child: string, parent: string): boolean {
    const relative: string = path.relative(path.resolve(parent), path.resolve(child));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** The declared member whose checkout contains `dir`, or null when none does. */
function memberContaining(members: readonly ResolvedMember[], dir: string): ResolvedMember | null {
    return members.find((m) => within(dir, m.expectedPath)) ?? null;
}

/**
 * Decide which repository a workbook belongs in, starting from the checkout a command was run in.
 *
 * In single-repo mode that is the repository itself. In a workspace it is a member: run from a
 * member's checkout the answer is that member, and run from the hub the caller must name the
 * member whose roadmap the workbook teaches, because the hub cannot guess which roadmap is meant.
 */
export function resolveWorkbookHome(startDir: string, member?: string): WorkbookHomeResult {
    const resolved: ResolveResult = resolveWorkspace(startDir);
    if (!resolved.ok) return { ok: false, message: resolved.error.message };

    if (resolved.workspace.mode === "single-repo") {
        if (member !== undefined) {
            return {
                ok: false,
                message:
                    `${startDir} declares no workspace, so there is no member named '${member}' to ` +
                    `put a workbook in. Drop the member name — a single repository holds its own workbooks.`,
            };
        }
        return { ok: true, home: { repoRoot: resolved.workspace.root, repo: resolved.workspace.root, mode: "single-repo" } };
    }

    const workspace = resolved.workspace;
    const names: string[] = workspace.members.map((m) => m.name);
    const here: ResolvedMember | null = memberContaining(workspace.members, startDir);

    if (here !== null) {
        if (member !== undefined && member !== here.name) {
            return {
                ok: false,
                message:
                    `this checkout is member '${here.name}', not '${member}'. A workbook lives in the ` +
                    `member repository whose roadmap it teaches, so make it from that member's checkout.`,
            };
        }
        return { ok: true, home: { repoRoot: here.expectedPath, repo: here.name, mode: "member" } };
    }

    if (member === undefined) {
        return {
            ok: false,
            message:
                `${startDir} is the hub checkout, and a workbook teaches one member's roadmap rather ` +
                `than the workspace's. Name the member it teaches, or run this in that member's ` +
                `checkout. The workspace declares: ${names.length === 0 ? "(no members)" : names.join(", ")}.`,
        };
    }

    const named: ResolvedMember | undefined = workspace.members.find((m) => m.name === member);
    if (named === undefined) {
        return {
            ok: false,
            message:
                `the workspace declares no member named '${member}'. It declares: ` +
                `${names.length === 0 ? "(no members)" : names.join(", ")}.`,
        };
    }
    if (named.checkout === "missing") {
        return {
            ok: false,
            message:
                `member '${named.name}' is not checked out at ${named.expectedPath}, and its workbook ` +
                `lives there rather than in the hub. Check it out and re-run.`,
        };
    }
    return { ok: true, home: { repoRoot: named.expectedPath, repo: named.name, mode: "member" } };
}

/**
 * Refuse a workbook in the wrong repository. Called before anything is written, so a hub checkout
 * never gains a workbook store — the invariant holds even when a caller passes a root it resolved
 * some other way.
 */
export function assertWorkbookHome(repoRoot: string): void {
    const resolved: ResolveResult = resolveWorkspace(repoRoot);
    if (!resolved.ok || resolved.workspace.mode !== "workspace") return;
    const workspace = resolved.workspace;
    if (memberContaining(workspace.members, repoRoot) !== null) return;
    throw new HubWorkbookError(repoRoot, workspace.members.map((m) => m.name));
}
