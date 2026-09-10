/**
 * Render the workspace status read-out.
 *
 * A read-only presentation over {@link resolveWorkspace}'s output — the epic's observable
 * surface and the verification vehicle for the declaration stories and the resolution contract.
 * It renders the resolver's result and derives nothing of its own, so what it shows is exactly
 * what resolution produced: it can never report a state the resolver disagrees with.
 *
 * Three cases, each plain terminal text (no ANSI, so it stays pipe- and CI-friendly):
 *   - a resolved workspace  → the hub, every declared member, and each member's checkout state;
 *   - single-repo mode      → "no workspace declared", stated as normal, never an error;
 *   - a resolution failure  → the structured diagnostic, naming the file, entry, and defect.
 *
 * One exception to "derives nothing of its own" (epic #215, story #510): a present member's
 * `.nexus/queue` can hold an entry the close-and-migrate path would once have moved into the hub.
 * Since that path is retired, {@link findStrandedQueueEntries} stats each present member's queue
 * directly, and its line survives after relocation — changing only to say the copy can be
 * deleted — until the member-side copy is actually gone, so an adopter who never runs the
 * relocation still gets a signal from the one command that already walks member checkouts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Diagnostic } from "./manifest.js";
import {
    type ResolveResult,
    type ResolvedWorkspace,
    type SingleRepoWorkspace,
} from "./resolve.js";

export interface StrandedQueueEntry {
    member: string;
    entry: string;
    /** Whether the hub's own queue already holds a same-named entry. */
    relocatedToHub: boolean;
}

/** Directory names (not dotfiles) directly under `<root>/.nexus/queue`. */
function listQueueEntries(root: string): string[] {
    const dir = path.join(root, ".nexus", "queue");
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort();
}

/** Every queue entry a present member still holds, read directly off disk. */
export function findStrandedQueueEntries(ws: ResolvedWorkspace): StrandedQueueEntry[] {
    const found: StrandedQueueEntry[] = [];
    for (const member of ws.members) {
        if (member.checkout !== "present") {
            continue;
        }
        for (const entry of listQueueEntries(member.expectedPath)) {
            found.push({
                member: member.name,
                entry,
                relocatedToHub: fs.existsSync(path.join(ws.hubRoot, ".nexus", "queue", entry)),
            });
        }
    }
    return found;
}

/** Two-space-indented line. */
function indent(line: string, depth = 1): string {
    return "  ".repeat(depth) + line;
}

/** Render a repo-relative docs root for display: "." reads as "repo root". */
function renderDocsRoot(docsRoot: string): string {
    return docsRoot === "." ? "repo root" : docsRoot;
}

function renderResolvedWorkspace(ws: ResolvedWorkspace): string {
    const lines: string[] = [];
    lines.push(`Workspace: ${ws.hub.name}`);
    lines.push(indent(`hub      ${ws.hub.name}  (${ws.hub.normalizedRemote})`));
    lines.push(indent(ws.hub.path, 2));
    lines.push(indent(`docs root: ${renderDocsRoot(ws.hub.docsRoot)}`, 2));

    if (ws.members.length === 0) {
        lines.push(indent("members: (none declared)"));
        return lines.join("\n");
    }

    const present = ws.members.filter((m) => m.checkout === "present").length;
    lines.push(indent(`members: ${ws.members.length} declared, ${present} checked out`));
    for (const m of ws.members) {
        const marker = m.checkout === "present" ? "[present]" : "[missing]";
        lines.push(indent(`${marker} ${m.name}  (${m.normalizedRemote})`, 2));
        const note = m.checkout === "missing" ? "  <- expected checkout not found" : "";
        lines.push(indent(`${m.expectedPath}${note}`, 3));
        lines.push(indent(`docs root: ${renderDocsRoot(m.docsRoot)}`, 3));
    }

    for (const s of findStrandedQueueEntries(ws)) {
        lines.push(
            s.relocatedToHub
                ? indent(
                      `stranded queue entry '${s.entry}' in ${s.member} has been relocated — delete the member-side copy`,
                  )
                : indent(
                      `stranded queue entry '${s.entry}' in ${s.member} is not yet relocated — run \`nexus queue-relocate\` from the hub`,
                  ),
        );
    }

    return lines.join("\n");
}

function renderSingleRepo(ws: SingleRepoWorkspace): string {
    return [
        "No workspace declared — single-repo mode.",
        indent(
            `${ws.root} has neither a hub manifest nor a hub pointer; Nexus commands operate on this repo alone.`,
        ),
        indent(`docs root: ${renderDocsRoot(ws.docsRoot)}`),
    ].join("\n");
}

function renderFailure(error: Diagnostic): string {
    const lines = [`Workspace resolution failed: ${error.problem}`];
    lines.push(indent(`file:  ${error.file}`));
    if (error.entry !== undefined) {
        lines.push(indent(`entry: ${error.entry}`));
    }
    lines.push(indent(error.message));
    return lines.join("\n");
}

/** Render a resolver result as terminal text. Pure: same result → same string. */
export function renderWorkspaceStatus(result: ResolveResult): string {
    if (!result.ok) {
        return renderFailure(result.error);
    }
    return result.workspace.mode === "workspace"
        ? renderResolvedWorkspace(result.workspace)
        : renderSingleRepo(result.workspace);
}
