## 2026-08-27 — Story #319 builds the version read-out it was going to merely verify

- **Choice:** Add the install-location report (`installLocation: {path, source, content, checkout}`) to `nexus version` inside story #319 rather than treating AC3 as already satisfied.
- **Why:** The epic assumes #251 already made the version verb report which content is present; it does not, so AC3 was unverifiable as filed and the gate would have been recorded as passed on an unmet criterion.
- **Refuted alternative:** Record AC3 as blocked and carry it into story #321 with the other call sites — refused because the gate story is the one that has to be true before the tree moves.
