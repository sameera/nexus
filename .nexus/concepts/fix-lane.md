---
title: "Fix Lane"
aliases: ["lightweight fix lane", "fix entry", "small-fix lane", "fifth entry point", "recording a small fix"]
touches: ["fix-razor", "ephemeral-handoff-entry", "distiller", "provenance-reference", "pr-worktree", "nexus-pipeline", "conformance-gate", "intake-lane"]
last_updated_by: "#483"
status: active
verification: verified
---

# Fix Lane

The fix lane records why a small change that has already landed mattered, taking one GitHub reference as input. The lane writes a drainable entry directly: two files in the ephemeral area, not the four durable artifacts the epic lane requires. The lane creates nothing on the host and commits nothing. The drain discovers the entry later, bounded by the fix razor.

## How It Works

The system was gated on epics at two points: the file heading an entry had one producer that walked an epic's sub-issue graph, and the close stage's preconditions were epic-shaped. The lane bypasses both by writing those files and stopping. It takes one reference, which may name an issue or a pull request, resolves the commit range, derives what changed from the diff, and asks only why the change mattered—the only thing the code cannot answer. A range is never guessed and its head must already have reached the trunk, because an entry recorded against unlanded work fails the drain's merge precondition and trains the operator to waive it. Everything after that reuses existing work: the drain finds the entry alongside ones it already scans.

## Key Invariants

1. The lane writes exactly two files into the ephemeral area and nothing else: no host writes, no branch, no pull request, no commit.
2. Provenance is always the reference the developer named. A pull request is never substituted for the issue it closes, nor an issue for a pull request, even when the range came from that pull request.
3. A recorded range carries full commit identifiers at both ends and its head must already reach the trunk. A range is never guessed and never defaulted.
4. The lane refuses and writes nothing when the reference is epic-classified, when a materialized epic already exists for that number, when run inside a member repository, or when the pull request is unmerged.
5. The kind recorded in an entry's header determines what the entry is, never the directory name.
6. The developer is asked exactly two things: why the change mattered (required) and the feature (optional, never invented).
7. There is no approval checkpoint and no conformance receipt. Nothing durable is written, so a second gate would force no decision.

## Integration Points

- [fix-razor](fix-razor.md) — the structural bound that lets this lane be cheap without letting the store lie.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — the area the lane writes its two files into, and the lifecycle they inherit.
- [distiller](distiller.md) — the drain that discovers the entry and applies its reasoning to the store.
- [provenance-reference](provenance-reference.md) — the grammar the lane reads its one input in, so what resolves at the input is what reaches the page.
- [pr-worktree](pr-worktree.md) — supplies the merge-safe range through a read that creates no worktree.
- [nexus-pipeline](nexus-pipeline.md) — the epic-shaped path this lane is the alternative to, for a change too small to justify it.
- [conformance-gate](conformance-gate.md) — refuses to run against this lane's entries, which carry none of the three things it checks.
- [intake-lane](intake-lane.md) — the sibling lane for a landed change that would alter what a page asserts, sharing this lane's reference and range resolution rules through one skill.

## Decision Log

### 2026-09-05 — #263 — A fifth entry point, bought with a structural bound

Recording the reason behind a two-line fix cost four durable artifacts and two review cycles, so it was not being recorded at all: a developer facing that price either skipped the rationale or dressed the fix as an epic, and the second buries the decisions that matter under ceremony. The lane creates the two files the drain already requires and reuses their existing names, so discovery changes one line rather than doubling the drain's surface. The considered alternative — give the fix entry honestly named files and its own discovery and drain path — reads correctly and avoids a permanent naming wart, but it doubles the surface area of the phase most expensive to keep correct, for a lane whose entire value is being cheap. The wart is accepted as the price, and is worth revisiting when a second kind of non-epic entry appears, because at that point the shape the two kinds share deserves a name of its own.

### 2026-09-08 — #483 — Reciprocal link from intake-lane

Mechanical reciprocity fan-out: the intake-lane page names this lane as its sibling for work that has already landed, sharing the checkout-role gate, reference resolution, range resolution and qualification rule through one extracted skill so a fix to either cannot silently diverge from the other. Nothing this page already asserted has changed.
