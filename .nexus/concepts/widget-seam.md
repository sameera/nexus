---
title: "Widget Seam"
aliases: ["widget declaration", "component library", "inert widget", "interactive exercise", "widget manifest", "predict-then-reveal", "lead region", "always-visible region"]
touches: ["lesson-renderer", "offline-page", "cold-drill"]
last_updated_by: "#407"
status: active
verification: verified
---

# Widget Seam

A lesson declares an interactive widget where it belongs in the prose, as a fenced block that stays ordinary markdown. The declaration is inert: it names a component and its data, and the renderer resolves it against one shared library at render time. The library shipped empty and now holds its first component, predict-then-reveal, which shows a question and withholds the answer until the learner asks.

## How It Works

Position matters for a teaching aid, so a declaration held in front matter alone would need a second mechanism to put the widget back where it belongs. Keeping the declaration valid markdown means the lesson still reads in every other surface that already displays markdown. A custom directive syntax was refuted: it is shorter and reads as prose, but it is a non-standard dialect, so every other viewer of the lesson would display it as noise, which undercuts the reason for keeping the authored file plain. Resolution is a lookup in the manifest the runtime declares. Rendering never bundles and never runs the runtime, which keeps the render fast and its failure cheap, at the price that adding a component needs a toolkit release. A name the library does not hold fails the whole render rather than one page, so a page with a hole in it is impossible rather than unlikely. A widget's content is in the page at render time, and interaction only changes what is visible. A component may also declare a lead region, placed before the reveal control and never hidden. The control is a button, and a button is excluded from print, so content carried only by its label would vanish from a printed page nobody touched.

## Key Invariants

1. A widget declaration stays ordinary markdown and names a component and its data.
2. A declaration resolves against one shared library at render time, by lookup rather than by running the runtime.
3. A name the library does not hold fails the whole render, names the missing component, and leaves no output behind.
4. A widget's content exists in the page at render time; interaction only changes what is visible.
5. An untouched widget's content is on the paper when the page is printed.
6. One library is shared by every lesson in every workbook.
7. A component's always-visible content goes in the lead region, never on the reveal control's label.

## Integration Points

- [lesson-renderer](lesson-renderer.md) — the render that resolves a declaration, and that fails whole when it cannot.
- [offline-page](offline-page.md) — the page a widget must work in, with nothing fetched and no module loader.
- [cold-drill](cold-drill.md) — the library's first consumer, whose drill is a predict-then-reveal exercise on the page.

## Decision Log

### 2026-09-07 — #405 — An inert declaration, resolved by lookup, failing the whole render

The declaration is placed in the prose because position matters for a teaching aid, and it stays valid markdown so the lesson keeps reading in every surface that already displays markdown. Resolution is a manifest lookup rather than an execution of the runtime, which keeps the render fast and its failure cheap; the accepted cost is that adding a component needs a toolkit release. Failing the whole render on an unknown component, rather than the one page, is what makes a page with a hole in it impossible. Refuted alternative: bundle at render time, so a workbook builds itself from source wherever it lives. A component could then be added without a release and an adopter could extend the library, but it puts a bundler and its dependency tree into a tool that is currently one self-contained program, and it makes every render a build.

### 2026-09-07 — #407 — One optional lead region, and the library's first component

The library gained predict-then-reveal, the component the opening drill is built from: a learner who commits to an answer before seeing it finds out what they knew rather than recognising an answer they were shown. Commitment is enforced by ordering alone, and the component stores nothing about the learner, because a page opened from a file has nowhere to write and giving it somewhere would create a record about a person outside the one folder the ignore rule protects. The seam gained one optional lead region, always visible and always printed, because the shipped seam could only hide content or label a button and a button is excluded from print. One optional field on the existing component contract is the smallest change that satisfies it, since every existing component and the declaration syntax are untouched. This entry also records the reciprocal link to the cold drill. Refuted alternative: a second widget kind carrying its own always-visible slot. It leaves the component contract unchanged, but it forks the declaration syntax and the render path for what is really one property of the seam, and every future component wanting such a region faces the same fork.
