---
title: "Issue Kind Classification"
aliases: ["issue kind", "what an issue is filed as", "epic or story", "classification mode mismatch", "declared marker over graph shape"]
touches: ["publishing-config-resolution", "pr-story-resolution", "decision-record", "entry-slot-ownership"]
last_updated_by: "#515"
status: active
verification: verified
---

# Issue Kind Classification

An issue's kind is read from the marker its repository declares for that kind. The kinds are epic, story, decision record, and none of these. Kind is never inferred from the issue graph's shape, because shape cannot tell a story of an epic from an epic of an initiative.

## How It Works

A repository declares one classification mode. Under label mode a kind is the configured label. Under issue-type mode it is the configured issue type. The legacy default declares neither and reads whichever marker is present, label first. Every marker name comes only from the shared publishing resolver, so the side that reads a kind cannot disagree with the side that filed it, and names match case-insensitively.

Under a declared mode only that mode's marker is read. When that marker says nothing and the other mode's marker would have answered, the run stops and names the mismatch. The declared classification then does not describe how this repository files issues, and a stage that quietly worked around it would resolve the same issue differently from a stage that trusts the declaration. Issue-type mode carries no built-in type names, so a repository selecting it without declaring them is reported rather than guessed at.

The design stage's import refuses an issue its repository files as a story or a record.

## Key Invariants

1. A kind comes from a declared marker; no stage infers a kind from the issue graph's shape.
2. Only the declared mode's marker is read; the legacy default alone reads either marker.
3. A declared mode whose marker is absent, where the other mode's marker would have answered, stops the run and names the mismatch.
4. Marker names match case-insensitively.
5. Markers come only from the shared publishing resolver, so reading a kind can never disagree with filing it.
6. Issue-type mode carries no built-in type names; a repository selecting it without declaring them is reported, never guessed.
7. An unmarked issue is refused as an epic only when it is a sub-issue of something, so a repository that marks no issue at all still resolves its epics.

## Integration Points

- [publishing-config-resolution](publishing-config-resolution.md) — supplies the declared mode and every marker name this rule matches against.
- [pr-story-resolution](pr-story-resolution.md) — validates each of a pull request's story candidates through this rule.
- [decision-record](decision-record.md) — the design stage's import decides here whether the issue it was handed is the epic.
- [entry-slot-ownership](entry-slot-ownership.md) — reads the declared epic marker through this rule, so a landed-work lane names an epic from the repository's own statement.

## Decision Log

### 2026-09-10 — #211 — What an issue is comes from the declared classification, never from the graph's shape

The rule this replaced asked the issue graph: an issue with a parent that lists it back was a story, and a parentless issue was an epic. Shape cannot carry that question. A story of an epic and an epic of an initiative have the same shape, so in a repository that files its epics under an initiative the shape rule resolved one level too high. Two stages read the wrong issue as a result. The conformance gate checked an initiative's non-existent acceptance criteria and decision record, and the design stage's import refused every genuine epic as not being one. Reading the declared marker instead makes the answer the repository's own statement rather than an inference. A mode that contradicts the issue is treated as a defect in the settings rather than as an input to route around, because a silent fallback would let a wrong declaration keep working here while every other stage that trusts the same setting disagrees about the same issue. The unmarked case stayed permissive on purpose: requiring a positive epic marker would refuse every epic in a repository that labels nothing, which is a new refusal rather than a fix. Refuted alternative: keep the shape check and add a depth heuristic, where an issue whose parent also has a parent is an epic. It needs no settings and it fixes this repository. It also encodes one repository's nesting depth as a global rule, and it breaks as soon as an adopter nests differently or does not nest at all.

### 2026-09-12 — #515 — Reciprocal link from entry-slot-ownership

Mechanical reciprocity fan-out: the rule that decides which kind of entry holds a number's slot now names this rule as the source of the epic marker it reads, so both landed-work lanes refuse an epic from the repository's own declaration rather than from a hard-coded label or type name. Nothing this page already asserted has changed.
