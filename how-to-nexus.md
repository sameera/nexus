# Getting Started with Nexus

## How this works: The Big Idea

AI agents made generation cheap — code *and* documents. Judgment stayed expensive. Left alone, an agent will happily turn "here's my vague idea" into a 30-page design and 3,000 lines of code before anyone has decided anything.

Nexus forces a pause at each point where a human decision actually lives, and refuses to generate artifacts anywhere else.

One rule governs everything: **every artifact must force a human decision, or it gets cut.** No speculative HLDs, no per-task plan files, no prose reports ahead of validated scope.

Two consequences follow:

1. **Nexus plans and gates the work. Engineers write the code.** Nexus stops decomposing once a user story is small enough to ship and verify on its own. The story — not the technical task — is the terminal planning unit. How a story gets implemented is the engineer's call, with whatever tools they choose.
2. **Decisions live where the work lives.** Epics, stories, decision records, and the backlog are GitHub issues — visible, linkable, closed when done. Planning commits nothing to the repo; there is no second copy to go stale.

## Grounded in Your Reality

Nexus does not work in a vacuum. It reads the documentation already in your project — product context, stack, standards, prior decisions — and grounds every stage in it. That context is built once by `/nxs.setup` and carried forward through every phase.

The long-term memory is the **concept store**: one distilled page per concept, holding current behavior, hard invariants, and the durable "why." Every closed epic feeds it (see Distill below). Six months later you read the concept page, not the dig site.

---

## The Pipeline in Plain English

```
setup → (discover when foggy) → epic → decision-record → analyze → close → distill
```

The planning and gating stages are run by product / the lead. Implementation sits between the decision record and analyze and belongs to engineers. Each stage is a separate conversation, and that separation is the feature: you look at fewer decisions at a time.

| Stage | Command | The human decision it forces |
| ----- | ------- | ---------------------------- |
| Setup | `/nxs.setup` | What is this product, and what are its standards? (once) |
| Discover | `/nxs.discover` | What has to be decided before this can even be scoped? (only when foggy) |
| Epic | `/nxs.epic` | Is this the right scope, cut into the right stories? |
| Decision record | `/nxs.decision-record` | Can we live with this design? |
| Analyze | `/nxs.analyze` | Does the build match what we promised? |
| Close | `/nxs.close` | What deviated, and what are we deferring? |
| Distill | `/nxs.distill` | Which of these decisions belong in the permanent record? |

---

## Step 0: `/nxs.setup` — Bootstrap Once

One-time project bootstrap. It auto-detects the stack, generates the system docs and standards, then runs a short interview — at most five strategic questions — to build the product context. Judgment applied once, up front, so every later stage has something real to ground in.

## Step 0.5: `/nxs.discover` — Only When the Initiative Is Foggy

Skip this stage unless you need it. Most intent goes straight to `/nxs.epic`.

You need it when the initiative is **underspecified**, which is not the same as **oversized**:

- **Oversized** — big but clear. You could list the goals today; there are just too many for one epic. `/nxs.epic` handles this: it cuts the scope into backlog stubs.
- **Underspecified** — foggy. The split itself hangs on decisions nobody has made. Slicing it into work-shaped stubs now would be a guess dressed up as a plan.

Discovery is a **multi-session loop**, and its unit is the **decision ticket** — a question whose resolution is a decision, never a slice of build work. Each session claims one open ticket, resolves it through the machinery Nexus already has (research agents, a PM interview, a council on a contested trade-off), records the resolution, and stops. One decision per session, one commit per decision, so the commit history reads as the decision history.

The loop ends at one destination and no other: **every functional goal is sharp enough for `/nxs.epic` to file** — a one-line goal, a small estimate, candidate story titles. A suspicion you can't yet phrase as a question waits in "Not yet specified" until some resolution makes it statable. Work ruled beyond the destination goes to "Out of scope" and never comes back.

A discovery is **shared by ordinary git operations**. Push it to a fork, hand it to the domain expert who can actually answer question three, pull their resolution back. There is no review gate, no approval command, and no rule about who may start, resume, or graduate one. That matters because discovery is the stage most likely to need more than one person.

**Discovery writes nothing to GitHub** — no issue, no comment, no label, at any point in its life. The issues appear when `/nxs.epic --discovery <folder>` consumes the finished discovery and files its goals through the same path every other stub goes through. A discovery whose resolutions conclude that *no build follows* ends with `/nxs.discover --close`, which writes a dated lessons note and removes the folder in one commit.

*First iteration:* the store is a committed folder under `.nexus/discovery/`, holding a discovery doc and one file per decision ticket.

## Step 1: `/nxs.epic` — Stop and Define the Problem

You bring natural-language intent: "We need audit logging for compliance." No feature brief required.

`/nxs.epic` reads your product context and pushes back. What actions count as auditable? Who reads the logs? How long do they live? How expensive can this get? Your job is not to be clever — it is to make sure everyone agrees what "audit logging" even means before anything is built.

The output is a right-sized epic with user stories and acceptance criteria. Approval happens at a **decision-grade digest** — you approve the decisions, not a wall of prose. On approval, the epic issue and one GitHub issue per story are filed together.

Two things keep the epic honest:

- **Oversized scope gets cut, not carried.** Anything that doesn't belong in this epic becomes a backlog stub issue instead of inflating the scope.
- **Underspecified scope gets referred, not sliced.** Before it sizes anything, `/nxs.epic` checks whether each functional goal can actually be stated. If they can't, it stops, recommends `/nxs.discover`, and files nothing — with an override, because that call is yours.
- **Nothing is committed to the repo at planning.** The issues are the source of truth. Any stage that later needs the epic as a file reconstructs it deterministically from the issue number.

### The backlog is one query

A backlog stub is an open GitHub issue carrying the single `backlog` label — a functional goal identified but not yet planned. The whole cross-feature backlog is one search: `is:issue is:open label:backlog`. Promote a stub with `/nxs.epic <issue-number>`, which plans that same issue in place — the stub *becomes* the epic, keeping its number and history.

## Step 2: `/nxs.decision-record` — Decide the "Why"

Once the stories exist, the lead runs `/nxs.decision-record`. This is the focused architectural "why": key decisions with the alternatives they beat, invariants the implementation must hold, and risks. It is tiered by complexity — a simple epic gets a short record, not ceremony.

The record is filed as a **sub-issue of the epic**. Approval is closing that issue — no shadow copies, no separate sign-off doc. This is the "are we comfortable living with this design" step. If the answer is no, fix it here; it is still cheap.

Two useful variants:

- `--from <path>` imports an existing design doc (a developer HLD or plan) as the authoritative basis, instead of analyzing from scratch. This is how engineering-authored designs enter Nexus.
- `--revise` reopens an approved record, states what it supersedes, and re-closes it. Designs are allowed to change; they are not allowed to change silently.

## Step 3: Implementation — Nexus Stays Out of the Way

Engineers pick up the story issues and build them, one PR at a time, with their own tools. Nexus does not generate or gate the code.

One small ask of the implementing agent: when it makes a non-obvious choice between viable approaches, it appends a short **decision stub** (choice, why, refuted alternative) to a scratch file in the epic's queue entry. These stubs are hints, never load-bearing — the close stage mines and verifies them against the actual diff, so implementation rationale isn't lost, and nobody writes a report to preserve it.

## Step 4: `/nxs.analyze` — The Conformance Gate

After the stories are implemented, `/nxs.analyze` checks the build against the promises: the epic's acceptance criteria and success metrics, and the decision record's invariants. It refuses to run while the decision record is unapproved, and it stamps exactly which record it checked against.

It reports findings inline and leaves a small **receipt** proving it ran — which `/nxs.close` gates on. This is where you catch "the AI snuck in assumptions" — before close, while it's still one epic's worth of review.

## Step 5: `/nxs.close` — Close with a Trail

`/nxs.close` requires every sub-issue of the epic closed and a current analyze receipt. It then:

- writes a human-prose close record: key decisions, deviations from the plan and why, and what was deferred;
- files deferred scope as backlog stub issues — a query away, not a forgotten section in a document;
- posts a durable close comment on the epic issue and closes it. The comment is the permanent record; the local files are just a hand-off to the distiller.

## Step 6: `/nxs.distill` — Keep Only What Earned Its Place

The distiller drains closed epics into the concept store: it reads each close record, the epic's decision record, and the real merged diff, then updates the affected concept pages through a **reviewed distillation-PR**. When that PR merges, the temporary planning artifacts are deleted.

This is the answer to documentation archaeology. The scaffolding that got the epic shipped does not accumulate; the validated decisions merge into a curated map of what the system is and why.

---

## The PR-Driven Flow

For teams that deliver through pull requests, the tail of the pipeline runs against the PR itself, so the diff being judged can't drift after merge:

1. The lead runs `/nxs.analyze --pr <N>` against the PR (which may still be open). The result is published as a PR review carrying a machine-readable receipt.
2. The PR merges.
3. Post-merge, the lead runs `/nxs.close --pr <N>` and `/nxs.distill` in one shared worktree. Close commits its artifacts and hands off; distill opens the distillation-PR.

## Multi-Repo Workspaces

Nexus scales past one repo. A workspace is a set of code **member** repos plus a **hub** docs repo. Members plan and close locally; the hub holds the concept store and drains the queue — close migrates each finished epic's entry to the hub, and one distillation-PR there updates the shared knowledge.

The portable `nexus` CLI manages all of it: `nexus install` installs or refreshes the Nexus components once per account, at the Claude configuration directory rather than in any repo (idempotent, never touches your own files), and `nexus workspace init` / `add-repo` / `status` declare and inspect the workspace. A repo that still carries a committed component set from an earlier version is cleared with `nexus migrate-components`.

---

## Where This Is Heading

Nexus is actively evolving. The direction, so you can tell drift from design:

- **Nexus Prime** — a browser-based harness that runs the real Claude Code session in an embedded terminal and makes the pipeline visible around it: which stage you're in, which decision gate is next, what's waiting in the hub queue. Prime's first principle is experiential fidelity: it wraps the live session, it never reduces it to summarized output. Pipeline discipline through gates, not nags.
- **Deeper PR-native delivery** — the post-merge flow extending to member repos, per-story analyze runs from the hub against member PRs, and epics that close over several story PRs.
- **A thinner, more portable toolchain** — the GitHub transaction layer moving out of the planning prompts into the CLI, and a one-time per-engineer install with zero per-repo effort.

The invariants underneath all of it are stable: issues as the planning surface, the story as the terminal unit, approval at decision gates, and a distilled concept store as the only durable record.

---

## How to Not Sabotage Yourself

A few hard-earned rules:

- Do not collapse phases because you are in a hurry. The gates are the product.
- Use the epic to argue about intent, the decision record to argue about design — not the other way around.
- Treat each approval as a real review, not a speed bump to click past. A rubber-stamped gate is worse than no gate.
- Defer honestly. "Cut to backlog" only works if the stub actually gets filed — let close do it, don't carry scope in your head.
- Keep the concept store trustworthy: review distillation-PRs like code, because six months from now they *are* the documentation.

## When Nexus Is Worth the Trouble

This shines when:

- You are changing architecture, or adding cross-cutting concerns like security or observability
- Multiple humans (or multiple agents) need shared, durable understanding
- You expect real review, not drive-by approval
- You will still be maintaining this system when the "why" matters

If the task is trivial, skip the pipeline. Nexus is a tool, not a religion.

## The Mental Model

Nexus does not prevent bad decisions.

It prevents bad decisions from happening silently — and it deletes everything else, so the decisions that were made stay findable.

In a world where AI is very good at confidently doing the wrong thing at high speed, and equally good at burying the right thing under paperwork, that turns out to be the whole game.
