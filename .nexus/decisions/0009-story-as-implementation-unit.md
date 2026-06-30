# 0009 — The user story is the unit of implementation

**Status:** Amendment. Amends 0001 D4 (interpretation), 0002 §5/§8, and 0004 (A0
templates, A1 `nxs.tasks`/`nxs.analyze` rows + skill table, §5/§8, "does not do").
**Date:** 2026-06-29.
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (D4 — implementation
is the engineer's), [`0002-pipeline-audit.md`](./0002-pipeline-audit.md) (§5 task decomposition,
§8 analyze), [`0004-implementation-plan.md`](./0004-implementation-plan.md) (the build plan this
sharpens), [`0006-queue-distillation-handoff.md`](./0006-queue-distillation-handoff.md) (distiller
input = decision + close records + diff, **not** the task index).

---

## Decision

**The user story is the terminal planning unit and the GitHub-issue granularity.** Nexus stops
decomposing at the story. It does **not** break stories into technical tasks; that decomposition is
the engineer's, performed with the engineer's own tools (0001 D4).

Concretely:

- **`/nxs.epic`** — each story is sized **S/M individually**; the epic's `complexity` is a
  **bottom-up rollup** of its story sizes (plus count and cross-story integration). A single story
  assessed **> M** forces a split _inside the epic_ (a story sized L is a mini-epic). This
  story-sizing gate is the keystone: without it, story-driven implementation silently degrades back
  into "unit too large to verify."
- **`/nxs.hld`** — unchanged in role: the decision record covers the whole epic.
- **`/nxs.tasks`** — repurposed. No HLD-into-tasks decomposition, no per-task LLD. It **sequences
  the epic's stories** (dependency order), runs the inline consistency gate, and after a review
  checkpoint creates **one GitHub issue per story** (child of the epic issue). It adds only thin
  sequencing metadata to the epic (an `## Implementation Sequence` section) — it does **not** emit a
  parallel story-index artifact that restates the User Stories section.
- **`/nxs.analyze`** — the story↔task traceability rules and the barrel-merge auto-remediation are
  **dropped** (no tasks to trace or merge). It keeps terminology normalization and the
  `story_type`-driven AC-quality check, and adds a story↔decision-record coverage check. It is an
  inline gate; it emits no `task-review.md`.
- **GitHub model** — epic issue (parent) → **story** issues (children). Was epic → task issues.

## Rationale

This is the 0001 razor — _every artifact is a forcing function for a human decision **or**
machine-consumed per the 0003 contract_ — applied to the task layer. 0004 cut `/nxs.dev` (0001 D4)
but **kept** a task-decomposition layer: `task-index-template.md`, `TASK-*` issues, `story_ref`
traceability, and the `nxs-generate-tasks` skill. With the dev stage gone, that layer serves no
consumer:

- It is **not machine-consumed.** The distiller (0006) reads the decision record + close record +
  the merged diff. The task index is not in its input.
- It is **not a forcing function for a human decision.** The human judgment a task layer once forced
  — "is this slice shippable?" — is exactly what the **story** (INVEST: independently deliverable and
  testable) already encodes.

So the task layer is vestigial scaffolding for a removed stage. Worse, **task slicing decomposes the
HLD by component**, which trends horizontal and manufactures non-shippable half-solutions — code an
agent can "complete" while nothing runs or verifies. Stories are vertical by construction, so every
implementation boundary is demonstrable. Evidence the layer was already a liability: 0004's
`/nxs.analyze` carried **barrel-merge auto-remediation** whose only job was to clean up the
export-only/verification-only fragments task slicing produces. Remove the slicing and that machinery
disappears with it.

Collapsing to story-as-unit also removes a redundant lossy transform — intent → stories → HLD →
**re-decompose into tasks** — leaving one decomposition (intent → stories) the rest of the pipeline
already trusts.

## Rejected

- **Keep tasks as the implementation unit** (0004 as-written). Rejected: no consumer after the dev
  cut; reintroduces horizontal half-solutions; needs the barrel-merge remediation to stay viable.
- **One file per story / one file per AC.** Rejected: stories have no per-file consumer (unlike
  tasks→issues→worktrees), it relocates reading rather than reducing it, and it severs the
  cross-story narrative. The epic remains the single story-bearing artifact.
- **A separate `story-index.md`.** Rejected: it would restate the epic's User Stories section — a
  thin parallel artifact. Sequencing metadata lives inline in the epic instead.

## Touch list (status)

- **Done:** this record; decision-log entry; 0004 inline edits; `/nxs.epic` story-sizing +
  complexity rollup (per-story `size: S|M`, no story > M, epic `complexity` = rollup); `nxs.tasks.md`
  and `nxs.analyze.md` rewrites; cut `task-index-template.md` + `task-template.md`; delete
  `nxs-generate-tasks`; repurpose `nxs-gh-create-task` → `nxs-gh-create-story`.
- **Remaining (A1, not in this pass):** `/nxs.hld` decision-record rewrite (still the 16-section
  HLD); `nxs-analyzer` / `nxs-architect` agent slimming; CLAUDE.md command-workflow rewrite. The
  Gemini mirror stays deferred (0004 C9).
