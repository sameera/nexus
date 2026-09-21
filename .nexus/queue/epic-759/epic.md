---
feature: "Scope Discipline"
feature_path: docs/features/scope-discipline
epic: "The Razor Check Reads a Decision Record as a Decision Record"
slug: razor-check-record-headings
created: 2026-09-21
type: enhancement
complexity: S
complexity_drivers: [one checker adopts the story definition its sibling already uses, inside a checker four stages share]
concepts: [scope-razor, decision-record]
link: "#759"
---

# Epic: The Razor Check Reads a Decision Record as a Decision Record

## Description

Four stages share one razor checker, and it has one idea of what a third-level heading means. An epic writes its user stories as third-level headings, and every such heading must carry a provenance label. A decision record writes its decisions as third-level headings too, and the razor states outright that a decision carries no label. The checker applies the epic's rule to both.

So the decision-record stage prescribes a check that blocks every record it is run on. A record with six decisions produces six blocking findings, one per decision, and the stage's instruction to fix what blocks before going on cannot be satisfied: the only way to clear them is to label something the razor forbids labelling. The stage has no gate agent, so this check is the only mechanical check its drafts get, and it currently passes none of them.

The sibling check already solves this. The ordering check asks whether the draft declares any story, and skips when it declares none, because a draft with no story is not an epic draft. Its definition of a story is a heading that names one. The story check walks third-level headings instead, and so has no such guard.

## Success Metrics

- A decision-record draft that states decisions raises no finding about those decisions.
- An epic draft raises exactly the findings it raises today.
- The record checkpoint's checklist and the razor check agree on which headings in a record are decisions.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

A decision record passes the razor check its own stage prescribes

## User Stories

### Story #760: A decision record passes the razor check its own stage prescribes

- **story_type:** system
- **size:** S

**As a** delivery lead drafting a decision record, **I want** the check my stage prescribes to read my decisions as decisions, **so that** I can satisfy it without labelling something the razor forbids labelling.

## Acceptance Criteria

- [ ] **Given** a decision-record draft whose decisions are third-level headings, **when** the razor check runs against it with its source text, **then** it raises no provenance-label finding for any decision heading.
- [ ] **Given** that same draft, **when** the razor check runs, **then** it reports every other finding the draft warrants, a quoted fragment that is not in the source text included.
- [ ] **Given** an epic draft, **when** the razor check runs, **then** every story heading and every acceptance criterion is still required to carry a provenance label.
- [ ] **Given** a draft that declares no story, **when** the razor check runs, **then** it raises no finding that assumes the draft declares one.

## Notes

The fix the source text points at is that the story check adopts the story definition the ordering check already uses, rather than growing a guard of its own.

Reported as #752.

## Assumptions

- The record checkpoint's checklist keeps reading a record's third-level headings as decisions. This epic changes the razor check to agree with it, not the reverse.

## Out of Scope

- The record filed as #750, and any record already approved while this defect was live. Re-checking one is the lead's action.
- What the razor's rules are. This epic changes which drafts a rule is applied to, never the rule.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #760 | none |
