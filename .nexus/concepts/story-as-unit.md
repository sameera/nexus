---
title: "Story as Unit"
aliases: ["user story as unit", "story-as-implementation-unit", "terminal planning unit", "no task layer", "bottom-up rollup"]
touches: ["nexus-pipeline", "epic-approval-gate", "story-identity", "design-warrant", "set-closure-check"]
last_updated_by: "#576"
status: active
verification: verified
---

# Story as Unit

The user story is Nexus's terminal planning unit and its issue granularity. The pipeline stops decomposing once a story is small enough to ship and verify on its own, and never breaks a story into technical tasks — that is the engineer's call.

## How It Works

Each story is sized within its epic, and the epic's complexity is a bottom-up rollup of the stories actually filed; a single story that is too large splits inside the epic rather than spawning a lower layer. A filed story that states no size blocks, because the rollup cannot be derived without it. The tracking model files one issue per story under the epic. There is no task layer: the distiller reads the decision record, the close record, and the diff — never a task index — so a task decomposition would have no consumer and would force no decision the story does not already encode. Cutting the task layer also removes the horizontal half-solutions that layer manufactured and the merge remediation that existed only to clean them up.

## Key Invariants

1. The user story is the terminal planning unit and the issue granularity.
2. Nexus never decomposes a story into technical tasks.
3. A too-large story splits inside its epic; no lower layer is introduced.
4. Epic complexity is a bottom-up rollup of the stories actually filed, and every filed story states a size.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the pipeline that stops decomposing at the story.
- [epic-approval-gate](epic-approval-gate.md) — the gate that files one issue per story.
- [story-identity](story-identity.md) — how the filed story this unit produces is named and, later, withdrawn.
- [design-warrant](design-warrant.md) — takes the floor of the rollup from these per-story sizes, and the needs-design label from the rollup.

- [set-closure-check](set-closure-check.md) — checks that a chosen set of these units can actually run.
## Decision Log

### 2026-06-29 — bootstrap — 0009: the story is the terminal unit

Made the user story the terminal planning unit and cut the technical-task layer. The considered alternative — keeping tasks as the unit of implementation — was rejected: the task layer had no downstream consumer, forced no decision the story's acceptance criteria did not already encode, and its horizontal slicing manufactured non-shippable half-solutions that needed dedicated merge remediation.

### 2026-07-28 — manual — Reciprocal link from story-identity

Mechanical reciprocity fan-out: the story-identity page names this unit as what a story's
issue-number identity and withdrawal lifecycle attach to.

### 2026-09-13 — #576 — The rollup is taken from the stories actually filed

The approval gate began letting the reviewer assemble the filed story set, adding stories the draft left out and dropping ones it held. The rollup is a property of that set, so an epic could otherwise be filed carrying a complexity taken from a draft nobody approved. A filed story that states no size now blocks, because the floor the set forces cannot be computed without it.
