---
title: "Theme Tokens"
aliases: ["theming", "dual theme", "light and dark mode", "semantic tokens"]
touches: [application-shell]
last_updated_by: sameera/prime#3
status: active
verification: verified
---

# Theme Tokens

Theme tokens give Prime one semantic colour vocabulary backed by two value sets — dark and light — selected by a single mode flag on the shell root. Every region consumes the semantic tokens and never a raw colour value, so a single mode flip re-resolves the whole shell with zero per-region branching. Both value sets cover every cross-mode colour divergence between the two design mockups, not only the top-level ones.

## How It Works

A semantic palette — surface tiers, terminal surface, chrome, ink tiers, accent, state colours, and the gate surface — is defined as named tokens whose values are redefined under a root mode selector. The active mode is set once at the shell root; each token resolves to that mode's value through inheritance, so a region written once renders correctly in either mode. The user-facing switch flips the mode at runtime and persists the explicit choice in local browser storage; on first load with no prior choice the shell follows the operating-system colour-scheme preference, defaulting to dark when none is expressed. Crucially, the two mockups do not differ only in their top-level variables: roughly two dozen colours defined elsewhere also flip between modes — surface tints, gate and validation gradient opacities, badge tints, violation-row fills, fix-link borders, the scrollbar thumb, hover backgrounds, and every ink drawn on the accent or on the state glyphs. All of these are lifted into both value sets as semantic tokens.

## Key Invariants

1. There is exactly one token source of truth: no region emits a literal colour, radius, or font value that the theme already defines.
2. The theme mode is applied only at the shell root; every region resolves the active mode through token inheritance with no per-region theme conditional.
3. Both value sets cover every cross-mode colour divergence between the two mockups, including the roughly two dozen values that flip outside the top-level variable block and the inks that flip on accent and state glyphs.
4. After a mode switch, every region renders in the new mode with none left in the prior mode.
5. An explicit mode choice is persisted and restored on reload; with no prior choice the shell follows the operating-system preference and falls back to dark.

## Integration Points

- [application-shell](application-shell.md) — the shell root applies the active mode that every region inherits.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Semantic tokens over the framework's dark variant

Theme is modelled as a semantic token vocabulary whose values are redefined under a root mode selector, so a themed property resolves one token rather than carrying both mode values inline. Refuted alternative: the styling framework's built-in dark variant, already in the stack and the idiomatic default — it loses because it forces every themed property to carry a paired dark utility at each call site (the exact per-region branching the shell forbids) and inverts ownership so the two values live inline, making the single-source-of-truth invariant unenforceable.
