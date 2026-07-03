---
product: Nexus Prime
version: 1.0.0
last_updated: 2026-06-28
stage: pre-launch (MVP build)
---

# Product Context — Nexus Prime

## Product Overview

Nexus Prime is a **React terminal-emulator harness** that runs **Claude Code** inside an
in-browser terminal and drives the **Nexus** delivery + knowledge-distillation pipeline through
it. Instead of leaving users to remember which `nxs.*` command comes next, Prime sequences the
judgment stages in order and surfaces the human-decision gates between them — while preserving
the feel of interacting with Claude Code directly.

<!-- Inferred from Q1 + project CLAUDE.md -->

## Vision & Strategy

Be the **richer-than-terminal surface for Nexus** — the place where the pipeline's discipline
(ordered stages, enforced decision gates) is made visible and navigable, without sacrificing the
live, high-fidelity Claude Code experience that makes the work feel real.

Nexus's core bet — **generation is cheap, judgment is expensive** — is Prime's organizing
principle: Prime orchestrates the *judgment* stages and the human decisions between them; it does
not try to automate the judgment away.

## Anti-goals

What Prime deliberately does **not** do:

- **Does not write or gate the target project's code.** Implementation and testing remain the
  engineer's job; Nexus (and therefore Prime) does not generate or gate code.
- **Does not replace Claude Code** — it wraps it. Prime is a harness around the tool, not a
  substitute for it.
- **Does not fork or modify the Nexus toolchain.** `../nexus` is the source of truth for command
  behavior; Prime orchestrates, it does not redefine.
- **Does not reduce the experience to summarized output and artifacts.** Showing only digested
  results instead of the live session is an explicit non-goal (see Product Principles #1).

<!-- Confirmed by user in Q2 -->

## Product Principles

1. **Experiential fidelity above all.** Even inside Prime, the user must feel they are getting
   the full benefit of interacting richly with Claude Code directly — not watching summarized
   output and generated artifacts. This is the one thing v1 has to get right. When a UX choice
   trades fidelity for tidiness, fidelity wins.
2. **Pipeline discipline through gates, not nags.** Order and decision gates exist to force the
   human judgment each stage is there for. Surface the next decision; don't bury it in a list of
   commands.
3. **Generation is cheap, judgment is expensive.** Optimize for the moments where a human must
   decide; don't add ceremony to the parts that are just generation.

<!-- Principle #1 is the user's stated must-get-right for v1 -->

## Personas

### Primary — Engineer on a small team adopting Nexus

- **Who:** A developer on a small engineering team that is standardizing on the Nexus pipeline.
  May be new to Nexus or only lightly familiar with it.
- **Jobs to be done:** Run delivery work through the structured pipeline without having to
  memorize stage order; hit the same decision gates their teammates do, consistently; stay in a
  full-fidelity Claude Code session the whole time.
- **Pain points:** Forgetting which `nxs.*` stage comes next; inconsistent process across
  teammates; tools that summarize the AI session and hide the actual interaction.
- **Wins when:** The team runs epics start-to-finish in Prime with consistent gates, and nobody
  feels they had to drop to a raw terminal to get the "real" experience.

### Secondary — Solo developer using AI-assisted delivery

- **Who:** An independent developer, possibly already using Nexus by hand, possibly not.
- **Jobs to be done:** Get the pipeline's structure and the live Claude Code experience in one
  surface; ship without losing flow.
- **Pain points:** Context-switching between remembering commands and doing the work; raw
  terminal lacks visible pipeline state.
- **Note:** For the Nexus-new solo dev, Prime doubles as the on-ramp to the pipeline.
  <!-- TODO: Verify how much guided onboarding this persona needs -->

## Domain / Industry Context

Developer tooling — specifically **AI-assisted software delivery orchestration**. Prime sits one
layer above Claude Code: a process harness that turns an open-ended AI coding session into an
ordered, gated delivery pipeline. Users are technical; tolerance for friction and for "magic that
hides what happened" is low. Product-led adoption is the natural motion (developers try it
themselves; teams standardize on it).

<!-- Inferred from category + personas -->

## Competitive Landscape

- **Raw Claude Code terminal** — the default users already have. Table stakes Prime must match:
  full-fidelity interactive session, no loss of the direct experience. Prime's wedge: visible
  pipeline state, enforced stage order, and decision gates layered *on top* without degrading
  that fidelity.
- **General AI-coding agent orchestration tooling** — emerging tools that wrap coding agents in
  workflows. Prime's differentiation: it is purpose-built for the Nexus pipeline's specific
  judgment stages and gates, not a generic workflow wrapper.

<!-- No competitor named by user; inferred from positioning. To be researched as the space matures. -->

## Success Metrics

- **North star: Stays-in-Prime rate** — share of pipeline runs completed inside Prime without
  the user dropping to the raw Claude Code terminal. This is the most direct proxy for
  experiential fidelity and flow: if users escape to the terminal, Prime has failed its #1
  principle.
- **Supporting:** pipeline completion rate (epics that reach `nxs.close`); consistency of gate
  decisions across a team.

### Impact thresholds (for RICE-style scoring)

- **High impact:** affects >20% of users / pipeline runs
- **Medium impact:** affects 5–20%
- **Low impact:** affects <5%

### Effort guidance

- **High effort:** up to ~4 weeks
- **Medium effort:** up to ~2 weeks
- **Low effort:** under 1 week

<!-- North star confirmed by user; thresholds are conservative defaults — adjust as real data arrives -->

## Regulatory & Compliance

None applicable. Prime is a local developer tool with no backend, database, or sensitive-data
handling; it shells out to the local Nexus toolchain and Claude Code. No PII, health, or
financial data flows through the product.

**Applies when:** if Prime later adds hosted/multi-user or telemetry features, revisit data
handling and privacy obligations at that point.

## Company Scale

- **Stage:** pre-launch — building the MVP on the Nx scaffold (wterm/Claude Code integration is
  the work to build).
- **Team:** solo / small.
- **Users:** none yet (pre-launch).

<!-- Inferred from repo state (scaffold only) + Q1 -->
</content>
