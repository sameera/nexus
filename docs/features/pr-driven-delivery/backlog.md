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

- **status:** promoted (#132) — re-scoped 2026-07-25
- **goal:** Verify range derivation against real merges of each strategy, so the distiller recomputes the diff the PR actually contained. Originally scoped as a full end-to-end run against a provisioned scratch repo; that was dropped once the same evidence proved obtainable read-only against this repo's own merged PRs. Rebase measured (6/6 PASS, zero divergences); squash and merge-commit pending on the next real PRs (#135). The scratch-repo stories (#134, #136) are closed — see the [record](live-acceptance-record.md).
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic PR-Driven Post-Merge Flow for Analyze, Close, and Distill (#101) (2026-07-20)

## revendor-claude-components-bundle

- **status:** proposed
- **goal:** Re-vendor the `claude-components` bundle so its committed fingerprint matches a fresh build and `libs/portable-tools/src/parity.spec.ts` passes on main.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill (#170) (2026-07-30)

## provenance-prose-match-test

- **status:** proposed
- **goal:** Add an executable test that a free-prose mention of an epic number does not mark an undrained ephemeral entry consumed — the whole-token, structured-position rule of record #176 invariant 8 currently ships as prompt-spec only, leaving its ADDRESS-tier risk mitigation untested.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill (#170) (2026-07-30)
