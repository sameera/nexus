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

## 2026-09-08 — Deferred Scope filled before Phase 7's only disk write, not after (#486)

- **Choice:** Phase 6.5 files the kept follow-ups and fills the close record's Deferred Scope
  section entirely in memory, before Phase 7 writes `close-record.md` to disk for the first time.
- **Why:** unlike `/nxs.close`, which must fill the section into a file already committed to the
  queue, an intake entry's close record has no on-disk existence before Phase 7. There is nothing to
  edit-after-write, so filing before the single write is strictly simpler and needs no follow-up
  patch step.
- **Refuted alternative:** mirror `/nxs.close`'s literal phase order — write the record with a
  pending placeholder, file the stubs, then patch the written file. It would match the precedent
  exactly but adds a write-then-rewrite step this lane's ordering does not need.

## 2026-09-08 — Intake's no-bound stated as an explicit sentence, not left implicit (#487)

- **Choice:** added an explicit paragraph in `/nxs.distill` Phase 3 stating that an intake entry
  gets the full epic vocabulary, rather than relying on "an intake entry has no special-cased bound,
  so the default (epic) behaviour already applies to it".
- **Why:** the fix razor's bound is itself a special case layered onto an otherwise-unbounded
  synthesis phase. A reader who does not already know that would reasonably ask whether intake is
  bounded too; stating it removes the question instead of relying on the reader inferring it from
  absence.
- **Refuted alternative:** say nothing and let the unbounded default speak for itself, symmetrical
  with how epic entries need no such sentence. Rejected because intake is new in this release and
  sits directly beside the fix razor prose in the same phase; silence there reads as an omission.

## 2026-09-08 — Fingerprint check replaces the record-hash branch, not adds to it (#488)

- **Choice:** the intake fingerprint check in `/nxs.distill` Phase 0 is worded as replacing the
  decision-record-hash branch for an intake entry ("this replaces the branch above rather than
  adding to it"), rather than as a fourth *why*-source branch alongside the three existing ones.
- **Why:** an intake entry structurally has no decision record, so the three existing branches
  (record sub-issue, committed `decision-record.md`, close-record-only) can never apply to it. Two
  independent verification paths that happen to be mutually exclusive by entry kind would read as
  a coincidence rather than the guaranteed disjunction it actually is.
- **Refuted alternative:** add a fourth numbered branch to the same list ("4. an intake entry
  verifies its pull request instead"). It would read more uniformly, but the existing three branches
  are explicitly the *decision-record* resolution list; folding a structurally different check
  (pull request vs. issue, `pr_digest` vs. `record_hash`) into that same enumeration understates how
  different the check is.

## 2026-09-08 — analyze's fix refusal rewritten as an inversion, not a second clause (#489)

- **Choice:** `/nxs.analyze` Phase 0.1 changed from "stop if `entry_kind: fix`" to "run only for an
  epic entry (absent or `entry_kind: epic`); stop for anything else", rather than adding a parallel
  "stop if `entry_kind: intake`" clause beside the existing fix clause.
- **Why:** the decision record's own refuted-alternative language for the *drain's* kind-selected
  razor applies identically here — a second clause is the smallest diff, but it is also exactly the
  shape that silently under-covers a fourth kind added later. Both the drain's razor selection and
  analyze's refusal face the same closed-kind-set problem, so both get the same fix.
- **Refuted alternative:** add `entry_kind: intake` as a second named clause, matching the drain's
  literal precedent of one clause per kind before this story. Rejected for the same reason the
  decision record gives for the drain: it is the forgotten-clause failure waiting for a fourth kind.

## 2026-09-08 — fix's advisory and distill's razor refusals both point at /nxs.intake, not just one (#489)

- **Choice:** updated both the fix lane's own advisory warning (authoring time) and the drain's two
  razor refusal messages (no-existing-page, append-only mismatch) to name `/nxs.intake`, rather than
  updating only one of the two surfaces.
- **Why:** the decision record explicitly scopes story #489 to both surfaces — "an advisory warning
  at authoring time and a mechanical refusal at drain time that disagree about which lane to use is
  worse than either alone, and the drain's refusal is the one an engineer actually hits."
- **Refuted alternative:** update only the drain's refusals, since they are the ones "actually hit".
  Rejected because the epic's own AC1 is specifically about the fix lane's advisory warning, so
  leaving it unchanged would fail that acceptance criterion even though the drain-side fix covers
  the case an engineer is more likely to hit.

## 2026-09-08 — Invariant 17 fix adds one omittable bullet to the per-concept block, not a new section

- **Choice:** the distillation-PR body's Phase 7 per-concept template gets one new bullet,
  `**From an intake entry:** <ref> — ...`, following the existing `**Provenance:**` bullet, present
  only when that concept delta came from an intake entry — rather than a separate summary section
  listing intake-sourced concepts apart from the per-concept list.
- **Why:** invariant 17 requires the flag to live beside the write itself, "per concept," and the
  file's own convention already carries other conditionally-omitted bullets (e.g. **Split**) at this
  same level; a separate section would duplicate the slug list findable in the per-concept block
  above it.
- **Refuted alternative:** a single top-of-body sentence naming which of the listed slugs came from
  an intake entry. Rejected because a reviewer scanning one concept's block would have to jump back
  to the top and cross-reference by slug instead of seeing the flag where the write is described.
