---
title: "Theme Tokens"
aliases: ["theming", "dual theme", "light and dark mode", "semantic tokens"]
touches: [reading-surface-tokens]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Theme Tokens

Theme Tokens is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

## How It Works

Nothing here asserts the concept any more. The teaching stage left Nexus as its own package,
and its knowledge left with it — one page, one decision log, one place it can be wrong. What
stayed is this stub, because two things still need the name. A reader who greps an old slug
gets an answer instead of silence. And the pages here that name this one keep a live edge: an
edge whose other end is gone is a dead edge, which reads as though the interaction lapsed when
in fact it only moved.

The bullets below are the interactions as they stood when the page left. They are a map to
follow, not a claim about today; the page in the teaching repository is what is current.

## Key Invariants

1. This entry asserts nothing about behaviour; the page in the teaching repository is the one that does.
2. The name keeps resolving here, so a reader who searches the old slug is told where it went.
3. Edges from pages that stayed keep resolving, so no page here carries an edge whose other end is gone.

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


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
