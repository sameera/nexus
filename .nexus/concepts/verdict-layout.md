---
title: "Pull-Request Verdict Layout"
aliases: ["verdict layout", "verdict headline", "blocked headline", "clear to merge", "verdict sections", "collapsed detail", "verdict body"]
touches: ["conformance-gate", "pr-verdict-answers"]
last_updated_by: "#923"
status: active
verification: verified
---

# Pull-Request Verdict Layout

The published verdict on a pull request has one fixed layout. The toolkit writes the whole body from one set of judgments, so the model writes no verdict text and the visible text cannot disagree with the machine blocks.

## How It Works

The first line says whether the pull request is blocked or clear to merge, followed by the open count per severity. Blocked means at least one open critical or high item exists.

Items appear in four sections, in this order: needs action, worth a look, already answered, and no longer found. Each open item shows its ID, severity and subject, then what is wrong, a link to its location, and how to resolve it. The stories table shows counts only. Evidence per criterion and the run's details sit in sections that stay collapsed. An empty section is left out.

The verdict ends with two machine blocks, the receipt and then the judgments block. An open item judged in this run that lacks a required field stops publishing, and the refusal names the item and the missing field.

## Key Invariants

1. The headline says blocked exactly when an open critical or high item exists, and the review requests changes on that same condition.
2. The same judgments give byte-identical visible text on every run.
3. An item carried unchanged from a verdict published before this layout shows only the fields it had, and no placeholder stands in for the rest.
4. Text from the diff or from an answer cannot end a collapsed section, add a heading, change the headline, or repeat a verdict marker.
5. The receipt marker is still directly followed by its fence, with the judgments block after it, so earlier releases of `nexus close` read the verdict with the same result.
6. A run without a pull request keeps its terminal report and result line. Only the published body uses this layout.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate that publishes this layout, and whose blocked state the headline states.
- [pr-verdict-answers](pr-verdict-answers.md) — supplies the items, IDs and answer lines that each section shows.

## Decision Log

### 2026-10-18 — #923 — Split from conformance-gate: the toolkit writes the verdict body

The rule for how a published verdict is laid out grew past the gate page's cap, so it moved here. The model no longer writes the verdict's visible text. The toolkit renders the whole body from one set of judgments and the run's facts, so the same judgments give the same bytes on every run. The headline and the review event follow one rule, because the merge pre-check and close already block on open critical or high items. Before, the model worded the layout from a prose template and only the machine blocks were checked, so the layout drifted between runs. Refuted alternative: keep the layout on the gate page and drop still-true content to make room, which would lose content the gate still states.
