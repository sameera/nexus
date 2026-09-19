---
product: Nexus
version: 0.59.0
last_updated: 2026-09-18
stage: published pre-1.0
---

# Product Context — Nexus

> **How this file was written.** Prime's extraction took the previous product context with it,
> because that file described Prime from its first line. This replacement is assembled from what
> this repository already states about itself — the readme, the getting-started guide, the project
> instructions and the concept store — rather than from the `nxs-setup` interview. Every section
> names its source. The sections a document cannot answer for the maintainer, marked
> `<!-- TODO: Confirm -->`, are the ones an interview sitting should settle.

## Product Overview

Nexus is a **lean, spec-driven delivery pipeline for teams working with AI coding agents**. It
assists Product and Project management — turning intent into validated, decision-grade specs — and
leaves implementation to engineers.

It ships as one npm package: a set of Claude Code components (slash commands, agents and skills)
installed once per user account, plus a portable executable the components call for every
mechanical step. A lead runs the stages in order — `setup`, `discover` when the scope is foggy,
`epic`, `decision-record`, then implementation by engineers, then `analyze`, `close` and `distill`
— and each stage is a separate conversation that puts one decision in front of one person.

<!-- Inferred from README.md ("What Nexus Does"), how-to-nexus.md and the install section -->

## Vision & Strategy

Be the system that **refuses to produce an artifact that does not force a decision**, so that the
scarce resource — human judgment — is spent on the choices that matter and is findable afterwards.

The bet is stated in the readme as the Nexus thesis: generation is cheap, judgment is not, and
artifact volume is no longer a signal of progress. Everything else follows from it. Planning writes
to GitHub issues rather than the repository, so there is no second copy of the truth to go stale.
Closed work is distilled into a concept store — one page per concept, carrying current behaviour,
hard invariants and the durable why — so the answer six months later is a lookup rather than an
excavation.

<!-- Sourced from README.md ("The Nexus Thesis") and CLAUDE.md ("Core Philosophy") — not inferred -->

## Anti-goals

What Nexus deliberately does **not** do:

- **Does not write or gate the target project's code.** Implementation belongs to engineers, with
  whatever tools they choose. Nexus plans and gates the work around it.
- **Does not decompose below the user story.** The story, not the technical task, is the terminal
  planning unit and the GitHub-issue granularity. Nexus stops once a story can be shipped and
  verified on its own.
- **Does not generate speculative artifacts.** No sprawling design documents, no per-task plan
  files, no prose reports ahead of validated scope. An artifact that forces no decision is cut.
- **Does not commit planning to the repository.** Epics, stories, decision records and the backlog
  are issues. The committed stores are the concept store and the pipeline's own working queue.
- **Does not replace the coding agent.** Nexus is the process around a Claude Code session, not a
  substitute for it.

<!-- Sourced from README.md, how-to-nexus.md and CLAUDE.md — each is stated, not inferred -->

## Product Principles

1. **Every artifact must force a human decision, or it gets cut.** The one rule. When a stage could
   produce a document or produce nothing, producing nothing is the default it has to argue against.
2. **Generation is cheap; judgment is expensive.** Add ceremony only where a person must decide.
   Never add it to the parts that are only generation.
3. **One copy of the truth.** A planning document committed beside the code is a second copy that
   drifts. Decisions live where the work lives, and durable ones are distilled into one page each.
4. **A gate that cannot refuse is theatre.** Stages block — an unapproved decision record stops
   `analyze`, an open sub-issue stops `close` — because a gate that always passes produces the
   feeling of rigour without the substance.
5. **Say the refusal out loud.** When a stage will not proceed, it names what is missing and what
   the lead has to do, rather than degrading quietly into a pass.

<!-- 1–3 are stated in README.md; 4–5 are drawn from the stage contracts in components/commands
     and the concept store's gate pages -->

## Personas

### Primary — The lead running the pipeline

- **Who:** The person accountable for scope on a small engineering team — a founder, a tech lead, a
  product-minded engineer. Technically fluent, runs Claude Code daily, is also the one who will be
  asked in six months why the system works the way it does.
- **Jobs to be done:** Turn a rough capability description into a right-sized epic with stories a
  team can pick up; record the architectural why once, where it will still be found; check a
  finished build against what was promised; close work so its decisions land in permanent memory.
- **Pain points:** Agents that generate thirty pages of design before scope is agreed; review gates
  that rubber-stamp; the six-month excavation to find the one decision that explains the system.
- **Wins when:** A decision they made once is found by reading a single concept page, and nothing
  they were asked to review existed for any reason other than a choice they had to make.

### Secondary — The engineer implementing a story

- **Who:** A developer picking up a story issue Nexus filed, on the same team or adjacent to it.
- **Jobs to be done:** Understand the story's acceptance criteria and the decision record's
  invariants without reading a planning archive; implement freely; have the conformance check tell
  them where the build and the promise diverged.
- **Pain points:** Planning artifacts that contradict the code; being told how to implement rather
  than what must hold.
- **Note:** This persona consumes Nexus's output and runs almost none of its stages. The one
  surface they meet directly is the in-flight decision stub and the conformance findings.

### Secondary — The maintainer of Nexus itself

- **Who:** This repository's own author, dogfooding the pipeline on the pipeline.
- **Jobs to be done:** Ship component changes without breaking an adopter's stages; keep the
  concept store honest about a tool that changes weekly.
- **Note:** Worth naming because it is the only persona with users today, and because it biases the
  backlog toward what the maintainer felt last. <!-- TODO: Confirm this is the intended reading -->

<!-- Inferred from how-to-nexus.md's stage table (who runs what) and CLAUDE.md's division of labour -->

## Domain / Industry Context

Developer tooling — specifically **process tooling for AI-assisted software delivery**. The product
sits one layer above a coding agent: it does not generate the code, it decides what should be built
and preserves why. Users are technical, work in public-ish repositories with GitHub issues, and have
very low tolerance for tools that hide what happened. Adoption is product-led and bottom-up: an
individual installs it, then a team standardises on it.

Distribution is a public npm package plus a GitHub repository; the components run inside Claude
Code on the user's own machine, against their own `gh` and `git`.

<!-- Inferred from the install path in README.md and the package manifest -->

## Competitive Landscape

- **Doing it by hand in the coding agent.** The default every user already has: prompt the agent for
  a spec, keep the discipline yourself. Table stakes Nexus must match — no extra install ceremony
  per repository, no loss of the direct session. Its wedge is that discipline you cannot
  self-regulate into existence: the system refuses, so you do not have to.
- **Generic spec-driven and workflow frameworks.** Templates and prompt libraries that produce the
  documents. Nexus's difference is subtractive — it is defined by what it refuses to generate, and
  by gates that block rather than advise.
- **Issue trackers and PM tooling.** Not competitors so much as the substrate: Nexus writes its
  planning into GitHub issues rather than owning a store of its own.

<!-- TODO: Confirm — no competitor has been named by the maintainer anywhere in the repository.
     This is positioning inferred from README.md's framing, not a researched landscape. -->

## Success Metrics

- **North star candidate: the lookup rate.** The share of "why is it like this?" questions answered
  by reading one concept page, rather than by excavating issues, pull requests and commits. It is
  the most direct measure of the thesis — if the store is not where the answer is, the pipeline
  produced paperwork.
- **Supporting:** epics that reach `close` with a drained queue; decision records approved without
  a revision cycle; stages that refuse for the stated reason rather than being waived.

<!-- TODO: Confirm — the maintainer has stated no metric anywhere in the repository. These are
     proposals consistent with the thesis, and the north star as written is not yet measurable. -->

### Impact thresholds (for RICE-style scoring)

- **High impact:** changes what a lead experiences at a stage they run every epic.
- **Medium impact:** changes a stage they run occasionally, or a refusal they meet when something
  is already wrong.
- **Low impact:** internal to the toolkit; no adopter runs into it.

<!-- Inferred from the release procedure's rule that versions are cut against adopter-visible stage
     behaviour rather than diff size -->

### Effort guidance

- **High effort:** a new stage, or a change to the shape of the pipeline.
- **Medium effort:** a new gate or refusal inside an existing stage, with its concept page.
- **Low effort:** a wording or mechanical change inside one stage.

<!-- TODO: Confirm — no calendar estimates are stated anywhere; a solo maintainer's week is not a
     unit this repository has ever used -->

## Regulatory & Compliance

None applicable. Nexus is a local developer tool: no backend, no database, no hosted account, no
telemetry. It runs on the user's machine and reaches only their `git`, their `gh` and their coding
agent, under their own credentials. No personal, health or financial data flows through it.

**Applies when:** if Nexus ever gains a hosted surface, collects usage data, or reads a customer's
private repository on their behalf, data handling and privacy obligations are a fresh question at
that point.

<!-- Inferred from the package manifest, the absence of any network or storage capability in the
     toolkit, and the install path -->

## Company Scale

- **Stage:** published and pre-1.0. Below 1.0 the version number carries no compatibility promise,
  and a minor release may break a pipeline that worked before.
- **Team:** solo maintainer.
- **Users:** small; the maintainer's own work is the primary adopter, and the pipeline is run on
  itself. <!-- TODO: Confirm — no user count is recorded anywhere in the repository -->

<!-- Inferred from the release procedure, the package manifest and the repository's own history -->
