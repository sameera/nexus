---
feature: "Scope Discipline"
feature_path: docs/features/scope-discipline
epic: "A Coherent Decomposition Files an Initiative"
slug: coherent-decomposition-initiative
created: 2026-09-20
type: enhancement
complexity: M
complexity_drivers: [one new issue kind above the epic, a judgment gate the lead must be able to decline, an existing filing refusal that has to narrow without opening the deadlock it prevents]
concepts: []
link: "#705"
record: "#786"
record_state: closed
---

# Epic: A Coherent Decomposition Files an Initiative

## Description

When an oversized capability is decomposed, `/nxs.epic` files one stub issue per functional goal and stops. The stubs land as a flat set of open issues. Nothing on any of them says what they add up to, which one comes first, or how much of the larger goal is reached once a given one ships. The lead who ran the decomposition holds that answer in their head on the day, and loses it by the time the first stub is promoted.

This epic gives that set a parent. When the stubs of one decomposition genuinely serve a single objective, the lead is asked to confirm that objective, and the run files one parent issue that states it. The parent issue carries the order the stubs are meant to run in, and, against each one, what implementing it gets you toward the objective. It does not restate the list of children, because GitHub already shows that. Each stub becomes a child of that parent, so the grouping is a fact about the issues rather than a sentence in a body that has to be maintained.

A stub is the epic issue before anyone has planned it, and it keeps its number when it is planned, so the children this epic files under an initiative are stubs on the day and epics later. This document says "stub" for the issue as filed and "epic" for the same issue once it is planned.

The condition is the point. Stubs are also filed to defer work nobody has decided on yet, and a set filed for that reason has no shared objective to state. Inventing one would be the speculative over-generation the pipeline exists to refuse. So the objective is proposed to the lead and the lead can decline it, and a run that files a single deferred stub never proposes one at all.

## Success Metrics

- A lead who reads only the parent issue can name the objective and say which stub comes next, without opening any child issue.
- A decomposition whose stubs share no single objective files exactly the issues it files today, and no additional issue.
- Promoting a stub that sits under an initiative takes the same steps as promoting one that does not.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The lead decides whether a decomposition serves one objective; The initiative states the objective, the order, and what each epic reaches; Every stub in a coherent decomposition hangs under its initiative

## User Stories

### Story #706: The lead decides whether a decomposition serves one objective

- **story_type:** user
- **size:** S

**As a** lead decomposing an oversized capability, **I want** to be asked whether the stubs about to be filed serve one objective, **so that** a set filed only to defer work is not tied under an objective nobody actually holds.

#### Acceptance Criteria

- [ ] **Given** a decomposition in `/nxs.epic` is about to file more than one stub, other than the successors of a stub that already sits under an initiative, **when** the lead is asked to consent to the filing, **then** a proposed objective for the set is shown alongside the stubs and the lead accepts or declines it before anything is created.
- [ ] **Given** the lead declines the proposed objective, **when** the stubs are filed, **then** they are filed exactly as they are filed today and no parent issue is created.
- [ ] **Given** a run is filing a single stub for scope the lead chose to defer, **when** that stub is filed, **then** no objective is proposed and no parent issue is created.
- [ ] **Given** a decomposition that produced exactly one goal, **when** its stub is filed, **then** no objective is proposed and no parent issue is created.

#### Notes

Declining is not an error and needs no reason. The proposed objective is the drafting model's reading of the set, and this criterion is the one place the lead can reject that reading.

### Story #707: The initiative states the objective, the order, and what each epic reaches

- **story_type:** user
- **size:** M

**As a** lead returning to a decomposition weeks later, **I want** the parent issue to say what the set is for and what each stub moves it toward, **so that** I can pick the next stub to promote without reopening the reasoning that produced the split.

#### Acceptance Criteria

- [ ] **Given** the lead accepted the proposed objective, **when** the set is filed, **then** a parent issue is created, labelled as an initiative, whose body states the objective that completing the stubs achieves.
- [ ] **Given** the initiative issue exists, **when** its body is read, **then** it names the stubs in the order they are meant to be executed.
- [ ] **Given** the initiative issue exists, **when** its body is read, **then** each stub in that order carries a statement of how much of the objective is reached once that stub is implemented.
- [ ] **Given** the initiative issue exists, **when** its body is read, **then** it holds no table listing its child issues.

#### Notes

The order in the body and the order the stubs already carry between themselves describe the same sequence. The body states it in prose because a reader of the objective needs it there; the stubs keep their own ordering because that is what a later run reads.

### Story #708: Every stub in a coherent decomposition hangs under its initiative

- **story_type:** user
- **size:** S

**As a** lead browsing the backlog, **I want** each stub of a coherent decomposition to sit under its initiative, **so that** the grouping is visible where the issues are, and the initiative body never has to restate the list.

#### Acceptance Criteria

- [ ] **Given** the lead accepted the proposed objective, **when** the set is filed, **then** every stub in that set is a child of the initiative issue.
- [ ] **Given** a stub that sits under an initiative, **when** the lead later plans it, **then** planning proceeds exactly as it does for a stub with no parent, and the resulting epic stays under the same initiative.
- [ ] **Given** a stub asking to sit under an epic rather than an initiative, **when** the set is filed, **then** the filing is refused and nothing is created.
- [ ] **Given** an epic that sits under an open initiative, **when** the lead closes that epic, **then** closing is not blocked by the initiative still being open.
- [ ] **Given** a stub under an initiative that proves larger than one epic when planned, **when** its successors are filed, **then** each successor is a child of the same initiative and no new objective is proposed.
- [ ] **Given** an issue labelled as an initiative, **when** any stage is run against it as an epic, **then** the stage refuses and names it as an initiative.

#### Notes

The third and fourth criteria preserve a guarantee that already holds. Closing an epic blocks on the epic's own children, so a parent above it must never be mistaken for one.

## Assumptions

- A set of stubs produced by consuming a finished discovery already has one stated outcome it is working toward, so its proposed objective is drawn from that outcome rather than invented afresh.
- Nothing retrofits an initiative onto stubs that were filed before this epic ships.
- An initiative is a planning container only. No code is delivered against the initiative issue itself, and it is never the target of a decision record or a conformance check.

## Out of Scope

- Progress reporting on the initiative issue beyond what GitHub already shows for its children.
- An initiative spanning stubs from more than one decomposition run, other than the successors filed when one of its own stubs is re-decomposed.
- Editing the execution order, the objective, or the per-stub statement after the initiative is filed.
- An initiative sitting under another initiative.
- When and whether an initiative issue closes once the work under it is finished.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #706 | none |
| #707 | #706 |
| #708 | #707 |
