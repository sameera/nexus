---
feature: "Multi-Repo Workspaces"
---

# Multi-Repo Workspaces

Run the Nexus pipeline across a multi-repo product: code repos plan and close locally while a
hub docs repo holds the concept store and drains the queue.

## Epics

- **Workspace Manifest & Resolution** — [#38](https://github.com/sameera/nexus/issues/38)
- **Portable Nexus Tooling** — [#44](https://github.com/sameera/nexus/issues/44)
- **Close-Entry Migration to the Hub Queue** — [#49](https://github.com/sameera/nexus/issues/49)
- **Distill Across a Multi-Repo Workspace** — [#54](https://github.com/sameera/nexus/issues/54)
- **Nexus Setup CLI** — [#60](https://github.com/sameera/nexus/issues/60)
- **Parameterized Docs Root** — [#74](https://github.com/sameera/nexus/issues/74)
- **Planning Surfaces Follow the Docs Root** — [#81](https://github.com/sameera/nexus/issues/81)
- **nxs-pm Path References Follow the Docs Root** — [#87](https://github.com/sameera/nexus/issues/87)
- **Issue-Sourced Planning: Nothing Commits Until Close** — [#114](https://github.com/sameera/nexus/issues/114)
- **GitHub Publishing Config** — [#121](https://github.com/sameera/nexus/issues/121)
- **The Decision Record Becomes an Approvable Sub-Issue** — [#139](https://github.com/sameera/nexus/issues/139)
- **The Engineer's PR Command: Rationale Rides the PR Body** — [#157](https://github.com/sameera/nexus/issues/157)
- **Analyze a Member Story Pull Request From the Hub** — [#211](https://github.com/sameera/nexus/issues/211)
- **One Epic Receipt, Aggregated From the Story Verdicts** — [#212](https://github.com/sameera/nexus/issues/212)
- **Close an Epic Over Several Merged Pull Requests** — [#213](https://github.com/sameera/nexus/issues/213)
- **Drain an Entry Whose Range Is a List** — [#214](https://github.com/sameera/nexus/issues/214)
- **Retire the Member Close-and-Migrate Path** — [#215](https://github.com/sameera/nexus/issues/215)

## Tooling

A hub no longer carries its own copy of the Nexus toolkit. There is nothing to build into a hub
repository and nothing to commit there: the hub-versus-member distinction stops governing tooling
entirely, and a checkout's role no longer decides how its tooling is invoked.

That distinction survives everywhere else it was load-bearing — where the concept store lives,
which repository holds the queue, and who drains it. It stops mattering for tooling, and for
tooling only.

How the toolkit does reach a machine is settled in
**Install Nexus components outside the target repo** —
[#261](https://github.com/sameera/nexus/issues/261).
