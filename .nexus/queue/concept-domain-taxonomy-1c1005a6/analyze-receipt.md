---
epic: "#89"
date: 2026-07-19
head: 0c47776
mode: full
findings: { critical: 0, high: 0, medium: 1, low: 0 }
---

Conformance: Domain Taxonomy for the Concept Store (concept-domain-taxonomy-1c1005a6)  ·  epic #89
Mode: full
Surface: 19 files changed, 3 stories (3 closed / 0 open)

Per-story AC conformance:
  STORY-89.01 A domain registry defines the taxonomy (#90): 4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY-89.02 Concept pages file under a domain (#91):      4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY-89.03 The atlas renders the domain hierarchy (#92): 5/5 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none breaking. Invariant 12 partially met (medium): the well-formed
                        registry, registry-mode atlas case, and preserved no-registry atlas case
                        are in the parity corpus, but the per-malformation fixtures live in the
                        unit specs (domain-registry.spec.ts / validate-concepts.spec.ts), not the
                        parity corpus — so the parity gate verifies source/bundle agreement on the
                        registry parse + render path (well-formed) but not on the malformation
                        finding messages. Engineer-documented rationale: a malformed domains.md at
                        the corpus docs root would activate registry mode for every existing corpus
                        case and break the no-registry byte-identity guarantee (Invariants 5/10).
                        Resolved by isolating the registry corpus in corpus/registry/ and keeping
                        malformation fixtures in specs. Non-breaking coverage placement; low
                        practical risk (parser is a standalone no-import module inlined identically
                        into both bundles, and the well-formed parse path is parity-verified).
Success metrics:        SM1 (every concept once / no single-heading collapse) → measurable via
                          corpus/registry case + renderRegistryAtlas tests; plausibly moved. Real
                          store-seeding is the out-of-scope follow-on epic.
                        SM2 (validator rejects 100% of fixture violations, zero on no-registry) →
                          measurable + met (AC4 it.each over well-formed + each malformation; the
                          no-registry no-op test).
                        SM3 (deterministic, --check parity preserved) → measurable + met (AC(d)
                          twice-byte-identical + --check; parity gate registry-mode + no-registry
                          byte-identity, source vs bundle).
Scope drift:            (informational) renderRegistryAtlas emits a trailing "## Unfiled" heading
                        for any page whose domain: resolves to no node — no AC calls for it, but it
                        satisfies Invariant 9 ("never silently dropped"; validator, not atlas, is
                        the gate). docs/features/concept-domains/README.md added as feature
                        scaffolding, no AC.

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 1 · low 0
