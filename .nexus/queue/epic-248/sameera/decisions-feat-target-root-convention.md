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

## 2026-08-25 — Fixed Invariant 5 gap: gh subprocess cwd in the two Python scripts

- **Choice:** Both `create_gh_issues.py` and `nxs_gh_create_epic.py` gained a module-level
  `TARGET_CWD: str | None` global, set once in `main()` right after `project_root` is resolved,
  and every `subprocess.run` that shells out to `gh` (or, in the epic script, `git`) now passes
  `cwd=TARGET_CWD`. In `nxs_gh_create_epic.py`, the `--root`/`project_root` resolution block was
  also moved to run before `check_prerequisites()` (previously after), so the `gh auth status`/
  `git rev-parse --is-inside-work-tree` checks run against the resolved target root too.
- **Why:** The analyze receipt (epic #248, `.nexus/tmp/epic-248/analyze-receipt.md`) found
  Invariant 5 ("every remote-issuing subprocess runs with cwd = resolved target root")
  CONTRADICTED — `-R <repo>` is only added `if repo:`, so the common no-`issues-repo`-configured
  case silently fell back to `gh` inferring the repo from the ambient process cwd instead of
  `--root`. A module-level global (not a `cwd` parameter threaded through every call site) mirrors
  this file's own existing convention for other resolve-once values (`RETRIES`,
  `CLASSIFICATION_LABEL`) and avoids changing the shared `run(cmd) -> CompletedProcess` callback
  contract that `nxs-gh-shared/delivery_config.py`'s `ensure_label`/`lookup_issue_type_id`/
  `set_issue_type` already rely on — `delivery_config.py:read_hub_defaults` establishes the same
  "closure captures cwd, callback signature stays `(cmd)`" pattern.
- **Refuted alternative:** Threading an explicit `cwd` parameter through every helper function and
  the shared `delivery_config.py` callback signatures. Rejected as a much larger diff across a
  file this story isn't otherwise touching, for no behavioral difference.
