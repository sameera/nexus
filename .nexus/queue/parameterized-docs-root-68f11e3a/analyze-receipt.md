---
epic: "#74"
date: 2026-07-18
head: 142dc6b
mode: full
findings: { critical: 0, high: 0, medium: 0, low: 0 }
---

Conformance: Parameterized Docs Root (.nexus/queue/parameterized-docs-root-68f11e3a)  ·  epic #74
Mode: full
Surface: 18 files changed, 4 stories (4 closed / 0 open)

Per-story AC conformance:
  STORY 1 Docs root joins resolved workspace context:            5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY 2 Atlas generator derives location and links:            5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY 3 Cross-ref URL building strips the configured docs root: 4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 4 The hub drain follows the resolved atlas location:      3/3 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none — all 9 decision-record invariants hold.
  1 single-repo byte-identity — computeLinkPrefix from docs/concepts.md yields "../.nexus/concepts/"; byte-identical test asserts it.
  2 resolver sole producer — atlas generator + cross-ref both call localDocsRoot; drain reads generator output; none re-derive.
  3 manifest+role only, parity holds — hub from manifest, members/single-repo "docs"; parity test asserts hub/member agreement.
  4 bundle byte-identity + re-vendor — bundle.spec parity vs source; bundle-fingerprint.json re-pinned.
  5 0b8973e2 amended docs/→<docs-root>/concepts.md — generator header updated.
  6 POSIX separators — computeLinkPrefix splits on path.sep, joins on "/".
  7 URL/docs-root agreement, mismatch=operator error — implemented + tested both directions.
  8 override validated repo-relative non-escaping — isSafeRelativePath guards the manifest field.
  9 resolution read-only — localDocsRoot only reads resolveWorkspace; no fs writes added.

Success metrics:
  1 docs-only hub drain (atlas at root, links resolve, no docs/ dir):  plausibly-moved · measurable (generate-atlas.spec asserts root atlas + no docs/; drain command follows resolved path)
  2 single-repo byte-identical atlas:                                  plausibly-moved · measurable (byte-identical test + portable/in-repo bundle parity)
  3 cross-ref zero dead links both layouts:                            plausibly-moved · measurable (cross-ref-docs-root.spec covers both layouts + mismatch)
  4 resolved docs root in status read-out for every repo:              plausibly-moved · measurable (status.ts + status.spec render hub/member/single-repo docs root)

Scope drift:            none material. The URL/docs-root agreement check (Invariant 7) is not unplanned — it is Story 3 AC4 and the decision record records it as an edit extending the cross-ref story. The isSafeRelativePath helper and override validation are called for by Invariant 8.

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 0 · low 0
