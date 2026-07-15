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

RANGE STAMPING (unconditional — every mode)
    The range records the exact diff /nxs.close derived: git diff <base>...<head>
    in the named repo reproduces the epic's landed change. It is a LIST (one
    entry per touched repo); a single-code-repo epic populates exactly one.
    Full SHAs only — symbolic refs stop resolving once the branch is deleted.
    After a workspace migration this range is the only thing the hub-side
    drain can recompute the diff from.

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
analyze: {{ANALYZE_STATUS}}     # conformance gate: "ran <date> @ <sha>" or the recorded waiver
range:                          # exact diff range of the landed change — one entry per touched repo
  - repo: {{REPO_IDENTITY}}     # normalized code-repo identity (host/owner/repo), from the close preflight
    base: {{BASE_SHA}}          # FULL commit SHA of the merge-base the branch forked from — never a ref
    head: {{HEAD_SHA}}          # FULL commit SHA of the branch head the close-from-diff pass diffed — never HEAD/main
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
