## 2026-10-16 — Ship /nxs.code-review as a skill, not a command
- **Choice:** Authored at `components/skills/nxs.code-review/SKILL.md`.
- **Why:** The epic and record name it a skill, and G15's replacement of a personal skill of that name holds only when the installed path is the same skill folder.
- **Refuted alternative:** `components/commands/nxs.code-review.md`, like the other `nxs.*` stages — it would sit beside a personal skill of the same name instead of replacing it.

## 2026-10-16 — Low and Negligible severity wording written fresh
- **Choice:** Low = a nuisance with an obvious workaround that leaves every result correct; Negligible = no effect on behaviour.
- **Why:** The record defers these two levels to the lead's personal skill, which is not in this checkout or install location.
- **Refuted alternative:** Leave Low and Negligible undefined — breaks D2's fixed scales and G5.

## 2026-10-16 — "Changed lines" are the head side of the diff hunks
- **Choice:** `nexus review-post` treats added lines and in-hunk context lines as changed lines.
- **Why:** Those are exactly the lines GitHub accepts an inline comment on, so the check refuses only what GitHub would reject.
- **Refuted alternative:** Added lines only — would push findings on unchanged context lines into the body for no gain.

## 2026-10-16 — The posting command tags each inline comment with its finding number
- **Choice:** `nexus review-post` prefixes every inline comment body with `**#<n>**`; the skill leaves the number out.
- **Why:** The tag (G10) is then applied by tested code, not by the model.
- **Refuted alternative:** The skill writes the tag into each comment body itself.
