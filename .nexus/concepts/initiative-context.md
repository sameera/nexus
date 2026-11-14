---
title: "Initiative Context"
aliases: ["initiative context", "kept context", "context summary", "context pointer", "context lookup", "attached plan", "design plan", "initiative context store", "context part", "collapsed context block", "part record", "legacy folder pointer"]
touches: ["initiative", "stub-promotion", "decision-record", "citation-check", "epic-approval-gate", "reading-list"]
last_updated_by: "#1011"
status: active
verification: verified
---

# Initiative Context

An initiative context is the planning context kept for one initiative, on the initiative issue itself. It sits either all in the initiative body, collapsed below a short summary, or all in numbered comments on the initiative, never split between the two. Stub planning and epic design read it from the issue, so settled decisions are not made again.

## How It Works

On accept, the run joins what the gate showed, every resolved discovery decision with its reasoning, and the attached plan. If the body fits the issue limit with room for the later edit, the context stays there. Otherwise each slice is posted as a comment whose hidden first line gives its number and the total. The body also records a hash of the collapsed context or of each part. A repeated run never posts a part twice, and each posted part is read back.

Both readers share one lookup that reads only the issue. It sets aside and names comments from authors who cannot speak for the repository. Planning treats the context as part of what the lead asked for; the design stage treats it as decisions already settled.

## Key Invariants

1. Nothing is kept before the lead answers the consent choice, and a declined or flat filing keeps no context anywhere.
2. Every sentence of context the run wrote itself was shown at the consent choice. The lead's typed capability description is never kept.
3. The context lives only on the initiative issue. No stage writes or reads a context folder in the repository, and a repeated run posts no part twice.
4. An attached plan is kept word for word, and only when an initiative is filed. A missing or empty plan is refused before anything is drafted.
5. A missing part, a part or collapsed context whose hash no longer matches, an unreadable comment list, or a body that still names a context folder stops planning and design before drafting, naming the initiative and the part or folder.
6. Work the context assigns to a sibling stub goes to Out of Scope and never becomes a story or a deferred stub.
7. No part of the context is copied into a filed issue body or comment. In the record, a settled decision with no reasoning becomes an open clarification, and the epic wins a disagreement.

## Integration Points

- [initiative](initiative.md) — the parent issue that carries the context in its body or in numbered comments.
- [stub-promotion](stub-promotion.md) — reads the context into the planning run's source text, bounded by the stub's own goal.
- [decision-record](decision-record.md) — reads the context before analysing, as decisions already settled.
- [citation-check](citation-check.md) — an item drawn from the context can be cited as asked, because the context joins the source text.
- [epic-approval-gate](epic-approval-gate.md) — the consent choice that shows the summary, the split reasoning and the deferred scope before anything is kept.
- [reading-list](reading-list.md) — built for a promoted stub from the stub body and the draft, never from the context.

## Decision Log

### 2026-11-09 — #850 — A long planning session's reasoning travels with its initiative

A decomposition used to file stubs that carried a one-line goal, an estimate and candidate story titles. The decisions, deferrals and split reasoning of the session were lost, so each stub was planned from its short body and settled decisions were made again. The initiative already sits above every stub of the set, so it now keeps that context. A full plan does not fit in an issue body, so the body carries a summary and the full text lives in a committed folder named for the initiative's number. That name lets both readers find it by convention, and lets a lead write one by hand for an older initiative. Only text the lead supplied or saw at the gate is kept, because a later promotion cites the context as asked, and unseen model prose would become the lead's request. A pointer with no folder stops the run, because the usual cause is a copy not yet committed or pulled, and planning on would silently re-derive the decisions. Refuted alternative: keep the context in a marked comment on the initiative issue, as discovery decisions are kept. It lost on size, because a comment has the same limit as a body.

### 2026-11-14 — #1011 — The context moves from a committed folder onto the initiative issue

The committed folder was meant to be removed when the initiative's last child closed, which would leave the body's pointer naming nothing. Teammates also could not see the folder until the lead pushed it. The context now lives on the issue: all in the body when it fits, otherwise all in numbered comments, so the reader has two cases and one hash scheme. A hidden number on each part sets the order, because a repeated run may post a missing middle part last. The body records each part's hash at filing, and the reader checks it, because the platform's edited marker cannot be read reliably and the run's own stub-number edit marks the body as edited. Trust reuses the owner, member and collaborator rule close applies, so there is one trust rule. A body that still names a folder stops the run; the folder is never read as a fallback. #997 was moved by hand, and the folder store was deleted. Refuted alternative: publish the context as a file in the issue asset store, linked at a pinned commit. It lost because that store is optional, and the link would again point at a file the reader must reach.
