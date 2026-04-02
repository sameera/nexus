# /nxs.qa

## Purpose

Orchestrates QA case lifecycle as GitHub issues (`qa-test-case`) with three modes:
- `--mode design`
- `--mode implement`
- `--mode verify`

## When to Use

Run after `nxs.tasks` has created task files:

```
nxs.epic → nxs.tasks → /nxs.qa --mode design → nxs.dev → /nxs.qa --mode implement → /nxs.qa --mode verify → nxs.ship
```

## Prerequisites

**For `--mode design`:**
- `gh` CLI authenticated (`gh auth status`)
- GitHub repository accessible
- Tasks created via `/nxs.tasks` (recommended; epic-only mode is supported but produces shallower specs)

**For `--mode implement`:**
- `<epic-folder>/qa_issues.json` present (created by design mode)
- Implementation code committed and unit/API tests passing

**For `--mode verify`:**
- `<epic-folder>/qa_issues.json` present
- Application running (or use `--auto-start` to start it automatically)
- Playwright MCP configured

## Usage

- `nxs.qa --mode design --epic-path docs/features/<feature>/<epic>/<epic>.md`
- `nxs.qa --mode implement --epic-path docs/features/<feature>/<epic>`
- `nxs.qa --mode verify --epic-path docs/features/<feature>/<epic>/<epic>.md [--auto-start]`

## Behavior

### design

1. Reads epic + tasks to understand all testable scenarios.
2. Ensures epic content is present; if missing, runs:
   - `git fetch origin`
   - `git checkout origin/main -- <epic-folder>`
3. Presents a **coverage plan** for user approval — lists all test cases before writing anything.
4. On approval, creates one GitHub issue per test case, labeled `qa-test-case`.
5. Detects intent mismatch between epic and QA scenarios. Prompts user to resolve:
   - update QA issues
   - update epic/tasks
   - continue with risk acknowledgement
6. Saves metadata to `<epic-folder>/qa_issues.json`.

> **User checkpoint:** You must approve the coverage plan before any issues are created.

### implement

1. Reads `<epic-folder>/qa_issues.json` and fetches QA issue content from GitHub.
2. Reads the committed implementation code to identify real selectors and endpoints.
3. Presents a **chunk plan** (groups of 1–4 related test cases) for user approval.
4. On approval, writes and runs tests chunk by chunk; fixes failures up to 3 attempts.
5. Surfaces failures and options if attempts are exhausted.

> **User checkpoint:** You approve each chunk before tests are written. You decide how to handle persistent failures.

### verify

1. Reads `<epic-folder>/qa_issues.json` (or fetches from GitHub if missing).
2. Confirms the application is reachable using Playwright MCP.
3. Executes all 7 validation categories using real browser interactions:
   - Functional (per QA spec test cases)
   - Security (OWASP Top 10)
   - Performance (load time, API response time)
   - Permissions (RBAC, data isolation)
   - Monkey testing (edge case interactions)
   - Cross-browser
   - Accessibility (WCAG AA)
4. Writes a comprehensive QA report to `<epic-folder>/qa/QA-REPORT-<timestamp>.md`.
5. Presents pass/fail summary and waits for user go/no-go decision.

> **User checkpoint:** The go/no-go decision is always yours. The agent reports; you decide whether to ship.

## GitHub label

Always use `qa-test-case` at issue creation.

## Relationship with `/nxs.dev`

- `nxs.dev` does not invoke `nxs.qa` automatically.
- It checks for QA case metadata or links, and if missing, prompts to run `nxs.qa --mode design`.
