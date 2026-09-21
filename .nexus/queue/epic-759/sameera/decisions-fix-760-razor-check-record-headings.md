## 2026-09-21 — Where the one story-heading definition lives

- **Choice:** `ordering.ts` exports `storyHeadingTitle`, the heading-level half of the story match it already owned, and the story check asks it.
- **Why:** the ordering check's definition is the one the epic says to adopt, so it stays where it is and gains a caller rather than moving.
- **Refuted alternative:** a new module holding the definition both checks import — a third file for one regexp, when neither check is the other's dependency today and `ordering.ts` is already the file that answers "which stories does this draft declare".
