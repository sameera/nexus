---
title: "Lesson Renderer"
aliases: ["workbook renderer", "lesson page", "closed markup channel", "all-or-nothing render", "generated page check", "provenance banner"]
touches: ["workbook-store", "widget-seam", "offline-page", "learner-folder", "reading-surface-tokens", "portable-tooling"]
last_updated_by: "#405"
status: active
verification: verified
---

# Lesson Renderer

An authored lesson is prose and front matter, and the toolkit turns it into a page. Markup is mechanical and costs several times the tokens the prose it wraps costs, on every lesson anyone writes, so moving it into code pays that cost once and makes the output testable, identical across pages, and unable to drift. The channel through which markup could reach a page is closed rather than discouraged.

## How It Works

A lesson containing markup fails the render, and the failure names the file. The check runs on the authored source before any conversion, so no markup reaches a page through an accident of ordering. An authoring format permitting components with markup inline was refuted: it is more expressive, but once an authored file may contain markup, generating markup becomes the cheapest thing an agent can do. Chrome comes from one place every page shares, so two lessons authored months apart cannot differ in anything but their prose. The render is all-or-nothing. Pages are built in memory and written only once every lesson has rendered, and a failed render also clears what an earlier render left behind. Pages are committed, so a reviewer meets the change that produced them. Committed generated output has one failure mode, drift from its source, and a check mode answers it: it re-renders, compares bytes, and reports what changed, what is missing and what is extra. It repairs nothing, so re-rendering stays the author's to run.

## Key Invariants

1. No authored lesson can put markup into a page; a lesson that tries fails the render, and the failure names the lesson.
2. Identical inputs render byte-identical output, and page chrome is generated from one source every page shares.
3. A failed render leaves no output behind, not even an earlier render's.
4. Every generated page carries its provenance statement as the first content in the file, so a reviewer meets it before any markup.
5. A check mode re-renders and reports drift between a committed page and its lesson, and repairs nothing.
6. One stylesheet and one script are written per workbook; every page references them rather than carrying a copy.
7. Renderer behaviour is asserted as a learner perceives a page, never through the internal shape of the emitted markup.

## Integration Points

- [workbook-store](workbook-store.md) — the lessons and the plan it reads, and the folder it writes the pages into.
- [widget-seam](widget-seam.md) — the declaration it resolves at render time, failing the whole render when it cannot.
- [offline-page](offline-page.md) — what a rendered page must be: openable from disk with nothing running.
- [learner-folder](learner-folder.md) — never an input, which is what keeps an empty folder from changing a page.
- [reading-surface-tokens](reading-surface-tokens.md) — the shared definition the one stylesheet it writes embeds.
- [portable-tooling](portable-tooling.md) — the executable it ships on, which carries the built script and stylesheet it writes out.

## Decision Log

### 2026-09-07 — #405 — The markup channel is closed, and the render is all-or-nothing

Moving the markup into code is only enforceable when there is no channel through which markup could arrive, so the markdown path has raw pass-through disabled and a lesson carrying markup fails loudly, naming itself. The render was made all-or-nothing in both directions during implementation: a failure now clears the previous render's pages rather than leaving them in place. A surviving page from an earlier render no longer matches the lesson that produced it, and nothing on the page says so, which makes a half-current workbook worse than an empty one. Refuted alternative: leave the previous render in place, which keeps a readable workbook after a failure but makes it silently wrong. The check mode named in the record was shipped rather than dropped, because a generated page in a diff looks authored and nothing on it says which lesson it has fallen behind.
