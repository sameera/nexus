---
title: "Pipeline Store Exclusion"
aliases: ["excluded stores", "withheld stores", "behavioural diff exclusion", "pipeline store set", "what a stage never reads back"]
touches: ["committed-queue", "pre-epic-discovery", "workbook-store", "distiller", "conformance-gate", "durable-close-record", "aggregated-epic-receipt"]
last_updated_by: "#212"
status: active
verification: verified
---

# Pipeline Store Exclusion

Some folders under the Nexus root are surfaces the pipeline writes or teaches from, never behaviour it reads back, so every stage that derives a diff withholds all of them. The set is closed, reviewed, and stated exactly once: code consumers read that one definition and a command body asks the executable for it, so no two statements of it can disagree. Each member is withheld entire, and no marker file lets a directory opt itself out.

## How It Works

Three stores are members: the close-time queue, the pre-epic discovery store, and the workbook a learner reads. Each member carries the reason it belongs, so membership is reviewable rather than a bare path. Analyze, close and distill all derive their diff from that one set. The exclusion used to be written twice, once in the code that derives a workspace's cross-repo diff and once as prose in the distill command, while analyze and close withheld nothing at all. A lead running either of those two against a branch that also touched a queue entry saw planning prose presented as shipped behaviour. A command body no longer lists the paths. It asks the toolkit for them, and a test fails when any body restates one. Adding a store is therefore a code change that appears in a diff. That is the point: a marker file anyone could drop would let a directory hide real application source from a gate, and the failure would be invisible, because the diff simply gets smaller.

## Key Invariants

1. The set has exactly one definition. Every consumer, code or command prose, derives its exclusions from that definition, and a test fails when two statements of it disagree.
2. Analyze, close and distill exclude the same set.
3. A store is withheld entire. No consumer excludes a slice of one.
4. Membership is closed and reviewed. No marker file or discovered convention lets a directory opt itself out of a stage's diff.
5. Every member states why a stage must not read it back as behaviour.
6. The exclusion removes no application source from any stage's diff.
7. The set renders in a stable order, so every statement of it is byte-identical run to run.

## Integration Points

- [committed-queue](committed-queue.md) — a member: an entry's own artifacts are the distiller's input, not behaviour it reads back.
- [pre-epic-discovery](pre-epic-discovery.md) — a member: a discovery folder holds in-flight reasoning no human gate has passed.
- [workbook-store](workbook-store.md) — the third member, and the store this set was named once for.
- [distiller](distiller.md) — derives its behavioural diff from this one definition rather than restating the store paths.
- [conformance-gate](conformance-gate.md) — analyze now draws its verdict from a diff with every member withheld; it withheld none before.
- [durable-close-record](durable-close-record.md) — close derives its deviation rationale from the same filtered diff.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — withholds every member of the set from each per-pull-request change set it unions into the epic's combined code.

## Decision Log

### 2026-09-07 — #405 — One definition of the stores a stage never reads back

The exclusion was stated twice before this epic and applied by one stage of three, which is two ways for it to be wrong. Naming the set once, with a reason recorded per member, makes a disagreement impossible rather than unlikely. A stage that quietly reads generated markup as shipped behaviour fails silently, because the diff only gets smaller. Refuted alternative: a discovered convention, where a marker file in any directory opts that directory out. It needs no code change for a fourth store, and an adopter could exclude their own generated trees, but a marker anyone can drop can hide real application source from a gate. A closed, reviewed set keeps what a stage is allowed not to see a deliberate decision that appears in a diff.

### 2026-09-10 — #212 — Reciprocal link from aggregated-epic-receipt

Mechanical reciprocity fan-out: the epic's combined code is a union of per-pull-request change sets, and each of those change sets withholds the whole set through the one shared definition rather than a locally written path list.
