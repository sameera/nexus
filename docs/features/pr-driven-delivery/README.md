---
feature: "PR-Driven Delivery"
---

# PR-Driven Delivery

Run conformance, closure, and distillation against a merged pull request instead of a live branch, so the diff the distiller reads can't drift after merge.

## Epics

- **PR-Driven Post-Merge Flow for Analyze, Close, and Distill** — [#101](https://github.com/sameera/nexus/issues/101)
- **Live Acceptance Dry-Run of the PR Post-Merge Flow** — [#132](https://github.com/sameera/nexus/issues/132)

## Live acceptance

The `--pr` mechanics are unit-tested against an injected command runner. These two documents are how
that logic is checked against real GitHub, and what the check found:

- [Live-acceptance runbook](live-acceptance-runbook.md) — the maintainer-invoked dry-run, start to
  finish. Its executable half is the `nxs-pr-acceptance` skill.
- [Live-acceptance record](live-acceptance-record.md) — what real GitHub did, per dated run, pinned
  to the toolchain commit it was observed against.
