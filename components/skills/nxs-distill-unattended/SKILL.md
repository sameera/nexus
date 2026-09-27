---
name: nxs-distill-unattended
description: The unattended-run contract of /nxs.distill. Read it only when `--unattended` was passed.
---

# nxs-distill-unattended

`/nxs.distill --unattended` says, once, on the command line, that nobody is here to answer this
run's questions — an explicit answer given in advance, never inferred from a non-interactive
session (decision record #818, D1). The close-and-distill command (`utils/close-epic.sh`, story
#817) always passes this flag when it starts distill; a lead invoking `/nxs.distill` directly
chooses whether to pass it. Without the flag, every phase runs exactly as the base stage states it,
whoever is or is not watching — this contract is read only when the flag is present.

Every rule below is keyed to the base stage's own phase numbering and overrides the base stage at
that number (or, for Phase 6.1, the `nxs-distill-taxonomy` contract's own numbering, when that
contract is also loaded). The base stage's phase order and numbering are unchanged, and a phase
this file does not name runs exactly as the base stage or its other loaded contracts state it.

## The blocking-condition table

**Every point where an ordinary run calls `AskUserQuestion` is, under this flag, a blocking
condition instead — never answered, never defaulted, never waived** (D2, G2):

| Question point | Phase | Under `--unattended` |
|---|---|---|
| Not-merged waiver | 0.4 | Every not-merged entry is excluded from this run — never processed, never waived. Remaining entries still drain. |
| Provenance-repository question | 0.6 | The affected entry is excluded from this run. Remaining entries still drain. |
| Hub provenance question (`nxs-distill-hub` Phase 0.6) | 0.6 | Same: the affected entry is excluded. |
| Taxonomy forced-fit gate (`nxs-distill-taxonomy` Phase 6.1) | resolved here, right after Phase 3, before Phase 4 cuts a branch | Any forced-fit delta, in any entry, stops the whole run before a branch is ever cut or a commit made. |

Each of the first three excludes one **entry**, treated like a `derive-entry-diff` blocked entry
(Phase 1): reported by name and reason, queue files untouched, the rest still drain. The taxonomy
row stops the **whole run**, because a forced-fit concept is not attributable to a single entry
once cross-entry `touches` exist.

The base stage's existing run-level stops are blocking conditions too, unchanged in when they
fire: a dirty tree, missing GitHub authentication, nothing left to drain (also what the exclusions
above can produce), a toolkit too old to derive the diff, and a blocking validator finding (Phase
5.5) this stage cannot resolve by fixing the page — the one condition that can fire after Phase 4
has already committed an entry, so it alone needs the branch unwind below. A per-entry error such
as a record-hash mismatch (Phase 0.1) keeps its existing per-entry treatment.

## Phase 0.4 — the not-merged waiver

Skip the `AskUserQuestion` ask. Every not-merged entry is excluded (recorded in `excluded`); the
remaining entries still drain.

## Phase 0.6 — the provenance-repository question (base stage and hub contract alike)

Skip the ask, whichever contract poses it. Exclude the affected entry (recorded in `excluded`) and
keep draining the rest.

## Phase 3.1 — unattended taxonomy precheck (new; runs between Phase 3 and Phase 4)

**Skip this precheck when Phase 2 found no domain registry** (`nxs-distill-taxonomy` was never
loaded, so no delta carries a domain-fit classification).

Once every entry's deltas are drafted (Phase 3), before Phase 4 does anything — no branch, no
commit — collect every `create` delta, across every entry, that contract classified as a forced
fit. Any such delta stops the whole run right here (D2, G2, G7): record it in `excluded` as a
run-level blocking condition naming every forced-fit concept, and go straight to the stop report
below. Nothing this run has done up to this point ever touched git, so there is nothing to unwind.

Zero forced-fit deltas → continue to Phase 4 exactly as an attended run would; the taxonomy
contract's own Phase 6.1 gate later finds nothing to ask, and reports so — it never fires under
this flag, because every `create` delta already resolved clear by the time Phase 4 would reach it.

## Phase 4 step 1 — recording the unwind point

Before creating or reusing any distill branch, record `START_REF` (the current branch or detached
HEAD SHA) and `START_HEAD` (`git rev-parse HEAD`). The Phase 5 unwind below resets to these if a
later entry blocks.

## Phase 5 step 5 — the validator's unattended outcome

A blocking finding this stage cannot resolve by fixing the page is a blocking condition (D2, G2,
G6), never left half-fixed. Earlier entries this run's loop already committed must be undone first
(G7):

- **`START_REF` was the trunk** (this run cut its own branch) → `git checkout "$START_REF"` then
  `git branch -D` the distill branch. Every commit this run made is gone with it.
- **`START_REF` was already a `distill/*` branch** (the branch pre-existed this run) → stay on it
  and `git reset --hard "$START_HEAD"`. Whatever commits were already on the branch at
  `START_HEAD` survive; only this run's own entry commits, made after it, are undone.

Then go to the stop report below. Nothing is pushed either way.

## Phase 6 — the checkpoint is skipped

The flag is the lead's own approval, given in advance, to open the pull request once drafting
finishes with no blocking condition (D1, G1). Phase 6.3's run summary is still written in full —
the pull request description below reads it — only the `AskUserQuestion` stop itself is skipped.

## Phase 7 — the pull request description carries every field

**Every field the Phase 6.3 run-summary table defines is rendered in the pull request description,
under the same omission and zero-case rules that table states** (D3, G8) — a reviewer of this
checkpoint-skipped run sees exactly what the checkpoint would have shown, including the `skipped`,
`blocked` and `waived` fields (the last of which is always empty here, since a not-merged entry is
excluded rather than waived under this flag).

As the first line of the body, state: this run opened without a checkpoint (`--unattended`); this
review is its only approval (G9).

Add one more section the base stage's template does not have:

```markdown
## Excluded (`--unattended` only)
<per entry: local id, the question point that would have asked; `none` when every entry resolved
without a question>
```

## Phase 8 — the stop report

**On any blocking condition**, report this shape instead of the base stage's ordinary one, and
stop — never open a pull request:

```
DISTILLATION STOPPED (unattended): <n> blocking condition(s).

  <condition> — <what clears it>
  ...

No pull request was opened. Nothing was pushed. <branch reset to <ref> | no branch was cut>
```

List every blocking condition found this run, not only the first. "What clears it" is "re-run
without `--unattended` and answer interactively" for a question-type condition or an unresolved
validator finding, and the base stage's own named remedy for a run-level stop (dirty tree, missing
authentication, a toolkit too old, nothing left to drain).

**On no blocking condition**, the base stage's ordinary completion report runs unchanged, plus two
lines this contract adds — a not-merged-waiver line (always empty here) and an excluded-entries
line (`none` when every entry resolved without a question).
