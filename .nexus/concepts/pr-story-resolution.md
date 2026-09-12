---
title: "Pull-Request Story Resolution"
aliases: ["candidate ladder", "story candidates", "which story a pull request implements", "closing-issue linkage", "per-story conformance scope"]
touches: ["pr-driven-flow", "conformance-gate", "issue-kind-classification", "story-identity", "aggregated-epic-receipt", "scope-claim", "issue-absence-fact"]
last_updated_by: "#564"
status: active
verification: verified
---

# Pull-Request Story Resolution

A pull request is resolved to the story issues it implements through a ladder of candidate sources, no one of which is believed on its own: the live issue graph validates every candidate, so a wrong number can only be rejected, never accepted. The verdict then covers exactly the resolved stories, and no epic-level success metric is assessed against one pull request.

## How It Works

Candidates are gathered from five sources: a story number named in the invocation, the pull request's linked and closing issues, closing keywords in its commit messages, an issue number in its branch name, and references in its body that claim the work. What each source must say to be read at all is a separate rule.

Each candidate is looked up and kept only if the repository files it as a story or an epic. A story candidate must be a sub-issue of an epic, and that epic must name it back among its own live stories. The decision record and every withdrawn story are dropped from that set. A candidate matching no issue is set aside rather than fatal.

A pull request that names only its epic resolves to that epic's whole live story set, which is what one branch carrying every story of an epic produces. Every surviving candidate must point at the same epic.

## Key Invariants

1. No candidate source is believed on its own; the live issue graph validates every candidate.
2. A candidate survives only if the repository files it as a story or an epic, and a story candidate's epic must name it back.
3. The epic's live story set excludes its decision record and every withdrawn story.
4. Stories the pull request names win over the epic's own set; a pull request naming only its epic resolves to that whole set.
5. A candidate matching no issue is set aside and named in the refusal; every other lookup failure stops the run.
6. Zero validated stories stops the run and names every candidate and why each was dropped. Two or more stories is not an error; two or more epics stops the run.
7. The verdict covers exactly the resolved stories, no epic-level success metric is assessed against one pull request, and the receipt stamps the list the resolver returned.

## Integration Points

- [pr-driven-flow](pr-driven-flow.md) — the flow whose conformance stage resolves its scope this way before it reads the code the pull request proposes.
- [conformance-gate](conformance-gate.md) — the gate whose findings this narrows to the resolved stories, so a sibling story's code reads as scope drift rather than as an unmet criterion.
- [issue-kind-classification](issue-kind-classification.md) — decides whether a surviving candidate is a story or an epic.
- [story-identity](story-identity.md) — supplies the withdrawal rule that drops a story from the epic's live set.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — the same validated-candidate idea run in the opposite direction, resolving a story to the pull requests that carry its verdict.
- [scope-claim](scope-claim.md) — decides what each of this ladder's sources must say before a number it carries is gathered as a candidate.
- [issue-absence-fact](issue-absence-fact.md) — tells a candidate matching no issue apart from a platform failure, so a stray number sets itself aside instead of stopping the run.

## Decision Log

### 2026-09-10 — #211 — A pull request resolves to its stories through a validated candidate ladder

The walk this replaced went from a pull request, to the issue that pull request closes, to that issue's parent epic. That walk is the one thing that does not survive a repository boundary. The platform's closing-keyword linkage covers a single repository, so a member's pull request whose story lives in the hub produced no link at all. The linkage also reads the pull-request body alone, so a pull request carrying one closing keyword per commit stated its scope nowhere the walk could see. A ladder whose every rung is only a candidate makes the weak sources safe to use, because a wrong number can only be rejected, never accepted. Covering several stories rather than refusing avoids the worse outcome, which is a shipped story that carries no verdict at all. Two things shipped differently from the approved design. The ladder has five rungs rather than four, the added rung being the commit-message one, ordered second: the design had asked for a branch-name convention as the mitigation for weak linkage, and this rung removes the dependency instead of documenting it. And a pull request that names only its epic is accepted as a terminal answer rather than refused, because one branch carrying an epic's whole story set is an ordinary shape and is what this project's own implementation script produces. Refuted alternative: refuse a multi-story pull request and make the lead name one story. That keeps one verdict per story trivially. It also produces a knowingly wrong verdict, because the sibling story's code sits in the diff and is scored as drift while the sibling itself stays unverdicted, and the lead's only remedy is splitting a pull request that has already been reviewed.

### 2026-09-10 — #212 — Reciprocal link from aggregated-epic-receipt

Mechanical reciprocity fan-out: the ladder now has a mirror image. Resolving a story to its pull requests uses the same rule that makes the weak sources safe here, which is that a candidate is believed only once something independent validates it. In that direction the validator is the verdict's own stamp rather than the live issue graph.

### 2026-09-12 — #564 — The ladder gathers claims of scope, and a missing issue no longer stops it

Four defects sat in one resolver. The one that mattered let the gate report a pass: the story list a run resolves is stamped verbatim onto the receipt published on the pull request, and the epic's aggregate reads a story as analyzed when any trusted receipt names it, so a body citing three sibling stories as background marked all three analyzed and the close gate then passed over code nobody read. What a source must say before it is read moved out of this page into scope-claim, because that grammar is shared by two rungs and this page was already at its capacity; what stays here is unchanged, that a candidate is believed only once the live issue graph validates it. A candidate matching no issue is now set aside rather than fatal, so one stray number in a body or a branch name cannot stop the gate. Refuted alternative: leave the gathering broad and stamp onto the receipt only those stories whose code the diff actually touches. That targets the harmful surface directly. It loses because the claim that a diff implements a story is not mechanically decidable, and because it splits one answer into two answers that can disagree.
