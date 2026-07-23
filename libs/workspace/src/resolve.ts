/**
 * The single deterministic producer of workspace context.
 *
 * {@link resolveWorkspace} is the one entry point every Nexus command consumes; no command
 * re-derives workspace shape. From any starting checkout it decides the checkout's role by
 * which committed artifact is present, then:
 *
 *   - a hub manifest (`.nexus/config/workspace.yml`) → resolve from the hub;
 *   - a hub pointer (`.nexus/config/hub.yml`)        → resolve from the member (locate the hub);
 *   - neither                                        → single-repo mode, today's behavior unchanged.
 *
 * It delegates the actual manifest/pointer reading and sibling-finding to
 * {@link loadWorkspaceFromHub} / {@link loadWorkspaceFromMember} — it never re-implements them —
 * and layers one thing on top: each declared member's checkout state (present or missing),
 * determined by a read-only stat of its expected sibling path. Resolution never clones, fetches,
 * or writes; a missing member checkout is a reported state, not a failure.
 *
 * The resolved workspace description is entry-point-independent: resolving from the hub and from
 * any member yields deep-equal descriptions (the parity guarantee). Hard failures — a malformed
 * manifest, a hub that is not checked out, an undeclared member — surface as the same structured
 * {@link Diagnostic} the underlying loaders produce.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
    type Diagnostic,
    type MemberDescription,
    type WorkspaceDescription,
    loadWorkspaceFromHub,
} from "./manifest.js";
import { loadWorkspaceFromMember } from "./pointer.js";

const MANIFEST_RELATIVE_PATH = [".nexus", "config", "workspace.yml"];
const POINTER_RELATIVE_PATH = [".nexus", "config", "hub.yml"];

/** Where the hub's vendored portable-tools bundle lives, relative to the hub root. */
export const PORTABLE_TOOLS_RELATIVE_PATH = [".nexus", "tools"];

/** Whether a declared member is checked out at its expected sibling location. */
export type CheckoutState = "present" | "missing";

/** A manifest-declared member, enriched with its on-disk checkout state. */
export interface ResolvedMember extends MemberDescription {
    checkout: CheckoutState;
}

/** A resolved multi-repo workspace: the hub plus every declared member and its checkout state. */
export interface ResolvedWorkspace {
    mode: "workspace";
    /** The hub checkout path (the manifest's home). */
    hubRoot: string;
    /** The shared parent folder holding the hub and every member checkout. */
    parentDir: string;
    hub: WorkspaceDescription["hub"];
    members: ResolvedMember[];
    /** Absolute path to the hub's vendored portable-tools directory (epic #44, Story 2). */
    portableToolsDir: string;
    /**
     * Workspace-wide GitHub-publishing defaults (epic #121, STORY-121.05), carried through from the
     * manifest's optional top-level `github:` block. Absent when the manifest declares none. The
     * `workspace github-defaults` CLI verb emits this so the Python resolver can layer it as the
     * `hub` level of its precedence chain.
     */
    github?: Record<string, string>;
}

/** A checkout that declares no workspace: today's single-repo behavior applies. */
export interface SingleRepoWorkspace {
    mode: "single-repo";
    /** The checkout resolution started from. */
    root: string;
    /** Repo-relative docs root (epic #74): always "docs" in single-repo mode. */
    docsRoot: string;
}

/** The single-repo docs-root default — unchanged before and after epic #74. */
const SINGLE_REPO_DOCS_ROOT = "docs";

/** A checkout's docs root alone, without the rest of the resolved workspace shape. */
export type LocalDocsRootResult = { ok: true; docsRoot: string } | { ok: false; error: Diagnostic };

export type ResolveResult =
    | { ok: true; workspace: ResolvedWorkspace | SingleRepoWorkspace }
    | { ok: false; error: Diagnostic };

/** True if the path exists and is a directory (read-only stat, never throws). */
function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Layer each member's read-only checkout state onto a hub-side workspace description. */
function annotate(ws: WorkspaceDescription): ResolvedWorkspace {
    return {
        mode: "workspace",
        hubRoot: ws.hubRoot,
        parentDir: ws.parentDir,
        hub: ws.hub,
        members: ws.members.map((m) => ({
            ...m,
            checkout: isDirectory(m.expectedPath) ? "present" : "missing",
        })),
        portableToolsDir: path.join(ws.hubRoot, ...PORTABLE_TOOLS_RELATIVE_PATH),
        ...(ws.github ? { github: ws.github } : {}),
    };
}

/**
 * Resolve the workspace from any starting checkout.
 *
 * The single producer of workspace context. Read-only and deterministic: same filesystem →
 * same result, regardless of whether resolution started from the hub or from a member.
 *
 * @param startDir the checkout to resolve from (a command passes its working directory)
 */
export function resolveWorkspace(startDir: string): ResolveResult {
    const hasManifest = fs.existsSync(path.join(startDir, ...MANIFEST_RELATIVE_PATH));
    const hasPointer = fs.existsSync(path.join(startDir, ...POINTER_RELATIVE_PATH));

    // Single-repo fallback keyed on the absence of BOTH artifacts: existing projects untouched.
    if (!hasManifest && !hasPointer) {
        return {
            ok: true,
            workspace: { mode: "single-repo", root: startDir, docsRoot: SINGLE_REPO_DOCS_ROOT },
        };
    }

    // The manifest is the single source of truth; if a checkout carries one, it is the hub.
    const loaded = hasManifest
        ? loadWorkspaceFromHub(startDir)
        : loadWorkspaceFromMember(startDir);
    if (!loaded.ok) {
        return loaded;
    }
    return { ok: true, workspace: annotate(loaded.workspace) };
}

/**
 * Resolve just the docs root for the checkout at `startDir` — the thin selector consumers that
 * need only this one value (the atlas generator, the cross-ref skill) read instead of resolving
 * (and discarding) the full workspace shape themselves. Never a second producer: it calls
 * {@link resolveWorkspace} and reads the same field the status read-out prints.
 */
export function localDocsRoot(startDir: string): LocalDocsRootResult {
    const resolved = resolveWorkspace(startDir);
    if (!resolved.ok) {
        return resolved;
    }
    if (resolved.workspace.mode === "single-repo") {
        return { ok: true, docsRoot: resolved.workspace.docsRoot };
    }
    const isHub = path.resolve(startDir) === path.resolve(resolved.workspace.hubRoot);
    return { ok: true, docsRoot: isHub ? resolved.workspace.hub.docsRoot : "docs" };
}
