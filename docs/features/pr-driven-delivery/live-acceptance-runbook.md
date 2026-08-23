---
feature: "PR-Driven Delivery"
epic: "#132"
---

# Runbook: Live Acceptance Dry-Run of the PR Post-Merge Flow

The `--pr` post-merge flow decides which diff the distiller reads weeks after a PR is forgotten. Its
riskiest mechanics live in `libs/pr-worktree` and are covered by unit tests that inject a fake
command runner — they prove the logic *given the `git` and `gh` output we believe real GitHub
produces*. This runbook buys the evidence that the belief holds, against a real hosted pull request,
and leaves a dated, commit-pinned record in
[`live-acceptance-record.md`](live-acceptance-record.md).

**It does not fix what it finds.** A divergence between live behavior and an injected-runner test is
recorded and filed; each fix is sized and scheduled separately.

This is a **maintainer-invoked, on-demand** exercise. There is no CI to run it in.

> **No longer the required path (2026-07-25).** Range derivation — the mechanic worth the evidence —
> is now measured **read-only against this repo's own merged pull requests**, with no scratch repo,
> no `delete_repo` scope, and no mutation. See the *How to run it* section of
> [#135](https://github.com/sameera/nexus/issues/135) for the six-command version, and the
> [record](live-acceptance-record.md) for what it found.
>
> This runbook is retained as the **controlled reproduction**: reach for it when a real PR misbehaves
> and you need to provoke the failure somewhere disposable. The stories that made a full scratch-repo
> run a gate — [#134](https://github.com/sameera/nexus/issues/134) and
> [#136](https://github.com/sameera/nexus/issues/136) — were closed as not worth the credential scope.

---

## Before you start

**Time:** about 25 minutes end to end. The provision → seed → teardown cycle alone is under 15.

**You need:**

1. `gh` authenticated as the owner the scratch repo will live under.
2. The `delete_repo` scope. The harness refuses to create anything without it:

    ```bash
    gh auth refresh -h github.com -s delete_repo
    ```

3. A resolved dependency closure in this checkout (`pnpm install`). The clone borrows it — see
   *Known divergence: packaging* below.

**What this creates:** exactly one private repository, `<your-login>/nexus-pr-acceptance-scratch`,
deleted at step 9. Nothing is committed, pushed, branched, or filed against the Nexus repo itself.

Throughout, `HARNESS` means:

```bash
HARNESS="tsx $(git rev-parse --show-toplevel)/libs/pr-acceptance/src/cli.ts"
```

Every command prints one JSON object on success, or `pr-acceptance <problem>: <message>` and a
non-zero exit on failure. **Stop at the first non-zero exit** and record what it said — that is the
finding.

**Safety.** This harness can delete a GitHub repository. Three things bound that:

-   **One deterministic name.** `<your-login>/nexus-pr-acceptance-scratch`, always. Isolation
    between runs comes from fresh scenarios inside it, never from fresh repositories — so a failed
    teardown cannot leave an unbounded set of near-identical repos behind.
-   **A triple guard on delete.** The name, the owner, and a provisioning marker the harness itself
    wrote (naming exactly that `owner/name` back) must all agree. Any mismatch refuses without
    deleting. There is no override flag.
-   **Nothing touches the Nexus repo.** No commit, branch, worktree registration, push, issue, PR,
    or config write-back lands here — every live mutation goes to the scratch repo or its
    disposable clone, and each created URL is checked back against the scratch identity.

`provision` refuses up front unless the credential reports `delete_repo`: teardown must be able to
remove what provision is about to create.

**Subcommand reference** (success prints one JSON object on stdout; a failure prints a named
diagnostic on stderr; exit codes: `0` success · `1` a named diagnostic · `2` usage):

| Subcommand | What it does |
|---|---|
| `preflight` | Read-only: identity, token scopes, whether the credential can delete. |
| `provision` | Create-or-reuse the scratch repo (toolchain tree at the current commit) and the disposable clone. |
| `status` | Resolved names and paths, whether the repo and clone exist. Needs no provision state. |
| `seed --kind <k>` | Seed a fresh scenario. `k` = `chain`, `multi-commit`, `single-commit`, `unmerged`. Re-runnable. |
| `merge --pr <N> --strategy squash\|merge\|rebase --branch <b>` | Merge by one strategy, delete the branch, prune it locally. |
| `range --pr <N> [--branch <distill/…>]` | Derive the range through `pr_worktree.ts open --mode close` and verify it. Records evidence. |
| `receipt --pr <N>` | Read the analyze receipt back the way `/nxs.close --pr` does; check exact currency. Records evidence. |
| `residue` | Enumerate worktrees and branches left in the Nexus checkout. Records evidence. |
| `note --stage <s> --verdict pass\|fail\|not-exercised [--detail k=v] [--diagnostic <t>]` | Record an operator-judged outcome. |
| `evidence` | Render everything recorded as markdown, for pasting into the acceptance record. |
| `teardown [--keep-alive]` | Always removes local residue. Deletes the repo unless `--keep-alive`, which prints the surviving URL instead. |

**Run every stage command with the working directory inside the disposable clone** (`$CLONE`
below) — issue and PR targeting resolves from the current checkout's remote, and the toolchain
persists resolved defaults back into config on first use. The harness commands themselves resolve
the Nexus checkout from their own script path, so they work from either directory; `/nxs.*`
commands do not.

---

## 1. Preflight

```bash
$HARNESS preflight
```

Confirms your identity, your token's scopes, and that the credential can delete a repository. If
this fails, fix it here — everything downstream assumes it passed.

## 2. Provision

```bash
$HARNESS provision
```

Creates `<your-login>/nexus-pr-acceptance-scratch` carrying the **toolchain tree at this repo's
current commit**, plus `.nexus/config/`, a docs root, and one feature folder
(`docs/features/acceptance-scratch/`). It also clones it to a disposable working copy under
`/tmp/nexus-pr-acceptance/…` and links this checkout's `node_modules` into it.

Note the printed `clonePath`, `url`, and `toolchainCommit` — the record needs all three.

```bash
CLONE=$($HARNESS status | python3 -c 'import json,sys; print(json.load(sys.stdin)["clonePath"])')
cd "$CLONE"
```

> **Run every remaining step from `$CLONE`.** Issue and PR targeting resolves from the current
> checkout's remote, and the toolchain persists resolved defaults back into config on first use. The
> `$HARNESS` commands find the Nexus checkout from their own path and work from anywhere; the
> `/nxs.*` commands do not.

Re-running `provision` **reuses** the repo when it carries the harness's own marker, and **refuses**
if a repo of that name exists without one. It never makes a second scratch repo.

## 3. Seed the scenarios

A pull request merges once, so each merge strategy needs its own scenario. Seed all five now — each
call mints an independently named, independently numbered scenario:

```bash
$HARNESS seed --kind chain          # → the full analyze → merge → close → distill chain
$HARNESS seed --kind multi-commit   # → squash
$HARNESS seed --kind multi-commit   # → merge commit
$HARNESS seed --kind single-commit  # → rebase
$HARNESS seed --kind unmerged       # → the close gate's negative case
```

Each prints `{ id, branch, epicIssue, storyIssues, prNumber, prUrl, commitCount, changedFiles }`.
**Write down each `prNumber` and `branch`** — the steps below take them as arguments. Below,
`$CHAIN_PR`, `$SQUASH_PR`, `$MERGE_PR`, `$REBASE_PR`, `$UNMERGED_PR` refer to them.

Each scenario carries an epic issue with two story sub-issues (created through the shipped
issue-creation components, so the parent linkage matches the real path), a branch with a non-empty
multi-commit diff, and an open PR whose body closes the first story. The second story is closed at
seed time, so the close precondition can be met without hand-editing issues.

## 4. Analyze the chain PR — STORY-132.02

From `$CLONE`, run the real stage against the real open PR:

```
/nxs.analyze --pr $CHAIN_PR
```

Then read the receipt back the way `/nxs.close --pr` does:

```bash
$HARNESS receipt --pr $CHAIN_PR
```

Expect `found: true`, `current: true`, and `publishedAs: "comment"` — GitHub forbids approving your
own PR, so on a single-account scratch repo analyze always takes its documented comment fallback.
That is full exercise of the receipt loop; the unexercised review path is a recorded limitation, not
a failure.

**Staleness check.** Push a commit to the PR branch and re-read:

```bash
git -C "$CLONE" fetch origin "acceptance/<chain-id>"
git -C "$CLONE" checkout -q "acceptance/<chain-id>"
echo "post-analysis" >> docs/features/acceptance-scratch/<chain-id>/note-1.md
git -C "$CLONE" commit -aqm "post-analysis commit"
git -C "$CLONE" push -q origin HEAD
git -C "$CLONE" checkout -q main
$HARNESS receipt --pr $CHAIN_PR
```

Expect `current: false` with a diagnostic naming both SHAs and the commit count. Staleness must be
**detectable**, never silently accepted. Then re-run `/nxs.analyze --pr $CHAIN_PR` so close has a
current receipt.

Finally confirm the analyze worktree is gone:

```bash
$HARNESS residue
```

## 5. Range derivation across all three strategies — STORY-132.03

Merge each scenario by its own strategy, then probe the range directly through the helper CLI —
the unit whose output is stamped into the close record:

```bash
$HARNESS merge --pr $SQUASH_PR --strategy squash --branch acceptance/<squash-id>
$HARNESS range --pr $SQUASH_PR

$HARNESS merge --pr $MERGE_PR  --strategy merge  --branch acceptance/<merge-id>
$HARNESS range --pr $MERGE_PR

$HARNESS merge --pr $REBASE_PR --strategy rebase --branch acceptance/<rebase-id>
$HARNESS range --pr $REBASE_PR
```

`merge` deletes the branch on the remote and prunes it locally — post-branch-delete reachability is
part of what is under test.

`range` asserts, and records, all of:

- `base` and `head` are full 40-character SHAs;
- both are reachable on the trunk *after* the branch delete;
- `base` is an ancestor of `head`;
- the three-dot diff with `.nexus/queue` excluded **exactly equals** `baseRefOid...prHead` for that
  PR — and, as a cross-check, GitHub's own changed-file list;
- the diff is non-empty.

A `pass: false`, or a non-zero exit carrying the helper's own named diagnostic, is the finding.
Either way it is recorded verbatim. The helper never prints a range it could not verify.

For the **rebase** case additionally confirm from the printed JSON that `base` equals
`mergeCommit^1` and the diff is non-empty — that is the single-commit branch of the derivation.

## 6. Close and distill the chain — STORY-132.04

First prove the gate refuses an unmerged PR:

```
/nxs.close --pr $UNMERGED_PR
```

Expect a non-zero exit with the merge-required diagnostic, and **no** branch, worktree, or commit
created. Confirm:

```bash
$HARNESS residue
git -C "$CLONE" branch --list 'distill/*'
```

Then merge the chain PR and run the real chain:

```bash
$HARNESS merge --pr $CHAIN_PR --strategy squash --branch acceptance/<chain-id>
```

```
/nxs.close --pr $CHAIN_PR
```

Confirm a `distill/<date>-<slug>` branch exists on the scratch remote carrying the close record and
the committed queue entry:

```bash
git -C "$CLONE" ls-remote --heads origin 'distill/*'
```

Then, **in the close worktree that `/nxs.close --pr` printed**:

```
/nxs.distill
```

Confirm the distillation PR is open against the scratch trunk and contains the concept deltas and
the deletion of the queue entry it drained:

```bash
gh pr list --repo "$($HARNESS status | python3 -c 'import json,sys; print(json.load(sys.stdin)["nameWithOwner"])')"
```

Distillation *content* is not under test — only the branch, the PR, and the drain.

**If this half-fails, do not repair it.** Close closes the epic issue and pushes a distill branch, so
a partial run cannot be rewound. Seed a fresh `chain` scenario and start step 4 again.

## 7. Record the limitations

Two branches cannot be provoked live. Name them explicitly — an unexercised branch must never be
left implied by silence:

```bash
$HARNESS note --stage "range refusal branch" --verdict not-exercised \
  --diagnostic "GitHub retains pull/<N>/head after the branch is deleted, so verification essentially always succeeds; the refusal branch cannot be reached without fabricating a denied fetch."

$HARNESS note --stage "review publishing" --verdict not-exercised \
  --diagnostic "GitHub forbids approving your own PR and the maintainer authors everything on the scratch repo, so analyze always takes the comment fallback. Proving the review path needs a second account, which is out of scope for the same reason fork heads are."
```

## 8. Collect the evidence

```bash
$HARNESS evidence
```

Paste the rendered markdown into a **new dated run section** in
[`live-acceptance-record.md`](live-acceptance-record.md). Append; never overwrite an earlier run —
the comparison between runs is what makes a re-run worth doing.

Then fill in the record's prose by hand: the verdict per stage, and every divergence from the
injected-runner tests linked to a filed issue or backlog stub. **Zero divergences is a pass** — record
it explicitly as zero, not as an empty section. Where live behavior contradicts a unit test, the
live behavior is authoritative and the test is what gets recorded as suspect.

## 9. Teardown

```bash
cd "$(git rev-parse --show-toplevel)"   # leave the clone before deleting it
$HARNESS teardown
```

Deletes the scratch repo behind the name/owner/marker triple guard, removes every worktree and
harness branch, and deletes the clone. Emitted evidence survives.

To keep the repo for debugging while still cleaning up locally:

```bash
$HARNESS teardown --keep-alive
```

Verify:

```bash
$HARNESS residue
git worktree list
git branch --list 'acceptance/*'
git status --porcelain
```

Teardown is idempotent — run it again any time, including after a failed run. It needs no state left
behind by provision.

---

## Known divergence: packaging

The scratch repo carries the **working toolchain tree**, not the consumer-facing vendored-component
shape a real consumer repo receives. It has to: the commands invoke their helpers by repo-relative
paths, and those helpers resolve their libraries through workspace links, so a repo carrying only
the vendored tree cannot execute the code being accepted. The clone borrows this checkout's
`node_modules` to run at all.

That gap is itself a real finding about distribution. It is recorded as a divergence in the
acceptance record — not repaired here.

If the borrow fails (`dependencyClosure: "absent"`), invoke the helpers from this checkout by
absolute path while keeping the working directory inside the clone.

## Out of scope

- Hub / multi-repo workspace runs — this is a single scratch repo. Member-repo `--pr` support is the
  separate `member-pr-post-merge-flow` backlog stub.
- Fork-originated PR heads: proving the `pull/<N>/head` fetch path from a fork needs a second GitHub
  account.
- Member-repo rejection of `--pr` — a pure role gate, already covered by unit tests.
- Wiring any of this into CI.
- Fixing whatever the run surfaces.
