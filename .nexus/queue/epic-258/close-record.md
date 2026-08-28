---
title: "Close Record: Seed the project templates the pipeline stages read"
epic: "#258"
feature: "Component Distribution"
date: 2026-08-28
nexus_version: 0.1.0
analyze: ran 2026-08-28 @ 18c53841b366729f3b4b8244b93da78b6222c944
range:
  - repo: github.com/sameera/nexus
    base: 1904a8e75ba29a83350f31ff2224a343faa12a6a
    head: 632f384e3d528235cb7b20dbc388f7a842e90da7
---

# Close Record: Seed the project templates the pipeline stages read

## Key Decisions

- **Seeding is its own repo-bound verb, `nexus seed-templates`, not part of `nexus install`.** `nexus install` writes once per account, at the Claude configuration directory that no repository owns, while the templates are a project resource that belongs to a repository. Folding the seed into `install` was refuted: it would have to guess which repository to write into, and the account's single install serves every repository. The epic deliberately left the seeding site open — either the setup stage or the install verb of #253 — and this is a third site that satisfies both readings: `/nxs.setup` Phase 1 invokes the verb, and an adopter who wants only the templates can invoke it directly.
- **Seed the whole set or none of it.** Every master is read and validated before anything is written; a missing master directory, or a master directory missing a member of the set, throws naming it and leaves the repository untouched. A half-seeded `.nexus/config/templates/` would send a stage looking for a file nothing will ever place — the exact failure this epic exists to remove. Refuted: seed what is present and warn about the rest, which converts a loud failure into a quiet one.
- **Seed-never-clobber is preserved rather than revisited, and reported.** An existing destination is kept and returned under `kept`, distinct from `seeded`, so a caller can tell "already yours" from "written". A silent skip would hide that difference. This predates the epic; the decision here was to carry it forward unchanged and make it observable.
- **The master-directory gate classifies mentions instead of banning the string.** The scanner finds every mention of `common/templates/` in the component payload and exempts one governed by a contrast marker (`not`, `never`, `rather than`, `instead of`, `no longer`) within the same sentence, bounded by sentence punctuation and capped at a 60-character window. Story #324's third acceptance criterion says outright that a passage naming the directory only to rule it out is not a match, and `nxs.decision-record.md` uses that shape on purpose. Refuted: ban the literal string, which would force deleting a passage the epic asks to keep.
- **Removing the close fallback narrows failure rather than widening it.** `/nxs.close` now stops on an absent `.nexus/config/templates/close-record-template.md`, reports that path, and names `nexus seed-templates` as the remedy. The old fallback to `common/templates/` only ever resolved for someone running inside the Nexus checkout, which is why close appeared to work outside one and did not. The two stories were ordered so the fallback went away only after the seeding landed — there was no window in which close had neither.

## Deviation Rationale

- **`apps/prime/server/pty-bridge.spec.ts` pins `PRIME_SHELL` (commit 18c5384) — no story in epic #258 called for it:** the pty suite failed on a developer machine while the bridge itself behaved correctly, because the bridge spawns `$SHELL` as a login shell in the user's home and the suite was therefore testing whichever startup files that machine happened to have. It blocked the branch's test run, so it was fixed on the branch rather than deferred, and the commit body says plainly that it is not part of this epic. The fix pins a fixed shell for the suite, leaving the shell-configuration block that genuinely tests resolution to set its own; raising the `waitUntil` timeouts was refuted because it hides a machine dependency behind a longer wait instead of removing it — the run went from 13s timeouts to 863ms once the shell was pinned. Test-only, breaks no acceptance criterion. Epic #258 has no decision record, so this deviates from the epic's stated scope, not from an approved design.

## Deferred Scope

none

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-28-seed-templates-repo-bound-verb.md`
