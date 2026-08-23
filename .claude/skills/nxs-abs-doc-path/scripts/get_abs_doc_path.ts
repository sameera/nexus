#!/usr/bin/env tsx
/**
 * Convert a repository-relative path to an absolute GitHub URL.
 *
 * Thin CLI shim over `@nexus/abs-doc-path` (decision record #277: this capability's settings
 * reading, repo-root walk, path normalisation, and URL-agreement check live in the library; this
 * file only parses argv and renders the result).
 *
 * Usage:
 *     tsx get_abs_doc_path.ts <relative-path>
 *     tsx get_abs_doc_path.ts <relative-path1> <relative-path2> ...
 *
 * Examples:
 *     tsx get_abs_doc_path.ts docs/features/tagging/README.md
 *     tsx get_abs_doc_path.ts "docs/features/tagging/README.md" "docs/system/delivery/task-labels.md"
 *
 * Output:
 *     The absolute URL(s), one per line
 *     e.g., https://github.com/user/repo/blob/main/docs/features/tagging/README.md
 *
 * Exit codes:
 *     0 - Success
 *     1 - Workspace resolution failed, or the cross-ref URL disagrees with the resolved docs root
 *     3 - Invalid arguments
 */

import { resolveAbsDocPath } from "@nexus/abs-doc-path/resolve";

function main(): void {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        process.stderr.write("Usage: tsx get_abs_doc_path.ts <relative-path>\n");
        process.stderr.write("       tsx get_abs_doc_path.ts <path1> <path2> ...\n");
        process.exit(3);
    }

    const result = resolveAbsDocPath(process.cwd(), args);
    if (!result.ok) {
        process.stderr.write(result.message + "\n");
        process.exit(1);
    }

    for (const url of result.urls) {
        process.stdout.write(url + "\n");
    }
}

main();
