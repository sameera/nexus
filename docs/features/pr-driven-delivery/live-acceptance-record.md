---
feature: "PR-Driven Delivery"
epic: "#132"
---

# Acceptance Record: Live Dry-Run of the PR Post-Merge Flow

What real GitHub did, on a given date, at a given toolchain commit — for the
`analyze --pr → merge → close --pr → distill` chain and the merge-strategy-safe range derivation.

This record is **evidence, not narrative**. Every entry carries the toolchain commit it was produced
against and the date it was observed; an entry missing either is not evidence and does not count.
Re-running the runbook **appends a new dated run** — never overwrite an earlier one, because the
comparison between runs is what makes a re-run worth doing.

Produced by [`live-acceptance-runbook.md`](live-acceptance-runbook.md). Fixing anything a run
surfaces is out of scope: divergences are filed and sized separately.

## How to read a run

- **Verdict per stage and per merge strategy.** `PASS`, `FAIL`, or `NOT EXERCISED`.
- **A `NOT EXERCISED` entry is not a gap in the record.** Two branches cannot be provoked on a real
  single-account hosted PR (see *Documented limitations*); they are named with the reason, and the
  run is still signed as a pass.
- **Divergences** are the point. Where live behavior contradicts an injected-runner unit test, the
  **live** behavior is authoritative and the test is what is recorded as suspect. Each divergence
  links to a filed issue or backlog stub.
- **Zero divergences is a pass**, recorded explicitly as zero — not as an empty section.

---

## Documented limitations

Branches that cannot be reached against a real single-account hosted pull request. Contriving either
would test a fabricated condition rather than a real one — the same reasoning that put
fork-originated heads out of scope.

| Branch | Why it cannot be provoked live |
|---|---|
| Range derivation's refusal branch (`range-ambiguous` / `range-unrecognized`) | GitHub retains the pull-request head reference (`pull/<N>/head`) after the branch is deleted, so the helper's verification essentially always succeeds. Reaching the refusal needs a denied fetch, which would be fabricated. |
| Analyze publishing its result as a **PR review** | GitHub forbids approving your own pull request, and the maintainer authors everything on a single-account scratch repo, so analyze always takes its documented comment fallback. The close-side reader consults both reviews and comments, so the publish-and-read-back loop is still fully covered. Proving the review path needs a second account. |

---

## Runs

> Append each run below, newest last. Paste the `pr_acceptance.ts evidence` output as the run's
> mechanical half, then fill in the prose sections by hand.

### Run template

```markdown
## Run <YYYY-MM-DD>

- **toolchain commit:** `<40-hex>`
- **scratch repo:** <owner>/nexus-pr-acceptance-scratch
- **operator:** <login>

### Verdicts

| Stage | Verdict |
|---|---|
| provision | |
| analyze --pr (receipt published + read back) | |
| analyze --pr (staleness detectable) | |
| range: squash | |
| range: merge commit | |
| range: rebase (single-commit) | |
| close --pr (merge-required gate refuses) | |
| close --pr (distill branch + close record pushed) | |
| distill (distillation PR + queue drain) | |
| residue after teardown | |
| range refusal branch | NOT EXERCISED |
| review publishing | NOT EXERCISED |

### Observations

<the `pr_acceptance.ts evidence` output, verbatim>

### Divergences from the injected-runner tests

<one row per divergence, or the single line "None — zero divergences observed.">

| # | What the unit tests assume | What live GitHub did | Filed as |
|---|---|---|---|

### Notes
```

---

## Run — not yet performed

No live run has been recorded yet.

The harness, the runbook, and this record shipped with **STORY-132.01** (#133). The three exercise
stories — **STORY-132.02** (#134, analyze), **STORY-132.03** (#135, range across all three merge
strategies), and **STORY-132.04** (#136, close and distill) — fill in the slots above from an actual
run.

Performing that run requires a credential carrying the `delete_repo` scope
(`gh auth refresh -h github.com -s delete_repo`), because the harness refuses to create a scratch
repository it could not later delete.

### Divergences already known before the first run

| # | What the unit tests assume | What is actually true | Filed as |
|---|---|---|---|
| D1 | Nothing — the packaging shape is not covered by the `libs/pr-worktree` specs at all. | A repo carrying only the **vendored** `.claude/` component tree cannot execute the flow: the commands invoke their helpers by repo-relative paths and those helpers resolve their libraries through workspace links. Provisioning has to seed the working toolchain tree and lend the clone a resolved dependency closure. | Recorded here; not repaired in epic #132 (its Out of Scope forbids it). To be sized separately. |
