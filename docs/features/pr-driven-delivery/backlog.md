# Backlog: PR-Driven Delivery

<!-- Append-only re-triage queue. Writers: /nxs.epic (decomposition stubs),
     /nxs.close (deferred scope). One consumer: the next /nxs.epic.
     Promote a proposed stub with `/nxs.epic <slug>`. -->

## member-pr-post-merge-flow

- **status:** proposed
- **goal:** Extend the `--pr` post-merge flow (analyze/close/distill) to member repos, reconciling the post-merge worktree cut from the trunk with the member's pre-merge close-and-migrate choreography.
- **estimate:** M
- **blocked_by:** none
- **source:** deferred from epic PR-Driven Post-Merge Flow for Analyze, Close, and Distill (#101) (2026-07-20)

## pr-flow-live-acceptance-dry-run

- **status:** proposed
- **goal:** Run the PR flow end-to-end against a scratch hosted repo (squash, merge-commit, and rebase merges) as a live acceptance check — the mechanics are unit-tested with injected runners but never exercised against a real `gh`/PR in the build environment.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic PR-Driven Post-Merge Flow for Analyze, Close, and Distill (#101) (2026-07-20)
