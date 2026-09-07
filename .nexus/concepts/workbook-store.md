---
title: "Workbook Store"
aliases: ["workbook", "workbook folder", "lessons folder", "teaching plan", "workbook placement"]
touches: ["pipeline-store-exclusion", "learner-folder", "lesson-renderer", "workspace-resolution"]
last_updated_by: "#405"
status: active
verification: verified
---

# Workbook Store

A workbook is a committed folder a learner opens, holding the authored lessons and the pages rendered from them. It sits beside the queue and the discovery store under the same hidden root, so all three share one location convention and one exclusion family. A repository may hold one workbook per roadmap, and in a workspace with a hub and members a workbook belongs to the member repository whose roadmap it teaches.

## How It Works

The store is created on first use and holds one folder per workbook. Inside a workbook the authored lessons sit in their own folder, and the pages render beside them at the workbook's root. An optional plan names the lessons in teaching order. Without a plan the order is the lessons' file names, which is deterministic but says nothing about teaching. A plan and a lessons folder that disagree fail the render in either direction: a plan naming a lesson that is absent, and a lesson the plan does not name. Ordering by a file-name prefix alone was refuted, because renaming a lesson to move it would change its page's address. Placement is enforced in code rather than documented. Creating a workbook refuses a hub checkout and names the members it could have meant, and it resolves the member from the checkout it ran in, or from an explicit name when run from the hub. Creating a workbook also ensures the ignore rule that covers the learner folder, because the store is created on first use while ignore rules are seeded at setup.

## Key Invariants

1. The workbook store is committed and sits outside the queue.
2. No workbook path appears in any diff a Nexus stage derives.
3. A workbook lives in the member repository whose roadmap it teaches; creating one in a hub checkout is refused, and the refusal names the members it could have meant.
4. The store holds many workbooks, because a repository may teach more than one roadmap.
5. A plan and the lessons folder must name the same lessons, or the workbook does not render.
6. Without a plan the teaching order is the lessons' file names.
7. Creating a workbook ensures the ignore rule covering the learner folder rather than assuming setup did.

## Integration Points

- [pipeline-store-exclusion](pipeline-store-exclusion.md) — the set this store joined, which keeps every workbook file out of a stage's diff.
- [learner-folder](learner-folder.md) — the one folder inside this store holding everything the workbook retains about a person.
- [lesson-renderer](lesson-renderer.md) — reads the lessons and the plan this store lays out, and writes the pages back into it.
- [workspace-resolution](workspace-resolution.md) — the one resolver that says which member checkout a workbook belongs in.

## Decision Log

### 2026-09-07 — #405 — The workbook joins the existing family of pipeline stores

The store is committed and sits beside the queue and the discovery store, under the hidden root those two already occupy, so the exclusion is one coherent family rather than three unrelated special cases. The member placement follows from what a workbook is. The queue lives in the hub because the distiller reads it, but a workbook is a reading surface for one repository's roadmap, so it belongs with that roadmap. Refuted alternative: a visible folder at the top of the repository, which a learner browsing in a file manager would find, since a hidden directory is invisible by default in most file browsers. It loses because it puts a Nexus-managed store outside the one root every other Nexus store lives in, and it splits the exclusion family into two shapes. The discoverability cost is bounded, because a learner reaches a page from a session or a link rather than by browsing.
