---
title: "Drain Entry Admission"
aliases: ["entry admission", "merge precondition", "lost entry rebuild", "unconsumed entry"]
touches: ["distiller"]
last_updated_by: "#896"
status: active
verification: verified
---

# Drain Entry Admission

A drain takes only entries whose change has reached the trunk. It scans the committed queue and the ephemeral area for unconsumed entries. A lost entry is rebuilt only when the lead asks for it by name.

## How It Works

A drain runs after merges, scanning unconsumed entries in the committed queue and the ephemeral area. An entry not yet in the trunk requires that its recorded range head reaches the trunk or that it resolves to a merged pull request; it never requires the file to be present. A lost entry is rebuilt on explicit request from its close comment. Recovery is a request for one entry, never a discovery scan.

## Key Invariants

1. A drained entry's recorded range head reaches the trunk or resolves to a merged pull request; the entry file's presence at the trunk is never the test.
2. A lost entry is rebuilt only on an explicit per-entry request, from its close comment, and no scan finds one.

## Integration Points

- [distiller](distiller.md) — the stage these admission rules belong to.

## Decision Log

### 2026-10-09 — #896 — Split from distiller
The distiller page passed its own-content cap when its statement about the reading list was rewritten. Which entries a drain admits does not depend on how it maps a diff, so each half loads on its own. The text moved without change, and the distiller keeps the mapping, the reason precedence and the deterministic steps. Refuted alternative: drop the two admission sentences to fit, which would lose the rule that an unmerged entry is checked by its range head.
