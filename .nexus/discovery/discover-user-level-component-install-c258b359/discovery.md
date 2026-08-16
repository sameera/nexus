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
- **Do the skill scripts stay as separate TypeScript files, or collapse into the one portable
  bundle?** — Every capability a component body invokes becomes a verb on one named executable,
  every capability only the build invokes stays a TypeScript file that never ships, and the Python
  capabilities remain a separate second toolkit. Detail: `ticket-03-script-runtime-shape.md`
- **Does a repo keep the ability to pin the Nexus component version it runs?** — No repo declares a
  Nexus version; one release identity covers both toolkits and the component payload, the toolkit
  stamps its version onto the artifacts it writes, the verb surface is guarded by a build-time gate
  rather than a version number, and the repo-bound data formats become the versioned contract.
  Detail: `ticket-05-version-pinning.md`
- **Must both installation modes coexist, and what happens to repos that already carry a committed
  .claude directory?** — They do not coexist and no precedence rule is written, because Nexus owns no
  site that can enforce one; exactly one component set exists per user account, the Nexus repository
  moves its authored tree out of `.claude/` so that no repository is exempt, and every other
  repository carrying committed components runs a gated migration verb that ships in the same release
  as the shared install. Detail: `ticket-06-coexistence-and-migration.md`

## Not yet specified

<!-- Empty. Both entries graduated into tickets when the self-location decision was resolved. -->

## Out of scope

- Implementing the refactor. This discovery settles the decisions, not the build.
- Changing what any pipeline stage decides or produces. Where the components live does not change
  what a stage does.
- The stale component archive at `libs/origin/v1/.claude`. Issue #60 already rules it out of the
  managed set.
- Rewriting the Python capabilities in TypeScript so that they become verbs on the TypeScript
  executable. This entry covers the rewrite and nothing else. Every Python import is standard
  library, so the Python capabilities need no package install and already install outside the target
  repo, which is what the destination asks for. Rewriting them would reduce the number of toolkits
  rather than enable the installation.

  **This entry does not put the Python toolkit itself out of scope.** Making the Python capabilities
  reachable by name is in scope and is required. Ticket 02's addressing rule covers them, and their
  current invocation strings are already broken: `nxs-gh-create-epic/SKILL.md:21` and its siblings
  write `python ./scripts/<name>.py`, which resolves only when the working directory is the skill
  directory, and which names `python` rather than `python3`.

- Per-repository version pinning, in every form. A repository declares no Nexus version, and no
  repository causes a particular toolkit version to be present on the machine. Staging a toolkit
  upgrade for one repository while another stays behind is out of scope with it, because both
  repositories share one install.

  **This entry does not close per-machine version selection.** Installing and holding an explicit
  older version on a machine is in scope and is required, because it is the only regression recourse
  the version-pinning decision leaves. Ticket 10 decides the channel that must support it.

- Coexistence of the two installation modes, in every form, and any precedence rule between a
  repository-local component set and the shared install. Nexus owns no site at which a precedence
  rule could be enforced, so writing one would be a promise with no enforcement point.

  **This entry does not close the maintainer's source-link install content.** That content is one
  install location pointing at a checkout rather than a second component set, and it is in scope and
  required. The entry also does not close ticket 09's question about how a Nexus Prime session
  reaches the toolkit.

- A migrator that discovers every repository on a machine and migrates them together. The population
  is six repositories belonging to one person, so the migration verb takes one repository and is run
  once per repository.

- Reproducing a past pipeline run at the toolkit version that produced its artifacts. A checkout of
  an old commit no longer reproduces the pipeline behaviour of that date. Nexus stages produce
  decision-grade prose behind approval gates rather than deterministic build output, so there is no
  byte-for-byte result to reproduce.
