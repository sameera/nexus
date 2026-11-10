---
title: "Initiative Context"
aliases: ["initiative context", "kept context", "context summary", "context pointer", "context lookup", "attached plan", "design plan", "initiative context store"]
touches: ["initiative", "stub-promotion", "decision-record", "pipeline-store-exclusion", "citation-check", "epic-approval-gate", "reading-list"]
last_updated_by: "#850"
status: active
verification: verified
---

# Initiative Context

An initiative context is the planning context kept for one initiative, in a committed folder named for the initiative's issue number. The initiative body carries a short summary of it and one sentence naming that folder. Planning a stub under it and designing the resulting epic both read it, so settled decisions are not made again.

## How It Works

At the decomposition's consent choice the lead sees the context summary, the reasoning behind the split, the deferred scope and the name of any attached design plan. On accept, the run files the initiative, writes the context into its folder, and fills the issue number into the pointer sentence in its one edit of the initiative body. The context holds only what the gate showed, every resolved discovery decision with its reasoning, and the attached plan. The lead commits the folder; the run commits nothing.

Both readers find the context with one lookup. It reads the issue's parent, checks its initiative marker, then reads the body and every file in the folder in name order. A folder written by hand is read the same way. Planning treats the context as part of what the lead asked for, within the stub's own goal. The design stage treats it as decisions already settled.

## Key Invariants

1. Nothing is kept before the lead answers the consent choice, and a declined or flat filing keeps no context anywhere.
2. Every sentence of context the run wrote itself was shown at the consent choice. The lead's typed capability description is never kept.
3. An accepted initiative has exactly one context folder, outside the queue and the discovery store, and a repeated run files no second initiative.
4. An attached plan is kept byte for byte, and only when an initiative is filed. Otherwise the run says it was kept nowhere. A missing or empty plan is refused before anything is drafted.
5. When the initiative body names a context that the checkout lacks, planning and design stop before drafting and name the expected folder.
6. Work the context assigns to a sibling stub goes to Out of Scope and never becomes a story or a deferred stub.
7. No part of the context is copied into a filed issue body or comment. In the record, a settled decision with no reasoning becomes an open clarification, and the epic wins a disagreement.

## Integration Points

- [initiative](initiative.md) — the parent issue whose body carries the context summary and the pointer sentence.
- [stub-promotion](stub-promotion.md) — reads the context into the planning run's source text, bounded by the stub's own goal.
- [decision-record](decision-record.md) — reads the context before analysing, as decisions already settled.
- [pipeline-store-exclusion](pipeline-store-exclusion.md) — the context store is a member, so no stage reads a kept plan back as shipped behaviour.
- [citation-check](citation-check.md) — an item drawn from the context can be cited as asked, because the context joins the source text.
- [epic-approval-gate](epic-approval-gate.md) — the consent choice that shows the summary, the split reasoning and the deferred scope before anything is kept.
- [reading-list](reading-list.md) — built for a promoted stub from the stub body and the draft, never from the context.

## Decision Log

### 2026-11-09 — #850 — A long planning session's reasoning travels with its initiative

A decomposition used to file stubs that carried a one-line goal, an estimate and candidate story titles. The decisions, deferrals and split reasoning of the session were lost, so each stub was planned from its short body and settled decisions were made again. The initiative already sits above every stub of the set, so it now keeps that context. A full plan does not fit in an issue body, so the body carries a summary and the full text lives in a committed folder named for the initiative's number. That name lets both readers find it by convention, and lets a lead write one by hand for an older initiative. Only text the lead supplied or saw at the gate is kept, because a later promotion cites the context as asked, and unseen model prose would become the lead's request. A pointer with no folder stops the run, because the usual cause is a copy not yet committed or pulled, and planning on would silently re-derive the decisions. Refuted alternative: keep the context in a marked comment on the initiative issue, as discovery decisions are kept. It lost on size, because a comment has the same limit as a body.
