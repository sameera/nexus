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
 */

import { type Diagnostic } from "./manifest.js";
import {
    type ResolveResult,
    type ResolvedWorkspace,
    type SingleRepoWorkspace,
} from "./resolve.js";

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
