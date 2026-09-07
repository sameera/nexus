---
title: "Offline Page"
aliases: ["opened from disk", "no server", "file-url page", "classic script", "printed lesson", "workbook page assets"]
touches: ["lesson-renderer", "widget-seam", "reading-surface-tokens"]
last_updated_by: "#405"
status: active
verification: verified
---

# Offline Page

A workbook page is opened by double-clicking it. No process is started and no request leaves the machine, so a learner reads a lesson with no network and nothing running. Everything the page needs is a file beside it, reached by a relative path.

## How It Works

A page opened directly from disk cannot load a module script and cannot fetch anything, so the script is loaded as a classic script and no asset is remote. A design relying on either would fail the offline requirement late and obscurely. Requiring nothing to be started also means a learner with no network and no running toolkit can still read a lesson. Serving the workbook from a local process the learner starts was refuted: module scripts, fetching and per-request rendering would all become available, which would ease later interactive components, but the learner must start something before reading, and the published toolkit would gain a server, a larger surface than this needs. Printing drops the navigation chrome, so the paper carries the lesson and nothing else. Printing also renders ink on white whatever the screen theme is, because a dark reading surface printed is unreadable, which would fail the paper requirement outright.

## Key Invariants

1. Every asset a page needs is a local file reached by a relative path.
2. No page makes a network request, loads a remote font, depends on a module loader, or depends on a process being started.
3. A page is read by opening it. Nothing is served and nothing is started.
4. Printing renders ink on white whatever the screen theme is, and drops the navigation chrome.
5. A page's content is complete when it is written, so nothing a learner reads arrives later.

## Integration Points

- [lesson-renderer](lesson-renderer.md) — writes the page and the two shared assets it references by relative path.
- [widget-seam](widget-seam.md) — the one interactive element here, whose content is present before any interaction.
- [reading-surface-tokens](reading-surface-tokens.md) — where the page's colours and typography come from, on screen and on paper.

## Decision Log

### 2026-09-07 — #405 — A page opened from disk, with everything it needs beside it

A page opened directly from disk can neither load a module script nor fetch anything, so the design commits to that constraint rather than meeting it late: a classic script, relative paths, and no remote asset. Requiring nothing to be started is what lets a learner with no network and no running toolkit read a lesson. Printing is treated as a first-class output rather than a side effect, because a dark reading surface printed is unreadable and the navigation is not worth paper. Refuted alternative: serve the workbook from a local process the learner starts. It makes module scripts, fetching and per-request rendering available, which would ease later interactive components, but the learner must start a process before reading, and the published toolkit would gain a server it does not otherwise need.
