<!--
DECISION RECORD TEMPLATE — approval-first format.

WHAT THIS IS
    The focused architectural decision record /nxs.decision-record files as a sub-issue of the
    epic (or, for an old-contract epic, writes into its committed queue entry). It is human prose
    only. It is the distiller's primary rationale source (the "why"), and /nxs.analyze checks the
    build against its guarantees.

    A revision of a record approved in the old format (a body with "Constraints & Invariants") is
    drafted from decision-record-template-v1.md instead. A revision keeps its record's format.

STRUCTURE
    The approval contract comes first; the explanation comes last.
    1. How it works                      what the design adds, in the epic's words
    2. Approval brief                    what needs a decision, and what is being accepted
    3. Guarantees                        the promised behaviour, checkable by /nxs.analyze
    4. Risks and dependencies
    5. Concept-store changes             only when non-empty
    6. Design rationale and mechanism    appendix: Mechanism (with Terms), then Decisions and reasons

    Sections 1-5 use only the vocabulary of the epic, its stories and How it works. Internal
    names are defined in the appendix's Terms and used only in the appendix.

REQUIRED SECTIONS (tier by the epic's complexity rating; explicit, not heuristic)
    - rating S or M : How it works, Guarantees and the appendix's Decisions and reasons are
                      required. Every other section is optional: omit it when empty.
    - rating L or XL: every section is required. A required section left empty states why.
    - At every size: the Approval brief appears whenever any of its groups has an entry, and
      Concept-store changes appears only when it has an entry.
    The `rating` frontmatter field selects the tier.

FILLING RULES
    - Replace every {{PLACEHOLDER}}. Delete guidance comments before filing.
    - No file paths, type/function names, API or schema specs, or implementation steps. Those are
      the engineer's, and they rot against source.
    - Consume concept pages for current system state; do not regenerate a "System Context" here.

DRAFT-ONLY RULES (checked at the lead's checkpoint, stripped from the filed body)
    - Every optional field of a decision entry is written as `none` in the draft when it is
      empty, so an omitted trade-off cannot pass for an asserted absence. `none` fields are
      removed from the filed body.
    - Every guarantee cites at least one decision, or sits under "Existing behaviour to
      preserve". A guarantee with neither goes under "Resolve before approval".
    - In a multi-story epic, every decision names the story that delivers it. A decision no story
      delivers is new scope and goes under "Resolve before approval".
    - Every "Epic commitment affected" line gives the exact old and new wording, and every one
      whose status is not "amended" appears under "Resolve before approval".
-->
---
title: "Decision Record: {{EPIC_TITLE}}"
epic: {{EPIC_ISSUE_REF}}        # parent epic GitHub issue, bare (e.g. #42) — in {{ISSUES_REPO}}
feature: "{{FEATURE_NAME}}"
rating: {{S|M|L|XL}}            # selects the required-section tier
concepts: []                    # reading-list: concept slugs this design read
date: {{YYYY-MM-DD}}
issues_repo: {{ISSUES_REPO}}    # owner/repo the epic issue above lives in. OMIT when it resolves
                                # to nothing (the epic lives in the current repo, never pinned).
---

# Decision Record: {{EPIC_TITLE}}

## How it works

<!-- What the design adds: how it meets the epic's outcomes. Read first, by an approver who has
     already read the epic and its stories.
     - Use only the epic's and stories' vocabulary. Name no internal component.
     - Never restate an outcome the epic or a story already states. Point to it if an anchor
       helps, e.g. "#223's failure cases".
     - No metaphors for plain actions ("mints", "hydrates", "walks"). Use the plain verb.
     LENGTH. Aim for about 300 words. This is a guideline, not a limit: if a clear explanation
     needs more, write more. Never cut content or a definition to get under it. Running over the
     guideline is a prompt to look for restated epic content, or for detail that belongs in the
     appendix. -->

{{MECHANISM_IN_EPIC_WORDS}}

## Approval brief

<!-- Approval covers the whole record. The brief lists what needs a decision, and every
     decision the approver is accepting a cost for. Omit an empty group.
     - Resolve before approval: every BLOCKER; every epic or story commitment not yet amended,
       with the date it was checked against the live issue; every guarantee with no supporting
       decision; every decision no story delivers.
     - Choices with trade-offs: every decision with a trade-off, in plain words, with the
       trade-off as a sub-bullet. The rule is mechanical: the drafter does not pick which are
       "material". A decision already listed under Resolve is not repeated here, but its
       trade-off moves with it, as a sub-bullet of its Resolve entry.
     - Before implementation: every ADDRESS risk whose mitigation is a plan not yet made.
     - Committed follow-up: every ADDRESS risk whose mitigation is decided, with who delivers it.
     - Revision delta: changed and withdrawn decision IDs. Only when revising. -->

Approval covers the whole record. This brief lists what needs a decision and every choice that carries a trade-off.

**Resolve before approval**

- {{BLOCKER_OR_COMMITMENT}} Checked {{YYYY-MM-DD}}: {{WHAT_THE_LIVE_ISSUE_SAYS}}.
  - Trade-off: {{WHAT_IS_GIVEN_UP}}

**Choices with trade-offs**

- D1. {{CHOICE_IN_PLAIN_WORDS}}
  - Trade-off: {{WHAT_IS_GIVEN_UP}}

**Before implementation**

- {{RISK_ID}} ADDRESS: {{PLAN_NEEDED}}

**Committed follow-up**

- {{RISK_ID}} ADDRESS: {{MITIGATION}} Delivered by {{STORY | EPIC | existing behaviour}}.

## Guarantees

<!-- The primary contract. Conditions the build could violate, each independently checkable by
     /nxs.analyze.
     - Group under short headings by what the reviewer checks (e.g. consent, filing, parentage,
       failure behaviour). Put behaviour already true that the design must not break under
       "Existing behaviour to preserve".
     - Each guarantee ends with the decisions that support it, e.g. (D2, D5).
     - Plain vocabulary, as in How it works, without losing any condition.
     - Explanation, consequence and reasoning belong in the decision, not here.
     - Per-subsystem only. A cross-cutting budget no single part of the system owns (e.g. a
       global "page load < 2s") belongs in docs/system/standards/; reference it there.
     - IDs are stable across revisions; grouping does not renumber them. -->

### {{GROUP}}

- G1. {{CHECKABLE_CONDITION}} (D1)

### Existing behaviour to preserve

- G2. {{CHECKABLE_CONDITION}}

## Risks and dependencies

<!-- Only risks that force a human decision. BLOCKER: a decision required before approval.
     ADDRESS: a risk with a mitigation, and who delivers it. No likelihood × severity matrix and
     no speculative risks. Plain vocabulary. -->

- R1 BLOCKER — {{RISK}}. {{DECISION_NEEDED}}
- R2 ADDRESS — {{RISK}}. {{MITIGATION}} Delivered by {{STORY | EPIC | existing behaviour}}.

## Concept-store changes

<!-- Only when the design changes or departs from a concept-store statement. Quote the old
     statement and give the new one, so the distiller rewrites it instead of reporting drift.
     Omit when empty, at every size. -->

- {{CONCEPT_PAGE}}: "{{OLD_STATEMENT}}" becomes "{{NEW_STATEMENT}}".

## Design rationale and mechanism

<!-- Appendix. Optional on a first pass; a reviewer consults the relevant entries when judging a
     consequential choice. Holds nothing approval-relevant that sections 1-5 do not already say. -->

### Mechanism

<!-- - Terms: every internal name the decisions use, each defined once in plain words.
     - Detail: the steps and data the decisions rely on that How it works leaves out.
     No word limit. -->

**Terms**

- **{{TERM}}:** {{PLAIN_DEFINITION}}

{{DETAIL}}

### Decisions and reasons

<!-- One entry per real decision. Write every optional field; write `none` when it is empty.
     - Refuted viable alternative: offered, not required (nxs-razor §9). Write
       `- **Refuted viable alternative:** <what lost, and the trade-off it lost on>` directly
       under Why, only where a competent engineer might genuinely have chosen it. Where no
       alternative was viable, write `- **Refuted viable alternative:** none`. Never invent one
       to fill the line.
     - Trade-off: what this choice gives up. The brief's sub-bullet says the same in plain words.
     - Epic commitment affected: the exact old wording, the exact new wording, the issue, and a
       status: pending, amended (verified <date>), or unresolved (with the record's reason).
     - Delivered by: the story. `none` when the epic has one story.
     - Guarantees: the IDs this decision supports. -->

#### D1 — {{CHOICE}}

- **Decision:** {{WHAT_WAS_DECIDED}}
- **Why:** {{RATIONALE}}
- **Trade-off:** {{WHAT_IS_GIVEN_UP | none}}
- **Epic commitment affected:** {{ISSUE}}. Old: "{{OLD}}". New: "{{NEW}}". Status: {{STATUS}}. <!-- or none -->
- **Delivered by:** {{STORY | none}}
- **Guarantees:** {{G1, G2 | none}}

<!-- repeat the block above per decision -->
