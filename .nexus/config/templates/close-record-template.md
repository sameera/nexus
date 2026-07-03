<!--
CLOSE RECORD TEMPLATE — replaces PIR.md.

WHAT THIS IS
    The epic close artifact emitted by /nxs.close into the committed planning
    queue (.nexus/queue/<epic-slug>-<local-id>/). It is HUMAN PROSE ONLY.

    There is NO ConceptDelta block (0006). The machine-handoff half is removed:
    System A emits nothing structured. The distiller mines THIS prose for the
    "why" it cannot derive from the code diff; B constructs the ConceptDeltas
    itself post-merge. Durability is structural — this entry is committed and
    travels to main with the PR; the distiller deletes it on consume.

CLOSE-FROM-DIFF FORCING FUNCTION
    /nxs.close diffs the branch AGAINST the decision record, auto-derives the
    "what" from the diff, and surfaces the detected DEVIATIONS. The human
    supplies rationale ONLY on those deviations (targeted, not a blank "write a
    summary"). That rationale lands in "Deviation Rationale" below.

FILLING RULES
    - Replace every {{PLACEHOLDER}}. Delete guidance comments before committing.
    - Deferred scope is APPENDED to docs/features/<feature>/backlog.md (C2);
      this record carries only a pointer to it, not the scope itself.
    - The process lesson is written as its own file under docs/delivery/lessons/
      (C3); this record does not restate it.
-->
---
title: "Close Record: {{EPIC_TITLE}}"
epic: {{EPIC_ISSUE_REF}}        # parent epic GitHub issue, e.g. #42
feature: "{{FEATURE_NAME}}"     # one-direction pointer: entry → parent feature
date: {{YYYY-MM-DD}}
---

# Close Record: {{EPIC_TITLE}}

## Key Decisions

<!-- Decisions made or changed during implementation — especially any not
     captured in the decision record. Each: the decision + the why, and the
     refuted viable alternative if one existed (C1/G2 guardrail: no strawmen).
     This is the distiller's "why" source for the Decision Log. -->

- {{DECISION_AND_WHY}}

## Deviation Rationale

<!-- The output of the close-from-diff forcing function: for EACH deviation the
     diff showed against the decision record, why it happened. Only deviations
     go here — matched work needs no entry. -->

- **{{DEVIATION}}:** {{WHY_IT_DEVIATED}}

## Deferred Scope

<!-- Pointer only. The scope itself is appended to the feature backlog. -->

Deferred items appended to: `docs/features/{{FEATURE}}/backlog.md`

## Process Lesson

<!-- Pointer only. The lesson is its own file. -->

Recorded in: `docs/delivery/lessons/{{YYYY-MM-DD}}-{{SLUG}}.md`
