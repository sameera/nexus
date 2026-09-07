---
title: "Close Record: Rename the Unplanned-Epic Label to needs-refinement"
epic: "#466"
feature: "Issue-Sourced Planning"
date: 2026-09-07
nexus_version: 0.6.0
analyze: waived — closed without /nxs.analyze (2026-09-07)
range:
  - repo: github.com/sameera/nexus
    base: a9c2c61048290766566a6b171870aad0bd309d8c
    head: 5c5a4b42c20504c06625328f378825645e483e1c
---

# Close Record: Rename the Unplanned-Epic Label to needs-refinement

## Key Decisions

- **Which "backlog" literals count as the unplanned marker:** renamed only the literals that stand
  for the unplanned-epic marker; left `gh.spec.ts`'s `"backlog"` (an arbitrary label name in generic
  `ensureLabel`/`labelExists` tests) and the `epic-352` corpus fixtures untouched. **Why:** the AC
  forbids anything that *resolves the marker* to `backlog`; those two are a throwaway label string
  and a frozen historical corpus, and editing the corpus would move a golden fixture for no
  behavioural reason. **Refuted alternative:** a blanket repo-wide `backlog` → `needs-refinement`
  substitution.
- **Version bump lands with Story 1, not Story 2:** bumped `package.json` to 0.6.0 with the CHANGELOG
  entry in Story 1's commit. **Why:** Story 1 is the only story that changes adopter-visible stage
  behaviour (the label a stub is filed under); Story 2 is doc and comment wording, which the
  contributing rule calls non-substantive. **Refuted alternative:** bumping in Story 2 so the release
  entry could also describe the reworded docs.

## Deviation Rationale

- **Story #468's rewording touched 19 files beyond the six its AC enumerates** (`CLAUDE.md`,
  `README.md`, both `close-record-template.md` copies, `nxs.discover.md`, `docs/features/README.md`,
  `how-to-nexus.md`, the `pr-driven-delivery`/`pre-epic-discovery` READMEs, and further spec/source
  files in `delivery-config`/`epic-resolve`): the AC named the files it could enumerate, but a
  vocabulary rename that stops halfway leaves the shipped components saying "epic stub" and the
  README they point at saying "backlog stub". The excluded trees — `.nexus/concepts/`, the archived
  `libs/origin/` tree, past CHANGELOG entries, delivery lessons, and the `epic-352` corpus — are
  either distiller-owned, frozen fixtures, or a historical record that must keep saying what it said.
  The epic has no decision record to name as the deviated-from baseline; this is checked only against
  the epic's own stated scope. The refuted alternative was touching only the six enumerated files.

## Deferred Scope

none

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-07-unplanned-label-rename.md`
