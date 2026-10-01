---
title: "Close Record: Complete, error-aware evidence from stories to pull requests for close"
epic: "#827"
feature: "PR-Driven Delivery"
date: 2026-10-01
nexus_version: 0.82.0
analyze: ran 2026-10-01 @ 4f1f630ef4d4cc5a2be0020053c0141134826108
record: "#837"
record_hash: dd78777eb7e123715965aabab6b4ac0cf93b476bc1b8a8b1fd16d9ed743c8be6
range:
  - repo: github.com/sameera/nexus
    base: e9e8f7b2056abdfcf18c551f21b9aca76b679e6e
    head: 12cb589ffa7653903287574979f9062675aa996b
---

# Close Record: Complete, error-aware evidence from stories to pull requests for close

## Key Decisions

- **The claiming read sends one query per edge, each paged on its own cursor (implements #837 D1).** The closing edge is read in full first, then the cross-references. The two connections end on different pages, and reading the closing edge first keeps "the closing edge wins" (G17) true however the pages fall. Refuted alternative: one combined query paging both connections together, which needs per-connection cursor bookkeeping and re-fetches the shorter edge.
- **The receipt read targets the pull request's own repository only when asked (#837 G19).** `verifyReceipt` and `readPrVerdict` take an optional repository. Only the evidence report passes it, with the repository the issue graph says the pull request merged in. `nexus pr-verdict` keeps its checkout-relative read unchanged. Refuted alternative: always pass the repository, which changes the existing reader's fetch for every caller.
- **The receipt read relies on gh's own paging (record risk R1).** `gh pr view --json reviews,comments` already follows every page of both connections. A test pins that selection over a payload larger than one page picks the newest receipt. Refuted alternative: a hand-written paged `gh api graphql` query, which duplicates what gh already does.
- **A receipt that names no story is listed once per pull request (#837 D4, G7).** The evidence report keeps such receipts in one `coversNone` list, so a pull request claiming several stories does not repeat the same line for each. Refuted alternative: attach the line to every story the pull request claims.
- **Fingerprints come from a dedicated `nexus story-fingerprints` command (#837 D6, D7, G22).** It resolves the issues repository itself and reuses the record digest. A stage handing a repository to `nexus record-digest` per story could fingerprint against the code repository. Refuted alternative: analyze calls `nexus record-digest --issue <story> --repo <issues repo>` once per story.
- **Receipt fingerprints are a one-line YAML flow map (#837 D7, D9).** `story_fingerprints: { <n>: <digest>, ... }` is read by the existing one-key-per-line receipt parser, the same shape `findings` uses. Refuted alternative: a nested YAML block, which needs a new parser.

## Deviation Rationale

- **The first story commit also edited `/nxs.distill` and the distill load ceiling, outside record #837's scope.** Two lines of `nxs.distill.md` were re-wrapped so a codex spec's literal match holds, and the distill load ceiling was re-recorded at 53024 bytes. The suite was already red on main before this branch (the 0.79.0 run-summary rules grew distill), and the epic needs a green suite to ship. Trimming 136 bytes of distill prose was refuted because it edits a stage this epic does not own. Nothing #837 decided is contradicted.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #840 — Close's evidence report finds a story's pull request when only the commits or the epic name it

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-10-01-evidence-report-misses-commit-closed-stories.md`
