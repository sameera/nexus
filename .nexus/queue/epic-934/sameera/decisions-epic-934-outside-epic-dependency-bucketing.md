## 2026-10-12 — A brief group of its own for accepted outside-epic dependencies
- **Choice:** Add a "Delivered by another epic" group to the approval brief, between "Before implementation" and "Committed follow-up".
- **Why:** The mitigation of such a risk is often not decided yet (record #38's Maps epic is unplanned), so "Committed follow-up" ("mitigation is decided") would misdescribe it.
- **Refuted alternative:** Widen "Committed follow-up" to take accepted outside-epic risks; one fewer group, but it mixes decided work with work nobody has planned.

## 2026-10-12 — The checker blocks an ADDRESS risk listed in two groups, not one listed in none
- **Choice:** `nexus razor-check --record` blocks an ADDRESS risk whose ID opens entries in more than one brief group; an unlisted risk still passes.
- **Why:** Blocking an unlisted risk would fail approved worked examples and drafts that never listed every ADDRESS risk; a duplicate is the case the new group makes likely.
- **Refuted alternative:** Require every ADDRESS risk in exactly one group mechanically.

## 2026-10-12 — The duplicate-listing check counts only the five placing groups
- **Choice:** `nexus razor-check --record` counts a risk's listings only in Resolve before approval, Choices with trade-offs, Before implementation, Delivered by another epic and Committed follow-up.
- **Why:** A Revision delta entry must name each moved risk, and any other bold line in the brief would otherwise count as a group too.
- **Refuted alternative:** Exclude "Revision delta" by name; smaller, but any other bold line a drafter adds would still be counted.
