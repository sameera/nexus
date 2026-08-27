---
name: nxs-epic-resolve
description: Rebuild a planned epic from its GitHub issue number — the epic body, its story sub-issues, and the native blocked_by graph — into a deterministic, gitignored epic.md. The single producer of the materialized epic every downstream stage reads when nothing was committed at planning.
---

# nxs-epic-resolve

Run the resolver that reconstructs an epic from the issue graph. It is the shared substrate for
issue-sourced planning: with `/nxs.epic` committing nothing at planning time, every stage
(`/nxs.decision-record`, `/nxs.analyze`, `/nxs.close`, `--from`) obtains the epic by resolving its issue number
through this one helper, so they all see the same reconstruction.

## Purpose

Given an epic issue number — the sole join key — it fetches the epic issue body, its story
sub-issues, and each story's native `blocked_by` dependencies, and materializes them into the
existing `epic.md` field shape (frontmatter + `## User Stories` + `## Implementation Sequence`) at
an ephemeral, gitignored path. The output is:

-   **Deterministic / byte-identical** on re-run against an unchanged issue graph — stories are
    ordered by ascending issue number (never GitHub's return order), the sequence table is rebuilt
    from the live dependency edges (never a stale table baked into the issue body), and no volatile
    field (timestamp, run id) is ever emitted.
-   **Fail-closed** — any unfetchable referenced sub-issue is a hard non-zero exit that writes no
    output; a dropped story never masquerades as an epic with fewer stories.
-   **Ephemeral** — written under `.nexus/tmp/` (gitignored), so a run leaves `git status` reporting
    no new tracked file.
-   **Keyed on issue numbers only** — a story is `### Story #<issue>:` and the sequence table's rows
    and `blocked_by` cells are `#<issue>`. The `STORY-<epic>.<seq>` ref belongs to `/nxs.epic`'s
    pre-filing batch, where no issue numbers exist yet; re-deriving it here would give each story a
    second, **positional** name that shifts whenever the epic is re-scoped while the issue number
    beside it stayed correct.

Frontmatter carries only what a bare epic issue recoverably provides — the `epic` title and the
`link` number. Fields the filing skills strip (`complexity`, `feature_path`, `slug`, …) are omitted,
never fabricated.

## The decision-record sub-issue

An epic's **decision record** lives as a sub-issue of the epic issue (epic #139), so the sub-issue
set is not homogeneous. The resolver identifies that sub-issue **record-positively** and keeps it out
of the story set — otherwise every stage that iterates stories (design coverage, conformance,
close's all-stories-closed gate) would act on a phantom story.

-   **Classification** comes only from the shared publishing resolver
    (`nexus-gh config resolve …`): the declared `classification` mode
    selects the record **label** or the record **issue type**. Nothing here parses `settings.yml`,
    and there is no fallback guess — an unresolvable classification is the named diagnostic
    `record-classification-unresolved`.
-   **Recoverable fields.** When a record sub-issue exists, the materialized frontmatter carries
    `record: "#<n>"` and `record_state: open | closed` (closed = approved), and the printed JSON
    carries `record: { number, state }`. An epic with **no** record sub-issue emits neither field —
    never a placeholder — and resolves byte-identically to the pre-#139 output.
-   **At most one.** Two record sub-issues abort with `multiple-record-subissues`; the resolver never
    silently picks one.

## Unplanned epics

A **backlog stub** is an epic issue that has been identified but not yet planned (epic #185) — it
carries the repository's declared unplanned label, has no planning meta block, and has no story
sub-issues. Resolving one would emit an epic whose story set is empty, which every downstream stage
reads as "an epic that plans nothing" rather than "work nobody has planned".

So the resolver refuses it by name: `epic-not-planned`, naming the label it found and pointing at
`/nxs.epic <n>` to plan it. The label is read through the shared publishing resolver
(`unplanned-label`), never hard-coded, and the check applies on every path — `--require-epic` or
not, because every stage that reconstructs an epic can meet one.

## Withdrawn stories

Re-scoping an epic leaves its cancelled stories behind as closed sub-issues — that is where the
supersession trail belongs — but they are no longer scope. Label such a story **`wontfix`** or
**`invalid`** and the resolver drops it: it is absent from `## User Stories` and from the sequence
table, and any `blocked_by` edge onto it is dropped rather than dangling a pointer to work that will
never ship. The surviving stories keep their own names, because those names are their issue numbers.

-   **Closure state is not the signal.** A delivered story is closed too, so withdrawal must be said
    explicitly. Closing as *not planned* alone does not remove a story from the materialization.
-   **The match is exact**, case-folded like GitHub's label namespace — `wontfix-followup` is a live
    story, not a withdrawal.
-   **Never the record.** A record sub-issue is kept whatever labels it carries; its own withdrawal is
    the approval question, which downstream stages decide from `record_state`.

## Usage

```bash
nexus epic-resolve --epic <N> [--out <path>] [--root <startDir>] [--require-epic]
```

-   `--epic <N>` — the epic issue number (required).
-   `--out <path>` — override the default output path (`<targetRoot>/.nexus/tmp/epic-<N>/epic.md`).
-   `--dir <startDir>` — the checkout to resolve the workspace from (default: the current directory).
-   `--require-epic` — validate that the target is an epic before materializing: a story sub-issue
    fails `not-an-epic` and a non-existent number fails `epic-not-found`, each with no output. This is
    the `/nxs.epic --from` security boundary; the internal stages omit it (they resolve epics they
    already know are epics).

On success it prints one JSON object: `{ epic, targetRoot, outPath, record }` — read `outPath` for
the materialized `epic.md`, and `record` for the decision-record sub-issue (`null` when the epic has
none).

## Contract

-   Success prints exactly one JSON object on stdout; a failure prints an `epic-resolve <problem>:
    <message>` diagnostic on stderr. Exit codes: `0` success · `1` a named diagnostic · `2` usage.
-   **Targeting comes from the workspace resolver (#38)**, never a fresh heuristic: in a workspace it
    queries the hub repo's issues; in single-repo it queries the local repo.
-   **Read-only.** It fetches via `gh` (issue view, the sub-issues and sub-issue-type GraphQL
    queries, the `dependencies/blocked_by` REST endpoint) and reads classification through the
    shared publishing resolver; it creates, edits, closes, and labels nothing.
-   The materialized `epic.md` is ephemeral and gitignored — treat it as a derived artifact, never
    commit it, and never link it from an issue.
