## 2026-09-08 — Shared skill sectioned rather than one linear phase list (#484)

- **Choice:** `nxs-landed-reference` exposes four independently-invokable sections (A: checkout-role
  gate, B: reference resolution, C: range resolution, D: qualification) instead of one linear phase
  sequence.
- **Why:** `/nxs.fix` needs its own epic/collision refusal between reference resolution and range
  resolution, so the shared rules had to be callable out of a strict single sequence.
- **Refuted alternative:** one monolithic phase list mirroring the old `/nxs.fix` phase numbering.
  It would force every lane through the same interleaving, and `/nxs.fix`'s epic/collision refusal
  has no equivalent in `/nxs.intake`.

## 2026-09-08 — CHANGELOG entry for #484 uses the no-behaviour-change form (#484)

- **Choice:** version 0.8.0's entry says "No change to how any pipeline stage behaves." plus one
  internal-only note, and `release-notes.spec.ts`'s `thisRelease` fixture sets
  `changedStageBehaviour: false`.
- **Why:** the fix lane's recorded output is unchanged (Phase 5–7 templates untouched); only the
  internal mechanics of reference/range resolution moved into a shared skill also used by the
  not-yet-landed intake lane. Neither lane is one of the seven `PIPELINE_STAGES` the release check
  recognises, so there is no stage word to name truthfully.
- **Refuted alternative:** claim the "fix" stage changed. `fix` is not in `PIPELINE_STAGES` and the
  lead-visible behaviour of `/nxs.fix` did not change, so this would be inaccurate framing purely to
  satisfy the check's regex.
