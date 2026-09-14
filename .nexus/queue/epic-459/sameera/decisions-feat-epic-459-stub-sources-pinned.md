## 2026-09-13 — Sources live on the committed plan slice, pinned by their own verb
- **Choice:** An optional `sources` field on each committed plan slice, filled by `nexus workbook pin`, absent until pinned.
- **Why:** The plan is the one committed file a session teaches from, and field ownership forbids a placeholder, so an owner-less field stays absent until its owner acts.
- **Refuted alternative:** A separate sources file beside the plan — a second committed document describing one plan that can disagree with it unnoticed.

## 2026-09-13 — The close stage runs the pinning step
- **Choice:** `/nxs.close` Phase 6.5 pins sources for any workbook teaching the epic.
- **Why:** Close is the lead-run stage that already holds the approved record and the merged diff, and the exemplar must name code that exists.
- **Refuted alternative:** Pin at `/nxs.decision-record` — the record is not approved and the story is not implemented yet, so there is no exemplar to name.

## 2026-09-13 — Record approval is read live, its number from the materialized epic
- **Choice:** The verb takes the record number from `.nexus/tmp/epic-<n>/epic.md` and reads its closed state and body with `gh issue view`.
- **Why:** The resolver is the single reconstruction every stage shares; a live read counts a record approved after the resolve.
- **Refuted alternative:** Call the resolver inside the verb — duplicates a run the stage already made and multiplies the issue-graph reads.

## 2026-09-13 — An epic's learner slices are pinned together, and pinned sources survive re-approval
- **Choice:** Refuse a sources file that misses any unpinned learner slice of the epic; carry a slice's sources forward on re-approval while it stays a learner slice.
- **Why:** A bare slice would be taught from the search pinning replaces, and nothing a re-plan reads changes the record the sources came from.
- **Refuted alternative:** Pin whatever is given and leave the rest bare — silent partial pinning nobody notices until a lesson is written.

## 2026-09-13 — A refuted alternative is required exactly when the named section states one
- **Choice:** Scope the record to the named heading's section; its `**Refuted alternative:**` lines decide whether `refuted` must be present, and the named alternative must appear in one of them.
- **Why:** The record template puts each decision's refuted alternatives under that decision's heading, so the section is where "the record states one for that invariant" can be checked mechanically.
- **Refuted alternative:** Trust the authored file and only refuse empty strings — cheaper, but a remembered alternative the record never stated would pin as if grounded.
