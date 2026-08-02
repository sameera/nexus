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
