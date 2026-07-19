#!/usr/bin/env tsx
/**
 * Print the resolved repo-relative docs root — the single-value view over the workspace resolver
 * ({@link localDocsRoot}). The in-repo vehicle of the docs-root read-out: planning commands run it
 * to learn where this checkout keeps its human docs, then prefix that value onto the unchanged
 * taxonomy suffixes (`features/`, `product/`, `system/`, `delivery/`). It derives nothing of its
 * own — it reads the same field the status read-out prints — so what it prints is exactly the
 * resolution contract's answer. Read-only by construction: the resolver never clones, fetches, or
 * writes.
 *
 * Usage:
 *     tsx docs_root.ts [dir]
 *
 *     dir  the checkout to resolve from (default: the current working directory)
 *
 * Output:
 *     stdout — the repo-relative docs root on one line: "docs" for a single-repo checkout or a
 *              workspace member, "." for a hub whose docs root is the repo root, or the hub's
 *              configured docs-root override.
 *     stderr — on a resolution failure, the resolver's named diagnostic (never a silent "docs").
 *
 * Exit codes:
 *     0 - resolved (the docs root was printed)
 *     1 - resolution failed (a named diagnostic was printed; the caller must stop, not fall back)
 */

import { localDocsRoot } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";

function main(): void {
    const startDir = process.argv[2] ?? process.cwd();
    const result = localDocsRoot(startDir);
    if (!result.ok) {
        process.stderr.write(renderWorkspaceStatus(result) + "\n");
        process.exit(1);
    }
    process.stdout.write(result.docsRoot + "\n");
    process.exit(0);
}

main();
