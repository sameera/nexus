---
title: "Stub Promotion"
aliases: ["stub promotion", "promote a stub", "plan a stub in place", "stub successors", "oversized stub"]
touches: ["backlog-stub", "epic-approval-gate", "epic-issue-filing", "initiative"]
last_updated_by: "#705"
status: active
verification: verified
---

# Stub Promotion

Stub promotion plans an epic stub on the same issue it was filed under. Planning fills in that issue, files its story children beneath it, and clears the unplanned label. Nothing is created and nothing is closed, so the number the scope was deferred under is the number it ships under.

## How It Works

The lead promotes a stub by running the epic stage on its issue number. The stub re-enters the approval gate like any other intent. On approval, the single-issue filing path edits the stub in place and clears its unplanned label.

A stub that proves larger than one epic is not planned. It is closed as not planned, and its closing names the successor stubs filed in its place.

A stub that sits under an initiative is promoted by exactly the same steps. Promotion never detaches the stub, moves it, or edits the initiative, so the planned epic stays a child of that initiative. Its stories and its decision record are filed under the epic, as for any epic. When that stub proves larger than one epic, its successors are filed as children of the same initiative. No new objective is proposed for them, and the initiative's body is not edited.

## Key Invariants

1. Promotion populates the same issue and clears the label. It never creates a second issue and never closes the stub.
2. A stub too large for one epic is closed as not planned naming its successors, never as completed.
3. Promoting a stub under an initiative takes the same steps as any other promotion, and never detaches the stub, moves it, or edits the initiative.
4. The successors of a split stub under an initiative become children of that same initiative, and no objective is proposed for them.

## Integration Points

- [backlog-stub](backlog-stub.md) — the unplanned epic this stage plans, whose number survives promotion.
- [epic-approval-gate](epic-approval-gate.md) — the gate a promoted stub re-enters, which offers its successors only the flat filing.
- [epic-issue-filing](epic-issue-filing.md) — the single-issue path that edits the stub in place and clears its unplanned label.
- [initiative](initiative.md) — the parent a promoted stub keeps, and the parent its successors join.

## Decision Log

### 2026-10-10 — #705 — split from backlog-stub, and successors join the stub's initiative

This page was split from backlog-stub when that page passed the word cap. It holds how a stub is planned in place and how a stub too large for one epic is closed. Work on promotion loads this page, and work on filing or deferring stubs loads backlog-stub. The epic that forced the split also added one rule here. When a promoted stub under an initiative proves larger than one epic, its successors join the same initiative, because they serve the objective the original served. Filing them flat would remove them from the only place a lead looks for the set. A second initiative would split one objective across two parents. Refuted alternative: file the successors flat and leave the initiative alone. This keeps the initiative's children and its body consistent. It lost because the successors disappear from the grouping.
