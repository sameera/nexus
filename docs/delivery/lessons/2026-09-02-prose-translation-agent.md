---
date: 2026-09-02
epic: "Prose translation agent with a resident density convention"
source: "#414"
---

# Lesson: a fail-closed gate is designed against the thing it gates, or it is designed twice

The epic was estimated at M over six stories, four of them component-body edits. It shipped seven stories and about 2500 added lines, and the extra story was not scope that arrived late — it was a property the plan had assumed the translator would deliver by instruction. Recognising that the guarantee had to be mechanical produced story #423, the largest single piece of build work in the epic, at the decision record's clarification gate rather than at planning.

## What the estimate missed

The plan said "restore six form rules in an agent, and check that machine-read regions do not move". Both halves were sized correctly. What was not sized is that a stochastic writer with write access to a file needs its output bounded over everything it may touch, not only over the blocks the pipeline parses. Once that was seen, a second comparison, four token classes, their exclusions, and a bounded retranslation all followed. The signal that would have caught it at planning: the epic's own success metrics already said "proven by a check that fails closed rather than by inspection" for regions, and said nothing equivalent for prose. A metric asking a human to read something, sitting beside a metric that refuses to, is where the next epic in this area should look first.

## The pattern worth reusing

Record #421 carries a decision named "the form rules and the tracked classes are designed against each other", with the rule amended rather than the class exempted where they conflict. That decision is what kept the gate usable. Two amendments to the form rules fell out of it before any code was written, and three more false-failure classes were found and closed during implementation — spelled-out numbers, the zero-and-one asymmetry, and a negated modal separated from its adverb. Each was a deterministic failure, and a deterministic failure in a fail-closed gate is not a bug to fix later: no retry clears it, so the gate gets switched off. The implementation cost of hunting them was real and was not in the estimate.

For the next epic that ships an automated gate over a generative step: budget explicitly for the false-failure hunt, and expect it to be a comparable share of the work to building the check itself. The first real run of the translator produced one of the three. Plan for at least one round of that, on live output, before the gate is wired to fail a run.

## Decomposition

Splitting rules by who can execute them — six form rules to a cheap model that holds only the text, two content rules resident with the author who holds the analysis — was the epic's central idea and it held all the way through. That split was made at the epic and never revisited, which is the right shape: the decomposition question was answered once, and every later question was about how to bound the cheap half. Staging the wiring so the approval-gated commands adopted the translator first, and the surfaces nobody reads before merge adopted it last, also held with no rework.
