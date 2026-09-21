## 2026-09-21 — The shared repository rule is the existing `sameRepo`, widened

- **Choice:** widen the comparator the provenance-reference module already exports rather than adding a second, verdict-specific one beside it; both verdict readers now call it.
- **Why:** invariant 4 asks for exactly one comparison rule, and a new function next to an existing one named for the same question is how a second rule starts.
- **Refuted alternative:** a new `sameRepository` exported alongside `sameRepo`, leaving the older one for bare-form callers.

## 2026-09-21 — A stamp that parses as neither form falls back to case-folded equality

- **Choice:** when either side is not a two- or three-segment repository identity, compare the two strings case-insensitively instead of rejecting.
- **Why:** that is exactly today's behaviour for an unparseable stamp, so the widening cannot make a previously accepted verdict fail.
- **Refuted alternative:** reject any stamp that does not parse, which would newly drop verdicts nobody has complained about.
