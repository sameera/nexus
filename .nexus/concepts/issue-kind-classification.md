---
title: "Issue Kind Classification"
aliases: ["issue kind", "what an issue is filed as", "epic or story", "classification mode mismatch", "declared marker over graph shape"]
touches: ["publishing-config-resolution", "pr-story-resolution", "decision-record", "entry-slot-ownership", "initiative", "filing-preflight", "epic-kind-refusal"]
last_updated_by: "#998"
status: active
verification: verified
---

# Issue Kind Classification

An issue's kind is read from the marker its repository declares for that kind. The kinds are initiative, epic, story, decision record, feature, and none of these. Feature exists only in a repository that opts in to features as issues. Kind is never inferred from the issue graph's shape, because shape cannot tell a story of an epic from an epic of an initiative.

## How It Works

A repository declares one classification mode. Under label mode a kind is the configured label. Under issue-type mode it is the configured issue type. The legacy default declares neither and reads whichever marker is present, label first. Every marker name comes only from the shared publishing resolver, so the side that reads a kind cannot disagree with the side that filed it, and names match case-insensitively.

Under a declared mode only that mode's marker is read. When that marker says nothing and the other mode's marker would have answered, the run stops and names the mismatch. The declared classification then does not describe how this repository files issues, and a stage that quietly worked around it would resolve the same issue differently from a stage that trusts the declaration. Issue-type mode carries no built-in type names, so a repository selecting it without declaring them is reported rather than guessed at.

Which kinds each stage refuses as its epic, and the order the markers are tested in, belong to the epic-kind-refusal concept.

## Key Invariants

1. A kind comes from a declared marker; no stage infers a kind from the issue graph's shape.
2. Only the declared mode's marker is read; the legacy default alone reads either marker.
3. A declared mode whose marker is absent, where the other mode's marker would have answered, stops the run and names the mismatch.
4. Marker names match case-insensitively.
5. Markers come only from the shared publishing resolver, so reading a kind can never disagree with filing it.
6. Issue-type mode carries no built-in type names; a repository selecting it without declaring them is reported, never guessed.

## Integration Points

- [publishing-config-resolution](publishing-config-resolution.md) — supplies the declared mode and every marker name this rule matches against.
- [pr-story-resolution](pr-story-resolution.md) — validates each of a pull request's story candidates through this rule.
- [decision-record](decision-record.md) — the design stage's import decides here whether the issue it was handed is the epic.
- [entry-slot-ownership](entry-slot-ownership.md) — reads the declared epic marker through this rule, so a landed-work lane names an epic from the repository's own statement.
- [initiative](initiative.md) — the kind every stage refuses as an epic and the filer allows as a stub's parent.
- [epic-kind-refusal](epic-kind-refusal.md) — which kinds a stage refuses as its epic, and the order the markers are tested in.
- [filing-preflight](filing-preflight.md) — reads through this rule whether a stub's named parent is an initiative.

## Decision Log

### 2026-09-10 — #211 — What an issue is comes from the declared classification, never from the graph's shape

The rule this replaced asked the issue graph: an issue with a parent that lists it back was a story, and a parentless issue was an epic. Shape cannot carry that question. A story of an epic and an epic of an initiative have the same shape, so in a repository that files its epics under an initiative the shape rule resolved one level too high. Two stages read the wrong issue as a result. The conformance gate checked an initiative's non-existent acceptance criteria and decision record, and the design stage's import refused every genuine epic as not being one. Reading the declared marker instead makes the answer the repository's own statement rather than an inference. A mode that contradicts the issue is treated as a defect in the settings rather than as an input to route around, because a silent fallback would let a wrong declaration keep working here while every other stage that trusts the same setting disagrees about the same issue. The unmarked case stayed permissive on purpose: requiring a positive epic marker would refuse every epic in a repository that labels nothing, which is a new refusal rather than a fix. Refuted alternative: keep the shape check and add a depth heuristic, where an issue whose parent also has a parent is an epic. It needs no settings and it fixes this repository. It also encodes one repository's nesting depth as a global rule, and it breaks as soon as an adopter nests differently or does not nest at all.

### 2026-09-12 — #515 — Reciprocal link from entry-slot-ownership

Mechanical reciprocity fan-out: the rule that decides which kind of entry holds a number's slot now names this rule as the source of the epic marker it reads, so both landed-work lanes refuse an epic from the repository's own declaration rather than from a hard-coded label or type name. Nothing this page already asserted has changed.

### 2026-10-10 — #705 — Initiative becomes a declared kind, tested last

An initiative needed a positive marker for two checks. The filer allows it as a stub's parent, and every stage refuses it as an epic. Working out a kind from the issue graph is already forbidden here, so the initiative became its own declared kind with its own label or issue type. The label defaults to the word initiative, and the issue type has no default. The marker is tested after epic, story and record, because a repository whose epic label is that same word would otherwise have every epic refused. The initiative check reads only the initiative marker, so it adds no failure for any issue that is not an initiative. Under issue-type mode, an issue that carries only the initiative label reads as none of these, as it did before the kind existed. The rule now lives in one place that both the filer and the resolver call, because a second copy inside the filer would let filing and reading disagree about the same issue. Refuted alternative: test the initiative marker first, so an issue carrying both markers is refused as an initiative. It lost because it refuses every epic in a repository whose epic label is the same word.

### 2026-11-21 — #998 — Feature becomes a declared kind; the refusal and test-order rules move to epic-kind-refusal

A repository that opts in to features as issues needs a feature issue to read as a feature. The feature marker follows the classification mode, as the initiative marker does: the feature label under label mode and the legacy mode, the feature issue type under issue-type mode. The kind list now names feature, and a feature exists only in an opted-in repository. Adding the feature rules would have taken this page past its 400-word cap, so the rules on which kinds a stage refuses as its epic, the marker test order and the unmarked-parentless rule (formerly invariant 7) moved to the new epic-kind-refusal page. Those rules load on their own, when a stage resolves an epic, while this page answers what a kind is. Refuted alternative: keep all of it here and drop older wording to fit. That would have removed still-true content to make room.
