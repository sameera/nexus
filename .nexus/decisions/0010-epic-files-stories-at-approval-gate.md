# 0010 — `/nxs.epic` files story issues at an approval-digest gate; `/nxs.tasks` is cut

**Status:** Amendment. Amends [`0009`](./0009-story-as-implementation-unit.md) (the `/nxs.tasks`
repurpose and the GH-issue-creation locus) and supersedes the `/nxs.tasks` command it produced.
**Date:** 2026-06-29.
**Builds on:** [`0009`](./0009-story-as-implementation-unit.md) (story = unit of implementation),
[`0008`](./0008-epic-direct-intent-and-stub-decomposition.md) (`/nxs.epic` takes direct intent),
[`0006`](./0006-queue-distillation-handoff.md) (the queue entry is committed-transient, drained by
the distiller).

---

## Decision

**Story-issue creation moves into `/nxs.epic`, gated by a decision-grade approval digest, and
`/nxs.tasks` is eliminated.** The epic issue and its story sub-issues are filed **together** at the
end of `/nxs.epic`, not deferred to a separate command.

Concretely:

- **Approval digest (read-surface reduction).** Before filing, `/nxs.epic` presents a digest — feature
  name + one-line statement, the epic's non-story prose (Description, Business Value, Success Metrics,
  Personas), the stories as **one-liners with sizes**, then Assumptions / Out of Scope. The full
  `epic.md` stays in the queue as drill-down. This is the human checkpoint: approve the epic *and* its
  story breakdown in one screen rather than glossing a long document.
- **Open questions block the gate.** Any unresolved `[NEEDS CLARIFICATION]` must be answered (and the
  epic updated) before the approval prompt renders or any issue is created. This is the only pre-filing
  safeguard — the consistency gate (`/nxs.analyze`) is **not** run before filing; stories are
  capability-level, so a design split surfaced later by `/nxs.hld` becomes an issue edit.
- **Coupled creation.** On `approve`, `/nxs.epic` creates the epic issue (if absent), sequences the
  stories (`blocked_by`), files one issue per story as a child of the epic, writes an
  `## Implementation Sequence` table back into the queued `epic.md`, and **writes the feature nav
  index (`README.md`) linking directly to the epic issue**. The README is deferred until the issue
  exists — never a draft queue-path pointer that must be updated later (the queue entry is transient;
  the distiller drains it, 0006).
- **`/nxs.tasks` deleted.** Its three remaining jobs (sequence stories, run the gate, create story
  issues) collapse: sequencing + creation fold into `/nxs.epic`; the gate is the standalone
  `/nxs.analyze`. The pipeline becomes **setup → epic → hld → analyze → close**.
- **`/nxs.analyze` unchanged in role** — still the standalone inline consistency gate. Only its
  closing severity note is retargeted (it no longer references `/nxs.tasks` as the issue creator).

## Rationale

0009 chose the story as the unit but left issue creation in a repurposed `/nxs.tasks` that, post-cut,
did only sequencing + gate + creation — a thin command between epic and HLD whose existence forced an
extra hop. Two problems it left open:

1. **Read-surface friction.** 0009 rejected per-story files on the grounds that splitting "relocates
   reading rather than reducing it," but offered no positive read-reduction — the reviewer still faced
   a 200+-line `epic.md` at the only checkpoint that mattered. The digest is the lever 0009 missed: it
   reduces what the human reads at the decision point **without** fragmenting the single epic artifact,
   so 0009's objection to file-splitting still holds and the friction it ignored is addressed.
2. **Decoupled filing.** Creating the epic issue in `/nxs.epic` but its stories in `/nxs.tasks` split
   one atomic act ("file this epic") across two commands and two checkpoints. Coupling them makes
   approval the single forcing function and removes a command.

This keeps the 0001 razor: the surviving artifacts (epic, decision record) are each a forcing function
or machine-consumed; the digest *is* the forcing function, and `/nxs.tasks` was neither.

## Rejected

- **Keep `/nxs.tasks` as a thin sequence+gate command** (0009 as-written). Rejected: an extra hop with
  no decision of its own; sequencing is cheap and belongs with creation.
- **Per-story or per-AC files for read reduction.** Rejected again (0009): the digest reduces reading
  without fragmenting the epic or severing the cross-story narrative.
- **Run `/nxs.analyze` inside `/nxs.epic` before filing.** Rejected: it makes the epic command heavy and
  duplicates the standalone gate; stories are capability-level, so the open-questions block is a
  sufficient pre-filing safeguard and the full gate runs as its own step.
- **Defer filing past the epic (create issues later).** Rejected: with `/nxs.tasks` gone there is no
  later creator; coupling at approval is the model. A pending queue entry (epic with no `link`) is
  re-enterable via `/nxs.epic --resume`.

## Touch list (status)

- **Done:** this record; decision-log entry; `nxs.epic.md` (resume check, draft nav-link note,
  approval-digest gate, coupled sequence + story-issue creation, `## Implementation Sequence`, feature
  README deferred to Phase 6 and written once with a direct issue link, report); deleted
  `nxs.tasks.md`; retargeted `/nxs.tasks` references in `nxs.analyze.md`, `nxs.close.md`, and the
  `nxs-gh-create-story` skill.
- **Remaining:** CLAUDE.md command-workflow rewrite (already the deferred 0009 A1 item — now also drops
  the `/nxs.tasks` step); the Gemini mirror stays deferred (0004 C9).
