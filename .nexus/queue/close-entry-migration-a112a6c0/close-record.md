---
title: "Close Record: Close-Entry Migration to the Hub Queue"
epic: #49
feature: "Multi-Repo Workspaces"
date: 2026-07-15
analyze: ran 2026-07-15 @ ca5265b
range:
  - repo: github.com/sameera/nexus
    base: a9c52304cb6d3c5ff4742ea0ac17498130eb909c
    head: ca5265b8199eaa1b2da3eb4a26b033608b0f91b8
---

# Close Record: Close-Entry Migration to the Hub Queue

## Key Decisions

The decision record already holds the architectural decisions (the three seams, the
migrate → verify → gated-remove ordering, role-from-resolver, the list-shaped full-SHA range).
Those shipped as designed and are not restated here. The two decisions below were made during
implementation and are not in the decision record.

- **The spec tsconfig lists `src/git-fixtures.ts` explicitly, rather than copying
  `libs/workspace/tsconfig.spec.json` verbatim as the plan instructed.** `git-fixtures.ts` is
  test-support (real temp git repos for the specs), so `tsconfig.lib.json` excludes it from the
  shipped build. But then no TS project claims it, and `tsc --build tsconfig.spec.json` fails
  TS6307 ("file is not listed within the file list of project") — a failure `vitest` never sees
  because it does not use `tsc`. Adding the one file to the spec project's `include` gives it a
  home. *Refuted alternative:* broaden the pattern to `src/**/*.ts` — rejected because it pulls
  every lib source into both the lib and spec builds, which TypeScript's composite-project mode
  forbids (a source file must belong to exactly one referenced project's output).

- **The pre-existing `@nexus/workspace` typecheck failure was left unfixed.**
  `libs/workspace/src/status.spec.ts` has two TS2322 errors (fixtures missing `portableToolsDir`);
  verified against a throwaway `main` worktree, they fail identically on `main` and predate this
  branch. This epic never touches `libs/workspace`, so the fix belongs to whatever change last
  touched `ResolvedWorkspace`. *Refuted alternative:* fix it inline as a drive-by — rejected as
  out-of-scope scope creep.

## Deviation Rationale

None. The shipped code matches the decision record's chosen approach, all three seams, the
migrate → verify → gated-remove order, and all nine constraints — `/nxs.analyze` confirmed every
acceptance criterion met with zero findings. A matched implementation, not a gap.

## Deferred Scope

Deferred items appended to: `docs/features/multi-repo-workspaces/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-15-close-entry-migration.md`
