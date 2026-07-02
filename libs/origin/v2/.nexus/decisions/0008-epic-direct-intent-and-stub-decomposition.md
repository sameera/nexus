# 0008 — `/nxs.epic` takes direct intent; oversized scope decomposes to stubs

**Status:** Decided.
**Date:** 2026-06-28
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (lean = the human
consumer; forcing-function razor D1; over-generation is the disease),
[`0002-pipeline-audit.md`](./0002-pipeline-audit.md) (§3 epic keep/slim verdicts; the
right-sizing gate as the early over-generation brake),
[`0004-implementation-plan.md`](./0004-implementation-plan.md) (A1 `nxs.epic` "Modify — slim";
C2 `backlog.md` as the feature re-triage queue).
**Amends:** 0002 §3 (epic now accepts intent directly; multi-epic emits stubs, not full epics);
0004 A1 `nxs.epic` row (precondition + stub behaviour); 0004 C2 (`backlog.md` gains a second
writer — epic-time decomposition stubs, not only close-time deferred scope).
**Resolves:** the PM activation cost of a pre-written feature brief, and a latent
over-generation hole in the existing right-sizing Option 2 (full epics for every sub-epic).

---

## Decision

Two changes to `/nxs.epic`. The command name is **unchanged** (`/nxs.epic`, not `/nxs.plan`);
**no new hierarchy tier** is introduced (no "initiative" — both considered and rejected, below).

**1. Direct intent — the feature brief stops being a precondition.** `/nxs.epic` takes a
natural-language capability description and runs. The hard "no valid Feature README" gate is
removed. The **feature container becomes an output, not an input**:

- Invoked inside an existing `docs/features/<name>/` → use it.
- Otherwise → infer a feature name from the intent, **confirm once** (cheap, single prompt),
  scaffold `docs/features/<name>/`, and write a thin nav index (name + one-line intent + epic
  index). This index is a navigation aid, **not** the old forcing-function brief — no
  human must pre-author prose before planning starts.

The container must still exist because the queue entry records its parent feature
([0006 §4](./0006-queue-distillation-handoff.md)) and `backlog.md` lives under it (C2).

**2. Oversized scope decomposes to stubs, not full epics.** The right-sizing gate
([0002 §3](./0002-pipeline-audit.md), the early over-generation brake) is **kept** — including
its MANDATORY STOP. What changes is the `> M` consent path:

- `≤ M` → generate the full `epic.md` now (today's behaviour, minus the brief precondition).
- `> M`, with user consent → emit **epic stubs** into `docs/features/<name>/backlog.md`, split
  by functional goal. A stub records only: slug, one-line functional goal, candidate
  user-story group titles, complexity estimate (S/M), `blocked_by` (stub-refs for ordering),
  `status: proposed`. **No** full `epic.md`, **no** stories, **no** acceptance criteria, **no**
  per-epic folder this run.
- Full `epic.md` generation is **deferred to a later `/nxs.epic <stub-ref>`** — the PM promotes
  one stub at a time when ready to work it, which then runs the `≤ M` full-generation path and
  writes its own folder + queue entry.

The stub list reuses C2's `backlog.md` — already defined as "the feature's re-triage queue and
the input the next `/nxs.epic` reads." Decomposition stubs and close-time deferred scope are the
same thing (right-sized future work awaiting promotion) and share one append-only surface.

---

## Why

**The brief was thin friction, not judgment.** Today's README gate only names the container and
seeds terminology. Its "context for coherence" role is being absorbed elsewhere:
`docs/product/context.md` is now the canonical home for personas/strategy
([0002 §2](./0002-pipeline-audit.md), [0004 A1 `nxs-setup`](./0004-implementation-plan.md)), and
the `concepts:` reading list (System B, [0003 §5](./0003-concept-schema.md)) will supply domain
context at read time. Requiring a hand-written brief on top is ceremony the architecture is
already routing around. This is the same move `/nxs.setup` made — pre-written doc → interactive
entry — applied one level down. It **lowers PM activation cost without removing a judgment gate**:
the right-sizing gate, the clarification limit, and stories/AC are all retained.

**Stubs are the razor applied to decomposition.** Generating three-to-four complete `epic.md`
(stories + AC + personas) from one fuzzy intent, ahead of validated scope, **is**
[speculative over-generation](../concepts/speculative-over-generation.md) — the disease 0001
names. Today's right-sizing Option 2 already commits it. Stubs pay only for the decomposition
*decision* (which functional goals, in what order) and defer the expensive spec until the PM
commits to working that epic — by which time scope has usually drifted (which is exactly what
`backlog.md` re-triage exists for, C2). Pipeline downstream (hld/tasks) already runs one epic at
a time, so a fully-specced epic #4 before epic #1 ships is waste. This turns Option 2 from an
over-generation hole into a brake.

## Considered and rejected

- **An "initiative" tier above feature** (initiative → feature → epic → task). Rejected: a 4th
  structural level cuts against the lean thesis (0001 is a de-bloat). The existing
  `docs/features/<name>/` folder is *already* a multi-epic container; the multi-epic case needs
  no new level, only the stub behaviour above. If "initiative" semantics are ever wanted, they
  are a frontmatter marker on a feature, not a folder tier.
- **Renaming `/nxs.epic` → `/nxs.plan`.** Rejected: cosmetic. It churns the 0002/0004 references,
  collides with Claude Code "plan mode" and the ADRs named "implementation plan," and the
  behaviour change (direct intent + stubs) is the substance regardless of the verb. If a
  PM-facing verb is wanted later, alias it — don't rename.
- **Generating the foundational epic full + the rest as stubs.** Rejected: reintroduces a
  "which one is first" judgment and partial over-generation. The clean rule is `> M → stubs
  only`; the PM promotes whichever they work first.

## What changes (relative to 0002 §3 / 0004 A1)

| Aspect | Before | After (0008) |
|---|---|---|
| Feature brief | hard precondition (README with `feature:` frontmatter) | **not required** — feature container is scaffolded as output; name confirmed once |
| Entry | run inside a validated feature | **direct natural-language intent** |
| Right-sizing gate | kept (Option 1/2/3, MANDATORY STOP) | **kept**; the `> M` path changes only |
| `> M` decomposition | full `epic.md` per sub-epic (Option 2) | **epic stubs** in `backlog.md`; full epic deferred to per-stub `/nxs.epic` |
| `backlog.md` writers | `/nxs.close` (deferred scope, C2) | **+ `/nxs.epic`** (decomposition stubs); same append-only surface |
| Command name / tiers | `/nxs.epic`; feature→epic→task | **unchanged** (no rename, no initiative) |

## Consequences (honest)

- **Stub promotion is a new, explicit step.** A `> M` intent yields no runnable epic until the
  PM runs `/nxs.epic <stub-ref>`. Accepted — that *is* the brake; the stub list makes the deferred
  scope visible and re-triageable rather than pre-specced and stale.
- **Story-traceability ([0004 A1 analyze](./0004-implementation-plan.md), `story_type` gate)
  applies per full epic only.** Stubs carry no AC, so the analyze severity gate is a no-op until
  promotion. No change to the gate itself.
- **`backlog.md` now has two writers** (close + epic). Append-only + one consumer (the next
  `/nxs.epic`) keeps this conflict-free; the entry shape must be common to both (slug + goal +
  estimate + status).
- **Feature-name inference can guess wrong.** Mitigated by the single confirm prompt before the
  folder is created; cheaper than mandating a pre-written brief.

## Open / out of scope

- **Exact `backlog.md` stub frontmatter/row shape** — settled when the A0 templates are written
  (this record fixes the *fields a stub must carry*, not the markdown layout).
- **Whether the thin feature nav index is a `README.md` or a lighter index file** — A1
  implementation detail; either satisfies the 0006 §4 container requirement.
- **Promotion ergonomics** (`/nxs.epic <stub-slug>` vs. selecting from a list) — A1 UX detail.

This record fixes only the **entry contract and the decomposition output shape**; the command
rewrite lands in 0004 Phase A1.
