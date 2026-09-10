---
title: "Pull-Request Story Resolution"
aliases: ["candidate ladder", "story candidates", "which story a pull request implements", "closing-issue linkage", "per-story conformance scope"]
touches: ["pr-driven-flow", "conformance-gate", "issue-kind-classification", "story-identity", "aggregated-epic-receipt"]
last_updated_by: "#212"
status: active
verification: verified
---

# Pull-Request Story Resolution

A pull request is resolved to the story issues it implements through a ladder of candidate sources, each validated against the live issue graph before it is believed. The platform's own closing-keyword linkage is one rung, because it covers a single repository and reads the pull-request body alone. The verdict then covers exactly the resolved stories, and no epic-level success metric is assessed against one pull request.

## How It Works

Candidates are gathered in priority order from five sources: a story number named in the invocation, the pull request's linked and closing issues, closing keywords in its commit messages, an issue number in its branch name, and repository-qualified issue references in its body. Only a closing keyword counts in a commit message, so a bare issue mention stays a mention. Each candidate is then looked up and kept only if the repository files it as a story or as an epic. A story candidate must be a sub-issue of an epic, and that epic must name it back among its own live stories. The decision record and every withdrawn story are dropped from that set. A pull request that names stories resolves to those stories. A pull request that names only its epic resolves to that epic's whole live story set, which is what one branch carrying every story of an epic produces. Every surviving candidate must point at the same epic. Zero survivors stops the run, and the refusal names each candidate it considered and why each was dropped.

## Key Invariants

1. No candidate source is believed on its own; the live issue graph validates every candidate.
2. A candidate survives only if the repository files it as a story or an epic, and a story candidate's epic must name it back.
3. The epic's live story set excludes its decision record and every withdrawn story.
4. Stories the pull request names win over the epic's own set; a pull request naming only its epic resolves to that whole set.
5. Zero validated stories stops the run, which names every candidate and why each was dropped.
6. Two or more stories is not an error and the run covers all of them; two or more epics stops the run.
7. The verdict covers exactly the resolved stories, and epic-level success metrics are not assessed against one pull request.

## Integration Points

- [pr-driven-flow](pr-driven-flow.md) — the flow whose conformance stage resolves its scope this way before it reads the code the pull request proposes.
- [conformance-gate](conformance-gate.md) — the gate whose findings this narrows to the resolved stories, so a sibling story's code reads as scope drift rather than as an unmet criterion.
- [issue-kind-classification](issue-kind-classification.md) — decides whether a surviving candidate is a story or an epic.
- [story-identity](story-identity.md) — supplies the withdrawal rule that drops a story from the epic's live set.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — the same validated-candidate idea run in the opposite direction, resolving a story to the pull requests that carry its verdict.

## Decision Log

### 2026-09-10 — #211 — A pull request resolves to its stories through a validated candidate ladder

The walk this replaced went from a pull request, to the issue that pull request closes, to that issue's parent epic. That walk is the one thing that does not survive a repository boundary. The platform's closing-keyword linkage covers a single repository, so a member's pull request whose story lives in the hub produced no link at all. The linkage also reads the pull-request body alone, so a pull request carrying one closing keyword per commit stated its scope nowhere the walk could see. A ladder whose every rung is only a candidate makes the weak sources safe to use, because a wrong number can only be rejected, never accepted. Covering several stories rather than refusing avoids the worse outcome, which is a shipped story that carries no verdict at all. Two things shipped differently from the approved design. The ladder has five rungs rather than four, the added rung being the commit-message one, ordered second: the design had asked for a branch-name convention as the mitigation for weak linkage, and this rung removes the dependency instead of documenting it. And a pull request that names only its epic is accepted as a terminal answer rather than refused, because one branch carrying an epic's whole story set is an ordinary shape and is what this project's own implementation script produces. Refuted alternative: refuse a multi-story pull request and make the lead name one story. That keeps one verdict per story trivially. It also produces a knowingly wrong verdict, because the sibling story's code sits in the diff and is scored as drift while the sibling itself stays unverdicted, and the lead's only remedy is splitting a pull request that has already been reviewed.

### 2026-09-10 — #212 — Reciprocal link from aggregated-epic-receipt

Mechanical reciprocity fan-out: the ladder now has a mirror image. Resolving a story to its pull requests uses the same rule that makes the weak sources safe here, which is that a candidate is believed only once something independent validates it. In that direction the validator is the verdict's own stamp rather than the live issue graph.
