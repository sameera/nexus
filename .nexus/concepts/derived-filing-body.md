---
title: "Derived Filing Body"
aliases: ["drafting-time token", "clean body assertion", "label stripping", "placeholder leak", "assertion mode", "derive and assert"]
touches: ["scope-razor", "scope-provenance", "epic-approval-gate", "decision-record", "draft-ordering-block", "issue-asset-store"]
last_updated_by: "#594"
status: active
verification: verified
---

# Derived Filing Body

A stage never files the draft it wrote. It derives a clean body from the labelled draft, asserts that no drafting-time token survived into it, and files nothing until that assertion passes. Five things exist only while a draft is being written: the provenance label, the epic's ordering block, the template placeholder, the marker a gate puts beside an advisory observation, and a local asset path. None of them is a durable reader's to read.

## How It Works

Deriving the body and asserting that nothing survived are one command rather than a habit, because remembering to strip a label out of a dozen headings is exactly the clerical pass a model drops one line of. The provenance label and the whole ordering block are derived away. Removing a label leaves a correct sentence behind, and the ordering block has no reader after filing, when the tracker's own dependency edges own the graph. A surviving placeholder is a question nobody answered and a surviving observation marker is a verdict the body was never meant to state, so both are reported for a human to resolve rather than deleted. The assertion runs over every body that reaches the tracker, not only the first — a story body transcribed out of an already-asserted epic body is still a copy made by hand, and clean-by-copying is the remembered-not-checked mode this exists to end.

## Key Invariants

1. Nothing is filed from the labelled draft; every filed body is derived from it and asserted first.
2. A surviving drafting-time token of any kind fails the run before any issue is created or updated.
3. The provenance label and the ordering block are removed automatically and an asset path is replaced by its published reference; a surviving placeholder or observation marker is reported for a human instead.
4. The observation marker and the asset path are matched by name rather than by syntax — one named sentinel, one exact declared path as a whole token — so a body's own callouts and quoted paths are never mistaken for leaks.
5. Every body that reaches the tracker is asserted on its own terms, including one transcribed from a body already asserted.
6. The derived body is rebuilt on every run, so the filed issue number is recorded on the labelled draft and never on the derived copy.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set that names the three drafting-time vocabularies and requires this assertion before filing.
- [scope-provenance](scope-provenance.md) — writes the labels this derivation removes.
- [draft-ordering-block](draft-ordering-block.md) — the other drafting-time vocabulary removed here, whole section and all.
- [epic-approval-gate](epic-approval-gate.md) — files the epic and every story body from the derived copy, each asserted before creation.
- [decision-record](decision-record.md) — derives its body after the checkpoint, so what is filed and hashed is what the reviewer approved.
- [issue-asset-store](issue-asset-store.md) — the fifth drafting-time token: each declared local path is replaced here by the reference that published it, and a survivor fails the run.

## Decision Log

### 2026-09-04 — #284 — Filing asserts a clean body rather than trusting a stripped one

Labels serve the author, the gate and the digest, and none of those is the reader of a filed issue, so the labelled draft cannot be what is filed. The assertion covers three vocabularies rather than one because a surviving placeholder and a leaked observation marker are the same class of failure as a surviving label — content the body was never meant to carry — and one invocation catches all three at the cost of a tool that already ran. Only the label is deleted automatically, because that is the only one whose removal leaves the sentence correct. The idempotency of a repeated run turns on which file records the issue number: the derived copy is rebuilt each time, so a number recorded only there is lost the moment the run repeats and the next run files a second epic. Refuted alternative: assert on the bare warning symbol instead of a named sentinel, which is simpler and catches strictly more — it lost because it would have rejected bodies carrying a legitimate warning callout of their own.

### 2026-09-13 — #576 — The ordering block joins what is derived away, and derivation became one command

A drafted epic now carries a title-keyed block naming what each story waits on, and that block has no reader after the issues exist, because the tracker's own dependency edges are then the authoritative graph. Leaving it in the filed body would ship a second and never-updated statement of that graph on the epic issue, so it is removed whole rather than line by line. Deriving and asserting merged into one command at the same time. They were previously a copy step the stage performed by hand followed by an assertion over the copy, and hand-stripping a label out of a dozen story headings is the clerical pass a model drops one line of. The assertion over a body derived some other way stayed available, because every other drafting stage still files through it.

### 2026-09-13 — #594 — A declared asset path is the fifth drafting-time token

A local file path a run declares as an asset must not reach an issue any more than a provenance label may, so the assertion is given this run's declared paths and fails on a survivor. It matches them exactly and as a whole token rather than by syntax, because a body legitimately quotes repository-relative paths in its own prose — the same reason the observation marker is a named sentinel rather than a bare warning symbol, which is why that reason now sits once in the invariants instead of twice. Dropped from How It Works, as superseded: the sentence restating why the marker is a named sentinel; invariant 4 now carries that reason for both name-matched tokens. Refuted alternative: a syntactic rule failing any link target that is not an absolute address, which would also catch an asset pasted in by hand — it loses because epic bodies legitimately quote repository-relative paths, so the rule would fail bodies for their own content.
