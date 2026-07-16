/**
 * `nexus workspace add-repo` (STORY-60.04): add the invoking checkout to an existing workspace
 * as one new member.
 *
 * A structured, minimal mutation of PRECISELY two files — the hub manifest gains one appended
 * entry (every existing entry preserved verbatim, via the yaml-document append in
 * `@nexus/workspace/write`) and the new member gains its hub pointer. No third file in any
 * repo changes; in particular, add-repo does not install components (that stays with
 * `nexus deploy` / `init`'s fan-out). Collisions with the hub or any declared member are
 * rejected before writing through the resolver's own manifest validation (the remote-identity
 * rule), and the verb closes the loop by re-resolving from the hub, the new member, and every
 * present member — rolling both files back unless every entry point yields the identical
 * workspace description.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
import {
    appendMemberToManifest,
    manifestPath,
    pointerPath,
    writePointer,
    type WriteResult,
} from "@nexus/workspace/write";
import { discoverSiblings, originRemote, type RepoCandidate } from "./workspace-init.js";

export interface AddRepoIo {
    /** The new member's checkout — the directory the verb is invoked from. */
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

export function runWorkspaceAddRepo(io: AddRepoIo): number {
    const memberRoot: string = io.cwd;
    const memberName: string = path.basename(memberRoot);

    if (fs.existsSync(pointerPath(memberRoot)) || fs.existsSync(manifestPath(memberRoot))) {
        io.stderr(`'${memberName}' already carries a workspace declaration — nothing to add`);
        return 1;
    }
    const memberRemote: string | null = originRemote(memberRoot);
    if (memberRemote === null) {
        io.stderr(`'${memberName}' has no origin remote — a member needs a remote identity`);
        return 1;
    }

    // Locate the hub: the one sibling checkout carrying a manifest.
    const hubs: RepoCandidate[] = discoverSiblings(memberRoot).filter(
        (c) => c.hasManifest && c.root !== memberRoot,
    );
    if (hubs.length !== 1) {
        io.stderr(
            hubs.length === 0
                ? `no sibling checkout under ${path.dirname(memberRoot)} carries a workspace manifest — ` +
                      "declare the workspace first with 'nexus workspace init'"
                : `several sibling checkouts carry a workspace manifest (${hubs.map((h) => h.name).join(", ")}) — ` +
                      "cannot determine the hub",
        );
        return 1;
    }
    const hubRoot: string = hubs[0].root;

    // The hub identity for the new pointer comes from the resolver, never re-derived.
    const hubResolved: ResolveResult = resolveWorkspace(hubRoot);
    if (!hubResolved.ok) {
        io.stderr(hubResolved.error.message);
        return 1;
    }
    if (hubResolved.workspace.mode !== "workspace") {
        io.stderr(`${hubRoot} does not resolve as a workspace hub`);
        return 1;
    }
    const hub = hubResolved.workspace.hub;

    // Two-file mutation, validated-before-write. The append runs the resolver's manifest
    // validation, so a name or remote collision reports here with nothing written.
    const priorManifest: string = fs.readFileSync(manifestPath(hubRoot), "utf8");
    const appended: WriteResult = appendMemberToManifest(hubRoot, { name: memberName, remote: memberRemote });
    if (!appended.ok) {
        io.stderr(appended.error.message);
        return 1;
    }
    const rollback = (detail: string): number => {
        fs.writeFileSync(manifestPath(hubRoot), priorManifest);
        fs.rmSync(pointerPath(memberRoot), { force: true });
        io.stderr(detail);
        return 1;
    };
    const pointer: WriteResult = writePointer(memberRoot, { name: hub.name, remote: hub.remote });
    if (!pointer.ok) {
        return rollback(pointer.error.message);
    }

    // Close the loop (epic invariant 1): hub, new member, and every present member must yield
    // the identical description, or the mutation is rolled back.
    const fromHub: ResolveResult = resolveWorkspace(hubRoot);
    if (!fromHub.ok) {
        return rollback(`resolver parity check failed — mutation rolled back: ${fromHub.error.message}`);
    }
    if (fromHub.workspace.mode !== "workspace") {
        return rollback("resolver parity check failed — mutation rolled back: hub no longer resolves as a workspace");
    }
    for (const m of fromHub.workspace.members.filter((m) => m.checkout === "present")) {
        const fromMember: ResolveResult = resolveWorkspace(m.expectedPath);
        if (!fromMember.ok) {
            return rollback(`resolver parity check failed — mutation rolled back: ${fromMember.error.message}`);
        }
        if (JSON.stringify(fromMember) !== JSON.stringify(fromHub)) {
            return rollback(
                `resolver parity check failed — mutation rolled back: resolution from '${m.name}' ` +
                    "disagrees with resolution from the hub",
            );
        }
    }

    io.stdout(
        `Added '${memberName}' (${memberRemote}) to workspace '${hub.name}': two files changed — ` +
            "the hub manifest and this checkout's hub pointer. Verify with 'nexus workspace status'.",
    );
    return 0;
}
