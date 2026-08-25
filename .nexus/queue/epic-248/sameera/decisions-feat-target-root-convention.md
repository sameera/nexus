## 2026-08-25 — Canonical flag name for the target-root convention

- **Choice:** `--root` (`TARGET_ROOT_FLAG` in `libs/workspace/src/target-root.ts`), matching
  `delivery_config.py`'s existing `--root` flag.
- **Why:** The decision record leaves the literal spelling to implementation, only requiring one
  named flag (not a leading positional) shared by TS and matching the shape Python already uses.
  `--root` requires renaming `epic_resolve.ts`'s existing `--dir` (an already-shipped root-like
  flag; no compatibility alias per the record) but needs no rename to `delivery_config.py`.
- **Refuted alternative:** `--target`, matching `deploy`'s existing flag. Not chosen for this
  story since `deploy`/`workspace init` are outside AC44's enumerated capability list and the
  decision record's "folded into this same flag" language reads as deploy's concept merging into
  the new convention, not necessarily its spelling winning; renaming `deploy --target` was left
  out of scope (see below) rather than force a premature choice.

## 2026-08-25 — Story #280 scope bounded to AC44's enumerated capabilities + the record's two additions

- **Choice:** Implemented the shared `takeTargetRoot` helper and migrated exactly: `docs_root.ts`,
  `workspace_status.ts`, `epic_resolve.ts` (+ its `nexus-cli.ts` twin), `generate-atlas.ts` (+ its
  `nexus-cli.ts` twin and the `workspace status`/`workspace docs-root` verbs), and the two
  GitHub issue-creation scripts (`nxs_gh_create_epic.py`, `create_gh_issues.py`) the decision
  record explicitly adds to this story's scope (explicit `--root` outranks the artifact's own
  location; an artifact resolving outside the root is rejected). `delivery_config.py`'s CLI
  already delegated to `_find_config_root` via its existing `--root` flag — confirmed compliant,
  no change needed.
- **Why:** AC46 ("zero call sites remain on any of the six prior conventions") reads repo-wide,
  but AC44 bullet 2 enumerates a specific, bounded capability list for *this* story, and the
  decision record adds exactly two more. Sweeping every remaining repo-bound entry point (e.g.
  `record_digest.ts`'s `--dir`, `close_migration.ts`'s positional dir, `deploy`/`workspace init`'s
  `--target`/`--payload`, `drift-advisory.ts`/`validate-concepts.ts`/`seed-registry.ts`/
  `derive-entry-diff.ts` implicit `process.cwd()` use) is real remaining work toward AC46 but was
  not pursued here to keep this story's diff reviewable and within its own AC44 list.
- **Refuted alternative:** A full repo-wide sweep in this one story. Rejected as disproportionate
  scope creep for a single story in a 3-story epic; deferred rather than silently dropped.
