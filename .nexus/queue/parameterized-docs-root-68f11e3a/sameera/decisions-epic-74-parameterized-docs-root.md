## 2026-07-18 — Re-vendor after Story 1, not deferred to Story 2
- **Choice:** Ran `pnpm nexus:vendor-tools` immediately after Story 1's resolver/status changes,
  rather than waiting until Story 2 as originally planned.
- **Why:** `derive-entry-diff.mjs` and `nexus.mjs` already import `@nexus/workspace/resolve` and
  `.../status`, and esbuild inlines that source — so Story 1 alone staled their bundled bytes.
  Editing `nxs-workspace-status/SKILL.md` also staled the `claude-components` payload hash. The
  parity fingerprint gate caught both immediately; re-vendoring per-story (whenever a story
  touches bundled source or `.claude/`) keeps the pin in sync instead of batching it.
- **Refuted alternative:** Defer all re-vendoring to the end (or to Story 2, per the initial plan).
  Rejected — it leaves the fingerprint gate red across intermediate commits, and "full suite every
  story" was the chosen verification rigor for this epic.
