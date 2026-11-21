## 2026-11-15 — Hub allowlist gets only features-as-issues
- **Choice:** Registered `features-as-issues` in the workspace manifest's `github:` allowlist. Left `feature-label` and `feature-type` out, as `initiative-label` and `initiative-type` already are.
- **Why:** The record asks for a matching entry for the opt-in key (D1); the marker keys follow the initiative's precedent, and a hub's own settings.yml still supplies them.
- **Refuted alternative:** Registering all three keys in the allowlist.

## 2026-11-15 — One 0.138.0 changelog entry for the whole epic
- **Choice:** Bumped the version once, to 0.138.0, in the #1006 commit, and extend that entry in the #1007 and #1008 commits.
- **Why:** The three stories ship in one pull request, so an adopter sees one release; each commit still carries its own component change and its own changelog text.
- **Refuted alternative:** One minor release per story commit (0.138.0, 0.139.0, 0.140.0).

## 2026-11-15 — Pin the retirement changelog spec to its own release
- **Choice:** `template-retirement.spec.ts` now reads the `## 0.137.0` changelog entry instead of the entry for whatever `package.json` says; its assertions are unchanged.
- **Why:** The spec checks the note of the release that retired `seed-templates`, so any later version bump made it read the wrong entry.
- **Refuted alternative:** Keep reading the current version's entry and repeat the retirement wording in every release's note.

## 2026-11-15 — Hub manifest reads an unquoted `true` for the opt-in
- **Choice:** The manifest's `github:` block accepts a YAML boolean for `features-as-issues` and stores it as the text `true`.
- **Why:** A lead writes `features-as-issues: true`, which YAML reads as a boolean; the rule for every other key (non-empty string) would refuse it.
- **Refuted alternative:** Require the quoted spelling `"true"` on a hub.

## 2026-11-15 — Feature listing reads the REST issues endpoint
- **Choice:** `nexus feature-issue lookup` lists feature issues with `gh api repos/<repo>/issues?state=all&labels=…` (or `type=…`), paginated.
- **Why:** D5 asks for a direct listing that skips the search index, and the REST endpoint filters by label and by issue type alike.
- **Refuted alternative:** `gh issue list --search`, which goes through the search index and misses an issue filed moments earlier.

## 2026-11-15 — The feature batch reuses the initiative's filing shape
- **Choice:** The feature issue is filed by `nexus create-story` on its own folder with `--classification-label/--classification-type` set to the feature marker and `--keep-manifest`; the filer is unchanged.
- **Why:** The classification flags already let one batch carry a non-story marker, as the initiative batch does, and the kept ledger gives the repeat-reuse D6 needs.
- **Refuted alternative:** A feature-specific mode in the filer.

## 2026-11-15 — One shared feature-link module for both filers
- **Choice:** `libs/delivery-config/src/feature-link.ts` holds the feature check, the `addRelatesTo` link and the related-list read; both filers and `nexus feature-issue check-related` call it.
- **Why:** One reading of "is this a feature" and one link path keep the two filers and the read-back from disagreeing.
- **Refuted alternative:** A copy of the link step inside each filer.

## 2026-11-15 — The link is idempotent by reading both sides first
- **Choice:** Before `addRelatesTo`, the link step reads both issues' `relatesTo` lists and counts an existing link as success; a failed mutation re-reads the feature before reporting failure.
- **Why:** G17 makes an existing link success, and a repeat must not depend on how GitHub answers a duplicate add.
- **Refuted alternative:** Always call the mutation and parse its error text for "already exists".

## 2026-11-15 — The feature reference is a `feature_issue` frontmatter key
- **Choice:** Epic drafts and stub work items carry `feature_issue: "#N"`; stubs also carry a `feature issue` Meta line for promotion to read.
- **Why:** The epic-meta block already round-trips the draft frontmatter, so the resolver returns it with no shape change (G14, G22).
- **Refuted alternative:** A body line on the epic, which the resolver does not return as a field.

## 2026-11-15 — Feature references resolve against the epic repository
- **Choice:** The feature batch files with `--issues-repo <epic-repo>`, and the story filer resolves a bare `feature_issue:` against `epic-repo`, falling back to its own issues repository.
- **Why:** Analyze DV1 on PR #1038: with split epic and story repositories the feature issue landed in the story repository, outside where lookup, the epic filer and the read-back look (G10, G9).
- **Refuted alternative:** Writing `feature_issue` qualified as `owner/repo#N` on every stub, which leaves the feature issue itself filed in the wrong repository.

## 2026-11-15 — Release as 1.0.0 and drop the never-bumped version guard
- **Choice:** The epic ships as 1.0.0; `pack-release.spec.ts` no longer refuses the literal `1.0.0`.
- **Why:** The lead declared features as issues a major change; the guard only caught the npm placeholder before the first real release, and the changelog-agreement check still pins the version.
- **Refuted alternative:** Releasing 1.0.1 to sidestep the guard.
