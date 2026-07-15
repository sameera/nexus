/**
 * Render close-migration output: the preflight read-out and a failed migration's
 * diagnostic. Read-only presentation over the preflight/migrate results — it derives
 * nothing of its own, so what it shows is exactly what those steps produced.
 */

import { type MigrationDiagnostic } from "./diagnostic.js";
import { type MigrateOutcome } from "./migrate.js";
import { type ClosePreflight } from "./preflight.js";

/** Two-space-indented line. */
function indent(line: string, depth = 1): string {
    return "  ".repeat(depth) + line;
}

export function renderPreflight(p: ClosePreflight): string {
    const repoLine = `${p.repo.identity}  (from ${p.repo.source})`;
    if (p.role === "member" && p.hub) {
        const lines = [
            "Close preflight: member mode — migration armed.",
            indent(`repo    ${repoLine}`),
            indent(`hub     ${p.hub.name}  (${p.hub.normalizedRemote})`),
            indent(`root:   ${p.hub.root}`, 2),
            indent(`branch: ${p.hub.branch}`, 2),
        ];
        return lines.join("\n");
    }
    if (p.role === "hub") {
        return [
            "Close preflight: hub mode — the entry stays in this repo (the hub drains its own queue).",
            indent(`repo  ${repoLine}`),
        ].join("\n");
    }
    return [
        "Close preflight: single-repo mode — the entry stays in this repo.",
        indent(`repo  ${repoLine}`),
    ].join("\n");
}

export function renderMigrationFailure(e: MigrationDiagnostic): string {
    const lines = [`Close migration failed: ${e.problem}`];
    lines.push(indent(`file:  ${e.file}`));
    if (e.entry !== undefined) {
        lines.push(indent(`entry: ${e.entry}`));
    }
    lines.push(indent(e.message));
    return lines.join("\n");
}

export function renderMigrateOutcome(o: MigrateOutcome): string {
    const lines = [`Migrated queue entry: ${o.entryName}`];
    if (o.alreadyMigrated) {
        lines.push(indent("hub already held this entry — verified identical; no new hub commit"));
    }
    lines.push(indent(`hub commit     ${o.hubCommit}  on '${o.hubBranch}'  at ${o.hubRoot}`));
    lines.push(
        indent(
            o.removalCommit
                ? `removed        commit ${o.removalCommit}`
                : "removed        nothing to commit — the entry held no tracked files",
        ),
    );
    lines.push("");
    lines.push("Push the hub commit — closure is not durable until it is pushed:");
    lines.push(indent(`git -C ${o.hubRoot} push`));
    return lines.join("\n");
}
