---
title: "Aggregated Epic Receipt"
aliases: ["epic receipt", "aggregate mode", "story verdicts", "per-story staleness", "combined change set", "no-pull-request marker"]
touches: ["conformance-gate", "pr-driven-flow", "pr-story-resolution", "record-digest", "pipeline-store-exclusion", "workspace-resolution", "multi-pr-close", "scope-claim", "shipped-ledger", "verdict-repository-scoping", "published-verdict-selection"]
last_updated_by: "#769"
status: active
verification: verified
---

# Aggregated Epic Receipt

An epic whose stories were each judged on their own pull request gets one receipt derived from those verdicts, never a second conformance run. Coverage decides what happens next: every story judged produces the receipt, no story judged falls back to the ordinary whole-epic run, and a mixture stops and names the stories still missing a verdict. Only what no single story could answer is judged afresh, against the combined code of every story pull request.

## How It Works

The conformance stage, addressed at an epic, reads the records on the epic issue for what shipped, and consults the issue graph only to notice a merged pull request that carries no record. It reports each story as shipped, unrecorded, unshipped or excluded, re-reading the live story set each run, so a story added after a record was written is reported without anything invalidating the records already there. A story marked on its issue as shipping without a pull request of its own is excluded rather than reported unshipped. One currency axis remains, checked per story: the stamped record digest against the record's current digest. The close gate reads the receipt and re-runs that check at gate time, naming each stale story rather than the whole epic.

## Key Invariants

1. The aggregate re-judges nothing. Every per-story finding and severity count is carried through unchanged.
2. Findings are summed once per record, never once per story. A record covering two stories counts once.
3. The combined code is the union of each story pull request's own change set, taken at the head its verdict stamped. No range spans two pull requests, and the aggregate stamps no range anywhere.
4. Every pipeline store is withheld from each pull request's change set, through the one shared exclusion set.
5. A finding only the combined code shows is attributed to the epic, never to a single story. A cross-story check the combined code cannot decide is reported as unverifiable, never passed.
6. Staleness is reported story by story on the record axis alone and is never collapsed into one statement about the epic.
7. Partial coverage writes no receipt, so the close gate sees exactly what it sees when analysis never ran.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate this receipt is a second shape of: analyze writes it, close reads it back, and a stale one still needs an explicit waiver.
- [pr-driven-flow](pr-driven-flow.md) — the flow that publishes the per-story verdicts this receipt collects, one review per story pull request.
- [pr-story-resolution](pr-story-resolution.md) — the same validated-candidate idea run in the opposite direction: that page resolves a pull request to its stories, this one resolves a story to its pull requests.
- [record-digest](record-digest.md) — supplies the record's current digest, which each story's stamped digest is compared against on the design-staleness axis.
- [pipeline-store-exclusion](pipeline-store-exclusion.md) — the closed set withheld from every per-pull-request change set the combined code unions.
- [workspace-resolution](workspace-resolution.md) — names the repositories the search for a story's verdict spans, so a story whose pull request lives in a member repository is found.
- [multi-pr-close](multi-pr-close.md) — reads this receipt as the authoritative pull-request set for the epic, and its close-time waiver is what writes the no-pull-request marker onto a story issue.
- [scope-claim](scope-claim.md) — narrows what reaches a pull request's story list, so a story this aggregate reads as analyzed was one that pull request actually took on.
- [published-verdict-selection](published-verdict-selection.md) — the shared trust and recency rule this derivation applies per story, so the repository a verdict stamps is read in either written form.
- [verdict-repository-scoping](verdict-repository-scoping.md) — decides which candidate verdicts this derivation may count, and requires each one it drops for belonging elsewhere to be named.
- [shipped-ledger](shipped-ledger.md) — the records this receipt now reads what shipped from, in place of searching repositories for a published verdict.

## Decision Log

### 2026-09-10 — #212 — One epic receipt derived from the story verdicts

An epic that ships story by story ends up with one verdict per story pull request and none that speaks for the epic, which is the answer the close gate asks for. Deriving that answer from the verdicts already published costs nothing and cannot disagree with them, because nothing is re-judged. Two things still need the whole epic to judge. Its success metrics are properties of the finished capability, and a decision-record invariant can span two stories. Both are judged against the union of the story pull requests' own change sets, taken at the heads their verdicts stamped, so a cross-story finding and a per-story finding always describe the same code. Refuted alternative: build an integration branch by merging every story head and judge the resulting tree. That branch is the one thing a union of diffs cannot do, because it would show code that only exists once the stories are combined. It loses because it manufactures a commit that never shipped, and because it makes conflict resolution nobody reviewed part of the judged artifact. A cross-story check that only the integrated tree could decide is reported as unverifiable instead, naming what would decide it.

Three parts of the approved design did not ship, and each is filed as deferred scope. The receipt carries no record of which release wrote it. The combined code reads every pull request from one checkout rather than from each pull request's own repository, which stays correct only while no epic ships story by story across repositories. The lead-supplied candidate list is implemented but cannot be reached from the command line, because both automatic candidate sources resolved every story in practice. One further omission was deliberate rather than deferred. The receipt drops the record reference and digest, because currency is judged per story against the record, so a receipt-level copy would be a second source for a fact the per-story check already reads.

### 2026-09-10 — #213 — The receipt is the authoritative set, and the close-time waiver is what writes the marker

The receipt already names each story's repository, pull request and analyzed head, so the close does not repeat the discovery ladder. Rediscovering the set from branch names or timelines would be a third copy of the trust and recency rules, in the stage that runs last and is re-read least. The marker gained a writer at the same time. A lead who waives a storyless story at close is what puts the marker on that story's issue. Refuted alternative: record the waiver only in the close record and never write the marker. That keeps the close's writes to GitHub confined to the epic issue, but it leaves two notions of the same fact, so an aborted close followed by a re-run stops again on a story the lead has already adjudicated.

### 2026-09-12 — #564 — Reciprocal link from scope-claim

Mechanical reciprocity fan-out: this aggregate reads a story as analyzed when any trusted receipt names it, and it re-judges nothing, so it can only be as honest as the story list each receipt stamps. Requiring a reference to claim the work is what keeps a story merely cited as background out of that list. Receipts published before that narrowing are not retracted here, because this aggregate picks the newest receipt naming a story, so a corrected receipt that omits the story does not displace the older one that wrongly named it; those are remediated by hand.

### 2026-09-21 — #747 — The derivation accepts the repository stamp the gate actually writes

This derivation dropped every verdict it was given. The conformance gate stamps the repository it read in the host-qualified form, and the derivation compared that stamp against a bare owner-and-name, so nothing ever matched: an epic whose stories all carried verdicts reported that not one did, and the close gate then read conformance as never having run. The single-pull-request reader compared host-qualified to host-qualified and accepted the same blocks, and each reader's own tests encoded its own side of the disagreement, so neither suite could observe the split. The comparison is now one shared rule both readers call, accepting either written form of the same repository and still rejecting a different one. Nothing about coverage, severity counts or staleness changed; this page asserted the right behaviour all along and the code did not do it.

### 2026-09-21 — #751 — Reciprocal link from verdict-repository-scoping

The derivation gained a trust check on the repository a candidate's story numbers belong to, and an obligation to name every candidate it drops for failing it.

### 2026-09-22 — #769 — What shipped comes from the epic's own records, and the issue graph only flags a gap

Resolving a story to its pull requests by searching for a published verdict only ever worked in
the repositories the lead happened to hold a checkout of, so an epic whose code merged elsewhere
read as partly unshipped and the close ended in a waiver. The records on the epic issue answer
that question instead, and they answer it the same way wherever the reader is standing, because
each record carries the repository and the range. The issue graph keeps one job: noticing a merged
pull request that carries no record, which is a merge that skipped the gate. That job is advisory,
so a thin cross-repository linkage costs the lead a prompt rather than a wrong close. Coverage is
reported in four states rather than two, because a story with nothing recorded and a story whose
merged pull request carries no record need different remedies. Findings are summed once per
record rather than once per verdict, which is the same rule stated against the thing that now
carries them. The per-story code-staleness axis is gone with the rest of it.
