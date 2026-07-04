---
title: "Theme Tokens"
aliases: ["theming", "dual theme", "light and dark mode", "semantic tokens"]
touches: [application-shell]
last_updated_by: "#15"
status: active
verification: verified
---

# Theme Tokens

Theme tokens give Prime one semantic colour vocabulary backed by two value sets — dark and light — selected by a single mode flag on the shell root. Every region consumes the semantic tokens and never a raw colour value, so a single mode flip re-resolves the whole shell with zero per-region branching. Both value sets cover every cross-mode colour divergence between the two design mockups, not only the top-level ones.

## How It Works

A semantic palette of surface tiers, chrome, ink tiers, accent, state, and gate-surface colours is defined as named tokens whose values are redefined under a root mode selector. The active mode is set once at the shell root; each token resolves through inheritance, so a region written once renders correctly in either mode. The user-facing switch flips the mode at runtime and persists the explicit choice in local browser storage; on first load with no prior choice the shell follows the operating-system colour-scheme preference, defaulting to dark when none is expressed. Crucially, the two mockups differ well beyond their top-level variables: roughly two dozen colours defined elsewhere also flip between modes — surface tints, gradient opacities, badge and violation fills, borders, the scrollbar thumb, hover backgrounds, and the inks on the accent and state glyphs — and all are lifted into both value sets as tokens.

## Key Invariants

1. There is exactly one token source of truth: no region emits a literal colour, radius, or font value that the theme already defines.
2. The theme mode is applied only at the shell root; every region resolves the active mode through token inheritance with no per-region theme conditional.
3. Both value sets cover every cross-mode colour divergence between the two mockups, including the values that flip outside the top-level block and the inks on accent and state glyphs.
4. After a mode switch, every region renders in the new mode with none left in the prior mode.
5. An explicit mode choice is persisted and restored on reload; with no prior choice the shell follows the operating-system preference and falls back to dark.
6. The server render and first client render use the default mode; the persisted or operating-system choice is reconciled only in a post-mount effect, so first load may show a one-frame flash.

## Integration Points

- [application-shell](application-shell.md) — the shell root applies the active mode that every region inherits.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Semantic tokens over the framework's dark variant

Theme is modelled as a semantic token vocabulary whose values are redefined under a root mode selector, so a themed property resolves one token rather than carrying both mode values inline. Refuted alternative: the styling framework's built-in dark variant, already in the stack and the idiomatic default — it loses because it forces every themed property to carry a paired dark utility at each call site (the exact per-region branching the shell forbids) and inverts ownership so the two values live inline, making the single-source-of-truth invariant unenforceable.

### 2026-07-04 — #15 — SSR-safe default theme with a one-frame flash

The theme store's synchronous browser-storage and media-query read crashes under server rendering, so the server and the first client render both use a fixed default mode and reconcile the persisted or operating-system choice in a post-mount effect, accepting a one-frame flash on first load. Refuted alternative: a cookie-persisted mode read on the server for zero flash — legitimate on a public multi-user app, but it adds a server-read path and a new persistence surface for a purely cosmetic gain on a local single-user app, so the cost does not clear.
