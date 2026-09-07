---
feature: "Issue-Sourced Planning"
feature_path: docs/features/issue-sourced-planning
epic: "Rename the Unplanned-Epic Label to needs-refinement"
slug: unplanned-label-rename
created: 2026-09-07
type: enhancement
complexity: S
complexity_drivers: [single-concern rename, spans two libs plus docs, one live GitHub state mutation]
concepts: []
link: "#466"
---

# Epic: Rename the Unplanned-Epic Label to needs-refinement

## Description

The label GitHub uses to mark an epic that exists but has not yet been decomposed into sized stories is currently named `backlog`. The word `backlog` collides with "the product backlog" — the general list of everything not yet done. A reader looking at an issue's labels cannot tell whether `backlog` means "this specific epic still needs refinement" or "this is part of our backlog" in the everyday sense.

The replacement is `needs-refinement`, the standard agile term for the ceremony that turns a raw item into an estimated, story-sized one. This is exactly what happens when a stub is promoted with `/nxs.epic <issue-number>`. `needs-refinement` was chosen over the original proposal and over `not-planned`/`unplanned`. These epics genuinely are on the roadmap; they have simply not been refined yet.

The label is resolved from exactly one place: the `unplanned-label` config key's builtin default. Therefore, the rename is small and well-bounded. The change affects one default value, the live GitHub label, the tests that pin the old literal value, and the "backlog stub" wording in docs and code comments. When the live label is renamed in place, every existing issue keeps it under the new name without per-issue relabeling.

## Success Metrics

- No config default, source file, test, or documentation file resolves the unplanned-epic marker to `backlog` — every one resolves to `needs-refinement`.
- Every issue that carried the `backlog` label before the rename still carries the renamed label afterward, with no issue relabeled by hand and none dropped from the backlog query.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Story 1 alone removes the ambiguous label value, which is the concrete thing asked for. Story 2 is a documentation-consistency follow-on that leaves nothing broken if deferred.

## User Stories

### Story #467: Rename the "backlog" label to "needs-refinement"

**As a** person reading an epic issue's labels, **I want** the marker for "not yet refined into stories" to say `needs-refinement` instead of `backlog`, **so that** I cannot mistake it for the product backlog.

## Acceptance Criteria

- [ ] **Given** a repository with no `unplanned-label` override declared, **when** the key is resolved, **then** it resolves to `needs-refinement`, not `backlog`.
- [ ] **Given** the live GitHub label previously named `backlog`, **when** the rename runs, **then** the label is renamed in place — not deleted and recreated — so every issue that carried it keeps it under the new name with no per-issue relabeling.
- [ ] **Given** the existing tests that assert the old literal value, **when** the suite runs after the rename, **then** every assertion expects `needs-refinement` and the suite passes.
- [ ] **Given** a repository whose `settings.yml` already declares an explicit `unplanned-label` override, **when** the rename ships, **then** that override is left untouched — only the builtin default changes.

## Notes

The label is resolved in exactly one place: the `unplanned-label` row's `builtin` field in `libs/delivery-config/src/keys.ts`. Renaming the live label with `gh label edit backlog --name needs-refinement` preserves every existing issue's association automatically, since it edits the label in place rather than creating a new one. Tests to update include `publishing.spec.ts`, `backlog.spec.ts`, `resolve.spec.ts`, `promote.spec.ts`, `preflight.spec.ts`, and the doc comment in `gh-fixtures.ts`.

### Story #468: Rename the "backlog stub" term to "epic stub" in docs and comments

**As a** person reading the Nexus command docs or source comments, **I want** the descriptive term for this object to say "epic stub" instead of "backlog stub", **so that** the vocabulary matches the renamed label and no longer carries the ambiguous word.

## Acceptance Criteria

- [ ] **Given** `nxs.epic.md`, `nxs.close.md`, and the `nxs-epic-resolve` skill doc, **when** they are searched for the phrase "backlog stub", **then** no occurrence remains — each is reworded to "epic stub" or an equivalent that drops "backlog".
- [ ] **Given** the code comments in `classify.ts`, `story-filer/preflight.ts`, and `resolve.spec.ts` that use "backlog stub" or "backlog-stub", **when** they are reviewed after the change, **then** none remain.
- [ ] **Given** the `backlog-query` CLI command, the "cross-feature backlog" phrasing, and epic #185's historical issue title, **when** this story ships, **then** none of them are renamed — they name the general list-of-open-work concept or an already-shipped issue title, not this object's identity.

## Notes

Documentation and comment-only story; it changes no resolved value and no runtime behavior. It should land after Story 1, since several of the reworded sentences also mention the label's literal value.

## Assumptions

- Renaming the GitHub label in place (`gh label edit`) is available and sufficient — no repository needs the old and new labels to coexist during a transition window.

## Out of Scope

- Renaming `backlog-query`, the "cross-feature backlog" phrasing, or epic #185's historical issue title.
- Renaming the `unplanned-label` config key itself (its `github:` block spelling, its normalized name, or the functions named after it, e.g. `resolveUnplannedLabel`). Only the *value* the key resolves to changes; the key name is a separate, internal identifier with no reader-facing ambiguity, and renaming it would break every repository's existing `settings.yml` override.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #467 | none |
| #468 | #467 |
