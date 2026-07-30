---
feature: "PR-Driven Delivery"
---

# PR-Driven Delivery

Run conformance, closure, and distillation against a merged pull request instead of a live branch, so the diff the distiller reads can't drift after merge.

## Epics

- **PR-Driven Post-Merge Flow for Analyze, Close, and Distill** — [#101](https://github.com/sameera/nexus/issues/101)
- **Live Acceptance Dry-Run of the PR Post-Merge Flow** — [#132](https://github.com/sameera/nexus/issues/132)
- **Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill** — [#170](https://github.com/sameera/nexus/issues/170)
- **Configurable Worktree Location for the --pr Flow** — [#178](https://github.com/sameera/nexus/issues/178)

## Live acceptance

The `--pr` mechanics are unit-tested against an injected command runner. These two documents are how
that logic is checked against real GitHub, and what the check found:

- [Live-acceptance record](live-acceptance-record.md) — what real GitHub did, per dated run, pinned
  to the toolchain commit it was observed against. **Start here.** The 2026-07-25 run measures range
  derivation read-only against this repo's own merged PRs; it needs no scratch repo and no extra
  credential scope.
- [Live-acceptance runbook](live-acceptance-runbook.md) — the scratch-repo dry-run, start to finish.
  Its executable half is the `nxs-pr-acceptance` skill. **No longer the required path** — retained
  as the controlled reproduction if something misbehaves on a real PR.
