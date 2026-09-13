---
title: "Citation Check"
aliases: ["citation check", "source text materialization", "normalized containment", "four-word floor", "quoted fragment", "source.md"]
touches: ["scope-provenance", "scope-razor", "razor-enforcement", "epic-approval-gate"]
last_updated_by: "#576"
status: active
verification: verified
---

# Citation Check

An `asked` label carries a fragment quoted from what the lead actually said, and the check compares that fragment against one materialized copy of the lead's own words. The comparison is normalized containment, never a fuzzy or semantic match, so the verdict is reproducible run to run.

## How It Works

Before anything is labelled, the run writes the text it was given verbatim into one file in session scratch. That text is the capability description the lead typed, the stub issue's body, or the discovery document with its resolved tickets. Every citation in that run is compared against that copy alone.

Three things make it a copy rather than a re-read. The gate is a separate reviewer handed only a draft. Typed intent has no durable home to fetch again. A stub edited between drafting and the gate would otherwise be checked against a source the draft was never written from.

The comparison collapses whitespace, folds case, and maps typographic quotes and dashes to plain forms. A fragment shorter than four words fails as though it were absent. The slack is deliberate, since blocking on a curly apostrophe teaches the lead to reword until the gate relents. The word floor is its counterweight, since one common word would otherwise satisfy every item.

What the check proves is that the quote exists. Whether the quote licenses the item it is attached to is the reviewer's to judge, and this is why the planning gate renders each story's asked fragment verbatim beside the story it justifies.

## Key Invariants

1. The run's source text is written out once, before any item is labelled, and every citation is compared against that copy alone.
2. The comparison is normalized containment, never a fuzzy or semantic match, so the verdict is reproducible run to run.
3. A quoted fragment shorter than four words fails as if it were absent.
4. The source text is session scratch and may hold anything the lead typed, including a pasted credential, so no part of it is ever posted to an issue, a comment or a report.
5. The check proves the quote exists; whether it licenses the item it is attached to is the reviewer's to judge.

## Integration Points

- [scope-provenance](scope-provenance.md) — the vocabulary whose `asked` value this check is the evidence for.
- [scope-razor](scope-razor.md) — the rule set that requires the citation and supplies the word floor.
- [razor-enforcement](razor-enforcement.md) — this comparison is one of the mechanically decidable checks the shared checker owns.
- [epic-approval-gate](epic-approval-gate.md) — renders each story's fragment verbatim, which is where a quote that does not license its item is caught.

## Decision Log

### 2026-09-13 — #576 — Split from scope provenance: the evidence rule is its own concept

Split from scope-provenance, which was at its own-content capacity when the provenance vocabulary extended to the story heading. The seam holds because each half is loadable alone. A question about which draft items carry a label, and what the two values mean, never needs the normalization rules or the word floor. A question about why a quoted fragment failed never needs the list of what carries a label. This epic forced the seam and also raised the stakes on this half: a story's label now decides whether that story is filed by default, so a fragment that exists without licensing its story is worth more to the drafting model than it was. The answer stayed a verbatim render beside the story rather than a smarter comparison. The parent's Decision Log stays whole and is not copied here.
