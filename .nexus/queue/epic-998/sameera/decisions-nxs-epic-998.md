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
