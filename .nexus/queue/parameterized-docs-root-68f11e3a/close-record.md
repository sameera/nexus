---
title: "Close Record: Parameterized Docs Root"
epic: #74
feature: "Multi-Repo Workspaces"
date: 2026-07-18
analyze: ran 2026-07-18 @ 142dc6b
range:
  - repo: github.com/sameera/nexus
    base: 387f0c6d512ea68af5272715d54baf028702a733
    head: 142dc6b0f8bd631b8f71dc44dbe25285413a57bf
---

# Close Record: Parameterized Docs Root

## Key Decisions

- **Re-vendored the portable-tools bundle per story, not once at the generator
  change.** esbuild inlines `@nexus/workspace/resolve` and `.../status` into
  `derive-entry-diff.mjs` and `nexus.mjs`, and the `.claude/` edits stale the
  `claude-components` payload hash — so the parity fingerprint gate reddens the
  moment Story 1 (resolver + status) and Story 3 (a skill edit) land, before
  Story 2 (the generator, the "obvious" re-vendor trigger) is touched.
  Re-vendoring whenever a story touches inlined source or `.claude/` keeps the
  pin green across every intermediate commit.
  - **Why:** it keeps the fingerprint gate green on every commit rather than red
    across the intermediate ones, matching the full-suite-every-story rigor
    chosen for this epic.
  - **Refuted alternative:** defer all re-vendoring to Story 2 / end of epic —
    rejected because it leaves the fingerprint gate red across the intermediate
    commits.

Otherwise the implementation matched the decision record line-for-line: one
resolver-produced docs root, four thin consumers (atlas generator, cross-ref
skill, hub drain, status read-out), the atlas at `<docs-root>/concepts.md` with a
computed link prefix, and byte-identical single-repo output. All seven
decision-record decisions and all nine invariants hold in the diff (0 contradicted
across 17 acceptance criteria; analyze receipt @ 142dc6b).

## Deviation Rationale

No deviations. The close-from-diff pass found the shipped code matched the
decision record's chosen approach, constraints, and all nine invariants — a
matched implementation, not a gap.

## Deferred Scope

Deferred items appended to: `docs/features/multi-repo-workspaces/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-18-revendor-tracks-inlined-source.md`
