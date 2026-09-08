## 2026-09-08 — analyze-mode member resolution lives in a new module, not in resolveRole

- **Choice:** Added `libs/pr-worktree/src/member-target.ts` (`parsePrReference`,
  `resolveAnalyzeTarget`) as the analyze-mode role/target resolver, and left `resolveRole` in
  `identity.ts` scoped to `/nxs.close`'s post-merge gate only (still always refusing a member).
- **Why:** Close's role gate depends on `closePreflight`, which calls `resolveWorkspace` on the
  member side and requires the hub to be locatable as a sibling checkout. Decision record #495
  requires a member to be able to self-select analyze mode against its own PR even when its hub
  sibling isn't checked out there. Reusing `resolveRole` for analyze would have forced that
  hub-lookup dependency onto a case that shouldn't need it. A second, narrower resolver keeps each
  mode's checkout requirements honest instead of layering an `if (mode === "analyze") skip this
  check` branch into the close-oriented function.
- **Refuted alternative:** Add a `mode` parameter to `resolveRole` itself and branch inside it. Costs
  less code today but couples close's hub-dependent resolution path to analyze's independent one —
  the exact kind of "two rules for one hazard" pattern decision record #495 calls out.

## 2026-09-08 — member-repo matching is case-insensitive on host+path

- **Choice:** `memberMatches` in `member-target.ts` lowercases both the manifest's
  `normalizedRemote` and the supplied `owner/repo` reference before comparing, rather than reusing
  `normalizeRemote`'s comparison verbatim.
- **Why:** `normalizeRemote` (workspace/remote.ts) deliberately preserves path case, documented
  there as needed for self-hosted, case-sensitive forges. GitHub repository identity is
  case-insensitive in practice, and a lead pasting a PR URL/reference will reproduce GitHub's own
  casing, which may differ by case from the manifest's declared spelling. Byte-exact matching here
  would produce spurious "not a declared member" refusals on `github.com` for a purely cosmetic
  case difference.
- **Refuted alternative:** Byte-exact match via `normalizedRemote` equality (no extra lowercasing).
  Simpler and consistent with the rest of the resolver, but fails a same-repo, different-case
  reference on GitHub for no real safety benefit — the decision record's threat model is about
  *which* repository is named, not its letter casing.
