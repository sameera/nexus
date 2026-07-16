---
epic: "#60"
date: 2026-07-16
head: 1ebbcf6
mode: full
findings: { critical: 0, high: 0, medium: 0, low: 0 }
---

Conformance: Nexus Setup CLI (.nexus/queue/workspace-setup-cli-5e26d130)  ·  epic #60
Mode: full
Surface: 24 files changed, 5 stories (5 closed / 0 open)

Per-story AC conformance:
  STORY 1 nexus deploy:              4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 2 nexus workspace init:      5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY 3 nexus workspace status:    4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 4 nexus workspace add-repo:  3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY 5 re-scope /nxs.setup:       3/3 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none — all 9 decision-record invariants preserved
  1 resolver-parity: init & add-repo re-resolve own output, roll back on mismatch (workspace-init.ts:225, workspace-add-repo.ts:96)
  2 single-authority: writers validate through resolver parsers, no second schema (write.ts:48)
  3 two-file add-repo: snapshot-tested exactly-two-file mutation (workspace-add-repo.ts:78)
  4 single-repo-writes-nothing: deploy touches only .claude/; setup Phase 0 binding rule (nxs.setup.md Phase 0)
  5 idempotent-deploy: mirror-to-managed-set + nxs-namespaced stale removal, settings.local.json untouched (deploy-components.ts:62)
  6 read-only status: resolver-only, tree byte-identical after run (nexus-cli.ts:199)
  7 bare-runtime: bundled nexus.mjs, plain-node tested; payload rides fingerprint pin (build-bundles.ts:14, vendor-bundle.ts:73)
  8 structure/judgment seam: setup writes no manifest/pointer/components (nxs.setup.md Phase 0)
  9 retire-legacy: nxs.update.claude.sh absent from distribution

Success metrics:
  1 one-deploy install, script removed          → measurable (distribution inspection) · plausibly moved
  2 single init, resolver zero-edit parity       → measurable (structural re-resolve gate) · plausibly moved
  3 add-repo mutates exactly two files           → measurable (snapshot test) · plausibly moved
  4 every verb on bare runtime                    → measurable (plain-node bundle test) · plausibly moved
  5 /nxs.setup no placement prompt, no artifacts  → observable (post-run file check); not instrumented — prompt-level guarantee · plausibly moved

Scope drift:             none material — add-repo cleanly reuses discoverSiblings/originRemote from init

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 0 · low 0
