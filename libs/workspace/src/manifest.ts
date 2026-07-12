/**
 * Read, parse, and validate the hub-side workspace manifest, and produce a canonical
 * workspace description from the hub.
 *
 * The manifest (`<hub>/.nexus/config/workspace.yml`) is the single source of truth for
 * the workspace shape: the hub identity plus the member set, each member's remote
 * identity, and its expected sibling checkout name. This module is the shared, importable
 * producer of workspace context — later stories (the member pointer, cross-entry parity,
 * the single-repo fallback, the status read-out) consume it rather than re-deriving it.
 *
 * Every failure is a structured {@link Diagnostic} naming the artifact, the offending
 * entry, and the defect — never a generic error and never a silently partial workspace.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { isBareSegment } from "./bare-name.js";
import { normalizeRemote } from "./remote.js";

export type DiagnosticProblem =
    | "malformed-yaml"
    | "missing-manifest"
    | "missing-field"
    | "unknown-key"
    | "duplicate-member"
    | "unsafe-name"
    | "wrong-type"
    // Member-side resolution (see ./pointer):
    | "missing-pointer"
    | "missing-hub-checkout"
    | "hub-remote-mismatch"
    | "undeclared-member";

export interface Diagnostic {
    /** Path to the workspace.yml that was read. */
    file: string;
    /** The offending entry, e.g. "hub" or "members[1] (api)"; absent for file-level faults. */
    entry?: string;
    /** The defect category. */
    problem: DiagnosticProblem;
    /** One human sentence naming the file, the entry, and the defect. */
    message: string;
}

export interface MemberDescription {
    /** Expected sibling checkout directory name. */
    name: string;
    /** Remote identity exactly as written in the manifest. */
    remote: string;
    /** Canonical remote identity (see {@link normalizeRemote}). */
    normalizedRemote: string;
    /** Expected checkout path: a sibling of the hub under the shared parent. */
    expectedPath: string;
}

export interface WorkspaceDescription {
    /** The hub checkout path resolution started from. */
    hubRoot: string;
    /** The shared parent folder that holds the hub and every member checkout. */
    parentDir: string;
    hub: {
        name: string;
        remote: string;
        normalizedRemote: string;
        /** The hub checkout path (equals hubRoot). */
        path: string;
    };
    members: MemberDescription[];
}

export type LoadResult =
    | { ok: true; workspace: WorkspaceDescription }
    | { ok: false; error: Diagnostic };

const MANIFEST_RELATIVE_PATH = [".nexus", "config", "workspace.yml"];
const HUB_KEYS = ["name", "remote"];
const MEMBER_KEYS = ["name", "remote"];
const TOP_LEVEL_KEYS = ["hub", "members"];

function isMapping(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A present, non-empty string field, or null. */
function stringField(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Parse and validate manifest source, returning either a resolved workspace description
 * or a structured diagnostic. Pure: no filesystem access, so it is directly unit-testable.
 *
 * @param raw     the manifest file contents
 * @param file    the manifest path (used to name the artifact in diagnostics)
 * @param hubRoot the hub checkout path (used to compute expected sibling checkout paths)
 */
export function parseAndValidateManifest(raw: string, file: string, hubRoot: string): LoadResult {
    const name = path.basename(file);
    const fail = (problem: DiagnosticProblem, entry: string | undefined, message: string): LoadResult => ({
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
        return fail("missing-field", "hub", `${name}: manifest is empty; missing required section 'hub'`);
    }
    if (!isMapping(doc)) {
        return fail("wrong-type", undefined, `${name}: manifest must be a mapping with 'hub' and 'members'`);
    }

    for (const key of Object.keys(doc)) {
        if (!TOP_LEVEL_KEYS.includes(key)) {
            return fail("unknown-key", undefined, `${name}: unknown top-level key '${key}'`);
        }
    }

    // --- hub -----------------------------------------------------------------
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
            `${name}: hub name '${hubName}' must be a bare directory name (no path separators or '..')`,
        );
    }
    const hubRemote = stringField(hub.remote);
    if (!hubRemote) {
        return fail("missing-field", "hub", `${name}: 'hub' is missing required field 'remote'`);
    }

    // --- members -------------------------------------------------------------
    const parentDir = path.dirname(hubRoot);
    const membersRaw = doc.members ?? [];
    if (!Array.isArray(membersRaw)) {
        return fail("wrong-type", "members", `${name}: 'members' must be a list`);
    }

    const members: MemberDescription[] = [];
    const seenNames = new Map<string, number>();
    const seenRemotes = new Map<string, string>();

    for (let i = 0; i < membersRaw.length; i++) {
        const entry = `members[${i}]`;
        const member = membersRaw[i];
        if (!isMapping(member)) {
            return fail("wrong-type", entry, `${name}: ${entry} must be a mapping with 'name' and 'remote'`);
        }
        for (const key of Object.keys(member)) {
            if (!MEMBER_KEYS.includes(key)) {
                return fail("unknown-key", entry, `${name}: unknown key '${key}' on ${entry}`);
            }
        }
        const memberName = stringField(member.name);
        if (!memberName) {
            return fail("missing-field", entry, `${name}: ${entry} is missing required field 'name'`);
        }
        if (!isBareSegment(memberName)) {
            return fail(
                "unsafe-name",
                entry,
                `${name}: ${entry} name '${memberName}' must be a bare sibling directory name (no path separators or '..')`,
            );
        }
        const label = `${entry} (${memberName})`;
        const memberRemote = stringField(member.remote);
        if (!memberRemote) {
            return fail("missing-field", label, `${name}: member '${memberName}' is missing required field 'remote'`);
        }

        const priorNameIndex = seenNames.get(memberName);
        if (priorNameIndex !== undefined) {
            return fail(
                "duplicate-member",
                label,
                `${name}: duplicate member name '${memberName}' (also declared at members[${priorNameIndex}])`,
            );
        }
        seenNames.set(memberName, i);

        const normalizedRemote = normalizeRemote(memberRemote);
        const priorRemoteName = seenRemotes.get(normalizedRemote);
        if (priorRemoteName !== undefined) {
            return fail(
                "duplicate-member",
                label,
                `${name}: members '${priorRemoteName}' and '${memberName}' both resolve to the same remote '${normalizedRemote}'`,
            );
        }
        seenRemotes.set(normalizedRemote, memberName);

        members.push({
            name: memberName,
            remote: memberRemote,
            normalizedRemote,
            expectedPath: path.join(parentDir, memberName),
        });
    }

    return {
        ok: true,
        workspace: {
            hubRoot,
            parentDir,
            hub: {
                name: hubName,
                remote: hubRemote,
                normalizedRemote: normalizeRemote(hubRemote),
                path: hubRoot,
            },
            members,
        },
    };
}

/**
 * Read and resolve the workspace manifest from a hub checkout.
 *
 * Read-only: it reads `<hubRoot>/.nexus/config/workspace.yml` and reports what it finds;
 * it never clones, fetches, writes, or checks member-checkout existence (that is a later
 * story's concern). A hub without a manifest yields a named `missing-manifest` diagnostic.
 */
export function loadWorkspaceFromHub(hubRoot: string): LoadResult {
    const file = path.join(hubRoot, ...MANIFEST_RELATIVE_PATH);
    if (!fs.existsSync(file)) {
        return {
            ok: false,
            error: {
                file,
                problem: "missing-manifest",
                message: `${path.basename(file)} not found at ${file}; this checkout has no workspace manifest`,
            },
        };
    }
    return parseAndValidateManifest(fs.readFileSync(file, "utf-8"), file, hubRoot);
}
