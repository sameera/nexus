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
