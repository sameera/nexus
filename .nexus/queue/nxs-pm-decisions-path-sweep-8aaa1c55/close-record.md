---
title: "Close Record: nxs-pm Path References Follow the Docs Root"
epic: #87
feature: "Multi-Repo Workspaces"
date: 2026-07-19
analyze: waived — closed without /nxs.analyze (2026-07-19)
range:
  - repo: github.com/sameera/nexus
    base: 59dad029c92c4af1ad44682748ae9f84720c47e1
    head: 33446b81f6b6f13a2f9dc812eb8e9c75537ca9d4
---

# Close Record: nxs-pm Path References Follow the Docs Root

## Key Decisions

- **The "re-vendor" AC means regenerating the fingerprint pin, not editing `libs/origin/v1`.**
  The epic's AC4 named `libs/origin/v1/.claude/agents/nxs-pm.md` as "the vendored copy" to update
  alongside the source agent. Implementation found `libs/origin/v1/` (and `v2/`) is a frozen
  historical design-workspace snapshot predating the Nx-monorepo refactor — never a copy target
  of the live vendoring mechanism, which only writes when `--tools-dir` is passed (never, in this
  single-repo checkout). The actual gate is `parity.spec.ts`, satisfied by regenerating
  `libs/portable-tools/bundle-fingerprint.json` via `pnpm nexus:vendor-tools` (verified 18/18
  passing). *Refuted alternative:* edit `libs/origin/v1/.claude/agents/nxs-pm.md` to match, per the
  epic's original wording — would have mutated a deliberately-frozen historical artifact for no
  gate benefit.

## Deviation Rationale

- **AC4's named vendoring target was wrong and was corrected mid-implementation, not shipped as
  written:** the epic (gated clean and approved) said to update a "vendored copy" at
  `libs/origin/v1/.claude/agents/nxs-pm.md`. That target does not exist in the real vendoring
  path. Rather than ship against the incorrect AC, the epic text and the already-filed story issue
  (#88) were corrected in place to name the actual mechanism (fingerprint-pin regeneration) before
  implementation closed out, so the committed record matches what actually shipped.

## Deferred Scope

None deferred — the sweep's three references were fully enumerated at planning time and all three
shipped in this change.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-19-verify-the-vendoring-mechanism-not-the-directory-name.md`
