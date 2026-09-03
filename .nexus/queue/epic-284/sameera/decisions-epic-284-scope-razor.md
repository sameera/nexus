## 2026-09-03 — `razor-check` ships with story #285, not #287

- **Choice:** the `razor-check` verb and the `@nexus/scope-razor` library are created here, carrying assertion mode only; #287 adds the counted limits and the citation comparison to the same operation.
- **Why:** #285's fourth criterion is enforced by the derived-body assertion, and the component-invocation gate refuses a shipped body naming a verb the executable does not declare — so the command wiring and the verb cannot land in different commits.
- **Refuted alternative:** wire the epic command to strip labels by instruction and defer every mechanical check to #287. It keeps the story boundary the record drew, but it makes the one criterion the record calls "checked rather than remembered" remembered again for a whole story.

## 2026-09-03 — the label grammar tolerates optional backticks

- **Choice:** `[inferred]` and `[asked: "…"]` match with or without surrounding backticks, and stripping collapses the whitespace it leaves behind.
- **Why:** a draft reads better with the label in code ticks and the checker must not make that a formatting rule the author has to get right.
- **Refuted alternative:** require the backticks, so the grammar is exact. It converts a rendering preference into a blocking condition, which is the escape-valve failure the citation rule already refuses.
