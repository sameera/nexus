---
title: "Widget Seam"
aliases: ["widget declaration", "component library", "inert widget", "interactive exercise", "widget manifest"]
touches: ["lesson-renderer", "offline-page"]
last_updated_by: "#405"
status: active
verification: verified
---

# Widget Seam

A lesson declares an interactive widget where it belongs in the prose, as a fenced block that stays ordinary markdown. The declaration is inert: it names a component and its data, and the renderer resolves it against one shared library at render time. The library ships empty, because the seam is what this builds and the first component arrives with the stage that needs it.

## How It Works

Position matters for a teaching aid, so a declaration held in front matter alone would need a second mechanism to put the widget back where it belongs. Keeping the declaration valid markdown means the lesson still reads in every other surface that already displays markdown. A custom directive syntax was refuted: it is shorter and reads as prose, but it is a non-standard dialect, so every other viewer of the lesson would display it as noise, which undercuts the reason for keeping the authored file plain. Resolution is a lookup in the manifest the runtime declares. Rendering never bundles and never runs the runtime, which keeps the render fast and its failure cheap, at the price that adding a component needs a toolkit release. A name the library does not hold fails the whole render rather than one page, so a page with a hole in it is impossible rather than unlikely. A widget's content is in the page at render time, and interaction only changes what is visible.

## Key Invariants

1. A widget declaration stays ordinary markdown and names a component and its data.
2. A declaration resolves against one shared library at render time, by lookup rather than by running the runtime.
3. A name the library does not hold fails the whole render, names the missing component, and leaves no output behind.
4. A widget's content exists in the page at render time; interaction only changes what is visible.
5. An untouched widget's content is on the paper when the page is printed.
6. One library is shared by every lesson in every workbook.

## Integration Points

- [lesson-renderer](lesson-renderer.md) — the render that resolves a declaration, and that fails whole when it cannot.
- [offline-page](offline-page.md) — the page a widget must work in, with nothing fetched and no module loader.

## Decision Log

### 2026-09-07 — #405 — An inert declaration, resolved by lookup, failing the whole render

The declaration is placed in the prose because position matters for a teaching aid, and it stays valid markdown so the lesson keeps reading in every surface that already displays markdown. Resolution is a manifest lookup rather than an execution of the runtime, which keeps the render fast and its failure cheap; the accepted cost is that adding a component needs a toolkit release. Failing the whole render on an unknown component, rather than the one page, is what makes a page with a hole in it impossible. Refuted alternative: bundle at render time, so a workbook builds itself from source wherever it lives. A component could then be added without a release and an adopter could extend the library, but it puts a bundler and its dependency tree into a tool that is currently one self-contained program, and it makes every render a build.
