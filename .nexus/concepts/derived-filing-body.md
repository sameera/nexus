---
title: "Derived Filing Body"
aliases: ["drafting-time token", "clean body assertion", "label stripping", "placeholder leak", "assertion mode"]
touches: ["scope-razor", "scope-provenance", "epic-approval-gate", "decision-record"]
last_updated_by: "#284"
status: active
verification: verified
---

# Derived Filing Body

A stage never files the draft it wrote. It derives a clean body from the labelled draft, asserts that no drafting-time token survived into it, and files nothing until that assertion passes. Three vocabularies exist only while a draft is being written — the provenance label, the template placeholder, and the marker a gate puts beside an advisory observation — and none of them is a durable reader's to read.

## How It Works

Stripping and the assertion that nothing survived are one tested pair rather than a habit, because remembering to strip the labels is an instruction a model can drop and replacing every placeholder is one a template can only ask for. Only the provenance label is derived away, since removing it leaves a correct sentence behind. A surviving placeholder is a question nobody answered and a surviving observation marker is a verdict the body was never meant to state, so both are reported for a human to resolve rather than deleted. That marker is a named sentinel rather than a bare warning symbol: a filed body may legitimately carry a warning callout of its own, and banning the symbol would ban the body's own content along with the leak. The assertion runs over every body that reaches the tracker, not only the first — a story body transcribed out of an already-asserted epic body is still a copy made by hand, and clean-by-copying is the remembered-not-checked mode this exists to end.

## Key Invariants

1. Nothing is filed from the labelled draft; every filed body is derived from it and asserted first.
2. A surviving drafting-time token of any kind fails the run before any issue is created or updated.
3. Only the provenance label is removed automatically; a surviving placeholder or observation marker is reported for a human instead.
4. The observation marker is one named sentinel, so a warning callout a body legitimately carries is never mistaken for a leak.
5. Every body that reaches the tracker is asserted on its own terms, including one transcribed from a body already asserted.
6. The derived body is rebuilt on every run, so the filed issue number is recorded on the labelled draft and never on the derived copy.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set that names the three drafting-time vocabularies and requires this assertion before filing.
- [scope-provenance](scope-provenance.md) — writes the labels this derivation removes.
- [epic-approval-gate](epic-approval-gate.md) — files the epic and every story body from the derived copy, each asserted before creation.
- [decision-record](decision-record.md) — derives its body after the checkpoint, so what is filed and hashed is what the reviewer approved.

## Decision Log

### 2026-09-04 — #284 — Filing asserts a clean body rather than trusting a stripped one

Labels serve the author, the gate and the digest, and none of those is the reader of a filed issue, so the labelled draft cannot be what is filed. The assertion covers three vocabularies rather than one because a surviving placeholder and a leaked observation marker are the same class of failure as a surviving label — content the body was never meant to carry — and one invocation catches all three at the cost of a tool that already ran. Only the label is deleted automatically, because that is the only one whose removal leaves the sentence correct. The idempotency of a repeated run turns on which file records the issue number: the derived copy is rebuilt each time, so a number recorded only there is lost the moment the run repeats and the next run files a second epic. Refuted alternative: assert on the bare warning symbol instead of a named sentinel, which is simpler and catches strictly more — it lost because it would have rejected bodies carrying a legitimate warning callout of their own.
