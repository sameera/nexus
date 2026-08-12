---
destination_accepted: 2026-08-12
feature: "Component Distribution"
feature_path: docs/features/component-distribution
status: open
---

# Discovery: Installing Nexus components outside the target repo

## Destination

This discovery is done when every functional goal of **installing Nexus components outside the
target repo** can be stated as a backlog stub of size M or smaller — a one-line goal, an S or M
estimate, and candidate story titles.

In scope for that judgement:

- Which parts of Nexus are genuinely repo-bound project data, and which are tooling that can live
  once per machine.
- How a command or skill addresses its own scripts when it is no longer at
  `./.claude/skills/...` in the current working directory.
- What runtime executes those scripts when the target repo has no in-repo Node toolchain.
- What distribution and version-pinning mechanism replaces the current `nexus deploy` mirror into
  the repo.
- How repos that already carry a committed `.claude/` migrate, and whether both installation modes
  must coexist.

Beyond it: implementing the refactor, and any change to what the pipeline stages decide or
produce.

## Resolved decisions

<!-- Append-only. One line per resolved ticket, order-insensitive. -->

## Not yet specified

- Whether a hub and its member repos in a multi-repo workspace need a different arrangement from a
  single repo once components are installed outside the repo. The hub already vendors the portable
  tooling under `.nexus/tools/`, so a shared install may make that placement redundant or may
  conflict with it. The question cannot be stated precisely until the repo-bound boundary is known.
- Whether the permission allowlist and any other Claude Code settings that Nexus depends on must
  move or be generated alongside a shared install. Today `.claude/settings.local.json` is
  user-owned and Nexus never writes it.
- Whether Nexus Prime, which drives Claude Code inside a browser terminal, needs its own way to
  locate the installed components. This depends on the addressing answer.

## Out of scope

- Implementing the refactor. This discovery settles the decisions, not the build.
- Changing what any pipeline stage decides or produces. Where the components live does not change
  what a stage does.
- The stale component archive at `libs/origin/v1/.claude`. Issue #60 already rules it out of the
  managed set.
