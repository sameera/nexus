## 2026-09-17 — RUN_DIR naming per entry mode

- **Choice:** `RUN_NAME` is the stub issue number in promotion mode, the discovery folder's slug in
  discovery mode, and the feature slug (resolved in Phase 1, before the right-size gate) in intent
  mode — including the decomposition-to-stubs path, which has no epic slug yet.
- **Why:** Decision record #646 states the run folder is named from "the epic slug, or the source
  issue number in promotion and discovery modes," but a decomposition run (Phase 2b) has no epic
  slug and no source issue — the feature slug is the only stable identifier Phase 1 has already
  resolved by the time the folder must exist (before the Phase 2 gate).
- **Refuted alternative:** Defer creating the run folder until Phase 3/4, once an epic slug (or none,
  on the decomposition path) is known. Refuted because decision record #646 requires the folder to
  exist before the right-size gate, specifically so the decomposition path's stub work items land in
  it too (story #642).

## 2026-09-17 — Fixed nxs-razor §2's stale session-scratch wording without a version bump

- **Choice:** Corrected `components/skills/nxs-razor/SKILL.md` §2 (the two spots naming where
  `source.md` lives) to say `RUN_DIR` inside the checkout, matching the already-shipped 0.55.0
  relocation, instead of bumping to a new package version.
- **Why:** The relocation itself (`DRAFT_DIR` → `RUN_DIR`, under `.nexus/tmp/planning/<run-name>/`)
  is already the current `CHANGELOG.md` entry for 0.55.0 and decision record #646; this change fixes
  a leftover contradiction in the one file the epic missed updating, it does not change what any
  stage does. No new adopter-visible behaviour, so no new entry.
- **Refuted alternative:** Add a new `CHANGELOG.md` entry / version bump for this fix. Refuted per
  CLAUDE.md's own carve-out ("a typo fix... is not substantive") — the invariant, the gate and the
  code are unchanged; only self-contradictory prose was corrected to match what already shipped.
