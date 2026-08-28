# Nexus

## Project Overview

**Nexus** is a lean, spec-driven delivery pipeline for the age of AI agents. It assists Product and Project management — turning intent into validated, decision-grade specs — and leaves implementation to engineers.

**Core Philosophy:** Generation is cheap. Judgment is not. Nexus's failure mode to guard against is speculative over-generation: heavy artifacts (sprawling HLDs, per-task plans, prose reports) produced ahead of validated scope, burying the human decisions that matter. The rule: every artifact must force a human decision, or it gets cut.

**Pipeline:** `setup → (discover when foggy) → epic → decision-record → analyze → close → distill`. Implementation sits between the decision record and analyze and belongs to engineers, and the distiller drains the closed queue into the concept store. In the PR-driven flow the lead runs `analyze --pr` against the (possibly open) PR, merges, then runs `close --pr` and `distill` post-merge in one shared worktree. The user story, not the technical task, is the terminal planning unit and the GitHub-issue granularity — Nexus stops decomposing once a story is small enough to ship and verify on its own. Implementation itself stays the engineer's job — Nexus plans and gates the work, it does not write the code.

**Discovery (`/nxs.discover`)** is the pre-epic stage, and it runs only when an initiative is *underspecified* — foggy, so that the split itself hangs on unmade decisions. That is distinct from *oversized* — big but clear, which `/nxs.epic` still decomposes into backlog stubs. Its durable contract: discovery is a multi-session loop, its unit is the decision ticket (a question whose resolution is a decision, never a slice of build work), its output is functional goals that `/nxs.epic` files, and a discovery is shared by ordinary git operations. It writes nothing to GitHub — the issues appear when `/nxs.epic --discovery` consumes the finished discovery. *First iteration:* the store is a committed folder under `.nexus/discovery/` holding a discovery doc and one file per ticket.

## Working on Nexus itself

Nexus's components are authored under `components/` at the repository root — **not** under
`.claude/`, which is the directory the harness loads and which this repository deliberately keeps
empty of components. Read `CONTRIBUTING.md` before changing one: it describes the authored tree and
the maintainer's loop, which points the account's install location at this checkout instead of
copying a release.

## Code Conventions

- **No barrel files.** Don't create `index.ts` (or `index.js`) files whose only job is
  to re-export from sibling modules, and don't add exports to existing ones. Import directly
  from the module that defines the symbol. Barrels obscure the dependency graph, defeat
  tree-shaking, and create import cycles. When you need a symbol, import it from its source.

## Test-First Development

All implementation work follows **Test-First Development (TFD)**: write the
failing test that pins the intended behavior _before_ writing the code that satisfies it.

Guidelines:

- Test user-visible behavior and interactions — not implementation.
- Assert on outcomes, not internal component details.
- Don't assert on exact strings unless the exact text is itself the requirement.
- Don't assert on CSS classes, styles, or layout/positioning — unless styling is the feature.
  For the terminal emulator, rendered output (character grid, colors, cursor) often _is_ the
  user-visible behavior; assert it as the user perceives it, not through implementation-specific
  DOM.
- Don't test component internals: state, private methods, or DOM structure.
- Keep tests resilient to refactors by matching how a real user experiences the UI.

After implementation, application source at **95% test coverage**. Treat coverage as a
signal, not a score to game — never add internal-facing tests solely to move the number. If a
branch can't be reached through user-visible behavior, question whether it should exist.

## In-Flight Decision Stubs

When you make a non-obvious implementation choice — you picked between viable approaches —
append a stub to your per-user scratch inside the epic's queue entry, at the moment of
choosing, not later:

    .nexus/queue/epic-<epic-issue-number>/<your-username>/decisions-<branch>.md

- `<epic-issue-number>` — the GitHub issue number of the epic your story belongs to (resolved below).
- `<your-username>` — your GitHub login (`gh api user --jq .login`; fall back to a slug of
  `git config user.name`).
- `<branch>` — current branch with `/` → `-`. Append-only; one file per branch.

    ## <YYYY-MM-DD> — <short decision title>
    - **Choice:** <what was chosen>
    - **Why:** <one sentence>
    - **Refuted alternative:** <the viable option not taken, or "none">

Working notes go in the same dir as `notes-<branch>.md`. Do **not** write a design/HLD
document into the queue — a developer HLD lives in the team's doc space and enters Nexus only
via the lead's `/nxs.decision-record --from` at approval, never as a committed file.

**Resolving `<epic-issue-number>`** (do this silently — a stub in the wrong folder is worse than none):
1. Find your story issue — the number in the branch name, or the issue the open PR closes.
2. `gh` that story issue's **parent epic issue**; its number is `<epic-issue-number>`.
3. If unresolved, **write nothing** — skip silently.

Resolution is issue-only: do **not** look for a queue entry, an `epic.md`, or a matching directory
name. The epic's queue entry is born at close, so during implementation there is nothing in the tree
to match against — the epic issue number is resolvable at any point in the epic's life, and close
births the entry at this same `epic-<epic-issue-number>` directory.

This scratch is committed: ordinary commits carry it through your PR. It is a pre-checkpoint
hint the lead-run stages (hld, analyze, close) mine and verify against the diff — never
load-bearing. Never link these paths from an issue, doc, or concept page; the distiller
deletes the whole queue entry when the distillation-PR merges. Obvious choices (only one
sensible option) get no stub.
