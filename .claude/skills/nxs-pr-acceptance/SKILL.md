---
name: nxs-pr-acceptance
description: Maintainer-invoked live-acceptance harness for the --pr post-merge flow. Provisions one throwaway hosted repo, seeds PR scenarios, drives the merge strategies and the range helper against them, and tears the whole thing down behind a triple guard. Holds a repository-delete capability.
---

# nxs-pr-acceptance

The executable half of `docs/features/pr-driven-delivery/live-acceptance-runbook.md`. Run the
runbook — it is the durable artifact and it sequences these commands. This file is the reference
for the commands themselves.

## Purpose

`/nxs.analyze --pr`, `/nxs.close --pr`, and `/nxs.distill` are covered by unit tests that inject a
fake command runner. Those tests prove the logic given the `git` and `gh` output we *believe* real
GitHub produces. This harness buys the evidence that the belief is true — once, cheaply, and
repeatably — and leaves a dated, commit-pinned acceptance record behind.

It does **not** fix what it finds. Divergences are recorded and filed; each fix is sized
separately.

## Safety

This harness can delete a GitHub repository. Three things bound that:

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

## Usage

```bash
tsx ./.claude/skills/nxs-pr-acceptance/scripts/pr_acceptance.ts <subcommand> [flags]
```

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

## Contract

-   Success prints one JSON object on stdout; a failure prints `pr-acceptance <problem>: <message>`
    on stderr. Exit codes: `0` success · `1` a named diagnostic · `2` usage.
-   **Run every stage command with the working directory inside the disposable clone.** Issue and PR
    targeting resolves from the current checkout's remote, and the toolchain persists resolved
    defaults back into config on first use. The harness commands themselves resolve the Nexus
    checkout from their own script path, so they work from either directory; `/nxs.*` commands do
    not.
-   **Verdicts are mechanical where the metrics are.** File-set equality against the PR's own
    changed-file set, exact full-SHA equality for receipt currency, and enumeration for residue are
    assertions the harness makes and reports. Operator judgment stays in the record's prose.
-   **Evidence is pinned or it is not evidence.** Every recorded outcome carries the toolchain
    commit it was produced against and the date observed; an entry missing either is refused.
-   **`teardown` is local-first, guarded, and idempotent.** It removes worktrees, harness branches,
    and the clone on keep-alive, after a failed run, and when run twice. It never removes a worktree
    outside the harness's temp roots or a branch outside the `acceptance/` prefix. Emitted evidence
    survives teardown.
-   The full chain is **one-shot per seeded epic** — close closes the epic issue and pushes a distill
    branch, so a failure partway through cannot be rewound. Recovery is to `seed` a fresh scenario,
    never to repair a half-run one.

## Known limitations

Two branches cannot be provoked on a real single-account hosted PR, and the acceptance record names
both rather than leaving them implied by silence:

-   **Range derivation's refusal branch** — GitHub retains the pull-request head reference after the
    branch is deleted, so verification essentially always succeeds.
-   **Review publishing** — GitHub forbids approving your own PR, and the maintainer authors
    everything on the scratch repo, so analyze always takes its documented comment fallback. The
    close-side reader consults both reviews and comments, so the receipt loop is still fully covered.
