## 2026-07-19 — Corrected vendoring target for the re-vendor AC

- **Choice:** Re-vendor step means regenerating the fingerprint pin
  (`libs/portable-tools/bundle-fingerprint.json` via `pnpm nexus:vendor-tools`) so
  `parity.spec.ts`'s live-tree-vs-pin hash check passes. `libs/origin/v1/.claude/agents/nxs-pm.md`
  is left untouched.
- **Why:** At planning time the epic's AC4 named `libs/origin/v1/.claude/` as "the vendored copy"
  to update. Investigation during implementation showed `libs/origin/v1/` (and `v2/`) is a frozen
  historical design-workspace snapshot from before the Nx-monorepo refactor — not wired into
  `vendor-bundle.ts` at all (it only writes when `--tools-dir` is passed, which this checkout,
  being single-repo with no `.nexus/tools/`, never does). `nxs.distill.md:588` documents the
  analogous `libs/origin/v2/.nexus/` as "never written" — same rule applies to `v1/.claude/`.
- **Refuted alternative:** Editing `libs/origin/v1/.claude/agents/nxs-pm.md` to match, per the
  epic's original (incorrect) AC4 wording — would have silently mutated a deliberately-frozen
  historical artifact for no gate benefit.
