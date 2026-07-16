/**
 * `nexus workspace init` (STORY-60.02): declare a multi-repo workspace in one invocation.
 *
 * The verb discovers candidate checkouts under the shared parent and LISTS them — the human
 * designates the hub and the members; init never proposes a hub (deliberately out of scope,
 * epic #60). Nothing is written until the designation is confirmed, and a repo that already
 * carries a manifest or pointer is reported and left unchanged absent explicit confirmation.
 *
 * The write path enforces the epic's parity invariant structurally: candidates are validated
 * through the resolver's own parsers (inside the `@nexus/workspace` writers — collisions
 * surface there via the remote-identity rule, before any write), and after writing, the verb
 * re-resolves from the hub AND every member, requiring the identical workspace description
 * from each entry point. A verb that cannot achieve clean parity rolls its writes back and
 * reports failure. Components are then fanned out through the same deploy primitive as
 * `nexus deploy`.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
import {
    manifestPath,
    pointerPath,
    writeManifest,
    writePointer,
    type RepoIdentity,
    type WorkspaceDeclaration,
    type WriteResult,
} from "@nexus/workspace/write";

export interface RepoCandidate {
    /** Bare sibling checkout directory name. */
    name: string;
    /** Absolute checkout path. */
    root: string;
    /** The checkout's `origin` remote, or null when it has none. */
    remote: string | null;
    hasManifest: boolean;
    hasPointer: boolean;
}

export interface InitIo {
    /** The invoking checkout; its parent is the shared workspace parent. */
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
    /** Interactive prompt; production wires readline, tests script the answers. */
    ask: (question: string) => Promise<string>;
}

export interface InitDeps {
    /** The component-deploy primitive, payload already bound (same primitive as `nexus deploy`). */
    deploy: (repoRoot: string) => void;
}

/** The checkout's `origin` remote via the git CLI (read-only), or null when unset. */
function originRemote(repoRoot: string): string | null {
    try {
        return execFileSync("git", ["-C", repoRoot, "remote", "get-url", "origin"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return null;
    }
}

/** Every git checkout under the invoking checkout's parent, the invoking one included. */
export function discoverSiblings(cwd: string): RepoCandidate[] {
    const parent: string = path.dirname(cwd);
    const candidates: RepoCandidate[] = [];
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }
        const root: string = path.join(parent, entry.name);
        if (!fs.existsSync(path.join(root, ".git"))) {
            continue;
        }
        candidates.push({
            name: entry.name,
            root,
            remote: originRemote(root),
            hasManifest: fs.existsSync(manifestPath(root)),
            hasPointer: fs.existsSync(pointerPath(root)),
        });
    }
    return candidates.sort((a, b) => a.name.localeCompare(b.name));
}

/** Parse a 1-based selection like "1" or "2,4"; null on anything out of range or malformed. */
function parseSelection(answer: string, max: number): number[] | null {
    const parts: string[] = answer
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
    if (parts.length === 0) {
        return null;
    }
    const picked: number[] = [];
    for (const part of parts) {
        if (!/^\d+$/.test(part)) {
            return null;
        }
        const index: number = Number(part);
        if (index < 1 || index > max || picked.includes(index)) {
            return null;
        }
        picked.push(index);
    }
    return picked;
}

interface FileBackup {
    file: string;
    /** Prior content, or null when the file did not exist. */
    prior: string | null;
}

function backup(file: string): FileBackup {
    return { file, prior: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null };
}

function restore(backups: FileBackup[]): void {
    for (const b of backups) {
        if (b.prior === null) {
            fs.rmSync(b.file, { force: true });
        } else {
            fs.writeFileSync(b.file, b.prior);
        }
    }
}

export async function runWorkspaceInit(io: InitIo, deps: InitDeps): Promise<number> {
    const candidates: RepoCandidate[] = discoverSiblings(io.cwd);
    if (candidates.length < 2) {
        io.stderr(
            `found ${candidates.length} checkout(s) under ${path.dirname(io.cwd)} — a workspace needs at ` +
                "least two sibling checkouts (one hub and one member)",
        );
        return 1;
    }

    io.stdout(`Discovered sibling checkouts under ${path.dirname(io.cwd)}:`);
    candidates.forEach((c, i) => {
        const markers: string[] = [];
        if (c.hasManifest) {
            markers.push("declares a workspace manifest");
        }
        if (c.hasPointer) {
            markers.push("carries a hub pointer");
        }
        const suffix: string = markers.length > 0 ? `  <- ${markers.join(", ")}` : "";
        io.stdout(`  [${i + 1}] ${c.name}  (${c.remote ?? "no remote"})${suffix}`);
    });

    // A repo already carrying a declaration is reported and left unchanged absent explicit
    // confirmation — the epic's re-run guard.
    const declared: RepoCandidate[] = candidates.filter((c) => c.hasManifest || c.hasPointer);
    if (declared.length > 0) {
        io.stdout(`Existing workspace declaration found on: ${declared.map((c) => c.name).join(", ")}.`);
        const answer: string = await io.ask("Type 'overwrite' to replace the existing declaration; anything else aborts: ");
        if (answer.trim() !== "overwrite") {
            io.stdout("No changes made.");
            return 1;
        }
    }

    const hubAnswer: string = await io.ask("Designate the hub (number): ");
    const hubSelection: number[] | null = parseSelection(hubAnswer, candidates.length);
    if (hubSelection === null || hubSelection.length !== 1) {
        io.stderr(`invalid hub designation '${hubAnswer.trim()}'`);
        return 1;
    }
    const hub: RepoCandidate = candidates[hubSelection[0] - 1];

    const memberAnswer: string = await io.ask("Designate the members (comma-separated numbers): ");
    const memberSelection: number[] | null = parseSelection(memberAnswer, candidates.length);
    if (memberSelection === null || memberSelection.includes(hubSelection[0])) {
        io.stderr(`invalid member designation '${memberAnswer.trim()}'`);
        return 1;
    }
    const members: RepoCandidate[] = memberSelection.map((i) => candidates[i - 1]);

    for (const repo of [hub, ...members]) {
        if (repo.remote === null) {
            io.stderr(`'${repo.name}' has no origin remote — every declared repo needs a remote identity`);
            return 1;
        }
    }

    io.stdout(`Hub:     ${hub.name}  (${hub.remote})`);
    for (const m of members) {
        io.stdout(`Member:  ${m.name}  (${m.remote})`);
    }
    const confirm: string = await io.ask("Write the workspace declaration and deploy components? (y/N): ");
    if (!confirm.trim().toLowerCase().startsWith("y")) {
        io.stdout("No changes made.");
        return 1;
    }

    const declaration: WorkspaceDeclaration = {
        hub: { name: hub.name, remote: hub.remote as string },
        members: members.map((m): RepoIdentity => ({ name: m.name, remote: m.remote as string })),
    };

    // Write manifest first: its validation (the resolver's own parser) is where every name and
    // remote-identity collision surfaces — on a diagnostic, nothing has been written yet.
    const backups: FileBackup[] = [backup(manifestPath(hub.root)), ...members.map((m) => backup(pointerPath(m.root)))];
    const manifestResult: WriteResult = writeManifest(hub.root, declaration);
    if (!manifestResult.ok) {
        io.stderr(manifestResult.error.message);
        return 1;
    }
    for (const m of members) {
        const pointerResult: WriteResult = writePointer(m.root, declaration.hub);
        if (!pointerResult.ok) {
            restore(backups);
            io.stderr(pointerResult.error.message);
            return 1;
        }
    }

    // Close the loop (epic invariant 1): the verb's own output must resolve cleanly and
    // identically from the hub and from every member, or it writes nothing.
    const fromHub: ResolveResult = resolveWorkspace(hub.root);
    const parityFailure = (detail: string): number => {
        restore(backups);
        io.stderr(`resolver parity check failed — declaration rolled back: ${detail}`);
        return 1;
    };
    if (!fromHub.ok) {
        return parityFailure(fromHub.error.message);
    }
    for (const m of members) {
        const fromMember: ResolveResult = resolveWorkspace(m.root);
        if (!fromMember.ok) {
            return parityFailure(fromMember.error.message);
        }
        if (JSON.stringify(fromMember) !== JSON.stringify(fromHub)) {
            return parityFailure(`resolution from '${m.name}' disagrees with resolution from the hub`);
        }
    }

    for (const repo of [hub, ...members]) {
        deps.deploy(repo.root);
    }

    io.stdout(
        `Workspace declared: hub '${hub.name}' + ${members.length} member(s); components deployed into every repo.`,
    );
    return 0;
}
