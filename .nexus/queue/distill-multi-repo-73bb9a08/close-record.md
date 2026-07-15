---
title: "Close Record: Distill Across a Multi-Repo Workspace"
epic: #54
feature: "Multi-Repo Workspaces"
date: 2026-07-15
analyze: ran 2026-07-15 @ 7c08d74
range:
  - repo: github.com/sameera/nexus
    base: 9778d437b2f1f3a271ccec1e01220c4a89cf2bef
    head: 7c08d748496ded67b34c3266642de2380e675f1a
---

# Close Record: Distill Across a Multi-Repo Workspace

## Key Decisions

- **Kept `@nexus/portable-tools` non-buildable with a minimal `exports` map, rather than
  suppressing the lint per-import.** Wiring `derive-entry-diff.ts`'s cross-lib imports
  (`@nexus/workspace`, `@nexus/close-migration`) failed `@nx/enforce-module-boundaries`
  (`enforceBuildableLibDependency: true`): `@nx/js`'s target inference had classified
  portable-tools as *buildable* purely because its `package.json` carried no `exports`/`main`,
  and a buildable project may not import a non-buildable one. Adding
  `"exports": { "./package.json": "./package.json" }` matches the two imported libs' non-buildable
  shape (they export subpaths straight to `./src/*.ts`), which clears the rule without touching the
  `typecheck`/`lint`/`test`/`bundle` targets the repo actually uses. **Refuted alternative:**
  per-line `eslint-disable` on the two imports — rejected because it papers over a real
  classification mismatch and would have to be repeated at every future cross-lib import site.

## Deviation Rationale

No deviations. The shipped diff matches the decision record's chosen approach and all ten
invariants: hub-mode diff derivation is recorded-range-only with hard per-entry errors and no
hub fallback, empty diff, partial diff, fetch, or clone (invariants 3–5); anchors carry a per-repo
`<repo>@<sha>` `source_sha` mapping with every path repo-qualified while the single-repo scalar form
is untouched (invariants 6–7); and the single mode gate is manifest-presence only (invariants 1–2).
Conformance was independently confirmed by `/nxs.analyze` (12/12 acceptance criteria met, 0
contradicted, no invariant violated, no material scope drift).

## Deferred Scope

<!-- Pointer only. -->

None. All four stories shipped complete with every acceptance criterion met; nothing was cut or
deferred. (The one analyze low finding — M3's "terse `#n` never appears in a workspace drain" is
command-enforced, not validator-gated — is an accepted design limitation, not deferred work; it is
captured in the process lesson.)

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-15-distill-multi-repo.md`
