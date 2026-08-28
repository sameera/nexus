## 2026-08-27 — Seeding runs as its own repo-bound verb, not inside `nexus install`

- **Choice:** a new `nexus seed-templates` verb that `/nxs.setup` invokes in Phase 1, with the three masters shipped in the release payload under `templates/`.
- **Why:** `nexus install` writes once per account at the Claude configuration directory, which no repository owns, while the templates are a repo-bound project resource.
- **Refuted alternative:** folding the seed into `nexus install` — it would have to guess a repository, and the account's one install serves every repository.

## 2026-08-27 — Seed the whole set or none of it

- **Choice:** validate every master is readable before writing anything; a missing master directory or missing member throws and leaves the repository untouched.
- **Why:** a half-seeded `.nexus/config/templates/` sends a stage looking for a file nothing will ever place — the failure this epic exists to remove.
- **Refuted alternative:** seed what is present and warn about the rest.

## 2026-08-27 — The master-directory gate classifies mentions rather than banning the string

- **Choice:** a scanner that finds every mention of `common/templates/` in the component payload and exempts one governed by a contrast marker (`not`, `never`, `rather than`, `instead of`, `no longer`) within the same sentence, capped at a 60-character window.
- **Why:** AC3 explicitly says a passage naming the directory only to rule it out is not a match, and the decision-record body uses exactly that shape deliberately.
- **Refuted alternative:** ban the literal string outright — it would force deleting a passage the epic asks to keep.
