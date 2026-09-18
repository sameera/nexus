---
title: "Offline Page"
aliases: ["opened from disk", "no server", "file-url page", "classic script", "printed lesson", "workbook page assets", "print completeness"]
touches: ["lesson-renderer", "widget-seam", "reading-surface-tokens", "workbook-home-page", "reference-page"]
last_updated_by: "#481"
status: active
verification: verified
---

# Offline Page

A workbook page is opened by double-clicking it. No process is started and no request leaves the machine, so a learner reads a lesson with no network and nothing running. Everything the page needs is a file beside it, reached by a relative path.

## How It Works

A page opened directly from disk cannot load a module script and cannot fetch anything, so the script is loaded as a classic script and no asset is remote. A design relying on either would fail the offline requirement late and obscurely. Requiring nothing to be started also means a learner with no network and no running toolkit can still read a lesson. Serving the workbook from a local process the learner starts was refuted: module scripts, fetching and per-request rendering would all become available, which would ease later interactive components, but the learner must start something before reading, and the published toolkit would gain a server, a larger surface than this needs. Printing drops the navigation chrome, so the paper carries the lesson and nothing else. Printing also renders ink on white whatever the screen theme is, because a dark reading surface printed is unreadable, which would fail the paper requirement outright. A print rule may recolour, drop controls and chrome, and reveal content a control was hiding, and nothing else. A code block scrolls sideways on screen and wraps on paper, because paper cannot scroll. Completeness is checked by applying every rule in force when printing to a rendered page, with no layout engine.

## Key Invariants

1. Every asset a page needs is a local file reached by a relative path.
2. No page makes a network request, loads a remote font, depends on a module loader, or depends on a process being started.
3. A page is read by opening it. Nothing is served and nothing is started.
4. Printing renders ink on white whatever the screen theme is, and drops the navigation chrome.
5. A page's content is complete when it is written, so nothing a learner reads arrives later.
6. No print rule hides an element carrying content, bounds its height, or clips it sideways.
7. The print check proves that no rule in force hides or clips content, and never that a printer placed every line on paper.

## Integration Points

- [lesson-renderer](lesson-renderer.md) — writes the page and the two shared assets it references by relative path.
- [widget-seam](widget-seam.md) — the one interactive element here, whose content is present before any interaction.
- [reading-surface-tokens](reading-surface-tokens.md) — where the page's colours and typography come from, on screen and on paper.
- [workbook-home-page](workbook-home-page.md) — a generated page under these same rules, whose dependency graph is in-page anchors rather than a layout computed on open.
- [reference-page](reference-page.md) — a page printed under these rules, whose completeness on paper is asserted over the rendered page.

## Decision Log

### 2026-09-07 — #405 — A page opened from disk, with everything it needs beside it

A page opened directly from disk can neither load a module script nor fetch anything, so the design commits to that constraint rather than meeting it late: a classic script, relative paths, and no remote asset. Requiring nothing to be started is what lets a learner with no network and no running toolkit read a lesson. Printing is treated as a first-class output rather than a side effect, because a dark reading surface printed is unreadable and the navigation is not worth paper. Refuted alternative: serve the workbook from a local process the learner starts. It makes module scripts, fetching and per-request rendering available, which would ease later interactive components, but the learner must start a process before reading, and the published toolkit would gain a server it does not otherwise need.

### 2026-09-13 — #458 — Reciprocal link from workbook-home-page

Mechanical reciprocity fan-out: the workbook's home page is opened from disk under exactly these rules, and its dependency graph is drawn as list items linking to anchors on the same page rather than as a layout a script computes when the page opens. That choice is this page's rule applied: a generated page's content has to exist at render time and print as it appears.

### 2026-09-18 — #481 — Nothing on paper is hidden or clipped, and the limit of the check is stated

A printed reference page must carry all of its content, and fitting on one sheet must never be reached by cutting content off. The one rule that could clip content on paper was the screen rule letting a code block scroll sideways. On paper a code block now wraps, because making its overflow visible alone would still run a long line off the sheet. The check reads the screen rules and the print rules together, since a check of the print rules alone would have missed that screen rule. It treats controls, live regions and navigation as droppable. The check has no layout engine, so its limit is written into the invariant and into the workbook skill, and nobody reads a passing check as a measured guarantee. The print change alters every rendered page, so a workbook rendered before it shows as changed in the drift check until it is rendered once more. This entry also records the reciprocal link from reference-page. Refuted alternative: print each page in a browser and read the text back. It is the only form that sees real pagination, but the workbook's checks run without a browser, and comparing printed text is slow and tends to fail when the browser changes rather than when a page regresses.
