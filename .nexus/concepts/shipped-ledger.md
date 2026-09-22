---
title: "Shipped Ledger"
aliases: ["shipped record", "what an epic shipped", "ledger of what shipped", "per-pull-request record", "epic-issue record", "shipped coverage states"]
touches: ["conformance-gate", "multi-pr-close", "aggregated-epic-receipt", "durable-close-record", "pr-driven-flow", "remote-identity-normalization"]
last_updated_by: "#769"
status: active
verification: verified
---

# Shipped Ledger

What an epic shipped is written on the epic issue at the moment it ships, and read back from there. Each merged pull request gets its own record naming the story it implements, the repository it merged in, its merge commit and the commit range it covers. Every later gate reads those records instead of searching repositories, reading published reviews, or asking what a branch looks like now.

## How It Works

The conformance gate writes a record only against a merged pull request, because the merge commit and its range do not exist before the merge. A run against an open pull request publishes its review for the engineer and writes nothing. The record's identity is the pull request, so a re-run replaces that one record and leaves every other untouched, and two runs minutes apart cannot overwrite each other.

Because the record carries the range, a later reader never needs a copy of the repository the code merged in. The one live question left is whether the platform still reports the same merge commit for that pull request. A moved merge commit is a hard block, because the recorded range then describes commits that are not on the trunk.

Addressed at an epic, the gate reports each story as shipped, unrecorded, unshipped or excluded, re-reading the live story set each run. Unrecorded and unshipped stay apart because their remedies differ: a merge that skipped the gate, or work not yet done.

## Key Invariants

1. A record is written only for a merged pull request; an open one produces a review and no record.
2. Exactly one record exists per code repository and pull-request number, and a re-run replaces that record alone.
3. A record is trusted only when its author can speak for the repository the epic issue lives in; an untrusted record is named rather than ignored.
4. The range a record carries comes from the one merge-anchored derivation, and every later stage stamps it rather than recomputing it.
5. The record's identity is the pull request, never the story, so a story that shipped twice contributes both and neither displaces the other.
6. Findings are summed once per record, so a record naming two stories counts once.
7. Records of one story in one repository are ordered by the merge time each stamped, so ordering never needs that repository.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate that writes a record, and the run whose findings each record carries.
- [multi-pr-close](multi-pr-close.md) — reads merge state and the close range from these records rather than from live pull-request state.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — the receipt shape whose story-to-pull-request answer these records replaced.
- [durable-close-record](durable-close-record.md) — stamps the range these records carry onto the epic issue, verbatim.
- [pr-driven-flow](pr-driven-flow.md) — the flow whose post-merge conformance run is what writes a record at all.
- [remote-identity-normalization](remote-identity-normalization.md) — the rule by which a record names its code repository, so two readers cannot disagree about which repository it stamps.

## Decision Log

### 2026-09-22 — #769 — What an epic shipped is recorded where it shipped, not rediscovered

The list of what an epic shipped was rebuilt from scratch on every gate run, and it came back wrong four ways: a story's pull requests were searched for only in repositories the lead happened to hold, merge state was asked of the wrong repository so merged work read as unmerged, one pull request per story was kept so a later fix displaced the feature it fixed, and the analysed commit was compared against a branch that kept moving and called stale. Each made a gate state something false that a person then had to overrule. All four fall out of the same omission: nobody wrote the fact down while it was cheap and certain. A record per merged pull request, on the issue that owns the work, written by the run holding the merged code, removes the search, the wrong-repository question, the per-story slot a second pull request could evict, and the staleness axis at once. Keying on the pull request rather than the story is what makes displacement unrepresentable rather than guarded against. Refuted alternative: one ledger comment per epic holding every entry, rewritten on each run. It reads better, because one fetch answers the whole epic and ordering is trivial. It loses because every write becomes a read-modify-write over shared state, so two gate runs minutes apart silently drop one of the two records, which is the class of failure this exists to end. Refuted alternative: write the record before the merge from the head commit and amend it at merge. That keeps the lead to one gate run per pull request. It loses because nothing in this pipeline runs at merge time, so the amendment has no owner and every reader would have to handle a permanently provisional record.
