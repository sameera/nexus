---
title: "Workbook Store"
aliases: ["workbook", "workbook folder", "lessons folder", "teaching plan", "workbook placement"]
touches: ["pipeline-store-exclusion", "learner-folder", "lesson-renderer", "workspace-resolution", "teaching-plan", "workbook-home-page", "reference-page"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Workbook Store

Workbook Store is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [pipeline-store-exclusion](pipeline-store-exclusion.md) — the set this store joined, which keeps every workbook file out of a stage's diff.
- [learner-folder](learner-folder.md) — the one folder inside this store holding everything the workbook retains about a person.
- [lesson-renderer](lesson-renderer.md) — reads the lessons and the plan this store lays out, and writes the pages back into it.
- [workspace-resolution](workspace-resolution.md) — the one resolver that says which member checkout a workbook belongs in.
- [teaching-plan](teaching-plan.md) — the plan of slices this store holds, which makes an unwritten lesson a stub rather than a mismatch.
- [workbook-home-page](workbook-home-page.md) — the page written at the workbook's root beside the lesson pages, from the plan this store holds.
- [reference-page](reference-page.md) — the authored prose of reference pages, one file per concept, in its own folder beside the lessons and never named in the plan.

## Decision Log

### 2026-09-07 — #405 — The workbook joins the existing family of pipeline stores

The store is committed and sits beside the queue and the discovery store, under the hidden root those two already occupy, so the exclusion is one coherent family rather than three unrelated special cases. The member placement follows from what a workbook is. The queue lives in the hub because the distiller reads it, but a workbook is a reading surface for one repository's roadmap, so it belongs with that roadmap. Refuted alternative: a visible folder at the top of the repository, which a learner browsing in a file manager would find, since a hidden directory is invisible by default in most file browsers. It loses because it puts a Nexus-managed store outside the one root every other Nexus store lives in, and it splits the exclusion family into two shapes. The discoverability cost is bounded, because a learner reaches a page from a session or a link rather than by browsing.

### 2026-09-07 — #407 — A plan of slices makes an unwritten lesson a stub, not a mismatch

The refusal that fired when the plan named a lesson the folder did not hold assumed every lesson exists before anyone reads them. Under a plan of slices a lesson is written when the learner arrives at it, so an absent lesson is the normal state and the old refusal would block every workbook that teaches. The refusal therefore narrows to plans that list lessons, while the other half stands for both kinds: a lesson the plan does not name still has no place in the workbook. This entry also records the reciprocal link to the teaching plan, which the store now reads and hands to a session. Refuted alternative: keep the refusal absolute and have the planning stage write an empty lesson for every slice up front. It keeps one rule for both kinds of plan, but the workbook would then ship stub pages the navigation links to, which is the dead end the stub marking exists to avoid.

### 2026-09-13 — #458 — Reciprocal link from workbook-home-page

Mechanical reciprocity fan-out: the home page is written at a workbook's root beside the lesson pages, from the plan this store holds. The store's own rules are unchanged by it. Approval writes the plan and the pages together or not at all — the plan is staged beside its target and the previous pages are held while the new ones are written, so a failed render leaves both exactly as they were — which is the same all-or-nothing guarantee the render already gave, now spanning the plan as well.

### 2026-09-18 — #481 — Reciprocal link from reference-page

Mechanical reciprocity fan-out: a workbook now holds a folder of authored reference pages beside the lessons folder. The plan names none of them, because a reference page is not a step in the teaching order, so the agreement between the plan and the lessons is unchanged. A workbook with no such folder has earned no page yet.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
