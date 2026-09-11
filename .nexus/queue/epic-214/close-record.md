---
title: "Close Record: Drain an Entry Whose Range Is a List"
epic: "#214"
feature: "Multi-Repo Workspaces"
date: 2026-09-10
nexus_version: 0.30.0
analyze: waived — closed without /nxs.analyze (2026-09-10)
record: "#513"
record_hash: 2efdfe025dbef1f87a5e73b2b508974fff3d466853e2ee89148e34473979a056
range:
  - repo: github.com/sameera/nexus
    base: 7d289348f146211fa1103d88ff64646e6aa66c92
    head: 05f96622db747798b040bf907091c881ba80c67c
---

# Close Record: Drain an Entry Whose Range Is a List

## Key Decisions

- **The branch was cut from epic #213's unmerged work, not from main.** Record #513 assumes the
  reader already receives a range list whose entries stamp a pull request number. That stamp ships
  only on epic #213's branch, which had not merged when this epic started. Building against main
  alone would have meant writing the reader against a range-list shape that did not yet exist. The
  refuted alternative was to implement against main and rebase once #213 landed. It was rejected
  because there was nothing on main to build on, and the merge was a clean fast-forward, so
  deferring it gained nothing.

- **Two range entries are the same entry only when the repository, the base and the head all
  match, and the key that decides this separates its three fields with a NUL character.** Invariant
  4 keeps an identical repeat a malformed stamp while a repeated repository is now legitimate, so
  the reader needs a composite key. NUL was chosen because no repository identity and no SHA can
  contain one, so no combination of field values can forge a collision. The refuted alternative was
  a printable separator such as a space. A space is readable in a diagnostic and is almost certainly
  safe for these three field types, but it makes the key's correctness depend on a property of the
  values rather than on the separator. The choice had a cost this epic did not anticipate. Writing
  the NUL as a literal byte in the TypeScript source made git classify `derive-entry-diff.ts` as
  binary, so the epic's main implementation file appeared in its own pull request as
  `Bin 10761 -> 16371 bytes` and could not be read without forcing a text diff. Epic #215 later
  rewrote the same two bytes as Unicode escape sequences, which leaves the key value identical and
  restores a readable diff.

## Deviation Rationale

- **The reader's header gained a `pr <n>` suffix, against invariant 1 of record #513.** Invariant 1
  and the record's first key decision require exactly one headed block per range entry with the
  existing header text unchanged, on the reasoning that no consumer would have to learn a format.
  The shipped reader appends a `pr <n>` suffix whenever an entry stamps one, and the drain's body
  now reads the pull request out of that suffix. The reader is the only stage that holds the
  stamped number, and its stdout is the only thing the drain reads from it. Putting the number in
  the header was therefore the sole way to reach the anchor writer without a second read of
  `close-record.md` or a network lookup, both of which record #513 rules out elsewhere. The suffix
  is additive. An entry that stamps no pull request still produces the original header text, and a
  test pins that. **This deviation supersedes what record #513 decided.**

- **The pull requests were never taught into a concept page's Decision Log entry body, against the
  sixth key decision and invariant 14 of record #513.** That decision places the pull requests in
  the body of the single Decision Log entry a delta appends, naming each repository and pull
  request whose change justified it, and that is how story #507's first acceptance criterion was to
  be met. The shipped drain adds pull-request attribution to the anchor sidecar only. Its Decision
  Log entry rules still require the why plus the refuted alternative and nothing more. The work was
  deferred because a multi-pull-request drain that produces a page delta cannot be exercised end to
  end in this release, so there was no real multi-entry drain to write one against. The consequence
  is that the epic's third success metric holds for anchors and does not yet hold for a page's
  provenance line. The remainder is filed as deferred scope below.

- **The single-repository path reuses `/nxs.close`'s role gate, so the drain can print a
  close-stage diagnostic.** Record #513 says only that single-repository mode resolves each entry
  against the current checkout's own identity, and that an entry naming another repository is the
  existing unknown-repository error. It names no borrowed gate and no member refusal. The shipped
  reader calls `resolveRole` from the pull-request-worktree library, which adds a
  `member-unsupported` problem to the drain and reports it in wording written for `/nxs.close --pr`.
  A lead who runs the drain in a member checkout is therefore told about a close flag they did not
  use. `resolveRole` was reused because it is the only committed helper that classifies a checkout
  from its own artifacts without reading the network, and writing a second classifier would keep
  two copies of a rule that record #513 elsewhere refuses to duplicate. The wrong stage name in the
  message is filed as deferred scope below.

- **The reader's count line still says "repo diff(s)" while counting range entries.** The record's
  first key decision requires the count line to report entries rather than repositories. The number
  shipped correctly and the label did not, so an epic that closed over three pull requests in one
  repository reports `3 repo diff(s)` for a single repository. The label was missed when the
  cardinality was renamed. It is filed as deferred scope below.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #533 — Name the pull requests in a concept page's decision log entry
- #534 — The drain's own output names the right stage and the right unit

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-10-drain-a-range-list.md`
