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

- **Which Nexus component behaviours genuinely require running inside the target repo, and which
  only appear to?** — The boundary has three sets, not two, drawn by asking what each path
  identifies: project state, the toolkit, or the toolkit's source checkout. Detail:
  `ticket-01-repo-bound-boundary.md`
- **When a Nexus component is installed outside the target repo, how does it address its own
  scripts and files?** — It does not address them by path at all. A component names the toolkit,
  the toolkit locates its own files at run time, and Nexus depends on no harness self-location
  variable. Detail: `ticket-02-component-self-location.md`
- **Which pain must this refactor remove, and who installs Nexus into a repo?** — Nexus is built for
  external adopters, it must remove staleness, commit churn, and onboarding cost together, an
  install step is an acceptable prerequisite everywhere, and Nexus acquires a semantic released
  version identity. Detail: `ticket-04-who-installs-nexus.md`

## Not yet specified

<!-- Empty. Both entries graduated into tickets when the self-location decision was resolved. -->

## Out of scope

- Implementing the refactor. This discovery settles the decisions, not the build.
- Changing what any pipeline stage decides or produces. Where the components live does not change
  what a stage does.
- The stale component archive at `libs/origin/v1/.claude`. Issue #60 already rules it out of the
  managed set.
