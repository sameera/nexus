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

## 2026-09-08 — pr_digest reuses `nexus record-digest --issue`, no new fetch path (#485)

- **Choice:** the intake entry's `pr_digest` is computed by calling `nexus record-digest --issue <n>
  [--repo <owner>/<repo>]` against the pull request number and taking its `.digest` field, instead of
  adding a `--pr` flag or a second fetch function to `@nexus/record-digest`.
- **Why:** GitHub's REST issues endpoint (`repos/{owner}/{repo}/issues/{number}`) serves a pull
  request through the same shape as an issue, and `fetchRecord` already reads exactly that endpoint.
  The decision record requires reusing "the digest program the pipeline already uses for decision
  records" and refuses a second implementation; this is that reuse with zero code change.
- **Refuted alternative:** add a `--pr` mode to `record-digest` that calls `gh pr view` instead. It
  would read more obviously as "a PR digest" but duplicates a fetch the issues endpoint already
  performs, and the decision record's own refuted-alternative language (a second implementation
  drifting from the first) applies just as much to a second fetch path as to a second hash.

## 2026-09-08 — Deferred scope deferred to story #486, not stubbed in #485 (#485)

- **Choice:** `/nxs.intake`'s Phase 6 checkpoint and Phase 7 entry in this commit carry no
  follow-up/deferred-scope handling at all — no keep-or-drop list, no stub authoring.
- **Why:** story #485's acceptance criteria name only the drafted record and the approval gate;
  every acceptance criterion mentioning follow-ups belongs to story #486, which blocks on #485 in
  the implementation sequence. Adding partial follow-up handling now would be building #486's scope
  under #485's story number.
- **Refuted alternative:** stub the follow-ups section now with a "none yet" placeholder so the
  Phase 6 render shape does not change between #485 and #486. Rejected because a placeholder that
  gets replaced wholesale next commit is exactly the speculative structure the razor cuts.
