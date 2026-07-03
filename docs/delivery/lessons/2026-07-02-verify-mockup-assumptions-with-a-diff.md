---
date: 2026-07-02
epic: "Application Shell Layout"
source: "#3"
---

# Lesson: verify a "differ only in X" mockup assumption with a direct diff before sizing

The epic was scoped on the stated assumption that the dark and light mockups "differ only in their
`:root` token values," with the token-extraction note calling the out-of-`:root` hardcodes "a
handful." A direct side-by-side diff of the two mockups told a different story: ~two dozen colors
hardcoded *outside* `:root` also flip between modes — surface tints, gate-tray and validation gradient
opacities, badge alpha tints, violation-row fills, scrollbar/hover treatments, and every
text-on-accent / on-glyph ink. Several were mode-dependent value *pairs*, not single-mode hardcodes —
the harder case to tokenize.

HLD caught it and corrected Story 1's scope to "enumerate and tokenize *all* cross-mode color
divergences from a side-by-side diff," and the implementation matched — so the epic still closed at
its M complexity with no deviations. But the token work was the epic's real hidden cost, and it was
invisible in the original sizing because the mockup assumption was trusted rather than checked.

**For the next epic in this area (PM estimation):** when an epic leans on a visual mockup with a
"differ only in X" / "structurally identical" assumption, run the actual diff before sizing. The
theming/token cost of a shell scales with the *count of cross-mode divergences*, not with the number
of regions — and that count lives in the diff, not in the region list. A one-line assumption that
turns out to be "~24 value pairs" is the gap between an S and an M. Cheap to check, expensive to
discover late.
