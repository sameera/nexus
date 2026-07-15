#!/usr/bin/env tsx
/**
 * Close-migration helper for /nxs.close — the deterministic cross-repo tail.
 *
 * Two subcommands over the tested library (@nexus/close-migration):
 *
 *   preflight [dir]      Read-only. Resolve the close role (single-repo | hub | member)
 *                        from the committed workspace artifacts, derive the repo identity
 *                        for the range stamp, and in member mode name the hub root and
 *                        branch. Runs in every mode; exit 1 blocks a member close whose
 *                        hub is unreachable BEFORE anything irreversible happens.
 *
 *   migrate <entry-dir>  Mutating, gated. Copy the full working-tree queue entry into the
 *                        hub's queue, commit it there (path-scoped), VERIFY the commit,
 *                        then — only on that confirmation — remove the entry from the code
 *                        repo and commit the deletion on the current branch. Refuses unless
 *                        the role is member. Idempotent re-run: an entry already verified
 *                        in the hub proceeds straight to removal.
 *
 * Exit codes: 0 success · 1 a named diagnostic was printed · 2 usage error.
 */

import { migrateEntry } from "@nexus/close-migration/migrate";
import { closePreflight } from "@nexus/close-migration/preflight";
import {
    renderMigrateOutcome,
    renderMigrationFailure,
    renderPreflight,
} from "@nexus/close-migration/render";

function main(): void {
    const [subcommand, arg] = process.argv.slice(2);

    if (subcommand === "preflight") {
        const result = closePreflight(arg ?? process.cwd());
        if (!result.ok) {
            process.stdout.write(renderMigrationFailure(result.error) + "\n");
            process.exit(1);
        }
        process.stdout.write(renderPreflight(result.preflight) + "\n");
        process.exit(0);
    }

    if (subcommand === "migrate") {
        if (!arg) {
            process.stderr.write("usage: close_migration.ts migrate <entry-dir>\n");
            process.exit(2);
        }
        const result = migrateEntry(arg);
        if (!result.ok) {
            process.stdout.write(renderMigrationFailure(result.error) + "\n");
            process.exit(1);
        }
        process.stdout.write(renderMigrateOutcome(result.outcome) + "\n");
        process.exit(0);
    }

    process.stderr.write("usage: close_migration.ts <preflight [dir] | migrate <entry-dir>>\n");
    process.exit(2);
}

main();
