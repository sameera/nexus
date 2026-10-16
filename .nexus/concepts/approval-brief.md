---
title: "Approval Brief"
aliases: ["approval brief", "brief groups", "Before implementation", "Delivered by another epic", "Committed follow-up", "accepted outside-epic dependency"]
touches: ["decision-record", "razor-enforcement"]
last_updated_by: "#934"
status: active
verification: verified
---

# Approval Brief

The approval brief is the opening section of a decision record. It lists what the approver must decide and what waits on whom. It places every ADDRESS risk in one group, chosen by who delivers the risk's mitigation, so "Before implementation" lists only work this epic's own team must finish before its first story.

## How It Works

The brief has five groups that place an item: Resolve before approval, Choices with trade-offs, Before implementation, Delivered by another epic, and Committed follow-up. An ADDRESS risk goes to the first group whose rule it meets.

A risk whose mitigation another epic delivers goes to Delivered by another epic when the risk's own text says the owner accepts the gap until that epic ships. Without that acceptance, the risk goes to Resolve before approval, and the approver accepts the gap or changes the plan. Before implementation keeps only a plan this epic's team has not yet made and must make before its first story. Committed follow-up keeps a decided mitigation that a story of this epic or existing behaviour delivers.

An unattended implementation run does the Before implementation items before the first story. It leaves the Delivered by another epic and Committed follow-up items alone.

A revision rebuilds the brief under these rules, whatever groups the approved body used. Moving a risk between groups changes no decision.

## Key Invariants

1. An ADDRESS risk listed in more than one placing group blocks filing. A risk listed in no group still passes.
2. Before implementation lists only work this epic's team must finish before its first story.
3. A risk that another epic delivers is listed under Delivered by another epic only when its own text says the owner accepts the gap. Otherwise it is listed under Resolve before approval.
4. A revision that only moves risks between groups names each moved risk and the group it left, and marks no decision as changed or withdrawn.
5. Only the five placing groups count as listings. A revision-delta line that names a moved risk is not a listing.

## Integration Points

- [decision-record](decision-record.md) — the opening section of the record; the design stage drafts it at filing and rebuilds it on a revision.
- [razor-enforcement](razor-enforcement.md) — the shared checker blocks an ADDRESS risk listed in two placing groups.

## Decision Log

### 2026-10-16 — #934 — A brief group for accepted outside-epic dependencies

The brief listed every ADDRESS risk whose mitigation was a plan not yet made under Before implementation. Some of those risks waited on another epic, and the owner had already accepted the gap until that epic shipped. An unattended implementation run read such a risk as work to do first, could not finish it, and stopped before the first story every time. The brief now has a Delivered by another epic group for these risks. A risk another epic delivers without the owner's stated acceptance goes to Resolve before approval instead, so the approver decides it. The shared checker blocks a risk listed in two groups but still passes a risk listed in none, because approved records and earlier drafts never listed every ADDRESS risk. It counts only the five placing groups, because a revision must name each risk it moved without that name counting as a second listing. Refuted alternative: widen Committed follow-up to take accepted outside-epic risks. It saves a group, but Committed follow-up means the mitigation is decided, and the other epic's mitigation is often not planned yet.
