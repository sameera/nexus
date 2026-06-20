# 0001 — Nexus refactor direction

**Status:** Decided (direction). Mechanism design not started.
**Date:** 2026-06-09

This is the authoritative current-state synthesis for the Nexus refactor. It supersedes
everything under [`.nexus/archive/`](../archive/) as _product direction_ (those docs
remain readable for mining specific ideas — see the archive README).

---

## Context

Three prior generations of design plus a long brainstorm arc all explored a heavier
"knowledge pipeline" reimagining of Nexus. All are now superseded as direction and have
been moved to `.nexus/archive/`. The one transferable conclusion from that work is a
**diagnosis**, not any of its machinery: Nexus's core weakness is
[_speculative over-generation_](../concepts/speculative-over-generation.md) — it generates
heavy, speculative artifacts (16-section HLDs, per-task LLDs, prose PIRs) ahead of validated
scope, and that volume drowns the human judgment Nexus exists to inject. "Make Nexus
token-efficient" always meant "stop generating junk."

A separate, higher-level product line (an openly-a-bot scope-coaching agent) diverged out
of that same brainstorm and lives in `~/projects/awzm-notes/brainstorms/concept store/nexus/`
(notes 001–016). **It is not built here.**

## The goal — two systems that feed each other

1. **System A — lean delivery pipeline.** Refactor Nexus into a leaner, more efficient
   delivery pipeline whose explicit purpose is to **assist Product and Project
   management**. Implementation is **left to engineers as they see fit** — Nexus is a
   delivery/judgment harness, not a code-generation engine.

2. **System B — knowledge distillation engine.** Distill durable system knowledge from
   what the pipeline produces, to **inform PM spec generation and architectural design**.
   System B consumes System A's artifacts; its output informs the next round of System A's
   specs and designs. Steady state: the two feed each other.

## Decisions

1. **Hard split — lean is defined by the human consumer; volume only where the consumer is
   a machine; the two never share an artifact.**
    - Human judgment surface → `docs/` — lean. Two independent gates: a forcing function
      (the interaction that makes a human decide) justifies *generating* an output and
      *stopping* on it; persistence to `docs/` is earned separately, by a downstream human
      reader consuming the committed result. A pure forcing function is an interaction, spent
      once answered — it persists nothing (e.g. the right-sizing gate, council).
    - Machine knowledge surface → `.nexus/concepts/` — distilled knowledge for AI tooling;
      volume is legitimate here.
    - A command writing a human artifact into the concept store, or a machine artifact into
      `docs/`, is a review violation. The two-store layout makes the constraint physical,
      not a matter of discipline.

2. **Knowledge distillation stays grep-native — no topology.** Informing PM specs and
   architectural design needs _readable, retrievable, distilled pages_, not a code graph.
   No community detection, no Graphify, no embeddings/RAG. (Graphify was killed for lack of
   a real burn; its unstable-community-ID problem was never solved. Do not reopen without a
   genuinely _structural_ corpse.) Backend for any code-navigation need is a separate, later
   question and defaults to grep until precision is demonstrably required.

3. **`.nexus/concepts/` is git-tracked, not derived.** It holds distilled _judgment_ (the
   "why"), which cannot be regenerated from code. This inverts the old "gitignore derived
   state" reflex that applied to graph caches.

4. **Scope boundary: assist PM/PjM; implementation is the engineer's.** Nexus does not gate
   or own the implementation step. This keeps the pipeline lean and is the antibody against
   drifting back into over-generation.

5. **Sequencing.** The artifact contract (what A emits / B consumes) is the interface
   between the two systems and is **frozen first**. Then build System A's artifact
   reshaping. Then build System B against the stable contract. Mutual feeding is a
   steady-state property, not a build order — do not build both in lockstep.

6. **Out of scope here:** a coaching-agent product, Graphify,
   Serena/MCP code-intelligence, community topology, PM continuous concept-curation as a
   first-class workflow. These belong to the divergent thread or were burned.

## Superseded & archived

| Archived doc                                         | What it was                                                                                         | Disposition                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `archive/nexus-wiki/1-6*.md`                         | Gen-1 "Graphify pivot": iteration→story units, PM-curated concepts, new commands, Graphify topology | Direction dead. **Mine** the artifact-reshaping & forcing-function ideas.      |
| `archive/nexus-wiki/HLD.md` + `wiki-architecture.md` | Gen-2 grep concept-graph + distiller + bootstrap                                                    | Direction dead. **Mine** the grep concept-page shape for System B.             |
| `archive/nexus-v2/v2-proposal.md`                    | Gen-3: grep concepts + Serena code-intelligence                                                     | Direction dead. Serena/MCP left behind; concept-page core may inform System B. |

**Mineable from the archive (for the refactor):** the razor "every artifact is a forcing
function for a human decision or it's cut scaffolding" (`1-validation.md`); `/nxs.hld`
16-section → focused decision record; `/nxs.tasks` → task index, drop per-task LLDs; drop
prose PIRs; a right-sizing brake that catches over-generation _early_. The grep concept-page
schema is a candidate shape for System B's concept pages.

**Left behind:** Graphify, Serena/MCP, community topology, the bootstrap/distiller command
machinery as designed, the coaching agent.

## Next step

Produce the **artifact contract** (per Decision 5), in two parts done together:

1. **Pipeline audit** — catalogue what each `/nxs.*` stage emits today; mark each output
   **keep / slim / cut** against the forcing-function razor. Defines System A's lean outputs.
2. **Concept schema** — what `.nexus/concepts/` holds and the shape System A emits into it.
   Defines System B's consumption contract.

## Deferred / not blocking

- **Success criteria** — the user is confident in the target; explicit falsifiable metrics
  are deferred by choice.
- **Delivery-model restructure** (iteration→story→task units, durable-vs-transient docs,
  immutable decision records, Objective/Story GH hierarchy) — separable from artifact
  reshaping. Weigh on its own merits; do not let it swallow the lean win. Do artifact
  reshaping first.
