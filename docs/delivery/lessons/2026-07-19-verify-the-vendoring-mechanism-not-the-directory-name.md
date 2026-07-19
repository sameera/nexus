---
date: 2026-07-19
epic: "nxs-pm Path References Follow the Docs Root"
source: "#87"
---

# Lesson: a directory named like a vendoring target isn't one — check the mechanism, not the name

The epic's AC4 named `libs/origin/v1/.claude/agents/nxs-pm.md` as "the vendored copy" that needed
updating alongside the source agent. That was wrong, and it wasn't caught until implementation:
`libs/origin/v1/` (and its sibling `v2/`) is a frozen historical design-workspace snapshot from
before the Nx-monorepo refactor, never touched by the live vendoring mechanism
(`vendor-bundle.ts` only writes when a `--tools-dir` is passed, which this checkout never does).
The real gate — `parity.spec.ts` — only compares a fresh hash of the live `.claude/` tree against
the committed fingerprint pin; it has no idea `libs/origin` exists.

The mistake happened at planning time: `libs/origin/` reads as "the other copy of things" by name
association, and the epic writer didn't verify that assumption against the actual vendoring code
before writing the AC. `nxs.distill.md` already documents the analogous rule for `libs/origin/v2/.nexus/`
("never written — the live store is `.nexus/` at the repo root"), but that documented rule wasn't
cross-checked when a new AC named a sibling path under the same directory.

**What the next epic touching vendoring/re-vendor ACs should do differently:** when an AC names a
specific file or directory as a vendoring/copy target, grep the actual vendoring script
(`vendor-bundle.ts`, or its equivalent) for that path before finalizing the AC — don't infer the
target from directory naming or proximity to other vendored-looking paths. `libs/origin/` looking
like a vendoring artifact is exactly the trap: it's a historical snapshot that happens to share a
naming pattern, not a target.
