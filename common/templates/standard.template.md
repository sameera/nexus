---
standard: [Standard Name]
category: [backend|frontend|database|security|testing|architecture]
applies_to: ["technology1", "technology2"]
description: [One line: what decision space this standard governs]
---

# [Standard Name]

> A standard is a **ledger of decisions**, not a catalog of patterns. Record only
> what an agent cannot recover by reading the code itself: canonical choices among
> alternatives, prohibitions, NFR budgets, security/authz constraints. Point to the
> code; never paste it.

## Overview

Brief explanation of the decision space this standard governs and when it applies.
One or two sentences.

## Decisions

Each entry is: the decision, why it holds, and a path to the exemplar in code.
No pasted code blocks — the path is stable, a paste drifts.

### [Decision name]

**Decision**: The canonical choice. When alternatives exist, state which wins and which is deprecated.

**Rationale**: Why this choice — the constraint or trade-off that an agent can't infer from the code.

**Exemplar**: `path/to/file.ts` — the reference implementation to follow.

**Exceptions**: When deviation is allowed (omit if none).

---

### [Decision name]

**Decision**:

**Rationale**:

**Exemplar**: `path/to/file.ts`

**Exceptions**:

## Prohibitions

"Never do X" rules. Absence is invisible in code, so it must be stated here.

- **Never** [action] — [why]. Use [the sanctioned alternative] instead.

## Budgets

Cross-cutting NFR constraints that live nowhere in source.

| Budget | Limit | Scope |
| ------ | ----- | ----- |
| [e.g. page load] | [< 2s] | [route/feature scope] |

## Checklist

Quick reference for design and code review:

- [ ] [Decision honored]
- [ ] [Prohibition not violated]
- [ ] [Budget met]
