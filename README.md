# Nexus

**A Lean, Spec-Driven Delivery Pipeline for the Age of AI Agents**
## Quick Reference

[How this works](how-to-nexus.md)

## Get Started

Nexus installs **once for your user account**, then bootstraps each repository you use it in:

```bash
npm install -g @sameeraperera/nexus   # 1. the package  (needs Node 22.22.0+ and Python 3.10+)
nexus install                   # 2. the Claude components, once per account
```

Then add two permission entries to your account-scoped `settings.json`, and run `/nxs.setup` inside
each repository. Full steps, and what each command touches: [Installing](#installing).

## The Archaeology Problem

[![Watch the video](https://img.youtube.com/vi/EkZb5mK1j7o/0.jpg)](https://www.youtube.com/watch?v=EkZb5mK1j7o)

Spec-driven development was supposed to be the answer. Write the spec first, let the agents implement against it, keep the humans in the judgment seat.

Then you look at a repo six months in.

Layers of design docs nobody re-read after the first review. Per-task plans that drifted from the code the week they were written. Prose reports summarizing other prose reports. Somewhere in that sediment is the one decision that explains why the system works the way it does — and finding it is an excavation, not a lookup.

That's the failure mode nobody warns you about: **spec-driven development, done naively with AI agents, produces documentation archaeology.** The agents are happy to generate specs at the same rate they generate code. The artifacts pile up faster than anyone can validate them, and the human decisions that actually matter get buried under speculative paperwork.

We didn't fix the judgment problem. We relocated it into a document graveyard.

## The Hidden Cost

AI agents have collapsed the cost of generation — code *and* documents. What used to take hours now takes seconds. What used to require careful thought now requires a prompt.

But an inversion has happened:

**As generation cost approaches zero, judgment becomes the dominant constraint.**

We're not bottlenecked on typing anymore. We're bottlenecked on understanding, evaluating, and deciding. And every artifact generated ahead of a validated need makes that bottleneck worse, not better:

- **Speculative over-generation** — sprawling designs and per-task plans produced before scope is validated. Most of it will be wrong or irrelevant by the time it's needed, but all of it demands review time now.
- **Buried decisions** - When everything is written down, nothing is findable. The three decisions that mattered are indistinguishable from the forty that didn't.
- **Stale-by-default records** - A committed planning document is a second copy of the truth. The code moves; the document doesn't. Six months later you can't tell which parts still hold.
- **Judgment theater** - Review gates that rubber-stamp thirty pages nobody read are worse than no gates: they produce the feeling of rigor without the substance.
- **Compounding correction costs** - The asymmetry is brutal: generation is cheap, comprehension is expensive, and correction is catastrophic. Decisions you never consciously made are the ones that hurt most at 2 AM.

**This is not a problem that discipline alone will solve.** You cannot self-regulate in the presence of unlimited acceleration. The system itself has to refuse to produce artifacts that don't earn their keep.

## The Nexus Thesis

**Generation is cheap. Judgment is not. Artifact volume — code or documents — is no longer a meaningful signal of progress.**

The bottleneck has shifted. What matters now is not how much you can produce, but how well you can exercise judgment over what gets built. How clearly scope is validated before anyone commits to it. How findable the "why" is when you need it later.

So Nexus runs on one rule:

**Every artifact must force a human decision, or it gets cut.**

No speculative HLDs. No per-task plan files. No prose reports ahead of validated scope. If a document doesn't put a real choice in front of a real person, Nexus doesn't generate it.

## What Nexus Does

Nexus is a lean, spec-driven delivery pipeline. It assists Product and Project management — turning intent into validated, decision-grade specs — and leaves implementation to engineers.

That division of labor is deliberate:

1. **Nexus plans and gates the work.** It turns a capability description into a right-sized epic, decomposes it into user stories, records the architectural "why", and checks the finished build against what was promised.

2. **Engineers (and their agents) write the code.** Nexus stops decomposing once a story is small enough to ship and verify on its own. The user story — not the technical task — is the terminal planning unit. How a story gets implemented is the engineer's call, made with whatever tools they choose.

3. **Decisions live where the work lives.** Epics, stories, and decision records are GitHub issues — visible, linkable, and closed when done — not markdown files quietly rotting in a `docs/` folder.

4. **The "why" outlives the epic.** When an epic closes, a distiller drains its validated decisions into a living concept store. The durable record isn't a pile of historical documents; it's a curated map of what the system is and why. That's the answer to the archaeology problem: you read the concept page, not the dig site.

## The Pipeline

```
setup → (discover when foggy) → epic → decision-record → analyze → close → distill
```

Implementation sits between the decision record and analyze; engineers own it.

1. **Setup** (`/nxs.setup`)
    - One-time bootstrap: detect the stack, generate the system standards, interview for product context.
    - Five questions, not fifty. Judgment applied once, up front.

2. **Discover** (`/nxs.discover`) — only when the initiative is foggy
    - **Oversized is not underspecified.** Big but clear is `/nxs.epic`'s job: it decomposes the scope into backlog stubs. Foggy is different — the split itself hangs on decisions nobody has made, so slicing it into work-shaped stubs would be a guess.
    - A **multi-session loop**. Its unit is the **decision ticket**: a question whose resolution is a decision, never a slice of build work. One decision is resolved per session.
    - Its output is **functional goals sharp enough for `/nxs.epic` to file** — a one-line goal, a small estimate, candidate story titles. That is the whole destination; nothing else ends a discovery.
    - A discovery can be **shared by ordinary git operations**. Push it to a fork, hand it to the domain expert who can answer a question, pull their resolution back. No review gate, no approval command, no rule about who may work it.
    - **Discovery writes nothing to GitHub.** No issue, no comment, no label, at any point. The issues appear when `/nxs.epic` consumes the finished discovery, through the same emission path every other stub goes through.
    - *First iteration:* the store is a committed folder under `.nexus/discovery/`, holding a discovery doc and one file per ticket.

3. **Epic** (`/nxs.epic`)
    - Natural-language intent in; a right-sized epic with user stories and acceptance criteria out.
    - Approval happens at a decision-grade digest — you approve the decisions, not a wall of prose.
    - On approval, the epic and one issue per story are filed together. Oversized scope is cut into backlog stubs instead of inflating the epic.
    - If the intent turns out to be underspecified rather than oversized, `/nxs.epic` stops and refers you to `/nxs.discover` instead of filing work-shaped stubs.

4. **Decision record** (`/nxs.decision-record`)
    - The focused "why": key decisions with refuted alternatives, invariants, risks. Tiered by complexity — a simple epic gets a short record.
    - Filed as a sub-issue of the epic. Approval is closing that issue. No shadow copies.

5. **Implementation** - engineers build the stories. Nexus stays out of the way.

6. **Analyze** (`/nxs.analyze`)
    - The conformance gate: does the build do what the planning said?
    - Checks the implemented code against acceptance criteria, success metrics, and the decision record's invariants — and refuses to run against an unapproved record.

7. **Close** (`/nxs.close`)
    - A human-prose close record: what was decided, what deviated and why, what was deferred.
    - Deferred scope becomes backlog issues, not a forgotten section in a document. The epic issue gets a durable close comment and is closed.

8. **Distill** (`/nxs.distill`)
    - Drains closed epics into the concept store via a reviewed PR.
    - Per-concept pages are updated with the epic's validated decisions; the temporary planning artifacts are deleted. The record that survives is the one you'll actually read.

## The Difference

Without a pipeline:

```
You: "Agent, write me a spec, then build it"
Agent: *generates a 30-page HLD and 2,000 lines of code*
You: "...approved, I guess?"
*Six months later*
You: *grepping through stale markdown at 2 AM, trying to find why the queue is shaped like that*
```

With Nexus:

```
Product: /nxs.epic — intent becomes stories small enough to ship and verify, filed as issues
Lead: /nxs.decision-record — the "why" is three decisions with refuted alternatives, approved by the team
Engineers: implement each story their way, with their tools
Lead: /nxs.analyze — the build is checked against the promises made at planning
Lead: /nxs.close — deviations recorded, deferred scope filed, epic closed with a durable trail
/nxs.distill — the validated decisions merge into the concept store; the scaffolding is deleted
*Six months later*
You: *read one concept page, see the decision and the alternative it beat, fix the bug in 10 minutes*
```

Same code ships. Different journey. Different outcome. **The decisions stay findable, and the humans made them.**

## Who This Is For

Nexus is for teams who:

- Realize that acceleration without judgment is just accumulating debt
- Want spec-driven development without the documentation graveyard it usually produces
- Believe a spec's job is to force decisions, not to exist
- Want product intent, architectural rationale, and delivered code to stay traceably connected
- Are tired of inheriting decisions nobody consciously made

If you're happy letting agents generate artifacts faster than anyone can judge them, Nexus isn't for you.

If you believe that **judgment trumps output**, you're in the right place.

## Why Now

Something fundamental has changed. We are living through a **structural shift in software economics**:

- Generation cost: near zero — for code and for documents
- Comprehension cost: unchanged
- Correction cost: exponentially higher

Traditional practices assumed generation was expensive, so more documentation always looked like more rigor. That assumption is dead. When an agent can produce a plausible 30-page design in a minute, documentation volume stops being evidence of thought — and starts being a place for thought to hide.

**Incremental improvements to current workflows are insufficient.** You cannot iterate your way out of a structural shift. You need a system that is lean by construction: one that generates the few artifacts that force decisions and refuses to generate the rest.

Nexus exists because this problem did not exist at this scale before AI agents, and it will not solve itself.

## Philosophy

We're not anti-AI, and we're not anti-spec. We're anti-sediment.

AI agents are incredibly powerful tools. But **power without constraint is chaos** — and in spec-driven development, chaos looks like a wall of well-formatted documents nobody has judged. Nexus provides the constraint: validated scope before decomposition, an approved "why" before implementation, a conformance check before close, and a distilled concept store instead of an archive.

This is about recognizing that the scarce resource is human judgment, and spending it only where a real decision lives. Everything else — the plans, the reports, the intermediate scaffolding — either serves a decision or gets cut.

Because at the end of the day, you're not paid to generate artifacts. You're paid to build systems that work, that you understand, and whose "why" you can still find a year later.

Nexus helps you do that.

## Status

Nexus is in active development. We're building this in the open because we think this problem matters, and we're not the only ones who've noticed it.

**Built with the conviction that slow is smooth, and smooth is fast - but only when every artifact earns its place.**

# Structure

```
docs
├── product
|   ├── context.md               // High-level product context for the agents.
└── system
    ├── standards
    |   ├── api_patterns.md
    |   ├── task_labels.md       // Labels for Github Issues (used with nxs.tasks)
    └── stack.md                 // The technology stack of the product.
```

# CLAUDE.md Setup

Add the following to your CLAUDE.md

```markdown
# Project Structure

This repository root contains:

- `CLAUDE.md` (this file)
- `docs/system/standards/` - shared standards and configurations

When any command or agent references paths under `system/`, `docs/`, or `scripts/`, treat them as relative to this repository root, not as absolute filesystem paths.
```

The Nexus slash commands are not part of your repository: they come from the component set installed once for your account.

# Requirements

Nexus ships as one package carrying both toolkits, so an adopter supplies only the two interpreters they run on:

- **Node.js 22.22.0 or newer** — runs the `nexus` executable.
- **Python 3.10 or newer** — runs the `nexus-gh` toolkit.

Supported platforms are **macOS and Linux**. A release targets POSIX-like environments only; on Windows, run Nexus inside WSL.

# Installing

Nexus's components — the slash commands, agents and skills Claude Code loads — are installed **once
for your user account**, not once per repository. Getting the package onto your machine and its
components into your account is two steps (1 and 2); granting permission and bootstrapping a
repository (3 and 4) follow once each.

## 1. Install the package

Nexus is published to npm as `@sameeraperera/nexus`, carrying both toolkits under one version. Install it
globally:

```bash
npm install -g @sameeraperera/nexus
```

That places two executables — `nexus` and `nexus-gh` — in the global binary directory your Node
installation already exposes. Whatever installed Node (nvm, fnm, volta, Homebrew, a system package)
put that directory on your `PATH`; Nexus edits no shell startup file, so removal has none to undo.

Verify from a directory that is not a Nexus checkout:

```bash
nexus version
nexus-gh version
```

Both print the same release version. If the shell cannot find either one, the global binary
directory is missing from `PATH` — `npm prefix -g` names it.

To hold a particular release rather than the newest, name it: `npm install -g @sameeraperera/nexus@<version>`.

## 2. Install the components for your account

```bash
nexus install
```

`nexus install` does the following:

1. Resolves the Claude configuration directory — `$CLAUDE_CONFIG_DIR` when you have set it, otherwise `.claude` in your home directory — and prints the location it resolved before changing anything. A `$CLAUDE_CONFIG_DIR` that is set but unusable is an error; Nexus never quietly installs somewhere else.
2. Mirrors the Nexus-managed component set (commands, agents, skills — the `nxs`-prefixed files) into that location, overwriting managed files in place.
3. Removes `nxs`-prefixed files that are no longer part of the managed set, so re-running always converges to the current component set (an idempotent refresh).
4. Leaves everything else at that location untouched — your own commands, agents and skills, and your `settings.json`, are never modified or deleted.

Installing is two steps on purpose. A package-manager lifecycle script is blocked by default in some package managers and commonly disabled in continuous integration, so a share of installs would end silently with no component set and no error — and the second step has to print text you must act on anyway.

## 3. Grant the two toolkits permission, once

Add these two entries to your account-scoped settings file (settings.json at the install location),
not to a repository-local one:

    Bash(nexus:*)
    Bash(nexus-gh:*)

Nexus writes no settings file. Adding these entries is your action.

Each entry is a trailing-wildcard prefix, so one entry per toolkit covers every verb and every argument list. Approving the permission prompt interactively instead saves the grant to the repository you happen to be in, and offers you no scope choice — you would re-approve once per repository, while the install itself is once per account.

## 4. Bootstrap each repository

The account-level install makes the `/nxs.*` commands available everywhere; it decides nothing about
any one repository. Inside each repository you want to run the pipeline in, start a Claude Code
session and run

```
/nxs.setup
```

It detects the stack, writes the system docs and standards, seeds the templates the stages read, and
interviews you for the product context. It is a one-time bootstrap per repository — re-run it later
only to refresh the product context.

Nothing about `/nxs.setup` installs components: the slash commands it is invoked through came from
step 2, and a repository never carries its own copy.

## Removing Nexus

```bash
nexus uninstall          # first: clears the installed component set
npm uninstall -g @sameeraperera/nexus
```

Run `nexus uninstall` **before** removing the package. The verb ships inside the package, and your package manager has no record of a component set copied into the configuration directory, so removing the package first leaves the components behind with nothing left to clear them.

## Repositories that still carry committed components

Earlier versions installed the components into each repository's `.claude/`. Run

```bash
nexus migrate-components
```

once inside each such repository. It removes the Nexus-namespaced files it finds under `.claude/` — including at that directory's own root — and adds namespaced ignore entries so they do not come back. It removes only files git tracks, stages nothing and makes no commit, so the removals arrive as ordinary working-tree changes for you to review and commit yourself.

`nexus deploy`, which installs the components into one repository, still works, but per-repository deployment is no longer the supported arrangement.

For multi-repo workspaces, the same CLI declares and inspects the workspace: `nexus workspace init`, `nexus workspace status`, and `nexus workspace add-repo`. Workspace initialisation deploys no components — they come from the install location. After the components are installed, run `/nxs.setup` inside a repo for the per-repo judgment pass (stack docs, standards, product context).

## Per repository: the templates the stages read

Three stages — setup, `/nxs.decision-record` and `/nxs.close` — read a template out of the repository's own configuration, under `.nexus/config/templates/`. `/nxs.setup` places them for you by running

```bash
nexus seed-templates
```

The masters travel inside the package, so this works in a repository that has never been a Nexus checkout. It seeds only what is absent: a template you have tuned is never overwritten, and re-running it adds anything a later release introduced without touching your edits. Run it directly if you want the templates without a full setup pass.

# Upgrading

Upgrade the package, then re-run `nexus install`:

```bash
npm install -g @sameeraperera/nexus@latest
nexus install
```

The mirror converges: components dropped from the managed set are removed, and files you own are untouched. `nexus version` reports what you are now on.

If you are coming from a version that deployed components into each repository, run `nexus migrate-components` once in each of those repositories (see above). While both a repository-local and an account-level component set resolve, every `nexus` invocation writes a diagnostic naming both locations to standard error.

The permission entries have not changed, and they belong to your account rather than to any repository:

Add these two entries to your account-scoped settings file (settings.json at the install location),
not to a repository-local one:

    Bash(nexus:*)
    Bash(nexus-gh:*)

Nexus writes no settings file. Adding these entries is your action.

# Contributing to Nexus itself

Working on Nexus rather than with it? Read `CONTRIBUTING.md`. Nexus's own components are authored
outside the directory the harness loads, and the maintainer's loop points the install location at a
checkout — neither is something an adopter needs.
