# Nexus knowledge library (machine-consumable)

This directory is the **machine knowledge surface** for Nexus — distilled, retrievable
knowledge intended for AI tooling that informs Product Management spec generation and
architectural design. See [`../decisions/0001-refactor-direction.md`](../decisions/0001-refactor-direction.md).

## Rules

- **Consumer is the machine, not the human.** Volume is legitimate here. Human-facing,
  judgment-forcing artifacts belong in `docs/`, never here. Never mix the two.
- **Grep-native, no topology.** Pages are readable, retrievable markdown keyed by concept.
  No graph engine, no community detection, no embeddings/RAG. Retrieval is grep/glob/read.
- **Git-tracked.** This is distilled *judgment* (the "why"), not derived state — it cannot
  be regenerated from code, so it is versioned and reviewed like source.

## Status

Empty. System B (the distillation engine) is not built yet. The page schema is part of the
artifact contract to be defined next.
