---
title: "Story as Unit"
aliases: ["user story as unit", "story-as-implementation-unit", "terminal planning unit", "no task layer"]
touches: ["nexus-pipeline", "epic-approval-gate"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Story as Unit

The user story is Nexus's terminal planning unit and its issue granularity. The pipeline stops decomposing once a story is small enough to ship and verify on its own, and never breaks a story into technical tasks — that is the engineer's call.

## How It Works

Each story is sized within its epic, and the epic's complexity is a bottom-up rollup of its stories; a single story that is too large splits inside the epic rather than spawning a lower layer. The tracking model files one issue per story under the epic. There is no task layer: the distiller reads the decision record, the close record, and the diff — never a task index — so a task decomposition would have no consumer and would force no decision the story does not already encode. Cutting the task layer also removes the horizontal half-solutions that layer manufactured and the merge remediation that existed only to clean them up.

## Key Invariants

1. The user story is the terminal planning unit and the issue granularity.
2. Nexus never decomposes a story into technical tasks.
3. A too-large story splits inside its epic; no lower layer is introduced.
4. Epic complexity is a bottom-up rollup of its stories.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the pipeline that stops decomposing at the story.
- [epic-approval-gate](epic-approval-gate.md) — the gate that files one issue per story.

## Decision Log

### 2026-06-29 — bootstrap — 0009: the story is the terminal unit

Made the user story the terminal planning unit and cut the technical-task layer. The considered alternative — keeping tasks as the unit of implementation — was rejected: the task layer had no downstream consumer, forced no decision the story's acceptance criteria did not already encode, and its horizontal slicing manufactured non-shippable half-solutions that needed dedicated merge remediation.
