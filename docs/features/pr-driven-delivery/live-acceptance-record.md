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

> Append each run below, newest last. Paste the harness's `evidence` output (`libs/pr-acceptance/src/cli.ts evidence`) as the run's
> mechanical half, then fill in the prose sections by hand.

### Run template

```markdown
## Run <YYYY-MM-DD>

- **toolchain commit:** `<40-hex>`
- **scratch repo:** <owner>/nexus-pr-acceptance-scratch
- **operator:** <login>
- **teardown mode:** automatic | manual (`--manual-teardown`)
- **scratch repo deleted:** yes, by teardown | yes, by hand on <YYYY-MM-DD> | NO — still standing

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
| residue after teardown (local) | |
| scratch repo removed | |
| range refusal branch | NOT EXERCISED |
| review publishing | NOT EXERCISED |

### Observations

<the harness's `evidence` output, verbatim>

### Divergences from the injected-runner tests

<one row per divergence, or the single line "None — zero divergences observed.">

| # | What the unit tests assume | What live GitHub did | Filed as |
|---|---|---|---|

### Notes
```

---

## Run — not yet performed

No live run has been recorded yet.

> **Superseded in part.** The scratch-repo run described below never happened, and the epic was
> re-scoped on 2026-07-25 so that it no longer needs to. See
> [*Run 2026-07-25 — read-only, against this repo's own merge history*](#run-2026-07-25--read-only-against-this-repos-own-merge-history),
> which measures range derivation against real merged pull requests without provisioning anything.
> The text below is kept as-written: its account of why the scratch-repo path stalled is still
> accurate and is the reason the re-scope happened.

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
maintainer's credential reports `gist, read:org, repo, workflow`, and the maintainer has declined to
hold `delete_repo` on their account for this exercise.

The unblock is `--manual-teardown`: the run proceeds, and the maintainer deletes the scratch repo by
hand afterwards. That does **not** relax the delete guard — the name/owner/marker triple guard is
untouched, and there is still no override flag. What it relaxes is the precondition that the harness
itself must be the remover. The trade is stated in the runbook's *Manual cleanup* section: the
guarantee "nothing is created that cannot be cleaned up" becomes a commitment the operator makes on
the command line, bounded by the one-deterministic-name design, which caps a forgotten cleanup at a
single private repository rather than a growing pile.

A run taken in that mode is not a zero-residue run, and the record must say so — see *teardown mode*
in the run template.

A local git-only simulation of the three merge strategies must still **not** be substituted: the
decision record refutes it explicitly, because the PR metadata and post-branch-delete reachability
would be fabricated by the same beliefs under test, so a green result would prove nothing.

The harness, the runbook, and this record shipped with **STORY-132.01** (#133). The three exercise
stories — **STORY-132.02** (#134, analyze), **STORY-132.03** (#135, range across all three merge
strategies), and **STORY-132.04** (#136, close and distill) — fill in the slots above from an actual
run.

Performing that run needs a named remover for the scratch repository — either a credential carrying
the `delete_repo` scope (`gh auth refresh -h github.com -s delete_repo`), so teardown removes it, or
`--manual-teardown`, where the operator removes it by hand. The harness still refuses to create a
scratch repository with neither.

### Divergences already known before the first run

| # | What the unit tests assume | What is actually true | Filed as |
|---|---|---|---|
| D1 | Nothing — the packaging shape is not covered by the `libs/pr-worktree` specs at all. | A repo carrying only the **vendored** `.claude/` component tree cannot execute the flow: the commands invoke their helpers by repo-relative paths and those helpers resolve their libraries through workspace links. Provisioning has to seed the working toolchain tree and lend the clone a resolved dependency closure. | Recorded here; not repaired in epic #132 (its Out of Scope forbids it). To be sized separately. |

---

## Run 2026-07-25 — read-only, against this repo's own merge history

- **toolchain commit:** `70d494760dcfab713ba899c05ca6625242cfc296` (`libs/pr-worktree/src/range.ts`
  last changed at `4e73970ce075ef9c1477d2686c231058ab6e5495`, 2026-07-20; `libs/` clean at run time)
- **scratch repo:** none — measured against `sameera/nexus` itself
- **operator:** sameera
- **method:** read-only `git` and `gh` against already-merged pull requests. No repository was
  created, no branch pushed, no PR merged, no scope granted. Every fetched ref was deleted after use.

### Why this run exists in this shape

The scratch-repo exercise was blocked on granting `delete_repo` to the maintainer's credential, and
the value it would have bought turned out to be smaller than assumed: on a single account the
review-publishing path is unreachable anyway, and the close/distill chain runs for real on the next
epic regardless. What the epic actually existed to measure — whether range derivation picks the
right base against real GitHub — needs a real *merged* PR, not a *disposable* one. This repo has
twelve of them.

### Verdicts

| Stage | Verdict |
|---|---|
| range: rebase (multi-commit) | **PASS** — 6/6 |
| range: post-branch-delete head reachability | **PASS** — 4/4 with the branch actually deleted |
| range: authoritative-set verification loop | **PASS** — 6/6 |
| range: squash | NOT EXERCISED — no squash merge in this repo's history (see *Follow-up*) |
| range: merge commit | NOT EXERCISED — none in this repo's history (see *Follow-up*) |
| range: rebase (single-commit) | NOT EXERCISED — takes the unambiguous `commitCount <= 1` branch |
| analyze --pr (receipt published + read back) | NOT EXERCISED — descoped, see #134 |
| close --pr / distill chain | NOT EXERCISED — descoped, see #136 |
| range refusal branch | NOT EXERCISED — unreachable live, as previously documented |
| review publishing | NOT EXERCISED — unreachable on one account, as previously documented |

### Observations

Every merge in this repo's history is a **rebase merge**: the merge commit has one parent, the PR
carried more than one commit, and `mergeCommit~N` — not `mergeCommit^1` — reproduces the PR's file
set. That is the *ambiguous* branch at `libs/pr-worktree/src/range.ts:87`. It is not an edge case
here; it is the normal path for every multi-commit PR.

For each PR: `authoritative` = `git diff --name-only baseRefOid...pull/<N>/head`, queue paths
excluded — the same set `deriveRange` computes at `range.ts:99`. Candidates are the two the code
tries at `range.ts:109`.

| PR | commits | branch still on remote | `pull/<N>/head` fetch | files | `merge^1` | `merge~N` |
|---|---|---|---|---|---|---|
| #131 | 2 | yes | OK | 12 | differ | **MATCH** |
| #129 | 8 | yes | OK | 20 | differ | **MATCH** |
| #86 | 8 | **no** | OK | 20 | differ | **MATCH** |
| #79 | 6 | **no** | OK | 19 | differ | **MATCH** |
| #99 | 2 | **no** | OK | 15 | differ | **MATCH** |
| #73 | 3 | **no** | OK | 20 | differ | **MATCH** |

In all six, the selected base `mergeCommit~N` equalled the PR's `baseRefOid` exactly — the expected
identity for a rebase merge, and an independent confirmation that the right candidate was chosen:

| PR | `mergeCommit` | `mergeCommit~N` | `baseRefOid` |
|---|---|---|---|
| #131 | `d89c8c1a5818aae13cf3d553d8b46443ccb307ec` | `288906382ecb248dc469d5cb52af2868f97bd5fe` | `288906382ecb248dc469d5cb52af2868f97bd5fe` |
| #129 | `288906382ecb248dc469d5cb52af2868f97bd5fe` | `b19449990008f2a2843d3a62ec93d64dcc1d74f7` | `b19449990008f2a2843d3a62ec93d64dcc1d74f7` |
| #86 | `23082c5d36f301eac7c7aa5b2aff616ad9fba6ab` | `504bfaa2421f3ab28427196c75d588a6bb7faf00` | `504bfaa2421f3ab28427196c75d588a6bb7faf00` |
| #79 | `142dc6b0f8bd631b8f71dc44dbe25285413a57bf` | `ff410f32b5d89872ee2d8f8f951e74632d159db4` | `ff410f32b5d89872ee2d8f8f951e74632d159db4` |
| #99 | `8e624e89370d93bcad126a93519b10a84e7faf23` | `34aab759aaf29ba6e7163ff36b2edcbdbe0a75e5` | `34aab759aaf29ba6e7163ff36b2edcbdbe0a75e5` |
| #73 | `e70b9761da9d8da1a0f3814a89a2ce31de35a21f` | `b88edc2a50579e5dc3a2660a4de7bff2d50c1ced` | `b88edc2a50579e5dc3a2660a4de7bff2d50c1ced` |

What this establishes, that the injected-runner specs could not:

1. **`pull/<N>/head` survives branch deletion on real GitHub.** Four of the six PRs have no branch
   left on the remote; the fetch succeeded for all four. The verification path's precondition holds.
2. **The authoritative-set comparison selects correctly against real merges** — 6/6, with the wrong
   candidate rejected every time rather than tied.
3. **`mergeCommit^1` is wrong for every multi-commit PR in this repo.** The refuse-rather-than-guess
   design at `range.ts:87-128` is load-bearing, not defensive.

### Divergences from the injected-runner tests

None — zero divergences observed. The live behavior matched what the specs assume in every case
measured.

| # | What the unit tests assume | What live GitHub did | Filed as |
|---|---|---|---|
| — | — | — | — |

### Notes

**Not covered, and honestly so.** This run measures range derivation only. It says nothing about the
receipt publish-and-read-back loop, the close `--pr` merge gate, the shared distill worktree, or the
distillation PR. Those stages are exercised for real by the next epic that runs the flow end to end;
a failure there is loud and recoverable, unlike a silently-wrong range, which is why they were the
stories worth dropping and this was the story worth keeping.

**One check not performed.** The single production caller of `deriveRange`
(`.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts:127`) always passes `verifyAgainstPrHead`,
so there is no reachable path that stamps an unverified `mergeCommit^1`. That was read from the
source, not exercised live.

### Follow-up

Squash and merge-commit strategies remain unmeasured because this repo has never used them. Rotate
the merge button across the next three real PRs — one squash, one merge commit, one single-commit
rebase — and re-run the table above against each. That closes the remaining coverage at the cost of
three button clicks, with no scratch repo and no new credential scope.

---

## Run 2026-08-06 — read-only, single-commit rebase slot (#135)

- **toolchain commit:** `d8a32481d82e561d53480b463b0f87347ba17fa8` (`libs/pr-worktree/src/range.ts`
  unchanged since `4e73970ce075ef9c1477d2686c231058ab6e5495`, 2026-07-20; `libs/` clean at run time)
- **scratch repo:** none — measured against `sameera/nexus` itself
- **operator:** sameera
- **method:** same as Run 2026-07-25 — read-only `git` and `gh` against already-merged pull
  requests. No repository created, no branch pushed, no scope granted. Every fetched ref was
  deleted after use.

### What this run measures

The **single-commit rebase** slot from #135. A PR that lands as one commit takes the unambiguous
branch at `libs/pr-worktree/src/range.ts:84` (`parentCount >= 2 || pr.commitCount <= 1`), so the
derived base is `mergeCommit^1` with no verification loop. The claims to check live: that base
reproduces the PR's authoritative changed-file set, is an ancestor of the merge commit, and yields
a non-empty three-dot diff. Two qualifying PRs existed since the last run; both were measured.

### Merge-method evidence

Rebase and squash are indistinguishable by topology for a one-commit PR, so the method was
established from the merge commit itself: for both PRs the merge commit's **full message is
byte-identical** to the PR head commit's message (a squash merge would have appended ` (#N)` to
the title), the author is preserved, and the committer is the merger — the rebase-merge signature,
and consistent with every other merge in this repo's history.

### Verdicts

| Stage | Verdict |
|---|---|
| range: rebase (single-commit) | **PASS** — 2/2 |
| range: post-branch-delete head reachability (single-commit) | **PASS** — 1/1 (#191's branch is deleted) |
| range: squash-of-N | NOT EXERCISED — still no squash merge in this repo's history (see *Follow-up*) |
| range: merge commit | NOT EXERCISED — still none in this repo's history (see *Follow-up*) |

### Observations

For each PR: `authoritative` = `git diff --name-only baseRefOid...pull/<N>/head`, queue paths
excluded; candidate = `mergeCommit^1...mergeCommit`, same exclusion — the base the unambiguous
branch stamps.

| PR | commits | branch still on remote | `pull/<N>/head` fetch | files | `merge^1` vs authoritative |
|---|---|---|---|---|---|
| #236 | 1 | yes | OK | 13 | **MATCH** |
| #191 | 1 | **no** | OK | 7 | **MATCH** |

In both, the stamped base `mergeCommit^1` equalled the PR's `baseRefOid` exactly, is an ancestor of
the merge commit, and the three-dot diff is non-empty — every assertion the #135 acceptance
criterion names:

| PR | `mergeCommit` | `mergeCommit^1` | `baseRefOid` |
|---|---|---|---|
| #236 | `74c162838ed7271fddd9f183d5ebb116c37a5526` | `ca9e867369d97d42a5eb290214b10ad47fd91789` | `ca9e867369d97d42a5eb290214b10ad47fd91789` |
| #191 | `3735d95a7809a206da7a54f8a7fd7a26a643bb99` | `9a00be8a6eb3ccb9a8fa8b90a3886f363099959a` | `9a00be8a6eb3ccb9a8fa8b90a3886f363099959a` |

#191 also extends the post-branch-delete reachability evidence to the single-commit path: its head
branch (`distill/2026-08-01-epic-178`) is gone from the remote and `pull/191/head` still fetched.

### Divergences from the injected-runner tests

None — zero divergences observed.

| # | What the unit tests assume | What live GitHub did | Filed as |
|---|---|---|---|
| — | — | — | — |

### Follow-up

Squash-of-N and merge-commit remain the two open slots in #135. Every multi-commit PR merged since
the last run (#177, #217, #234 among them) was also rebase-merged — verified by parent-of-merge
message comparison, so none qualifies retroactively. Squash-merge the next **multi-commit** PR and
merge-commit-merge any PR after that, then re-run the table against each.
