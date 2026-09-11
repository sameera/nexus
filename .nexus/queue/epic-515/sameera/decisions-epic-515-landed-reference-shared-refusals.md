## 2026-09-11 — Section E built incrementally across stories, not all at once

- **Choice:** Story #541 adds Section E to `nxs-landed-reference` holding only the epic-classification
  and foreign-kind collision refusal (E's numbered items 1-5). The same-kind rewrite reconciliation
  the decision record describes as the section's second application point is added later, by story
  #543, as an extension to this same section rather than being built now.
- **Why:** Story #541's own acceptance criteria only name the refusal content; the reconciliation
  needs the qualified reference and a per-lane refusal condition (intake's filed-follow-up check)
  that story #543 defines. Building it now would guess at #543's shape before it lands.
- **Refuted alternative:** Write the full two-point section (refusal + reconciliation) in story #541
  since the decision record frames it as one shared section. Rejected because #541's stories/ACs
  don't cover reconciliation, and the blocked_by graph lets #542 and #543 both build on #541 without
  #543 requiring the reconciliation subsection to exist yet.

## 2026-09-11 — Version bumped once per story commit, not once for the whole epic

- **Choice:** Each of the three story commits bumps `package.json`'s `version` and adds its own
  CHANGELOG entry, rather than bumping once after all three stories land.
- **Why:** CLAUDE.md ties the bump to "a change under `components/` that alters what a stage does,
  in the same commit as the change" — each story independently changes adopter-visible stage
  behavior, so each commit needs its own bump to stay self-contained and bisectable.
- **Refuted alternative:** One bump in the final commit covering all three stories' behavior change
  at once. Refuted because it leaves the first two commits with component changes and no version
  signal, which is exactly the drift CLAUDE.md's rule exists to prevent.

## 2026-09-11 — Intake's filed-deferred-scope check reads the existing Deferred Scope prose

- **Choice:** Story #543's extra refusal condition for `/nxs.intake` — refuse a rewrite when the
  occupying entry already recorded filed deferred-scope issues — reads the occupying entry's
  existing `close-record.md` `## Deferred Scope` section (one or more `#<issue>` lines vs. the
  literal "none"), rather than adding a new structured frontmatter field to `epic.md` for it.
- **Why:** The epic's Assumptions section already treats `## Deferred Scope` as the source of truth
  for filed issue numbers (Phase 6.5 fills it from there), so a second field would duplicate a fact
  that one file already states, with no invariant tying the two together if they ever disagreed.
- **Refuted alternative:** Add a `deferred_scope_filed: true` frontmatter key to `epic.md` for a
  cheaper machine check. Refuted because it is a new fact to keep in sync with the prose section
  that already carries it, for a check that only ever runs against an entry this same lane wrote.

## 2026-09-11 — No second version bump for the Section E clarification
- **Choice:** Fold the absent-`entry_kind` sentence into the already-bumped 0.33.0 rather than bumping to 0.33.1.
- **Why:** 0.33.0 is unreleased on this branch, so no adopter has yet seen a Section E without the sentence.
- **Refuted alternative:** Bump to 0.33.1 with its own CHANGELOG entry.

## 2026-09-11 — Left the pre-existing store-level concepts failure alone
- **Choice:** Did not trim `.nexus/concepts/distiller.md` to clear the 25-bullet revisit advisory.
- **Why:** `concept-page-capacity` invariant 4 forbids it — "neighbour-list pressure is never a reason to drop, demote, or compress an interaction" — and invariant 6 says degree is "watched, never limited"; the 25-bullet trigger is invariant 7's prompt for a human revisit, which is the lead's call, not an epic-515 code fix.
- **Refuted alternative:** Drop a bullet from distiller.md, or raise `DEGREE_REVISIT_TRIGGER`, to make the suite exit 0.
