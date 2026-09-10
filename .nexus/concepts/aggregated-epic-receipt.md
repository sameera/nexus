---
title: "Aggregated Epic Receipt"
aliases: ["epic receipt", "aggregate mode", "story verdicts", "per-story staleness", "combined change set", "no-pull-request marker"]
touches: ["conformance-gate", "pr-driven-flow", "pr-story-resolution", "record-digest", "pipeline-store-exclusion", "workspace-resolution"]
last_updated_by: "#212"
status: active
verification: verified
---

# Aggregated Epic Receipt

An epic whose stories were each judged on their own pull request gets one receipt derived from those verdicts, never a second conformance run. Coverage decides what happens next: every story judged produces the receipt, no story judged falls back to the ordinary whole-epic run, and a mixture stops and names the stories still missing a verdict. Only what no single story could answer is judged afresh, against the combined code of every story pull request.

## How It Works

The conformance stage, addressed at an epic, looks for a published verdict on each story's pull request. Candidates come from the story issue's closing links and from a head branch naming the story number, searched across every repository the workspace declares. A candidate counts only if its verdict stamps this epic and names this story, so a wrong candidate can only be rejected. The newest surviving verdict per story is the one the receipt reports. A story marked on its issue as shipping without a pull request of its own leaves the coverage requirement, named as excluded. Currency is then checked per story on two axes: the verdict's analyzed commit against that pull request's current head, and the verdict's stamped record digest against the record's current digest. The close gate reads the receipt and re-runs that check at gate time, naming each stale story rather than the whole epic.

## Key Invariants

1. The aggregate re-judges nothing. Every per-story finding and severity count is carried through unchanged.
2. Findings are summed once per distinct verdict, never once per story. A verdict covering two stories counts once.
3. The combined code is the union of each story pull request's own change set, taken at the head its verdict stamped. No range spans two pull requests, and the aggregate stamps no range anywhere.
4. Every pipeline store is withheld from each pull request's change set, through the one shared exclusion set.
5. A finding only the combined code shows is attributed to the epic, never to a single story. A cross-story check the combined code cannot decide is reported as unverifiable, never passed.
6. Staleness is reported story by story on both axes and is never collapsed into one statement about the epic.
7. Partial coverage writes no receipt, so the close gate sees exactly what it sees when analysis never ran.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate this receipt is a second shape of: analyze writes it, close reads it back, and a stale one still needs an explicit waiver.
- [pr-driven-flow](pr-driven-flow.md) — the flow that publishes the per-story verdicts this receipt collects, one review per story pull request.
- [pr-story-resolution](pr-story-resolution.md) — the same validated-candidate idea run in the opposite direction: that page resolves a pull request to its stories, this one resolves a story to its pull requests.
- [record-digest](record-digest.md) — supplies the record's current digest, which each story's stamped digest is compared against on the design-staleness axis.
- [pipeline-store-exclusion](pipeline-store-exclusion.md) — the closed set withheld from every per-pull-request change set the combined code unions.
- [workspace-resolution](workspace-resolution.md) — names the repositories the search for a story's verdict spans, so a story whose pull request lives in a member repository is found.

## Decision Log

### 2026-09-10 — #212 — One epic receipt derived from the story verdicts

An epic that ships story by story ends up with one verdict per story pull request and none that speaks for the epic, which is the answer the close gate asks for. Deriving that answer from the verdicts already published costs nothing and cannot disagree with them, because nothing is re-judged. Two things still need the whole epic to judge. Its success metrics are properties of the finished capability, and a decision-record invariant can span two stories. Both are judged against the union of the story pull requests' own change sets, taken at the heads their verdicts stamped, so a cross-story finding and a per-story finding always describe the same code. Refuted alternative: build an integration branch by merging every story head and judge the resulting tree. That branch is the one thing a union of diffs cannot do, because it would show code that only exists once the stories are combined. It loses because it manufactures a commit that never shipped, and because it makes conflict resolution nobody reviewed part of the judged artifact. A cross-story check that only the integrated tree could decide is reported as unverifiable instead, naming what would decide it.

Three parts of the approved design did not ship, and each is filed as deferred scope. The receipt carries no record of which release wrote it. The combined code reads every pull request from one checkout rather than from each pull request's own repository, which stays correct only while no epic ships story by story across repositories. The lead-supplied candidate list is implemented but cannot be reached from the command line, because both automatic candidate sources resolved every story in practice. One further omission was deliberate rather than deferred. The receipt drops the record reference and digest, because currency is judged per story against the record, so a receipt-level copy would be a second source for a fact the per-story check already reads.
