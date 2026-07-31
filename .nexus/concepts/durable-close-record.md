---
title: "Durable Close Record"
aliases: ["close comment", "durable close rationale", "close machine block", "closing rationale"]
touches: ["ephemeral-handoff-entry", "committed-queue", "distiller", "conformance-gate", "record-digest"]
last_updated_by: "#170"
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
3. It stamps the record reference and hash, the conformance verdict, and the landed range in a marker-anchored block.
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

## Decision Log

### 2026-07-31 — #170 — The epic issue's close comment is the durable close record

Promoting the close comment from an incidental side effect to the definition of the durable record is what lets the close-record file become disposable hand-off content: the comment already ran in every mode and already inlined the closing prose, so the unrecoverable-local-entry problem resolves without inventing a surface. A small stamped block was added beside the prose because prose cannot recover the landed range, the record hash, or the conformance verdict — facts a later drain needs and that are authoritative rather than recomputable; the same shape already appears on published conformance reviews, and stamping it here is a deliberate exception to keeping machine blocks off human surfaces, justified because the human has just approved these facts at the closure checkpoint. Refuted alternative: keep the file as the durable artifact and commit it in local mode too, mirroring the born-at-close mechanism the pull-request flow uses — it reuses a mechanism that already exists and needs no fallback path at all, but the local flow has no pull request of its own to carry that commit to the trunk, so it either forces a manual commit and push of a throwaway file, the exact friction this removes, or invents a second distillation-branch flow for the non-pull-request path.
