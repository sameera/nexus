---
title: "Close Over Several Pull Requests"
aliases: ["multi-pull-request close", "epic-wide close", "merge gate", "story pull-request set", "range list", "one entry per pull request", "storyless story waiver", "trunk head verification"]
touches: ["aggregated-epic-receipt", "pr-driven-flow", "pr-worktree", "durable-close-record", "distiller", "range-entry-diff", "remote-identity-normalization"]
last_updated_by: "#215"
status: active
verification: verified
---

# Close Over Several Pull Requests

A close is addressed at the epic rather than at one pull request, so an epic whose stories shipped as several pull requests closes in one run. The set of pull requests comes from the epic receipt, every one of them must be merged, and each contributes its own merge-anchored range entry.

## How It Works

The gate runs in a fixed order. Merge state comes first, story by story, against live pull-request state. An unmerged pull request is a hard block naming that pull request and its story, and no waiver is offered. Currency is checked next and keeps its own waiver, because a stale analysis is a judgment the lead may take and an unmerged pull request is not.

A closed story with no pull request of its own also stops the run, and the lead is offered a waiver for that story. Taking the waiver writes the durable marker onto the story issue, after the closure checkpoint, alongside the other writes to GitHub.

Only once every gate passes are the ranges derived, one call per pull request into the existing merge-anchored derivation. Only once every range resolves is the branch cut. Nothing gathers the engineers' notes, because every story branch committed into the same epic-keyed path before the cut.

## Key Invariants

1. Every story's pull request must be merged. An open one is a hard block naming the pull request and its story, with no waiver.
2. The set of pull requests comes from the epic receipt, never from branch names, timelines or searches.
3. A story that shipped inside a sibling's pull request passes only on the lead's explicit waiver. The waiver writes the durable marker after the checkpoint, and the close record names the story and its date.
4. One range entry is stamped per story pull request, anchored on that pull request's own merge and naming its number. Entries are never collapsed per repository.
5. A refusal on any single entry stops the close before a branch is cut, a file is written, or an issue is touched.
6. A commit that reached the trunk outside a story pull request is not in the recorded range.
7. Every gate and every derivation completes before a working tree exists. The branch is cut from a trunk verified to hold every stamped head.

## Integration Points

- [aggregated-epic-receipt](aggregated-epic-receipt.md) — the authoritative record of which story shipped in which pull request. This close reads its set from there, and writes the marker that page defines.
- [pr-driven-flow](pr-driven-flow.md) — the single-pull-request post-merge flow this generalizes. One pull request is now the one-entry case of the same close.
- [pr-worktree](pr-worktree.md) — the worktree now opened once for the whole epic, and only after every gate and every range derivation has passed.
- [durable-close-record](durable-close-record.md) — carries the list-shaped range and every waived story with its date onto the epic issue.
- [distiller](distiller.md) — reads the stamped list later, through the range-entry-diff reader.
- [range-entry-diff](range-entry-diff.md) — the reader that turns this stamped list into one change set per pull request; it replaced the interim refusal this close shipped alongside.

- [remote-identity-normalization](remote-identity-normalization.md) — canonicalizes the repository identity each stamped range entry carries.

## Decision Log

### 2026-09-10 — #213 — Close is addressed at the epic, and every gate runs before any worktree exists

A pull request was only ever a proxy for the epic when there was exactly one of them. Making the single-pull-request close the one-pull-request case of a single flow is what stops a second close mechanism appearing beside the first. The order inverted at the same time, because with several pull requests the coupling between opening the worktree and obtaining the range has no meaning, and keeping it would create and abandon a checkout on every refused close. Refuted alternative: a separate flag for the multi-pull-request case, leaving the single-pull-request flag untouched. That keeps the working path from regressing, but two flags mean two flows, and the flow that runs less often is the one whose gate, range stamp and artifact placement drift silently.

### 2026-09-10 — #214 — Reciprocal link from range-entry-diff

Mechanical reciprocity fan-out: the range-entry-diff page names this close as the writer of the stamped list it reads, and its reader retires the interim refusal this close shipped alongside. Nothing this page already asserted has changed.

### 2026-09-11 — #215 — Reciprocal links: range stamping lands here alone

Mechanical reciprocity fan-out, both directions in one entry. The page that used to own range stamping is retired, so that edge is removed, and this page's own invariant on one entry per pull request is now the store's only statement of the stamped shape. The rule that canonicalizes a repository identity correspondingly records its edge against this close, because this is what stamps the range those identities sit in. Nothing about the stamping itself changed here.
