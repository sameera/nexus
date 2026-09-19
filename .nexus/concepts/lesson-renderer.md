---
title: "Lesson Renderer"
aliases: ["workbook renderer", "lesson page", "closed markup channel", "all-or-nothing render", "provenance banner", "quoted code in a lesson"]
touches: ["workbook-store", "widget-seam", "offline-page", "learner-folder", "reading-surface-tokens", "portable-tooling", "just-in-time-lesson", "generated-page-check", "workbook-home-page", "component-refusal", "reference-page"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Lesson Renderer

Lesson Renderer is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [workbook-store](workbook-store.md) — the lessons and the plan it reads, and the folder it writes the pages into.
- [widget-seam](widget-seam.md) — the declaration it resolves at render time, failing the whole render when it cannot.
- [offline-page](offline-page.md) — what a rendered page must be: openable from disk with nothing running.
- [learner-folder](learner-folder.md) — never an input, which is what keeps an empty folder from changing a page.
- [reading-surface-tokens](reading-surface-tokens.md) — the shared definition the one stylesheet it writes embeds.
- [portable-tooling](portable-tooling.md) — the executable it ships on, which carries the built script and stylesheet it writes out.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson written on arrival, whose quoted pinning test the render must show as code.
- [generated-page-check](generated-page-check.md) — split from this page: what answers drift between a committed page and the lesson it came from.
- [workbook-home-page](workbook-home-page.md) — one more page this render produces, from the committed plan rather than from an authored lesson.
- [component-refusal](component-refusal.md) — the code fields this render's markup check now skips, because a component escapes and shows their values as code itself.
- [reference-page](reference-page.md) — one more page this render builds, from its own authored prose, and links to from the warm-up of each lesson that drilled its concept.

## Decision Log

### 2026-09-07 — #405 — The markup channel is closed, and the render is all-or-nothing

Moving the markup into code is only enforceable when there is no channel through which markup could arrive, so the markdown path has raw pass-through disabled and a lesson carrying markup fails loudly, naming itself. The render was made all-or-nothing in both directions during implementation: a failure now clears the previous render's pages rather than leaving them in place. A surviving page from an earlier render no longer matches the lesson that produced it, and nothing on the page says so, which makes a half-current workbook worse than an empty one. Refuted alternative: leave the previous render in place, which keeps a readable workbook after a failure but makes it silently wrong. The check mode named in the record was shipped rather than dropped, because a generated page in a diff looks authored and nothing on it says which lesson it has fallen behind.

### 2026-09-07 — #407 — Code fences are exempt from the markup refusal, and the drift check splits out

The refusal was absolute, so a lesson could not quote the pinning test the learner is asked to write, and naming only the file left the learner unable to see what is being checked without opening the plan. A code fence's content is escaped and shown as code, so it is text a reader sees rather than a channel through which markup reaches the page, and the exemption tracks exactly what the renderer escapes. A widget declaration's content still counts, because a component turns it into markup. Fence closing now honours the opening run's length, so a lesson can quote a test containing a fence. Fitting the amended refusal took the page over its own-content cap, so the committed-page drift check moved to its own page, taking the paragraph on committed generated output and the invariant on the check mode. The seam is that a task asking why a committed page no longer matches its lesson needs neither the markup rule nor the chrome rules, and a task debugging a failed render needs nothing about the check. This entry also records the reciprocal link to the just-in-time lesson. Refuted alternative: leave the lesson naming only the file and let the learner open the plan. It is cheaper and keeps the markup rule absolute, but it drops the half of the decision that exists so the learner can see what is being checked.

### 2026-09-13 — #458 — Reciprocal link from workbook-home-page

Mechanical reciprocity fan-out: the render now produces a home page from the committed plan alongside the pages it builds from authored lessons. Nothing this page asserts changes — the home page goes through the same closed markup channel, the same shared chrome and the same all-or-nothing write, and it carries its provenance statement as the first content in the file like every other generated page.

### 2026-09-13 — #480 — Reciprocal link from component-refusal

Mechanical reciprocity fan-out: a component can now name fields of its own declaration that carry code, and this render's markup check skips exactly those fields' values, reading every other key and scalar in the declaration as before. Nothing else about the closed markup channel changes: code fences remain the only other exemption, and a widget declaration's content otherwise still counts as markup.

### 2026-09-18 — #481 — Reciprocal link from reference-page

Mechanical reciprocity fan-out: this render now also builds reference pages, in the same all-or-nothing pass as the lessons and with the same shared chrome. It links a lesson to the page on the concept that lesson drilled, only when that page is in the same render. A lesson whose page name would take the reserved form reference pages use is now refused by name. The closed markup channel is unchanged: an authored reference file carrying markup fails the render exactly as a lesson does.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
