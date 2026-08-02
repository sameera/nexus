## 2026-08-01 — The label preflight is a shared batch helper, not a filer-local one

- **Choice:** `ensure_labels` lives in `nxs-gh-shared/delivery_config.py` beside `ensure_label` and `label_exists`, taking `run` as a parameter like its neighbours.
- **Why:** the single-source-of-truth guard test forbids the scripts redefining a `gh` label helper, and stories #187/#189 file stubs through the same preflight.
- **Refuted alternative:** a private helper in `create_gh_issues.py` closing over `_run_plain` — shorter, but it duplicates the upsert path the guard exists to prevent.

## 2026-08-01 — An unresolvable label query fails the batch closed

- **Choice:** `ensure_labels` treats `label_exists` returning `None` (the query itself failed) the same as `False` — the label is reported missing and nothing is created.
- **Why:** Invariant 19 optimises against a half-filed batch; a run that creates nothing is recoverable by re-running, a partially-filed one is not.
- **Refuted alternative:** proceed on `None` and let creation fail per-issue — keeps transient failures non-blocking, but strands exactly the state the invariant names.

## 2026-08-01 — Per-label creation styles, so an upsert cannot recolour an existing label

- **Choice:** `ensure_labels` takes a `styles` map; the resolved story label keeps its established `BFD4F2`, everything else takes `ensure_label`'s default grey.
- **Why:** the preflight now upserts frontmatter-declared labels too (`pipeline`, area labels), and `ensure_label` uses `--force` — a single uniform colour would repaint pre-existing labels on every run.
- **Refuted alternative:** read each label's current colour back from `gh label list --json name,color` and pass it through — fully non-destructive, but more machinery than the story's "the only new call is the shared `ensure_label`" note supports.

## 2026-08-01 — Invariant 6 is enforced in the filer, not promised in the command doc

- **Choice:** `create_gh_issues.py` refuses, in its preflight, any work-item that carries the unplanned label *and* a `parent:` — the whole batch stops with nothing created.
- **Why:** a deferred-scope stub filed beneath the epic being closed deadlocks `/nxs.close`'s all-sub-issues-closed gate, and the gate deliberately has no exemptions; a doc instruction is not a guarantee.
- **Refuted alternative:** silently drop the `parent:` key for stub work-items — never deadlocks, but hides a writer bug instead of naming it.

## 2026-08-01 — Deferred-scope filing is Phase 7.4, its own phase ahead of 7.5/7.6/8

- **Choice:** a new phase between the checkpoint and the member-mode migration, rather than folding the filing into Phase 8's GitHub writes.
- **Why:** the close record must name the filed numbers, and `--pr` mode commits the record in Phase 7.6 — before Phase 8 runs; only a pre-7.5 position satisfies both.
- **Refuted alternative:** file in Phase 8.0 and amend the record afterwards — one fewer phase, but re-introduces amending an already-pushed artifact.

## 2026-08-01 — The backlog query is a resolver subcommand with three named forms

- **Choice:** `delivery_config.py backlog-query --form list|search|exclude` — the CLI listing, the issue-search fragment a link carries, and the negation an epic query wears.
- **Why:** the query is named in two stage reports and two documents; a subcommand keeps the label resolved in one place (invariant 18) and makes "one query / one negated filter" assertable.
- **Refuted alternative:** let each stage compose `--label $(… resolve unplanned-label)` inline — no new surface, but the negation form has no home and the three spellings drift.

## 2026-08-01 — The features index is created, not the per-feature READMEs repointed

- **Choice:** the backlog link lands once in a new `docs/features/README.md`; feature nav indexes gain no backlog section, and `/nxs.epic` Phase 6 gains a step that adds a new feature's row.
- **Why:** the record's surfacing decision — with the feature held in the issue body, a per-feature view is a text search over bodies; the index is also the inventory the `nxs-pm`/`nxs-architect` agents already read.
- **Refuted alternative:** a backlog section in each feature README linking a body-text search — preserves the per-feature navigation path, but is brittle and is ten links that all mean the same thing.

## 2026-08-01 — A declared label is unquoted before the query quotes it

- **Choice:** `_query_token` peels one pair of surrounding quotes off the resolved label, then re-quotes only when the label carries whitespace.
- **Why:** the simple YAML reader keeps quotes verbatim, so `unplanned-label: "not planned"` would otherwise emit `label:""not planned""` — a filter GitHub matches nothing against.
- **Refuted alternative:** strip quotes in `_parse_simple_yaml` — the right long-term home, but it changes what every existing key resolves to, well outside this story.

## 2026-08-01 — Only `#<n>` is a literal dependency reference; a bare number stays a batch ref

- **Choice:** `resolve_literal_ref` matches `^#\d+$` only, and resolves it against the platform; a bare `54` is looked up in the batch map and reported unresolved if absent.
- **Why:** batch refs are author-chosen strings, so a bare number is indistinguishable from one — the sigil is what states the intent, and an ambiguous form would wire an edge onto whatever issue happened to have that number.
- **Refuted alternative:** accept a bare number when it is not in the batch map — friendlier for the migration, but silently turns a typo'd ref into an edge onto an unrelated issue.

## 2026-08-01 — The 24 proposed blocks migrate as authored; the frozen decision archive is not repointed

- **Choice:** every `proposed` block became an issue (24, not the 22 the epic estimated — two were appended after planning); the `libs/origin/v2/.nexus/decisions/` logs still name `backlog.md` and were left alone.
- **Why:** those numbered logs record decisions as they were made and are superseded by record #192 — rewriting them to match a later decision destroys the audit trail the project keeps them for.
- **Refuted alternative:** sweep the archive too, satisfying the reference AC literally — but the deleted file is exactly what those decisions decided to create.

## 2026-08-01 — The `--pr` acceptance harness seeds no backlog file

- **Choice:** `scratchFeatureDocs` writes only the feature nav index into the provisioned throwaway repo.
- **Why:** the harness verifies the live toolchain; seeding a retired artifact would rehearse a shape no writer produces any more.
- **Refuted alternative:** leave the seed as inert scenery — harmless today, but the next reader takes it as evidence the file format is still live.
