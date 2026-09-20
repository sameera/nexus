## 2026-09-20 — Phase 0.3 becomes a back-reference rather than disappearing

- **Choice:** Workspace-shape and run-mode resolution moved to a new run-shape resolution section at the front of Input Resolution, and Phase 0.3 kept its number as a two-line pointer at the values already resolved.
- **Why:** Record invariant 4 forbids changing the base stage's phase numbering, and deleting step 3 would renumber 0.4–0.6, invalidating the phase references the concept store and sibling stages carry.
- **Refuted alternative:** Delete step 3 and renumber the rest of Phase 0.

## 2026-09-20 — The contract selection table grows one row per story

- **Choice:** Story #727 introduces the selection table with its two rows; each later extraction adds its own row rather than the table landing complete and half-empty.
- **Why:** A row naming a contract that does not exist yet would fail the story's own "every named contract exists as an installed skill" assertion.
- **Refuted alternative:** Land all five rows in #727 with the unbuilt contracts marked pending.

## 2026-09-20 — The hub gate lives in the workspace-shape bullet, not a separate sentence

- **Choice:** The hub contract is named inside run-shape resolution's `hub` bullet rather than at a later, separate gate sentence like recovery's and continuation's.
- **Why:** Hub rules are scattered across six phases with no single first use, so the only point where the condition is resolved and no hub rule has yet been needed is the resolution itself.
- **Refuted alternative:** Gate it at Input Resolution 3, the first phase whose behaviour varies.

## 2026-09-20 — The fix and intake lane suites read base stage plus contract

- **Choice:** `fix-lane.spec.ts` and `nxs-intake.spec.ts` now build their `DISTILL` constant from the base command document concatenated with the non-epic contract, instead of repointing each assertion individually.
- **Why:** Those suites assert what a run draining an entry of that kind reads, and such a run reads both documents; concatenating keeps every existing assertion verbatim, which is what record invariant 12 asks for.
- **Refuted alternative:** Repoint each of the ~30 assertions at whichever of the two documents now owns its rule.
