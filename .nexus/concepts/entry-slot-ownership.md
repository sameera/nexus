---
title: "Entry Slot Ownership"
aliases: ["entry slot", "cross-kind collision", "same-kind rewrite", "slot occupancy", "re-running a landed-work lane", "collision refusal"]
touches: ["fix-lane", "intake-lane", "ephemeral-handoff-entry", "issue-kind-classification", "provenance-reference"]
last_updated_by: "#515"
status: active
verification: verified
---

# Entry Slot Ownership

A number holds one entry slot, and exactly three kinds compete for it: an epic's materialization, a fix entry, and an intake entry. A lane stops and writes nothing when the slot holds a kind it does not own, and replaces the entry in place when the slot holds its own kind recorded against the same reference. Both landed-work lanes read this rule from one place, so a fix to one cannot leave the other behind.

## How It Works

A slot is keyed by repository as well as number, because two repositories in one workspace can use the same number for unrelated work. A candidate holds the slot only when its recorded reference resolves to the same repository. One whose reference cannot be read holds the slot anyway, so a half-written entry is never written over.

The check reaches past the number the developer typed: for an issue, the merged pull requests that close it; for a pull request, the issues it closes. Without that reach, an intake entry against a merged pull request and a fix entry against the issue it closes are one shipped change recorded twice, and both would drain. A failed lookup narrows the check to the one number and says so, because a check that only ever refuses must never turn a working command into a failing one.

Replacing at the point of writing, rather than at detection, means a run that refuses later never leaves the slot empty.

## Key Invariants

1. A candidate holds the slot only when its recorded reference resolves to the same repository; one whose reference cannot be read holds it anyway.
2. The check also covers an issue's merged closing pull requests and a pull request's closed issues; a failed lookup narrows it and reports that.
3. A slot held by a kind the lane does not own stops the lane, which writes nothing and leaves the occupant untouched.
4. A match reached through a linked number always refuses and is never replaced, whatever kind holds it.
5. Replacing a same-kind entry requires its directory name and recorded kind to agree, its recorded reference to match, and any refusal the lane states over its own kind to pass; the first failure refuses.
6. A replacement is announced before anything is removed, and leaves only the two files the lane always writes.

## Integration Points

- [fix-lane](fix-lane.md) — applies this rule under its own name, gaining the intake collision it never checked before.
- [intake-lane](intake-lane.md) — applies the same rule under its own name, and supplies the one lane-local refusal: an entry that already filed its deferred-scope issues is never replaced.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — holds the slots, and supplies the recorded kind this rule reads.
- [issue-kind-classification](issue-kind-classification.md) — supplies the declared epic marker the first refusal reads, so an epic is named from the repository's own statement.
- [provenance-reference](provenance-reference.md) — the grammar the recorded references are compared in, so a slot is judged by repository and not by number alone.

## Decision Log

### 2026-09-12 — #515 — One closed set of kinds, and a slot judged by repository

Each landed-work lane was guarding its own number: the fix lane refused an epic's materialization, the intake lane checked nothing at all, so the same shipped change could collect an intake entry beside a fix entry. Stating the rule once over a closed set of three kinds lets a lane ask only whether the occupant is its own kind, without naming any other kind's directory prefix or owning command. Two widenings came with the move. A slot is judged by repository as well as number, because a workspace where two repositories share a number would otherwise refuse a developer over an entry that has nothing to do with their work, and the repository is already established during reference resolution, so the check costs one comparison. The check also reaches through a closing pull request or a closed issue, which catches the case a lead flagged: an intake entry against a merged pull request and a fix entry against the issue that pull request closes are the same shipped change, and both would drain into the store. Refuted alternative: qualify the entry directory names themselves by repository, which removes the ambiguity at its root. It loses on reach, because those names are read and written by more than these two lanes, so renaming them would strand entries already sitting in the tree from earlier runs.
