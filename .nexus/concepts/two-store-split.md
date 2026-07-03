---
title: "Two-Store Split"
aliases: ["two-system split", "human/machine store separation", "docs-vs-concepts wall", "artifact wall"]
touches: ["forcing-function-razor", "gold-plating", "concept-store"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Two-Store Split

Nexus keeps two knowledge surfaces that never share an artifact: a lean human-judgment surface for what a person must read and decide, and a machine knowledge surface where distilled volume is legitimate. The consumer, not the content, decides where a thing lives.

## How It Works

The human surface holds only committed judgment a later human reader consumes — product and system ground truth, slim epics, focused decision records, close records. The machine surface holds distilled concept pages retrieved by tooling that informs planning and design. A command that writes a human-judgment artifact into the machine store, or a machine artifact into the human surface, is a review violation. The split is physical — separate locations — so the constraint is enforced by layout, not discipline. A third, transient category, the committed queue, carries gated human planning artifacts awaiting distillation; it is not a breach because it never holds an ungated machine block.

## Key Invariants

1. The two stores never share an artifact; each belongs to exactly one consumer.
2. Placement is decided by the consumer — human reader versus machine tooling — never by content type alone.
3. Volume is legitimate only on the machine surface; the human surface stays lean.
4. Writing a human artifact into the machine store, or the reverse, is a review violation.
5. The machine store holds non-regenerable judgment, so it is version-tracked, not derived from code.

## Integration Points

- [forcing-function-razor](forcing-function-razor.md) — the razor decides what earns a place on the lean human surface.
- [gold-plating](gold-plating.md) — the disease the split contains by walling regenerable volume off from judgment.
- [concept-store](concept-store.md) — the machine surface the split defines.

## Decision Log

### 2026-06-09 — bootstrap — 0001: hard split by consumer

Established the two-system direction: a lean delivery pipeline that assists product and project management, feeding a knowledge store that informs later specs and designs. Lean is defined by the human consumer; volume is allowed only where the consumer is a machine; the two never share an artifact. The considered alternative — one blended store with per-artifact tags marking human versus machine — was rejected: a soft tag relies on discipline and drifts, whereas separate physical surfaces make a misplaced artifact a visible review violation.
