---
title: "Record Revision"
aliases: ["record revision flow", "reopen and revise", "record amendment", "advisory amendment comment"]
touches: ["decision-record"]
last_updated_by: "#1041"
status: active
verification: verified
---

# Record Revision

An approved decision record changes in only two ways. Before implementation, the design stage reopens it, revises the body and closes it again. After the code ships, close may post one advisory comment when the diff no longer holds a decision.

## How It Works

Once approved, the record can still be corrected without being edited. When close's diff shows a decision it no longer holds, close posts one advisory comment naming the decision, what shipped, and why. A conformant close posts nothing. A change made before implementation instead reopens and revises the record directly.

## Key Invariants

1. A closed body is editable only by reopen-and-revise.
2. An advisory comment never touches the body, title, labels, or state.
3. Every revision embeds the superseded body and hash.

## Integration Points

- [decision-record](decision-record.md) — the approved record these two paths change after its approval.

## Decision Log

### 2026-11-22 — #1041 — Split from decision-record

Epic #1041 added an as-built mode and an as-built approver to decision-record and took its own content over the word cap. How an approved record changes afterwards moved here: reopen-and-revise before implementation, close's advisory comment after it, and the invariant that governs both. A task that revises or amends a record does not need the drafting and checkpoint rules, and a task that files or approves one does not need these. The behaviour did not change.
