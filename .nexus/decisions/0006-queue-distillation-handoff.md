# 0006 — Queue-based distillation handoff

**Status:** Decided. **Amended by [`0007`](./0007-delta-in-pr-merge-apply.md)** — the distiller's
apply is routed through a reviewed distillation-PR instead of a direct write to main. Everything
here (synthesis in B, A-dumb/B-smart, queue surface, drain triggers, two-store framing) stands.
**Date:** 2026-06-14
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (two-store split, D2/D3),
[`0003-concept-schema.md`](./0003-concept-schema.md) (page schema + emission contract),
[`0004-implementation-plan.md`](./0004-implementation-plan.md) (build order, close BLOCKER),
[`0005-transient-artifact-storage.md`](./0005-transient-artifact-storage.md) (storage surfaces).
**Supersedes:** 0005 §2, §4, §5, §6 (storage model). **Amends:** 0003 §8.1, §8.2, §9.1.
**Dissolves:** the 0004 close-emission BLOCKER.

---

## Decision

There is **one** pipeline-to-concept-store handoff surface: a committed **queue** folder,
`.nexus/queue/<branch>/<local-id>/`. It holds the epic's human planning artifacts (epic,
decision record, task index, close record). It is **not gitignored** — it is committed to
the feature branch and travels to main with the PR. The **distiller** drains it: reads the
queued artifacts plus the branch diff, distills into `.nexus/concepts/`, then deletes the
consumed queue entry.

This **collapses 0005's two surfaces** (`.nexus/.temp/` transient + `.nexus/staged/`
durable) into one. The dotted `.temp` folder and the `staged/*.json` sidecar are both
retired.

---

## Why

System A produces **no machine artifact**. The queued human artifacts (already gated by
their own pipeline reviews) plus the committed code *are* the distiller's input. The
distiller (System B) performs all synthesis — the *what* from the diff, the *why* from the
decision and close records. This is the cleanest expression of the 0001 D1 two-store wall:
A never writes into the machine namespace; B reads gated human artifacts + code and writes
the concept store. No machine block ever sits inside a human artifact, and no "laundering path"
(0004 razor-check) is possible because there is nothing to launder.

It also removes machinery rather than adding it — the refactor's whole thesis (0001).

## What it resolves

- **0004 close-emission BLOCKER — dissolved.** Durability is automatic; the artifacts are
  committed. Nothing to discard, no sidecar to write before deleting a temp folder.
- **Synthesis-location question — settled.** All diff→delta synthesis lives in the distiller
  (B). Close emits nothing structured. A stays dumb, B stays smart, build order (0001 D5)
  is honored: the A2 pilot produces a committed queue entry that becomes B1's first fixture.
- **Cross-worktree visibility (prior review #5) — resolved for free.** The decision record is
  committed to the branch, so every checkout/worktree sees its invariants + rationale. No
  need to duplicate them into the GH issue body.
- **0004 "staged candidate queue" + C12 expiry — now literal**, one concept, one folder.

## Roles after the collapse

- **Decision record** (in queue) — design-time *why*. Distiller's primary rationale source.
- **Close record** (in queue) — pure human prose: key decisions + deferred-scope pointer +
  **deviation rationale**. No `ConceptDelta` block. The close-from-diff forcing function
  still applies (see below) and writes its output here.
- **The git diff** — the *what*: behavioral deltas, `touches`, behavioral invariants. These
  are code-derivable, so the diff is their correct source (0001 D3 — code is the truth for
  the *what*; the concept store exists for the *why*).

## Close-from-diff forcing function (carried from the prior-review #4 resolution)

`/nxs.close` diffs the branch **against the decision record**, auto-derives the *what*, and
**surfaces detected deviations** — places where shipped code diverges from what the decision
record implied. It forces the human to supply rationale **only on those deviations** (a
targeted forcing function, not a blank "write a summary"). That rationale lands in the close
record, which the distiller later mines. The diff supplies what code can supply; the human
supplies only the *why* that code cannot.

## Distiller drain — the new mechanism questions

These are B-phase build details, defaulted here so the contract is closed:

1. **Trigger.** Distiller scans `.nexus/queue/**` for unconsumed entries (presence =
   unconsumed). Runs post-merge on main, as a curated step (0004 B0: "apply is explicit,
   candidates never write the concept store directly"). Naturally batches N epics.
2. **Diff capture.** SHA range is inferable from the merge commit that introduced the queue
   entry; otherwise record base/head in the entry. The distiller recomputes the diff from
   git — it is not stored.
3. **Delete on consume.** The distiller deletes the queue entry after distilling. Steady-state
   tree stays clean; the artifacts remain recoverable via git history — a provenance **gain**
   over 0005's `.temp` model, where they vanished at close. Abandoned (never-merged) epics
   never reach main and never distill — correct. Merged-but-undrained entries are governed by
   0004 C12 expiry.
4. **Feature linkage — one direction only.** The queue entry records its parent feature
   (`docs/features/<name>`) so the distiller can resolve which feature an epic belongs under.
   The pointer lives **in the transient queue entry, pointing at the permanent brief** — never
   the reverse. This is self-cleaning: the link dies with the entry at distill, and the target
   (the brief) outlives it, so nothing dangles. A pointer in the *permanent* brief back to the
   `<local-id>` entry would dangle after the delete-on-consume step (3) — explicitly rejected.
   Post-distill, the durable feature ↔ epic mapping is carried by the GH epic issue, the
   distilled page's provenance, and git history, not by a filesystem pointer.

## Two-store wall — restated for the queue

`.nexus/queue/` holds **committed human planning artifacts awaiting distillation** — a third
category, distinct from `docs/` (permanent human) and `.nexus/concepts/` (machine knowledge).
It does not breach 0001 D1: the queue carries human forcing-function artifacts (gated by
pipeline reviews), never an ungated machine block. The distiller reads them; it never writes
back into the queue. `.gitignore` precision: ignore nothing under `.nexus/` for this purpose —
`queue/`, `concepts/`, and `staged/`-if-any-survivor are all tracked. (Only genuinely local
scratch, if any, would be ignored; the queue is not scratch.)

## Amendments to upstream records

- **0005 §2, §4, §5, §6 — superseded.** No `.temp` (dotted, gitignored) and no
  `.nexus/staged/<id>.json`. Planning artifacts are committed in `.nexus/queue/`; close
  writes no machine block; `docs/` scope (0005 §6) is unchanged but the "leaves no trace in
  the committed tree" goal (0005 §6 close) is **reversed** — artifacts are committed, then
  deleted on distill (clean steady state + history provenance). 0005 §1 path discovery and
  §3 close-deletes-at-end survive in spirit: close still cleans up, but the durable copy now
  travels in git rather than to a sidecar.
- **0003 §8.1 — amended.** Close is the *emission* point; the distiller's curated apply is
  the *write*. "Epic close = the authoritative write" reads as authoritative *emission*.
- **0003 §8.2 — repurposed.** The `ConceptDelta` shape is the **distiller's internal/output**
  representation, not a System-A emission. A emits human artifacts; B constructs deltas.
- **0003 §9.1 — relaxed.** A no longer produces a structured concept list at close. B
  **infers** the concept mapping from the diff + queued artifacts. This is harder for the
  distiller but locates the judgment correctly (B), and avoids close pre-guessing concept
  boundaries. The distiller-over-generation risk this implies is already owned (0004 ADDRESS
  + Phase C razor audit).
- **0004 A0 — simplified.** `close-record-template` loses its machine-handoff half; it is
  human prose only. `decision-record-template` is unchanged. The BLOCKER row + Risk are
  dissolved (durability is structural).

## Out of scope (unchanged from upstream)

The distiller mechanism itself, bootstrap, reciprocity rule (0004 C11), and verification
machinery remain B-phase work. This record fixes only the **handoff surface and its
triggers** — the interface, per 0001 D5.
