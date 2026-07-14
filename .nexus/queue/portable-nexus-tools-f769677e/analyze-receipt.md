---
epic: "#44"
date: 2026-07-14
head: 75153b1
mode: full
findings: { critical: 0, high: 0, medium: 0, low: 2 }
---

Conformance: Portable Nexus Tooling (.nexus/queue/portable-nexus-tools-f769677e/)  ·  epic #44
Mode: full
Surface: 56 files changed, 3 stories (3 closed / 0 open)

Per-story AC conformance:
  STORY 1 Portable tooling distributable: 3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY 2 Hub invocation path:            3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY 3 Parity guarantee:               2/2 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none (Inv 1–6, 8–12 met; Inv 7/13 met in spirit — see LOW-1)
Success metrics:         M1 hub-distill → plausibly moved; bundle-on-bare-node instrumented, hub command-selection is prose (not auto-tested)
                         M2 corpus parity → plausibly moved; fully instrumented (parity.spec.ts, nx test target)
                         M3 single-repo unchanged → preserved; pnpm nexus:* repointed to new source, measurable via existing suite
Scope drift:             none unplanned. Side-effect: 4 concept anchors still cite moved utils/ paths (LOW-2, self-heals next distill)

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 0 · low 2

Story issues #45, #46, #47 all CLOSED (2026-07-14) — the prior close-readiness block is cleared.
LOW-1 (invariant letter vs spirit): /nxs.distill selects the hub-vs-single-repo invocation with
  an inline `test -f .nexus/config/workspace.yml|hub.yml` and hard-codes `.nexus/tools/*.mjs`
  (nxs.distill.md:224-268), rather than consuming @nexus/workspace's resolveWorkspace()/
  portableToolsDir. It keys off the same authoritative artifacts and forbids a new heuristic, so
  Inv 7/13 hold in spirit; but the role rule and the tools path are duplicated in prose and won't
  auto-follow a future resolver change. Inherent to distill being a markdown/bash command.
LOW-2 (derived-state staleness): moving utils/*.ts → libs/portable-tools/src/ left 4 code anchors
  (.nexus/anchors/distiller.md, concept-store.md, append-only-decision-log.md,
  provenance-reference.md) pointing at the old utils/ paths. Anchors are derived/self-healing —
  the next /nxs.distill R1 refresh rebuilds them; no page or invariant references them.
