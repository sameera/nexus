## 2026-07-22 — Resolver ships as a lib+skill, recoverable-only frontmatter

- **Choice:** New nx lib `@nexus/epic-resolve` (fetch/serialize/resolve over an injectable
  Runner) with a thin `nxs-epic-resolve` skill CLI, mirroring `@nexus/pr-worktree`. The resolver
  reconstructs only the frontmatter fields recoverable from a bare epic issue (`epic` title,
  `link` number, `type` if fetched) and **omits** the rest — never fabricates `complexity`,
  `feature_path`, `slug`, `complexity_drivers`, `concepts`.
- **Why:** The filing skills strip epic frontmatter, so those fields are not on the issue today.
  Story 1 ships substrate that breaks nothing; persisting the missing fields (an embedded meta
  block) is Story 2's job (`/nxs.epic` filing), where "fully re-resolvable from its issue number
  alone" is the AC.
- **Refuted alternative:** Have the resolver default/guess the missing fields — rejected: it would
  bake wrong values into every downstream stage (hld tiers on `complexity`).

## 2026-07-22 — Materialized epic lives at gitignored `.nexus/tmp/epic-<N>/epic.md`

- **Choice:** Default output path `<repo>/.nexus/tmp/epic-<N>/epic.md`, with `.nexus/tmp/` added
  to `.gitignore`. Keyed on the issue number (the sole join key).
- **Why:** Outside version control (Invariant 4 / AC3) yet at a predictable repo-relative path a
  downstream stage can find. Deterministic per issue.
- **Refuted alternative:** OS temp dir (`os.tmpdir()`) — untracked but not discoverable at a stable
  repo-relative path across stages.

## 2026-07-22 — Story 2 persists frontmatter via an epic-issue meta block

- **Choice:** `/nxs.epic` (Story 2) embeds a `<!-- nexus:epic-meta -->` fenced-yaml block carrying
  the planning frontmatter into the epic issue body at filing; the resolver is extended to read it
  back (falling back to recoverable-only when absent, e.g. a hand-filed epic).
- **Why:** Story 2 AC — "fully re-resolvable from its issue number alone" — requires the issue to
  carry the fields downstream parsers need (unchanged parsers, per the decision record). Mirrors the
  existing `<!-- nexus:analyze-receipt -->` machine-block precedent.
- **Refuted alternative:** Map fields onto labels/project fields — `feature_path`/`concepts`/
  `complexity_drivers` do not map cleanly; a body machine-block is precedented and lossless.
