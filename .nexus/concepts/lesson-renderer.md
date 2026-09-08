---
title: "Lesson Renderer"
aliases: ["workbook renderer", "lesson page", "closed markup channel", "all-or-nothing render", "provenance banner", "quoted code in a lesson"]
touches: ["workbook-store", "widget-seam", "offline-page", "learner-folder", "reading-surface-tokens", "portable-tooling", "just-in-time-lesson", "generated-page-check"]
last_updated_by: "#407"
status: active
verification: verified
---

# Lesson Renderer

An authored lesson is prose and front matter, and the toolkit turns it into a page. Markup is mechanical and costs several times the tokens the prose it wraps costs, on every lesson anyone writes, so moving it into code pays that cost once and makes the output testable, identical across pages, and unable to drift. The channel through which markup could reach a page is closed rather than discouraged.

## How It Works

A lesson containing markup fails the render, and the failure names the file. The check runs on the authored source before any conversion, so no markup reaches a page through an accident of ordering. A plain code fence's content is exempt, because it is escaped and shown as code: text a reader sees, not a channel markup reaches the page through. A widget declaration's content still counts. A fence closes only on a backtick run at least as long as the opening one, so a lesson can quote a test containing a fence. An authoring format permitting components with markup inline was refuted: it is more expressive, but once an authored file may contain markup, generating markup becomes the cheapest thing an agent can do. Chrome comes from one place every page shares, so two lessons authored months apart cannot differ in anything but their prose. The render is all-or-nothing. Pages are built in memory and written only once every lesson has rendered, and a failed render also clears what an earlier render left behind.

## Key Invariants

1. ~~No authored lesson can put markup into a page; a lesson that tries fails the render, and the failure names the lesson.~~ No authored lesson can put markup into a page outside a plain code fence, whose content is escaped and shown as code; the render fails and names the lesson.
2. Identical inputs render byte-identical output, and page chrome is generated from one source every page shares.
3. A failed render leaves no output behind, not even an earlier render's.
4. Every generated page carries its provenance statement as the first content in the file, so a reviewer meets it before any markup.
5. One stylesheet and one script are written per workbook; every page references them rather than carrying a copy.
6. Renderer behaviour is asserted as a learner perceives a page, never through the internal shape of the emitted markup.

## Integration Points

- [workbook-store](workbook-store.md) — the lessons and the plan it reads, and the folder it writes the pages into.
- [widget-seam](widget-seam.md) — the declaration it resolves at render time, failing the whole render when it cannot.
- [offline-page](offline-page.md) — what a rendered page must be: openable from disk with nothing running.
- [learner-folder](learner-folder.md) — never an input, which is what keeps an empty folder from changing a page.
- [reading-surface-tokens](reading-surface-tokens.md) — the shared definition the one stylesheet it writes embeds.
- [portable-tooling](portable-tooling.md) — the executable it ships on, which carries the built script and stylesheet it writes out.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson written on arrival, whose quoted pinning test the render must show as code.
- [generated-page-check](generated-page-check.md) — split from this page: what answers drift between a committed page and the lesson it came from.

## Decision Log

### 2026-09-07 — #405 — The markup channel is closed, and the render is all-or-nothing

Moving the markup into code is only enforceable when there is no channel through which markup could arrive, so the markdown path has raw pass-through disabled and a lesson carrying markup fails loudly, naming itself. The render was made all-or-nothing in both directions during implementation: a failure now clears the previous render's pages rather than leaving them in place. A surviving page from an earlier render no longer matches the lesson that produced it, and nothing on the page says so, which makes a half-current workbook worse than an empty one. Refuted alternative: leave the previous render in place, which keeps a readable workbook after a failure but makes it silently wrong. The check mode named in the record was shipped rather than dropped, because a generated page in a diff looks authored and nothing on it says which lesson it has fallen behind.

### 2026-09-07 — #407 — Code fences are exempt from the markup refusal, and the drift check splits out

The refusal was absolute, so a lesson could not quote the pinning test the learner is asked to write, and naming only the file left the learner unable to see what is being checked without opening the plan. A code fence's content is escaped and shown as code, so it is text a reader sees rather than a channel through which markup reaches the page, and the exemption tracks exactly what the renderer escapes. A widget declaration's content still counts, because a component turns it into markup. Fence closing now honours the opening run's length, so a lesson can quote a test containing a fence. Fitting the amended refusal took the page over its own-content cap, so the committed-page drift check moved to its own page, taking the paragraph on committed generated output and the invariant on the check mode. The seam is that a task asking why a committed page no longer matches its lesson needs neither the markup rule nor the chrome rules, and a task debugging a failed render needs nothing about the check. This entry also records the reciprocal link to the just-in-time lesson. Refuted alternative: leave the lesson naming only the file and let the learner open the plan. It is cheaper and keeps the markup rule absolute, but it drops the half of the decision that exists so the learner can see what is being checked.
