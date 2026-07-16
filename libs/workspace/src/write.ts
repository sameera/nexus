/**
 * Writers for the workspace artifacts (epic #60) — the counterpart of the readers in
 * manifest.ts / pointer.ts. The resolver stays the single authority on workspace shape: these
 * writers never define a second schema. Each one renders a candidate, runs it through the
 * resolver's own pure parser (`parseAndValidateManifest` / `parseAndValidatePointer`), and
 * touches disk only when the resolver accepts the candidate with zero edits — so collisions
 * (the remote-identity rule, duplicate names, unsafe names) are rejected by the same code that
 * reads the artifacts, before anything is written.
 *
 * `appendMemberToManifest` is deliberately a structured minimal edit: it parses the existing
 * manifest as a YAML document and appends one member node, preserving every existing entry,
 * comment, and ordering — never a wholesale regeneration.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Document, isSeq, parseDocument } from "yaml";
import { type Diagnostic, parseAndValidateManifest } from "./manifest.js";
import { parseAndValidatePointer } from "./pointer.js";

const MANIFEST_RELATIVE_PATH = [".nexus", "config", "workspace.yml"];
const POINTER_RELATIVE_PATH = [".nexus", "config", "hub.yml"];

export interface RepoIdentity {
    /** Bare sibling checkout directory name. */
    name: string;
    /** Git remote identity as written (any spelling the resolver normalizes). */
    remote: string;
}

export interface WorkspaceDeclaration {
    hub: RepoIdentity;
    members: RepoIdentity[];
}

export type WriteResult = { ok: true; file: string } | { ok: false; error: Diagnostic };

/** The manifest path a hub checkout carries. */
export function manifestPath(hubRoot: string): string {
    return path.join(hubRoot, ...MANIFEST_RELATIVE_PATH);
}

/** The pointer path a member checkout carries. */
export function pointerPath(memberRoot: string): string {
    return path.join(memberRoot, ...POINTER_RELATIVE_PATH);
}

function writeValidated(file: string, raw: string): WriteResult {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, raw);
    return { ok: true, file };
}

/**
 * Render and write the hub manifest for a full workspace declaration. Validates the rendered
 * candidate through the resolver's manifest parser first; on any diagnostic (collision, unsafe
 * name, …) nothing is written.
 */
export function writeManifest(hubRoot: string, declaration: WorkspaceDeclaration): WriteResult {
    const doc = new Document({
        hub: { name: declaration.hub.name, remote: declaration.hub.remote },
        members: declaration.members.map((m) => ({ name: m.name, remote: m.remote })),
    });
    const raw: string = doc.toString();
    const file: string = manifestPath(hubRoot);

    const validated = parseAndValidateManifest(raw, file, hubRoot);
    if (!validated.ok) {
        return validated;
    }
    return writeValidated(file, raw);
}

/**
 * Render and write a member's hub pointer. Validates through the resolver's pointer parser
 * first; nothing is written on a diagnostic.
 */
export function writePointer(memberRoot: string, hub: RepoIdentity): WriteResult {
    const doc = new Document({ hub: { name: hub.name, remote: hub.remote } });
    const raw: string = doc.toString();
    const file: string = pointerPath(memberRoot);

    const validated = parseAndValidatePointer(raw, file);
    if (!validated.ok) {
        return validated;
    }
    return writeValidated(file, raw);
}

/**
 * Append exactly one member entry to an existing hub manifest — a structured minimal edit that
 * preserves every existing entry, comment, and ordering. The appended candidate is validated
 * through the resolver's manifest parser (which enforces the name and remote-identity collision
 * rules against the hub and every declared member) before the file is touched; on a diagnostic
 * the manifest is left byte-identical.
 */
export function appendMemberToManifest(hubRoot: string, member: RepoIdentity): WriteResult {
    const file: string = manifestPath(hubRoot);
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

    const doc = parseDocument(fs.readFileSync(file, "utf-8"));
    const entry = doc.createNode({ name: member.name, remote: member.remote });
    if (isSeq(doc.get("members", true))) {
        doc.addIn(["members"], entry);
    } else {
        // No members list yet (absent or empty value): create it with the one new entry.
        doc.set("members", doc.createNode([entry]));
    }
    const raw: string = doc.toString();

    const validated = parseAndValidateManifest(raw, file, hubRoot);
    if (!validated.ok) {
        return validated;
    }
    return writeValidated(file, raw);
}
