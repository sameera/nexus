/**
 * Read the member-side hub pointer and resolve the workspace from a member checkout.
 *
 * A member repo carries a thin, committed pointer (`<member>/.nexus/config/hub.yml`) that
 * names ONLY the hub: a bare sibling directory name plus the hub's git-remote identity for
 * verification. It never adds, removes, or redeclares membership — the hub manifest stays the
 * single source of truth for the member set.
 *
 * {@link loadWorkspaceFromMember} reads that pointer, finds the hub as a named sibling under
 * the shared parent folder, and delegates to {@link loadWorkspaceFromHub} — so resolution from
 * a member yields a workspace description identical to resolution from the hub itself. Every
 * failure is a structured {@link Diagnostic} naming the artifact, the entry, and the defect,
 * and never a silently partial workspace.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { isBareSegment } from "./bare-name.js";
import {
    type Diagnostic,
    type DiagnosticProblem,
    type LoadResult,
    loadWorkspaceFromHub,
} from "./manifest.js";
import { normalizeRemote } from "./remote.js";

export interface HubPointer {
    /** The hub's expected sibling checkout directory name. */
    hubName: string;
    /** The hub's remote identity exactly as written in the pointer. */
    hubRemote: string;
    /** Canonical hub remote identity (see {@link normalizeRemote}). */
    normalizedHubRemote: string;
}

export type PointerResult =
    | { ok: true; pointer: HubPointer }
    | { ok: false; error: Diagnostic };

const POINTER_RELATIVE_PATH = [".nexus", "config", "hub.yml"];
const HUB_KEYS = ["name", "remote"];
const TOP_LEVEL_KEYS = ["hub"];

function isMapping(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A present, non-empty string field, or null. */
function stringField(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Parse and validate hub-pointer source, returning either the located hub identity or a
 * structured diagnostic. Pure: no filesystem access, so it is directly unit-testable.
 *
 * @param raw  the pointer file contents
 * @param file the pointer path (used to name the artifact in diagnostics)
 */
export function parseAndValidatePointer(raw: string, file: string): PointerResult {
    const name = path.basename(file);
    const fail = (problem: DiagnosticProblem, entry: string | undefined, message: string): PointerResult => ({
        ok: false,
        error: entry === undefined ? { file, problem, message } : { file, entry, problem, message },
    });

    let doc: unknown;
    try {
        doc = parse(raw);
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        return fail("malformed-yaml", undefined, `${name}: could not parse YAML — ${detail}`);
    }

    if (doc === null || doc === undefined) {
        return fail("missing-field", "hub", `${name}: pointer is empty; missing required section 'hub'`);
    }
    if (!isMapping(doc)) {
        return fail("wrong-type", undefined, `${name}: pointer must be a mapping with a 'hub' section`);
    }

    for (const key of Object.keys(doc)) {
        if (!TOP_LEVEL_KEYS.includes(key)) {
            return fail(
                "unknown-key",
                undefined,
                `${name}: unknown top-level key '${key}'; a hub pointer names only the hub, it never redeclares membership`,
            );
        }
    }

    if (!("hub" in doc)) {
        return fail("missing-field", "hub", `${name}: missing required section 'hub'`);
    }
    const hub = doc.hub;
    if (!isMapping(hub)) {
        return fail("wrong-type", "hub", `${name}: 'hub' must be a mapping with 'name' and 'remote'`);
    }
    for (const key of Object.keys(hub)) {
        if (!HUB_KEYS.includes(key)) {
            return fail("unknown-key", "hub", `${name}: unknown key '${key}' on 'hub'`);
        }
    }
    const hubName = stringField(hub.name);
    if (!hubName) {
        return fail("missing-field", "hub", `${name}: 'hub' is missing required field 'name'`);
    }
    if (!isBareSegment(hubName)) {
        return fail(
            "unsafe-name",
            "hub",
            `${name}: hub name '${hubName}' must be a bare sibling directory name (no path separators or '..'); it locates the hub as a sibling of this checkout, never an arbitrary path`,
        );
    }
    const hubRemote = stringField(hub.remote);
    if (!hubRemote) {
        return fail("missing-field", "hub", `${name}: 'hub' is missing required field 'remote'`);
    }

    return {
        ok: true,
        pointer: { hubName, hubRemote, normalizedHubRemote: normalizeRemote(hubRemote) },
    };
}

/**
 * Resolve the workspace from a member checkout via its hub pointer.
 *
 * Read-only: it reads the member's `hub.yml`, locates the hub as a named sibling under the
 * shared parent, and reads that hub's manifest; it never clones, fetches, or writes. The
 * result is identical to {@link loadWorkspaceFromHub} run against the located hub. Failures are
 * named diagnostics distinguishing a missing pointer, a hub that is not checked out at the
 * expected location, a pointer whose hub remote disagrees with the located hub, and a member
 * that the hub manifest does not declare.
 */
export function loadWorkspaceFromMember(memberRoot: string): LoadResult {
    const file = path.join(memberRoot, ...POINTER_RELATIVE_PATH);
    if (!fs.existsSync(file)) {
        return {
            ok: false,
            error: {
                file,
                problem: "missing-pointer",
                message: `${path.basename(file)} not found at ${file}; this checkout has no hub pointer`,
            },
        };
    }

    const parsed = parseAndValidatePointer(fs.readFileSync(file, "utf-8"), file);
    if (!parsed.ok) {
        return parsed;
    }
    const pointer = parsed.pointer;

    // Locate the hub as a named sibling under the shared parent — never by absolute path.
    const expectedHubPath = path.join(path.dirname(memberRoot), pointer.hubName);
    const missingHub = (message: string): LoadResult => ({
        ok: false,
        error: { file, entry: `hub (${pointer.hubName})`, problem: "missing-hub-checkout", message },
    });
    if (!isDirectory(expectedHubPath)) {
        return missingHub(
            `hub '${pointer.hubName}' (${pointer.hubRemote}) is not checked out at the expected location ${expectedHubPath}`,
        );
    }

    const hubResult = loadWorkspaceFromHub(expectedHubPath);
    if (!hubResult.ok) {
        // A directory sits at the hub location but carries no manifest: it is not the hub.
        if (hubResult.error.problem === "missing-manifest") {
            return missingHub(
                `found a checkout at ${expectedHubPath} but it has no workspace manifest; hub '${pointer.hubName}' (${pointer.hubRemote}) is not checked out there`,
            );
        }
        // Any other manifest defect belongs to the located hub's file — pass it through.
        return hubResult;
    }
    const workspace = hubResult.workspace;

    // Verify the located hub is the one the pointer intends (compare normalized remotes).
    if (pointer.normalizedHubRemote !== workspace.hub.normalizedRemote) {
        return {
            ok: false,
            error: {
                file,
                entry: `hub (${pointer.hubName})`,
                problem: "hub-remote-mismatch",
                message: `hub pointer expects remote '${pointer.normalizedHubRemote}' but the hub at ${expectedHubPath} declares '${workspace.hub.normalizedRemote}'`,
            },
        };
    }

    // Membership comes from the manifest, matched by this checkout's sibling directory name.
    const memberName = path.basename(memberRoot);
    if (!workspace.members.some((m) => m.name === memberName)) {
        const declared =
            workspace.members.length > 0
                ? workspace.members.map((m) => m.name).join(", ")
                : "(none)";
        return {
            ok: false,
            error: {
                file: path.join(workspace.hubRoot, ".nexus", "config", "workspace.yml"),
                entry: `member (${memberName})`,
                problem: "undeclared-member",
                message: `this checkout '${memberName}' (at ${memberRoot}) is not declared as a member in the hub '${workspace.hub.name}' manifest; declared members: ${declared}`,
            },
        };
    }

    return hubResult;
}

/** True if the path exists and is a directory (read-only stat, never throws). */
function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}
