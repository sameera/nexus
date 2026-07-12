#!/usr/bin/env tsx
/**
 * Print the workspace status read-out.
 *
 * A read-only view over the shared workspace resolver ({@link resolveWorkspace}). It renders
 * the resolved workspace — the hub, every declared member, and each member's checkout state —
 * or, when the checkout declares no workspace, states single-repo mode (not an error). Because
 * it derives nothing of its own and only renders what the resolver produced, it is the
 * verification vehicle for the declaration and resolution stories: what it shows is exactly the
 * resolution contract's answer.
 *
 * It never clones, fetches, or writes; it reports missing state, it does not repair it.
 *
 * Usage:
 *     tsx workspace_status.ts [dir]
 *
 *     dir  the checkout to resolve from (default: the current working directory)
 *
 * Exit codes:
 *     0 - resolved (a workspace, possibly with missing member checkouts, or single-repo mode)
 *     1 - resolution failed (a named diagnostic was printed)
 */

import { resolveWorkspace } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";

function main(): void {
    const startDir = process.argv[2] ?? process.cwd();
    const result = resolveWorkspace(startDir);
    process.stdout.write(renderWorkspaceStatus(result) + "\n");
    process.exit(result.ok ? 0 : 1);
}

main();
