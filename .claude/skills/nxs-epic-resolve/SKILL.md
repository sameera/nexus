---
name: nxs-epic-resolve
description: Rebuild a planned epic from its GitHub issue number — the epic body, its story sub-issues, and the native blocked_by graph — into a deterministic, gitignored epic.md. The single producer of the materialized epic every downstream stage reads when nothing was committed at planning.
---

# nxs-epic-resolve

Run the resolver that reconstructs an epic from the issue graph. It is the shared substrate for
issue-sourced planning: with `/nxs.epic` committing nothing at planning time, every stage
(`/nxs.hld`, `/nxs.analyze`, `/nxs.close`, `--from`) obtains the epic by resolving its issue number
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

Frontmatter carries only what a bare epic issue recoverably provides — the `epic` title and the
`link` number. Fields the filing skills strip (`complexity`, `feature_path`, `slug`, …) are omitted,
never fabricated.

## Usage

```bash
tsx ./.claude/skills/nxs-epic-resolve/scripts/epic_resolve.ts --epic <N> [--out <path>] [--dir <startDir>] [--require-epic]
```

-   `--epic <N>` — the epic issue number (required).
-   `--out <path>` — override the default output path (`<targetRoot>/.nexus/tmp/epic-<N>/epic.md`).
-   `--dir <startDir>` — the checkout to resolve the workspace from (default: the current directory).
-   `--require-epic` — validate that the target is an epic before materializing: a story sub-issue
    fails `not-an-epic` and a non-existent number fails `epic-not-found`, each with no output. This is
    the `/nxs.epic --from` security boundary; the internal stages omit it (they resolve epics they
    already know are epics).

On success it prints one JSON object: `{ epic, targetRoot, outPath }` — read `outPath` for the
materialized `epic.md`.

## Contract

-   Success prints exactly one JSON object on stdout; a failure prints an `epic-resolve <problem>:
    <message>` diagnostic on stderr. Exit codes: `0` success · `1` a named diagnostic · `2` usage.
-   **Targeting comes from the workspace resolver (#38)**, never a fresh heuristic: in a workspace it
    queries the hub repo's issues; in single-repo it queries the local repo.
-   **Read-only.** It fetches via `gh` (issue view, the sub-issues GraphQL query, the
    `dependencies/blocked_by` REST endpoint); it never mutates GitHub or any checkout.
-   The materialized `epic.md` is ephemeral and gitignored — treat it as a derived artifact, never
    commit it, and never link it from an issue.
