<!--
DECISION RECORD TEMPLATE — TRIAL FORMAT (not shipped; the recordChecklist parser still reads
the old headings).

STRUCTURE
    The approval contract comes first; the explanation comes last.
    1. How it works                      what the design adds, in the epic's words
    2. Approval brief                    what needs a decision, and what is being accepted
    3. Guarantees                        the promised behaviour, checkable by /nxs.analyze
    4. Risks and dependencies
    5. Concept-store changes             only when non-empty
    6. Design rationale and mechanism    appendix: Mechanism, then Decisions and reasons

    Sections 1-5 use only the vocabulary of the epic, its stories and How it works. Internal
    names are defined in the appendix's Mechanism and used only in the appendix.

FILLING RULES
    - Replace every {{PLACEHOLDER}}. Delete guidance comments before filing.
    - No file paths, type/function names, API or schema specs, or implementation steps.

DRAFT-ONLY RULES (checked at the lead's checkpoint, stripped from the filed body)
    - Every optional field is written as `none` in the draft, so an omitted trade-off cannot pass
      for an asserted absence. `none` fields are removed from the filed body.
    - Every guarantee cites at least one decision, or sits under "Existing behaviour to
      preserve". A guarantee with neither goes under "Resolve before approval".
    - In a multi-story epic, every decision names the story that delivers it. A decision no story
      delivers is new scope and goes under "Resolve before approval".
    - Every "Epic commitment affected" line gives the exact old and new wording, and every one
      whose status is not "amended" appears under "Resolve before approval".

CHECKS AT THE LEAD'S CHECKPOINT
    - Cold read. A fresh reader gets the epic, its stories, the product context and sections
      1-5. It lists every term it cannot explain, and every sentence in How it works that only
      restates an epic or story outcome. IDs that point inside this record are allowed. An issue
      number is allowed only with a plain statement of what it shows. Any hit blocks filing.
    - Completeness. The same reader, from sections 1-5 only, states: what is being approved,
      the behaviour promised, the material costs, and what blocks approval. Any
      approval-relevant fact that first appears in the appendix blocks filing.
    - The appendix is cold-read separately, with sections 1-5 added to the reader's inputs.

    Tool vocabulary is the usual failure: the drafter knows the code, so its internal names
    (a "filer", a "resolver", a "marker") feel like plain words. They are not, to the approver.
-->
---
title: "Decision Record: {{EPIC_TITLE}}"
epic: {{EPIC_ISSUE_REF}}
feature: "{{FEATURE_NAME}}"
rating: {{S|M|L|XL}}
concepts: []
date: {{YYYY-MM-DD}}
issues_repo: {{ISSUES_REPO}}
---

# Decision Record: {{EPIC_TITLE}}

## How it works

<!-- What the design adds: how it meets the epic's outcomes. Read first, by an approver who has
     already read the epic and its stories.
     - Use only the epic's and stories' vocabulary. Name no internal component.
     - Never restate an outcome the epic or a story already states. Point to it if an anchor
       helps, e.g. "#223's failure cases".
     - No metaphors for plain actions ("mints", "hydrates", "walks"). Use the plain verb.
     LENGTH. Aim for 250-300 words at most. A guideline, not a limit: if a clear explanation
     needs more, write more. Never cut content or shorten a sentence to get under it. Over the
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
       "material". A decision already listed under Resolve is not repeated, but its trade-off
       moves with it, as a sub-bullet of its Resolve entry.
     - Before implementation: every ADDRESS risk whose mitigation is a plan not yet made.
     - Committed follow-up: every ADDRESS risk whose mitigation is decided, with who delivers it.
     - Revision delta: changed and withdrawn decision IDs. Only when revising. -->

Approval covers the whole record. This brief lists what needs a decision and every choice that carries a trade-off.

**Resolve before approval**

- {{BLOCKER_OR_COMMITMENT}} Checked {{YYYY-MM-DD}}: {{WHAT_THE_LIVE_ISSUE_SAYS}}.

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
     - IDs are stable across revisions; grouping does not renumber them. -->

### {{GROUP}}

- G1. {{CHECKABLE_CONDITION}} (D1)

### Existing behaviour to preserve

- G2. {{CHECKABLE_CONDITION}}

## Risks and dependencies

<!-- BLOCKER: a decision required before approval. ADDRESS: a risk with a mitigation, and who
     delivers it. Plain vocabulary. -->

- R1 BLOCKER — {{RISK}}. {{DECISION_NEEDED}}
- R2 ADDRESS — {{RISK}}. {{MITIGATION}} Delivered by {{STORY | EPIC | existing behaviour}}.

## Concept-store changes

<!-- Only when the design changes or departs from a concept-store statement. Quote the old
     statement and give the new one, so the distiller rewrites it instead of reporting drift.
     Omit when empty. -->

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

<!-- One entry per real decision.
     - Refuted viable alternative: only where a competent engineer might genuinely have chosen it,
       with the trade-off it lost on.
     - Trade-off: what this choice gives up. The brief's sub-bullet says the same in plain words.
     - Epic commitment affected: the exact old wording, the exact new wording, the issue, and a
       status: pending, amended (verified <date>), or unresolved (with the record's reason).
     - Delivered by: the story. Omit when the epic has one story.
     - Guarantees: the IDs this decision supports. -->

#### D1 — {{CHOICE}}

- **Decision:** {{WHAT_WAS_DECIDED}}
- **Why:** {{RATIONALE}}
- **Refuted viable alternative:** {{ALTERNATIVE_AND_WHY_IT_LOST}}
- **Trade-off:** {{WHAT_IS_GIVEN_UP}}
- **Epic commitment affected:** {{ISSUE}}. Old: "{{OLD}}". New: "{{NEW}}". Status: {{STATUS}}.
- **Delivered by:** {{STORY}}
- **Guarantees:** G1
