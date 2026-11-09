---
title: "Initiative"
aliases: ["initiative issue", "coherent decomposition", "proposed objective", "execution order", "reach statement", "stubs under an initiative", "flat filing", "planning container"]
touches: ["backlog-stub", "epic-approval-gate", "issue-kind-classification", "resumable-batch-filing", "issue-sourced-planning", "publishing-config-resolution", "filing-preflight", "stub-promotion", "initiative-context"]
last_updated_by: "#850"
status: active
verification: verified
---

# Initiative

An initiative is the parent issue of a decomposition's stubs when the lead accepts that those stubs serve one objective. It states that objective, the order the stubs are meant to run in, and how much of the objective each stub reaches. It is a planning container only: nothing is delivered against it, and no stage accepts it as an epic.

## How It Works

When the epic stage splits oversized scope into two or more stubs, it always proposes an objective. The lead's decline is the only filter. The consent choice offers the filing twice: under an initiative, or flat. The gate shows the objective, the order, every reach statement, the split reasoning, the deferred scope and a context summary, and the lead accepts or declines them as one unit. In discovery mode the objective is the discovery's own destination. From typed intent it claims nothing beyond the lead's description.

On accept, the run files the initiative first, keeps its planning context, then files the stubs as its children, then writes the stub numbers into its ordered list. It reads back the initiative's children and reports the run incomplete if any stub is missing. Repeating the run finishes it without filing a second copy of anything.

A stub under an initiative is promoted by the usual steps and stays where it is. If that stub proves larger than one epic, its successors join the same initiative, and no new objective is proposed.

## Key Invariants

1. Nothing is created or kept before the lead accepts or declines the proposed objective, and every sentence the initiative states was shown at the gate.
2. Only a decomposition with two or more goals proposes an objective. Deferred stubs, close's stubs, intake follow-ups and a one-goal split are filed flat.
3. A declined proposal files exactly what a flat filing files today.
4. The order respects every blocking edge between the stubs, each entry states its reach in words rather than a percentage, and the body holds no table and no second list of children.
5. Every stub of an accepted set is a child of that initiative and of nothing else.
6. Every stage refuses an initiative as its epic, and names it as an initiative.
7. The initiative body is never edited after filing, including when successors join it.

## Integration Points

- [epic-approval-gate](epic-approval-gate.md) — the consent choice that proposes the objective and offers the filing under an initiative or flat.
- [backlog-stub](backlog-stub.md) — the stubs this issue groups, which may be a sub-issue of an initiative and never of an epic.
- [issue-kind-classification](issue-kind-classification.md) — reads an issue as an initiative from its declared marker.
- [resumable-batch-filing](resumable-batch-filing.md) — files the initiative and then its stubs, and retries a failed parent link on a repeat.
- [filing-preflight](filing-preflight.md) — allows an initiative as a stub's parent and refuses every other parent.
- [stub-promotion](stub-promotion.md) — promotes a stub under an initiative without moving it, and files a split stub's successors under the same initiative.
- [issue-sourced-planning](issue-sourced-planning.md) — its resolver refuses an initiative by name instead of reconstructing it as an epic whose stubs read as stories.
- [initiative-context](initiative-context.md) — the planning context this issue keeps, summarised in its body and read when its stubs are planned.
- [publishing-config-resolution](publishing-config-resolution.md) — supplies the initiative label or issue type; with no issue type declared under type mode, only the flat filing is offered.

## Decision Log

### 2026-10-10 — #705 — A coherent decomposition files a parent that states its objective

Stubs from one decomposition used to land as a flat set of open issues. Nothing on them said what they added up to, which came first, or how much each reached. The lead held that answer only on the day of the split. An initiative now carries it, and the grouping is a parent link rather than a list in a body that would need upkeep. The objective is proposed inside the existing consent choice and is always proposed on this path, because the decomposition splits one capability the lead already described. Neither version of the choice is recommended, because this gate is the only place the lead can reject the model's reading of the set. The initiative is filed before its stubs because a stub's parent must already exist, and every parent link stays inside the guarded filer. Every stage refuses an initiative, because otherwise an initiative with no parent resolves as an epic whose stubs read as stories. Refuted alternative: file the stubs flat first, then file the initiative and attach the stubs to it. An interrupted run would leave only the flat filing, which is a milder failure. It lost because attaching after creation is a second parent-link path, and the rule that a stub is never under an epic would then need enforcing in two places.

### 2026-11-09 — #850 — An initiative keeps the planning context that produced it

A long planning session ended in stubs that kept a one-line goal each, and the session's decisions, deferrals and split reasoning were lost. The initiative sits above every stub of the set, so it is the place to keep them. Its body now carries a short summary and one sentence naming where the full context is kept, because a full plan does not fit in an issue body. The split reasoning and the deferred scope are shown at the gate beside the objective, because the kept context may hold only text the lead saw. The issue number in that sentence is filled in the same single edit that writes the stub numbers, so the body is still never edited after the run. Refuted alternative: show only the summary at the gate, and let the lead review the full context in the commit diff. It lost because a diff nobody is required to read would be the only human check on text a later plan cites as asked.
