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

## hub-github-defaults-allowlist-gaps

- **status:** proposed
- **goal:** Close the four record- and design-related publishing keys that exist in the resolver's key map but are missing from the hub manifest's defaults allowlist, so a hub can declare them without failing validation.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic Configurable Worktree Location for the --pr Flow (#178) (2026-07-31)

## hub-worktree-base-end-to-end-coverage

- **status:** proposed
- **goal:** Verify hub-declared `worktree-path` inheritance end to end — from a hub manifest through to the path of an opened worktree — rather than one hop short at the resolver seam plus the manifest allowlist.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic Configurable Worktree Location for the --pr Flow (#178) (2026-07-31)

## pr-flow-live-acceptance-dry-run

- **status:** promoted (#132) — re-scoped 2026-07-25
- **goal:** Verify range derivation against real merges of each strategy, so the distiller recomputes the diff the PR actually contained. Originally scoped as a full end-to-end run against a provisioned scratch repo; that was dropped once the same evidence proved obtainable read-only against this repo's own merged PRs. Rebase measured (6/6 PASS, zero divergences); squash and merge-commit pending on the next real PRs (#135). The scratch-repo stories (#134, #136) are closed — see the [record](live-acceptance-record.md).
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic PR-Driven Post-Merge Flow for Analyze, Close, and Distill (#101) (2026-07-20)
