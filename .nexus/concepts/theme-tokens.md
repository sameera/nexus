---
title: "Theme Tokens"
aliases: ["theming", "dual theme", "light and dark mode", "semantic tokens"]
touches: [reading-surface-tokens]
last_updated_by: "#673"
status: active
verification: verified
---

# Theme Tokens

Theme tokens are one semantic colour vocabulary backed by two value sets, dark and light, chosen by a single mode flag at the root of whatever surface reads them. A consumer names the role it wants and never a colour, so one flag re-resolves the whole surface and nothing below the root asks which mode is on.

## How It Works

A token names a role: the page background, the ink tiers from body text down to the quietest label, the accent at rest and in use, rules, code surfaces. Every name appears in both value sets, so a name that resolves in one mode resolves in the other. A value that does not flip is declared once outside both sets, so the pair holds only what actually changes.

The two sets are emitted against the same root, one as the default and one behind the mode flag. A surface that sets the flag gets the second set by inheritance, with no question asked at any point of use. Dark is what a root that selects nothing resolves to; light is the deliberate choice.

The vocabulary is defined here and rendered as bytes, which is what lets a surface embed it instead of depending on the application it first grew in. Which part is shared with a second surface belongs to the reading subset, not here.

## Key Invariants

1. There is one source for a themed value: no consumer emits a literal colour the vocabulary already names.
2. A token names a role and never an appearance, so one name stays correct in both modes.
3. Every name is defined in both value sets, and a value that does not flip is declared once outside them.
4. The mode is chosen once, at the surface's root, and every region resolves it by inheritance with no per-region conditional.
5. A root that selects no mode resolves to dark.
6. ~~An explicit mode choice is persisted and restored on reload; with no prior choice the shell follows the operating-system preference and falls back to dark.~~ Persisting a choice was the application's, and it left.
7. ~~The server render and first client render use the default mode; the persisted or operating-system choice is reconciled only in a post-mount effect, so first load may show a one-frame flash.~~ Likewise: nothing here renders twice.

## Integration Points

- [reading-surface-tokens](reading-surface-tokens.md) — the reading subset of this vocabulary, lifted out so a second surface can share it.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Semantic tokens over the framework's dark variant

Theme is modelled as a semantic token vocabulary whose values are redefined under a root mode selector, so a themed property resolves one token rather than carrying both mode values inline. Refuted alternative: the styling framework's built-in dark variant, already in the stack and the idiomatic default — it loses because it forces every themed property to carry a paired dark utility at each call site (the exact per-region branching the shell forbids) and inverts ownership so the two values live inline, making the single-source-of-truth invariant unenforceable.

### 2026-07-04 — #15 — SSR-safe default theme with a one-frame flash

The theme store's synchronous browser-storage and media-query read crashes under server rendering, so the server and the first client render both use a fixed default mode and reconcile the persisted or operating-system choice in a post-mount effect, accepting a one-frame flash on first load. Refuted alternative: a cookie-persisted mode read on the server for zero flash — legitimate on a public multi-user app, but it adds a server-read path and a new persistence surface for a purely cosmetic gain on a local single-user app, so the cost does not clear.

### 2026-09-07 — #405 — Reciprocal link from reading-surface-tokens

Mechanical reciprocity fan-out: the reading subset of this vocabulary — background, ink levels, accent, rules, code surfaces, type stacks and radius — was lifted into one definition the application now imports rather than declares. Application chrome values stay here. The single-source-of-truth invariant is unchanged in force; the source of truth for the reading subset moved out of the application so a library that cannot depend on it can read the same values.

### 2026-09-18 — #669 — The page stays whole here while its subject moves to sameera/prime

Prime's theme and the workbook's reading tokens were one concept, and half of it left this repository. The page is kept whole rather than split, because a split would leave two pages asserting one thing. Its dead edge to application-shell was dropped by hand when that page left. What this repository can still verify is the single shared definition the workbook reads, which reading-surface-tokens holds. Rewriting the vocabulary itself away from Prime is deferred to its own stub, so the body above still describes a shell maintained in sameera/prime. Refuted alternative: split the page into a Prime half and a workbook half, which loses on what stays here being one shared definition rather than two concepts.

### 2026-09-18 — #673 — The vocabulary is stated as itself, not as the departed shell's

The definition opened as Prime's — two mockups, a scrollbar thumb, a persisted switch, a one-frame flash on first load — and that opening propagated into the generated atlas, where it described a shell this repository does not hold. What survives Prime's departure is the vocabulary itself: roles rather than colours, two value sets under one flag at the root, and the rule that no consumer writes a literal. The page now says that, and the two invariants that were the application's own behaviour are struck rather than deleted, because a struck invariant records that it was once held and by whom. Refuted alternative: leave the body and let the reading subset's page carry the whole story, which loses on the atlas continuing to introduce the concept as a shell that is not here.
