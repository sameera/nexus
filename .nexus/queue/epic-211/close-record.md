---
title: "Close Record: Analyze a Member Story Pull Request From the Hub"
epic: "#211"
feature: "Multi-Repo Workspaces"
date: 2026-09-10
nexus_version: 0.30.0
analyze: overridden — 2 critical / 0 high finding(s) open; waived 2026-09-10
record: "#495"
record_hash: 48fb8c80ea9ee36c10953dc87eccccc78c503809600e98834f5ea399d77d2b58
range:
  - repo: github.com/sameera/nexus
    base: 01ce652a9565d0d7720567d4cc11844a9d2e8d3e
    head: 2da35932df3ffd38a3ab71f7c81fe1f75e139b15
---

# Close Record: Analyze a Member Story Pull Request From the Hub

## Key Decisions

- **Analyze-mode member resolution lives in its own module, not in `resolveRole`.**
  `libs/pr-worktree/src/member-target.ts` holds `parsePrReference` and `resolveAnalyzeTarget`.
  `resolveRole` in `identity.ts` stays scoped to close's post-merge gate, and it still refuses a
  member. Close's role gate calls `closePreflight`, which resolves the workspace from the member
  side and requires the hub to be locatable as a sibling checkout. Record #495 requires a member to
  select analyze mode against its own pull request even when the hub sibling is not checked out.
  Reusing `resolveRole` would have forced that hub lookup onto a case that does not need it.
  Refuted alternative: add a `mode` parameter to `resolveRole` and branch inside it. That costs
  less code today. It also couples close's hub-dependent resolution to analyze's independent one.

- **Member matching is case-insensitive on host and path.** `memberMatches` lowercases both the
  manifest's `normalizedRemote` and the supplied `owner/repo` reference before comparing.
  `normalizeRemote` preserves path case deliberately, because self-hosted forges can be
  case-sensitive. GitHub repository identity is case-insensitive in practice, and a lead pasting a
  pull-request URL reproduces GitHub's own casing, which may differ from the manifest's spelling.
  Refuted alternative: byte-exact equality on `normalizedRemote`. It is simpler, and it is
  consistent with the rest of the resolver. It fails a same-repository reference that differs only
  by case, for no safety gain. The record's threat model concerns which repository is named, not
  its letter casing.

- **A candidate's kind comes from the repository's declared classification.** `resolveStories`
  reads `github.classification` and asks whether the candidate carries the declared epic, story or
  record marker. Shape is now only a relationship check. Shape alone cannot distinguish a story of
  an epic from an epic of an initiative, so a three-level hierarchy resolves one level too high and
  the gate checks the wrong issue. Refuted alternative: keep the shape check and add a depth
  heuristic, where an issue whose parent also has a parent is an epic. That encodes one
  repository's hierarchy depth as a global rule, and it breaks as soon as an adopter nests
  differently or does not nest at all.

- **A declared classification mode that does not match the issue stops the run.** Under
  `classification: labels`, an issue carrying no epic, story or record label but a matching GitHub
  issue type stops the run with `classification-mode-mismatch`. The mirror rule holds under
  `types`. `legacy-auto` declares nothing, reads either marker, and cannot mismatch. A silent
  fallback would let a wrong `github.classification` value keep working here while every other
  stage that trusts the setting disagrees about the same issue. The settings are the repository's
  own statement, so a contradiction is a defect in the settings rather than an input to route
  around. Refuted alternative: read whichever marker is present. That is more permissive, and it
  hides the misconfiguration that would make two stages resolve one issue differently.

- **An epic-level pull request resolves to that epic's own story set.** A candidate filed as an
  epic is a valid terminal answer. The record sub-issue and withdrawn stories are removed from the
  set. When the pull request also names stories, the named stories win. One branch carrying all of
  an epic's stories is an ordinary shape, and it is what `utils/implement-epic.sh` produces.
  Refusing it would narrow `--pr` to story-level pull requests only. Refuted alternative: require
  `--story` for a pull request that names no story. That cannot work in CI, where the only input
  the gate receives is `--pr <N>`.

- **The candidate ladder gained a commit-trailer rung, ordered second.** GitHub's closing-keyword
  linkage reads the pull-request body alone, so a pull request that carries one `Closes #<n>` per
  commit states its scope only in its commit messages. Without this rung the branch name is the
  sole remaining signal, which is the dependency record #495 flagged as a risk. Only a closing
  keyword counts, so a bare `#N` in a commit body stays a mention rather than a statement of
  scope. No viable alternative was refuted.

- **`requireEpic` adds no new refusal for an unlabelled issue.** `resolveEpic` refuses an issue
  filed as a story or a record. It refuses an unmarked issue only when that issue is a sub-issue of
  something. A top-level issue with no markers still resolves, as it did before. The previous rule
  accepted any parentless issue, and requiring a positive epic marker would refuse every epic in a
  repository that labels nothing. That would be a new refusal rather than a bug fix. Refuted
  alternative: require the epic marker unconditionally. That is a cleaner rule, and it breaks
  adopters whose epics carry no label, for no gain against the defect being fixed.

- **The final fix folds into the unreleased 0.16.0 rather than taking a new minor.** Main is at
  0.13.0. Versions 0.14.0, 0.15.0 and 0.16.0 all live only on this branch, and none of the three
  has shipped. The corrected resolution is therefore what 0.16.0 delivers, rather than a change to
  it. Refuted alternative: bump to 0.17.0. That collides with the 0.17.0 to 0.21.0 entries the
  stacked epic-212 branch already carries, and it would force renumbering three branches for no
  adopter signal.

## Deviation Rationale

- **A candidate's kind is resolved from the declared classification, not from the issue graph's
  shape.** This deviates from record #495, whose candidate-ladder decision and invariant 6 state
  that a candidate is validated against the issue graph and must be a story sub-issue. The record's
  shape rule cannot tell a story of an epic from an epic of an initiative. This repository files
  epics under initiative #491, so the shape rule resolved one level too high and the gate read the
  wrong issue. The rule was replaced rather than patched, because a depth heuristic would encode
  this repository's nesting depth as a global rule.

- **An epic-level candidate is accepted as a terminal answer and expands to the epic's own story
  set.** This deviates from record #495's requirement that a candidate must be a story sub-issue.
  One branch carrying an epic's whole story set is an ordinary shape, and it is what this
  repository's own `utils/implement-epic.sh` produces. Refusing it would have narrowed `--pr` to
  story-level pull requests only, which no story of this epic asked for.

- **The ladder ships five rungs, not the four record #495 enumerated, and the added
  `commit-trailer` rung is ordered second, ahead of `branch-name`.** GitHub's closing-keyword
  linkage reads the pull-request body alone, so a pull request built one commit per story names its
  scope nowhere else. Record #495's own ADDRESS risk anticipated the branch-name rung becoming
  load-bearing and asked for a branch-name convention as the mitigation. This rung removes the
  dependency instead of documenting it.

- **Commit `adac897` changed component specifications with no version bump.** This deviates from
  record #495's invariant 16, which requires a version bump and a changelog entry in the same
  commit. The unreleased 0.16.0 changelog entry was extended instead. Main is at 0.13.0, so 0.16.0
  has never shipped, and the adopter still receives exactly one release signal for the whole
  change. Taking 0.17.0 would have collided with the stacked epic-212 branch's existing entries.

- **Configuration is still resolved with the worktree as its root in `--pr` mode.** This deviates
  from record #495's invariant 5, which states that configuration is never read from the worktree
  in any pull-request mode. `components/commands/nxs.analyze.md:169` names `$wtPath` as `<root>`,
  which contradicts line 50 of the same file. The record's ADDRESS mitigation asked for a test that
  a worktree-committed configuration file cannot redirect the gate, and no such test exists. The
  trust-boundary work was scoped smaller than invariants 3, 5 and 13 imply. The post-merge analyze
  pass surfaced the residue, and it is carried forward as deferred scope rather than reopening a
  merged pull request.

- **`libs/pr-worktree/src/pr.ts:65` runs `gh pr view` with only a working directory, and names no
  repository.** This deviates from record #495's invariant 3, which states that every GitHub call
  names its repository explicitly and that no call may infer its target from the working directory.
  This is the one call that decides which pull request is read. The deferral is the same one
  recorded above.

- **`verifyReceipt` gained an `expectedRepo` parameter that its only non-test caller does not
  pass.** `libs/pr-acceptance/src/cli.ts:336` still passes three arguments, and the parameter
  defaults permissive, so the harness's receipt check does not apply record #495's invariant 13
  stamped-repository match. The repository scoping is exercised only by its own unit tests. The
  deferral is the same one recorded above.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #527 — Complete the pull-request trust boundary in the conformance gate (invariants 3, 5 and 13 of record #495)

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-10-analyze-member-pr-per-story.md`
