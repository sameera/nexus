---
name: nxs-gh-create-story
description: Create GitHub issues from STORY-*.md work-item files. Use to bulk-create one issue per user story from markdown files whose frontmatter carries title, labels, parent (epic), and project. Extracts frontmatter, creates issues via gh CLI, links each as a sub-issue of the parent epic, and adds them to a project.
---

# NXS GitHub Create Story

Create GitHub issues from `STORY-*.md` work-item files in a target folder — one issue per user
story. The story is the unit of implementation (0009); these issues are the children of the epic
issue. `/nxs.epic` emits the `STORY-*.md` files (typically to a scratch folder) and invokes this
skill at its approval gate.

## Usage

```bash
python ./scripts/create_gh_issues.py <target_folder> [--dry-run] [--no-project] \
    [--retries N] [--retry-base-delay S] [--keep-manifest]
```

**Arguments:**

-   `target_folder` - Directory containing `STORY-*.md` files
-   `--dry-run` - Preview what would be created without making API calls
-   `--no-project` - Skip adding issues to any project
-   `--retries N` - Retries per gh call for **transient** failures (HTTP 5xx, rate limits, network). Default `3`.
-   `--retry-base-delay S` - Base seconds for exponential backoff between retries. Default `1.0`.
-   `--keep-manifest` - Keep the resume ledger even after a fully successful run (default: delete it).

## Story File Format

Each `STORY-*.md` file has YAML frontmatter; the body becomes the issue body:

```markdown
---
ref: "STORY-42.01"
title: "Shell frame and region composition"
blocked_by: none
labels: [frontend, layout]
parent: "#42"
project: "acme-corp/app-roadmap"
---

**As an** engineer, **I want** … **so that** …

## Acceptance Criteria
- [ ] …
```

**Frontmatter fields:**

| Field        | Required | Description                                                                                                                  |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ref`        | No       | Stable planning-time key (`STORY-{EPIC}.{SEQ}`). Used only to resolve `blocked_by`; **not** shown on the issue. Defaults to the filename stem. |
| `title`      | Yes      | Issue title — the plain story title (no `STORY-…` prefix; the epic link and dependencies carry the structure).               |
| `blocked_by` | No       | List of story `ref`s this story is blocked by (`[STORY-42.01, …]`), or `none`. Wired as native GitHub issue dependencies.    |
| `labels`     | No       | Extra GitHub labels: `[label1, label2, ...]`. The canonical `story` label is always added automatically.                     |
| `parent`     | No       | Parent **epic** issue reference (`#42` or full URL) — the story is linked as its sub-issue                                   |
| `project`    | No       | Per-story GitHub project override: `owner/number`, `number`, or project title. Wins over the `github.project` config target. If omitted, the config target decides (see Project Resolution). |

## Workflow

The script runs in **two passes** so that `blocked_by` can reference stories created in the same batch
(their issue numbers don't exist until pass 1 finishes).

1. Script finds all `STORY-*.md` files in the folder.
2. Ensures the canonical `story` label exists on the target repo (`gh label create story --force` — idempotent).
3. **Pass 1 — create issues.** For each file:
    - Parses YAML frontmatter (`ref`, `title`, `blocked_by`, `labels`, `parent`, `project`).
    - Prepends the `story` label to the frontmatter labels (every issue this skill creates is a story).
    - Writes a temp file with the body (frontmatter stripped).
    - Runs `gh issue create --title <title> --label story --label ... --body-file <temp>`.
    - Adds the issue to the resolved project.
    - If `parent` is set, creates the sub-issue relationship via `gh api`.
    - Records `ref → issue database id` for pass 2, then deletes the temp file.
4. **Pass 2 — wire dependencies.** For each story with `blocked_by` refs, resolves each ref through the
    pass-1 map and creates a native GitHub dependency:
    `POST repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by` with `issue_id=<blocker database id>`.
    A `blocked_by` ref not found in the batch is warned and skipped. (Dependencies are REST-only — there
    is no GraphQL mutation; the `issue_id` is the REST `.id`, not the issue number or node id.)

## Robustness — no partial issue lists

GitHub has no batch-create-with-rollback, so the script makes a partial run **recoverable** rather than
trying to be atomic. Three mechanisms:

-   **Retries with backoff.** Every `gh` call goes through a wrapper that retries **transient** failures
    (HTTP 5xx, rate-limit / abuse, network errors) with exponential backoff + jitter (`--retries`,
    `--retry-base-delay`). **Deterministic** failures (validation 4xx, auth, not-found) are not retried —
    retrying can't fix them.
-   **Resume ledger (`.nxs-created.json`).** Written into `target_folder`, it maps each `ref` to its
    created issue and is persisted **immediately after each issue is created** (atomic temp-file rename).
    On any re-run, a `ref` already in the ledger is **reused, never recreated** — so re-running the same
    command after a failure completes the remainder with **zero duplicates**. The ledger is deleted on a
    fully clean run (keep it with `--keep-manifest`).
-   **Idempotent linking.** Sub-issue links and `blocked_by` dependencies check for / tolerate an existing
    relationship, so pass 2 re-runs converge instead of erroring or duplicating.

At the end the script prints a **SUMMARY**: counts of issues created / reused / failed and dependencies
wired / already-present / unresolved / failed. If anything is incomplete it prints an **⚠️ action-required**
block listing exactly what failed, the ledger path, and the exact command to re-run to resume — and exits
non-zero. A clean run prints **✅ Complete** and exits zero.

## Project Resolution

A per-story frontmatter `project` attribute is the top override — it is looked up and used for
that story. Absent it, the declared `github.project` target in `.nexus/config/settings.yml`
decides the fallback for every story:

- **none** — no config lookup, no repository auto-discovery, no warning (the personal-repo case
  with no project at all).
- **explicit** (`owner/number` or a project title) — looks up exactly that project; no
  auto-discovery fallback.
- **auto** (or no `github:` block) — today's repository project auto-discovery.

`--no-project` skips project assignment for the whole run regardless of the above.

## Prerequisites

-   `gh` CLI installed and authenticated
-   For project integration: `gh auth login --scopes 'project'`
-   Repository context (run from within a git repo or use `gh repo set-default`)

## Examples

```bash
python ./scripts/create_gh_issues.py <scratch>/stories --dry-run
python ./scripts/create_gh_issues.py <scratch>/stories
python ./scripts/create_gh_issues.py <scratch>/stories --no-project
```
