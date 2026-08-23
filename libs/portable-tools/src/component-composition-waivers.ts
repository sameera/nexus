/**
 * The waiver register for the payload-composition check (decision record #277). A component file
 * listed here is a known, counted, expiring exception to "no vendored component file may import a
 * workspace package" — every one of these is a legacy skill script that gained a `nexus` verb
 * form in epic #247's stories #272-#274 but keeps its `.claude/skills` script form too,
 * because deleting it is out of scope until the invocation rewrite (#250) repoints the component
 * bodies that still name a script path. This register only ever shrinks: reaching empty is #250's
 * completion condition (decision record, Invariant 12 / Constraint list item).
 */
export const COMPONENT_COMPOSITION_WAIVERS: readonly string[] = [
    "skills/nxs-abs-doc-path/scripts/get_abs_doc_path.ts",
    "skills/nxs-close-migration/scripts/close_migration.ts",
    "skills/nxs-epic-resolve/scripts/epic_resolve.ts",
    "skills/nxs-pr-worktree/scripts/pr_worktree.ts",
    "skills/nxs-record-digest/scripts/record_digest.ts",
    "skills/nxs-workspace-status/scripts/docs_root.ts",
    "skills/nxs-workspace-status/scripts/workspace_status.ts",
];
