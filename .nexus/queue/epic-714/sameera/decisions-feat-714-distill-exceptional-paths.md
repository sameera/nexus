## 2026-09-20 — Phase 0.3 becomes a back-reference rather than disappearing

- **Choice:** Workspace-shape and run-mode resolution moved to a new run-shape resolution section at the front of Input Resolution, and Phase 0.3 kept its number as a two-line pointer at the values already resolved.
- **Why:** Record invariant 4 forbids changing the base stage's phase numbering, and deleting step 3 would renumber 0.4–0.6, invalidating the phase references the concept store and sibling stages carry.
- **Refuted alternative:** Delete step 3 and renumber the rest of Phase 0.

## 2026-09-20 — The contract selection table grows one row per story

- **Choice:** Story #727 introduces the selection table with its two rows; each later extraction adds its own row rather than the table landing complete and half-empty.
- **Why:** A row naming a contract that does not exist yet would fail the story's own "every named contract exists as an installed skill" assertion.
- **Refuted alternative:** Land all five rows in #727 with the unbuilt contracts marked pending.
