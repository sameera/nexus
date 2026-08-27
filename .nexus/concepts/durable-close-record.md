---
title: "Durable Close Record"
aliases: ["close comment", "durable close rationale", "close machine block", "closing rationale"]
touches: ["ephemeral-handoff-entry", "committed-queue", "distiller", "conformance-gate", "record-digest", "backlog-stub", "writer-stamp"]
last_updated_by: "#251"
status: active
verification: verified
---

# Durable Close Record

The durable copy of a close's rationale is the comment the close stage posts on the epic issue, in every mode; the close-record file is a hand-off copy carrying no durability obligation. The comment inlines the closing prose in full beside a stamped block of the facts prose cannot recover, making the issue a complete substitute for the file.

## How It Works

The close stage always posted its rationale onto the epic issue; that side effect is now the definition. The comment inlines the key decisions and the deviation rationale verbatim. Beneath the prose sits a marker-anchored block stamping what prose cannot recover: the decision record's reference and full approved-body hash, the conformance verdict including any waiver, and the full-revision range of the landed change. A queue or ephemeral location would dangle the moment the entry is consumed, so the comment links only durable targets. Because the rationale may exist nowhere else, a failed post is not tolerated: the run preserves the composed body, leaves the epic issue open, and ends with an explicit retry instruction rather than reporting success. A drain that has lost its local entry rebuilds one from this comment.

## Key Invariants

1. The single durable copy of a close's rationale is the comment on the epic issue, in every mode.
2. The comment inlines the key decisions and deviation rationale in full; nothing is thinned because the mirrored file is disposable.
3. It stamps the record reference and hash, the conformance verdict, the landed range, and which release wrote it, in a marker-anchored block — the writer beside the hash, never inside the bytes it covers.
4. The stamped range is the exact range the close diffed, never recomputed afterwards.
5. A failed post preserves the body, leaves the epic issue open, ends with a retry instruction, and never reports success.
6. The comment links only durable targets, never a queue or ephemeral location.
7. An epic issue carrying no trusted close comment cannot be recovered from and is a named hard block.

## Integration Points

- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — the disposable copy this comment makes safe to discard.
- [committed-queue](committed-queue.md) — the entry whose close-record file this comment supersedes as the durable copy.
- [distiller](distiller.md) — rebuilds a lost entry's rationale, record reference, and range from this comment.
- [conformance-gate](conformance-gate.md) — the verdict, waiver included, that the stamped block carries onto the issue.
- [record-digest](record-digest.md) — the approved-body hash stamped in full beside the record reference.
- [backlog-stub](backlog-stub.md) — the deferred-scope issues filed before this comment is composed, whose numbers and backlog query it then carries.
- [writer-stamp](writer-stamp.md) — the record of which release wrote this comment's block and the mirrored file, placed beside the record hash rather than inside it.

## Decision Log

### 2026-07-31 — #170 — The epic issue's close comment is the durable close record

Promoting the close comment from an incidental side effect to the definition of the durable record is what lets the close-record file become disposable hand-off content: the comment already ran in every mode and already inlined the closing prose, so the unrecoverable-local-entry problem resolves without inventing a surface. A small stamped block was added beside the prose because prose cannot recover the landed range, the record hash, or the conformance verdict — facts a later drain needs and that are authoritative rather than recomputable; the same shape already appears on published conformance reviews, and stamping it here is a deliberate exception to keeping machine blocks off human surfaces, justified because the human has just approved these facts at the closure checkpoint. Refuted alternative: keep the file as the durable artifact and commit it in local mode too, mirroring the born-at-close mechanism the pull-request flow uses — it reuses a mechanism that already exists and needs no fallback path at all, but the local flow has no pull request of its own to carry that commit to the trunk, so it either forces a manual commit and push of a throwaway file, the exact friction this removes, or invents a second distillation-branch flow for the non-pull-request path.

### 2026-08-06 — manual — Reciprocal link from backlog-stub

Mechanical reciprocity fan-out: the backlog-stub page names the ordering this comment imposes — deferred scope is filed as stub issues after the checkpoint and before the comment is composed, because the comment carries those numbers and the backlog query that finds them. Declared by hand because both epics involved had already drained; the edge was dropped at distillation only because a reciprocal bullet did not fit under the pre-#220 body cap.

### 2026-08-26 — #251 — The stamped block records its own writer

The close comment's machine block and the mirrored close-record file now record which release wrote them, so a later change to how these facts are written is detectable instead of silently invalidating closes already in flight. The record sits beside the record hash, never inside the bytes that hash covers, so stamping leaves every value a later stage verifies exactly as it was. It is written even when the project's own record template — a tuned file that seeding never overwrites — predates the field and carries no placeholder for it: the command's field list is authoritative, not the template's. Where the release cannot be resolved the field is omitted rather than defaulted, because an absent record already reads as an unknown writer. Refuted: writing the field only when the template offers a placeholder, which would leave every project that tuned its template silently unstamped.
