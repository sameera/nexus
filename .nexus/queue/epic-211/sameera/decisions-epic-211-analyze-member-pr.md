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

## 2026-09-10 — A candidate's kind comes from settings, not from the issue graph's shape

- **Choice:** `resolveStories` reads `github.classification` and asks whether the candidate carries
  the declared epic / story / record marker. Shape (parent-of, sub-issue-of) is now only a
  *relationship* check, never a *kind* check.
- **Why:** shape alone cannot distinguish a story of an epic from an epic of an initiative, so a
  three-level hierarchy resolves one level too high and the run checks the wrong issue.
- **Refuted alternative:** keep the shape check and add a depth heuristic (an issue whose parent
  also has a parent is an epic). It encodes one repository's hierarchy depth as a global rule and
  breaks the moment an adopter nests differently or nests not at all.

## 2026-09-10 — A declared mode that does not match the issue errors instead of falling back

- **Choice:** under `classification: labels`, an issue carrying no epic/story/record label but a
  matching issue *type* stops the run with `classification-mode-mismatch` (and the mirror under
  `types`). `legacy-auto` declares nothing, so it reads either marker and cannot mismatch.
- **Why:** a silent fallback makes a wrong `classification:` value keep working here while every
  stage that trusts the setting disagrees about the same issue. The settings are the repository's
  own statement; a contradiction is a defect in the settings, not an input to route around.
- **Refuted alternative:** read whichever marker is present. Strictly more permissive, and it
  hides exactly the misconfiguration that would make two stages resolve differently.

## 2026-09-10 — An epic-level pull request resolves to the epic's whole story set

- **Choice:** a candidate filed as an epic is a valid terminal answer: the epic is itself, and the
  stories are its own live story sub-issues (record and withdrawn stories removed). When the PR
  also names stories, the named stories win.
- **Why:** one branch carrying all of an epic's stories is an ordinary shape — it is what
  `utils/implement-epic.sh` produces, and it was supported before the ladder existed. Refusing it
  would narrow `--pr` to story-level PRs only.
- **Refuted alternative:** require `--story` for a PR that names no story. It cannot work in CI,
  where the only input `/nxs.analyze` gets is `--pr <N>`.

## 2026-09-10 — requireEpic gains no new refusal for an unlabelled issue

- **Choice:** `resolveEpic`'s `requireEpic` refuses an issue filed as a story or a record, and an
  issue filed as nothing in particular *only when it is a sub-issue of something*. A top-level
  issue with no markers still resolves, as it did before.
- **Why:** the old rule accepted any parentless issue. Requiring a positive `epic` marker would
  refuse every epic in a repository that labels nothing — a new refusal, not a bug fix.
- **Refuted alternative:** require the epic marker unconditionally. Cleaner rule, but it breaks
  adopters whose epics carry no label, for no gain against the defect being fixed.

## 2026-09-10 — The fix folds into the unreleased 0.16.0 rather than taking a new minor

- **Choice:** no version bump; the 0.16.0 CHANGELOG entry is extended to describe the corrected
  resolution, and the 0.15.0 entry's ladder description is corrected in place.
- **Why:** `main` is at 0.13.0 — 0.14.0, 0.15.0 and 0.16.0 all live only on this branch and none
  has shipped, so this is what 0.16.0 delivers, not a change to it.
- **Refuted alternative:** bump to 0.17.0. It collides with the 0.17.0–0.21.0 entries the stacked
  epic-212 branch already carries, forcing a renumbering of three branches for no adopter signal.
