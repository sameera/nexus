---
title: "Plan Approval Gate"
aliases: ["approval gate", "gate digest", "mark override", "draft fingerprint", "one gate for the whole roadmap", "declining writes nothing"]
touches: ["plan-draft", "coverage-check", "teaching-plan", "plan-field-ownership", "plan-re-approval", "focus-marking"]
last_updated_by: "#458"
status: active
verification: verified
---

# Plan Approval Gate

A plan draft becomes the committed plan at one human checkpoint, and that checkpoint covers the whole roadmap however many epics it spans. Code refuses a draft whose coverage is not clean before the reviewer sees anything, prints the digest the reviewer reads, and refuses to approve a draft that changed after that print. The reviewer approves, changes a slice's mark, or declines, and declining writes nothing.

## How It Works

The digest is printed by code rather than summarised by an agent, so it cannot leave out a slice, a scaffold or a removed concept, and nothing could check a summary that did. One line per slice carries its position, its identity, its mark and its story's title quoted as data. Parts sit under their story and each scaffold sits beside the slice whose assumption forced it. Below the slices come the concepts the learner's declaration removed, each beside the phrase that removed it, the phrases that matched nothing, and whether the focus matched no story. The learner's own words are read here and reach no committed file, which is why the gate is terminal output and not a rendered page.

Approval writes the plan and its pages together or not at all. Printing the digest records a fingerprint of exactly what was printed. Approval refuses when the current draft no longer matches that fingerprint, or when nothing was ever printed, because re-printing the gate inside approval would approve a draft nobody read.

## Key Invariants

1. One gate approves the whole roadmap, and no epic of an initiative is approved on its own.
2. A draft with no coverage verdict, one whose verdict names a gap, or one a fresh check contradicts, is refused with every gap named, and nothing committed is written.
3. The digest is printed by code, and the reviewer is shown it word for word.
4. The digest carries no pinned state, no story body, no lesson prose and no source; a story title appears only as quoted data.
5. The learner's quoted phrases are printed at the gate and written to no committed file.
6. Approval refuses a draft whose fingerprint differs from the one recorded when the gate was printed.
7. Only marks change at the gate; a mark change writes nothing committed, and changing a mark and changing it back gives the same draft.

## Integration Points

- [plan-draft](plan-draft.md) — the uncommitted draft this gate reads, prints and turns into the committed plan on approval.
- [coverage-check](coverage-check.md) — the verdict this gate recomputes rather than trusts, and the gaps a refusal names.
- [teaching-plan](teaching-plan.md) — what approval writes: the committed plan the shipped session teaches from.
- [plan-field-ownership](plan-field-ownership.md) — which fields approval itself fills, and which it leaves for the reviewer and the session.
- [plan-re-approval](plan-re-approval.md) — the second and later passes through this same gate, after a story has drifted.
- [focus-marking](focus-marking.md) — the mark a reviewer overrides here, recorded per story and surviving later re-plans.

## Decision Log

### 2026-09-13 — #458 — The gate is a digest printed by code, and the coverage refusal recomputes rather than trusts

The draft is a file an agent can write, so a recorded clean verdict is the cheapest way around the gate: the refusal recomputes coverage over the draft's slices and refuses a recorded verdict the fresh check contradicts, in the step that prints the gate and again in the step that writes the approval. The digest is printed by code because an agent's summary can drop a slice and nothing can check that it did not. Showing story titles breaks the earlier rule that a planning session holds no story text; a sequence of bare issue numbers cannot be reviewed, so titles are printed one line each and quoted as data while bodies stay out. Approval is bound to what was printed by a fingerprint of the printed text, because the alternative — re-printing the gate inside approval and approving whatever it shows — approves a draft nobody read. Refuted alternative: render the gate as a workbook page, which reads better for a long roadmap and could draw the graph. It lost because workbook pages are committed and the gate carries the learner's own words, and a page outside the store would be a second rendered output with a different lifetime. Refuted alternative: let the agent summarise the draft in its own prose, which lets it stress what matters for this plan — refuted for the same reason the code print exists.
