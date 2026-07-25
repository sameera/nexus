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

### Partial evidence: the harness's `gh` reader, validated read-only

Observed **2026-07-25** against toolchain commit `17b316c674ec571c19232f4f64d3769141b492a1`.

This is **not** a run of the flow. It is the one thing that could be checked against real GitHub
without provisioning anything: whether the harness's `gh`-output readers parse live output the way
their specs assume. Three read-only calls against existing `sameera/nexus` pull requests — no
mutation of any kind.

| Reader | PR | Observed | Verdict |
|---|---|---|---|
| `prEndpoints` | #131 (merged) | `state=MERGED`, `merged=true`, `commits=2`, `base=28890638…`, `head=29177241…`, `mergeCommit=d89c8c1a…` | PASS |
| `prEndpoints` | #138 (open) | `state=OPEN`, `merged=false`, `commits=1`, `mergeCommit=null` | PASS |
| `prChangedFiles` | #131 | 12 paths, queue entries excluded | PASS |
| `verifyReceipt` | #131, #138 | `found=false` on PRs carrying no analyze receipt — reported, not errored | PASS |

What this does **not** establish: anything about merge topology, range derivation, post-branch-delete
reachability, the receipt publish-and-read-back loop, or the close/distill chain. Those are exactly
what stories #134–#136 exist to measure, and they need a real hosted PR the harness controls.

### Why the run has not happened

The harness refuses to create a scratch repository unless the credential reports `delete_repo` —
teardown must be able to remove what provision creates, or the exercise leaks a repository. The
maintainer's credential currently reports `gist, read:org, repo, workflow`. Granting the scope is an
interactive browser flow:

```bash
gh auth refresh -h github.com -s delete_repo
```

That guard is deliberate and is not to be relaxed to unblock a run. Equally, a local git-only
simulation of the three merge strategies must **not** be substituted: the decision record refutes it
explicitly, because the PR metadata and post-branch-delete reachability would be fabricated by the
same beliefs under test, so a green result would prove nothing.

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
