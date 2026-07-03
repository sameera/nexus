<!--
DECISION RECORD TEMPLATE — replaces the 16-section HLD.

WHAT THIS IS
    The focused architectural decision record emitted by /nxs.hld into the
    committed planning queue (.nexus/queue/<epic-slug>-<local-id>/). It is human
    prose only. It is the distiller's PRIMARY rationale source (the "why") and
    is read by System B post-merge.

FILLING RULES
    - Replace every {{PLACEHOLDER}}. Delete guidance comments before committing.
    - No file paths, type/function names, API or schema specs, or
      implementation steps — those are the engineer's (0001 D4) and rot against
      source. Keep this to decisions, constraints, and rationale.
    - Consume concept pages for current system state; do NOT regenerate a
      "System Context" section here.

C5 — REQUIRED-SECTION WHITELIST (tier by epic complexity rating; explicit, not
heuristic):
    - rating S or M : Key Decisions + Constraints & Invariants are REQUIRED.
                      All other sections are optional — omit if empty, do not
                      force-fill.
    - rating L or XL: ALL sections below are REQUIRED.
    The `rating` frontmatter field selects the tier. A section required by the
    tier must not be left empty without a stated reason.

B-MINING ANNOTATIONS (per 0006 — DOCUMENTATION ONLY)
    Each section notes which ConceptDelta field System B will derive from it at
    distill time. This documents what B mines; it is NOT a machine block this
    record emits. System A writes only the human prose below.
-->
---
title: "Decision Record: {{EPIC_TITLE}}"
epic: {{EPIC_ISSUE_REF}}        # parent epic GitHub issue, e.g. #42
feature: "{{FEATURE_NAME}}"
rating: {{S|M|L|XL}}            # selects the C5 required-section tier
concepts: []                    # reading-list: concept slugs this design read (consumed in B3)
date: {{YYYY-MM-DD}}
---

# Decision Record: {{EPIC_TITLE}}

## Summary

<!-- Section 1 (slimmed). 2–3 sentences: what is being built and the shape of the
     chosen approach. Lead with the most distinctive sentence.
     B-mining: feeds the concept Summary / how_it_works_delta at close. -->

{{SUMMARY}}

## Chosen Approach

<!-- Section 5 (slimmed). The approach in a few sentences. Diagram only if
     load-bearing. No layer-by-layer frontend/API/data boilerplate.
     B-mining: behavioral outcome → how_it_works_delta. -->

{{CHOSEN_APPROACH}}

## Key Decisions

<!-- Section 10 (CORE — required at every tier). One entry per real decision.
     C1/G2: each entry records the refuted VIABLE alternative + why it lost.
     Viability guardrail: include an alternative only if a competent engineer
     might genuinely have chosen it and it was rejected on a real trade-off —
     never a strawman. If no viable alternative existed, state only the why and
     omit the alternative line.
     B-mining: each decision → decision_log_entry (B constructs the delta from
     this prose post-merge). -->

### {{DECISION_TITLE}}

- **Decision:** {{WHAT_WAS_DECIDED}}
- **Why:** {{RATIONALE}}
- **Refuted alternative:** {{VIABLE_ALTERNATIVE_AND_WHY_IT_LOST}}  <!-- omit line if none was viable -->

<!-- repeat the block above per decision -->

## Constraints & Invariants

<!-- Sections 4 + 9 (slimmed). Hard constraints the build must preserve,
     including security boundaries. Numbered, one sentence each.
     C4: a cross-cutting NFR budget NOT attributable to one concept (e.g. a
     global "page load < 2s") does NOT belong here — route it to
     docs/system/standards/ and reference it. Only per-subsystem invariants
     (a latency budget on one component, an identifier format, a security
     boundary) belong here.
     B-mining: invariants → invariants_added (per-concept). -->

1. {{INVARIANT}}
2. {{INVARIANT}}

## Risks (BLOCKER / ADDRESS only)

<!-- Section 13 (slimmed). Only risks that force a human decision before
     proceeding. No likelihood×severity matrix. Speculative risks are out;
     risks that materialize reach the concept log via the close record.
     B-mining: accepted-debt / materialized-risk rationale → decision_log_entry
     (at close, not here). -->

- **BLOCKER — {{RISK}}:** {{MITIGATION_OR_DECISION_NEEDED}}
- **ADDRESS — {{RISK}}:** {{MITIGATION}}

## Open Clarifications

<!-- Normally EMPTY in the written record. /nxs.hld resolves every ⚠️ NEEDS
     CLARIFICATION item at its Phase 2 gate (AskUserQuestion) and folds the
     answer into the relevant decision/invariant/approach before writing — the
     write is blocked while any remain unresolved. Leave this section empty
     (delete the placeholder) unless an item was explicitly deferred with the
     human's recorded decision to defer. -->

- [ ] {{OPEN_QUESTION}}
