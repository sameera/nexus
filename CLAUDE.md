# Nexus

## Project Overview

**Nexus** is a lean, spec-driven delivery pipeline for the age of AI agents. It assists Product and Project management — turning intent into validated, decision-grade specs — and leaves implementation to engineers.

**Core Philosophy:** Generation is cheap. Judgment is not. Nexus's failure mode to guard against is speculative over-generation: heavy artifacts (sprawling HLDs, per-task plans, prose reports) produced ahead of validated scope, burying the human decisions that matter. The rule: every artifact must force a human decision, or it gets cut.

**Pipeline:** `setup → epic → hld → analyze → close`. The user story, not the technical task, is the terminal planning unit and the GitHub-issue granularity — Nexus stops decomposing once a story is small enough to ship and verify on its own. Implementation itself stays the engineer's job — Nexus plans and gates the work, it does not write the code.

## Working with Claude

### Response style

Write for a technical user who wants clarity, not flair.
Use short, plain sentences.
Keep explanations concise.
Break complex ideas into steps.
Avoid unnecessary adjectives, metaphors, and filler.
Use common words instead of fancy words when both mean the same thing.
