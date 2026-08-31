# Features

One folder per feature. Each holds that feature's navigation index (`README.md`), linking the
epic issues delivered under it, plus any durable feature-level notes.

## The backlog

Deferred scope does not live here. A **backlog stub** — a functional goal identified but not yet
planned — is an open GitHub issue carrying the single `backlog` label, so the whole cross-feature
backlog is one query:

**[Open backlog stubs](https://github.com/sameera/nexus/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog)**
— `is:issue is:open label:backlog`

That link is the authoritative inventory of unplanned work across every feature; the feature a
stub belongs to is recorded in its issue body, not as a label. Promote one with
`/nxs.epic <issue-number>`, which plans that same issue in place.

Two consequences follow from the single label:

- **Excluding stubs costs one negated filter** — `-label:backlog`. A default triage view carries
  it once and sees no stub.
- **A stub is an epic issue**, so *every* query enumerating epics for planned work carries that
  same negation. An epic query without it counts work nobody has planned yet.

Ask for either form rather than spelling the label out, so a repository that renames it renames
its queries too:

```bash
nexus config backlog-query --form search
nexus config backlog-query --form exclude
```

## Feature index

| Feature                                                                    | What it covers                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Application Shell](application-shell/README.md)                           | The persistent frame and ephemeral surfaces wrapping the Claude Code session.     |
| [Command Input](command-input/README.md)                                   | An editable, multi-line command prompt in the terminal region.                    |
| [Concept Domain Taxonomy](concept-domains/README.md)                       | A curated domain taxonomy for the concept atlas, replacing derived headings.      |
| [Concept Store Capacity](concept-store-capacity/README.md)                 | Keeping concept pages cheap to load and their touches graph growable.             |
| [Component Distribution](component-distribution/README.md)                 | Packaging, installing, and addressing Nexus components outside the target repo.   |
| [Issue-Sourced Planning](issue-sourced-planning/README.md)                 | Planning surfaces on GitHub issues rather than committed files.                   |
| [Multi-Repo Workspaces](multi-repo-workspaces/README.md)                   | The pipeline across code repos plus a hub docs repo.                              |
| [Pipeline Command Surface](pipeline-command-surface/README.md)             | The names and surfaces of the Nexus slash commands.                              |
| [PR-Driven Delivery](pr-driven-delivery/README.md)                         | Conformance, closure, and distillation against a merged pull request.            |
| [Pre-Epic Discovery](pre-epic-discovery/README.md)                         | Discovery of foggy initiatives into resolved decisions and backlog stubs.        |
| [Queue Scratch Capture](queue-scratch-capture/README.md)                   | In-flight decision scratch as committed per-user subdirs in the queue entry.      |
| [Server Platform](server-platform/README.md)                               | The server/runtime foundation the shell and terminal features sit on.             |
| [Terminal Integration](terminal-integration/README.md)                     | A local PTY-over-WebSocket bridge and a real terminal mounted in Prime.           |

A feature folder appears here once it has an epic; the folder itself is created at that feature's
first epic filing.
