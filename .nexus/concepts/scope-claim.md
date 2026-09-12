---
title: "Claim of Scope"
aliases: ["mention is not a claim", "repository qualifier", "closing keyword", "implements", "part of", "body reference", "commit trailer", "explicit story reference", "scope grammar"]
touches: ["pr-story-resolution", "aggregated-epic-receipt"]
last_updated_by: "#564"
status: active
verification: verified
---

# Claim of Scope

A number appearing in a pull request is a mention; it counts as work the pull request takes on only when something claims it. Text a person wrote claims scope under one grammar, shared by the pull request body and its commit messages: an optional repository qualifier, which must name the issues repository when present, followed by a word taking the work on. A reference the lead names at invocation is a claim that replaces all of them.

## How It Works

The vocabulary is the platform's closing keywords plus a project set that includes "implements" and "part of". Both text rungs accept the same words from one implementation, so they cannot drift apart again.

A qualifier is compared against the issues repository, never used as the target of a lookup, so text an outside author controls cannot aim a query at an undeclared repository. A qualifier naming another repository disqualifies the reference before the number is ever looked up. A body reference must carry a qualifier, since a bare number in a member's pull request names that member's own issue; a commit trailer may omit one.

The platform's own closing links are same-repository by construction, so they are believed only when the pull request lives in the issues repository. A reference the lead supplies at invocation replaces the whole collection, so nothing else is read and no other reference can stop that run. A same-repository reference that claimed nothing is a near miss, which a refusal names alongside the way through.

## Key Invariants

1. A number is looked up only when its source carried no repository qualifier, or carried one naming the issues repository.
2. A qualifier is only ever compared against the issues repository, never used as the target of a lookup.
3. A reference qualified to another repository reaches neither the story list nor the candidates a refusal reports as considered.
4. A body reference counts only when it states scope under the shared grammar; merely appearing in the body never does.
5. The qualifier rule and the scope vocabulary are implemented once and used by both text rungs.
6. The platform's closing-link rung contributes nothing when the pull request does not live in the issues repository.
7. An explicit reference is the sole source of the story list, and is still validated against the live issue graph.

## Integration Points

- [pr-story-resolution](pr-story-resolution.md) — the ladder that gathers under this grammar, and then validates whatever it gathered against the live issue graph.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — reads a story as analyzed when a trusted receipt names it, which is why a mention must never reach the list a receipt stamps.

## Decision Log

### 2026-09-12 — #564 — Split from pull-request story resolution: a reference must claim the work

Split from pr-story-resolution, which was at its capacity and was describing two things: what a source must say to be read, and how a read candidate becomes a resolved story. The seam holds because each half is loadable alone — a question about why a body reference did not count never needs the validation rules, and a question about why a multi-story pull request resolved to a whole epic never needs the grammar. The rule itself repairs a resolver whose two text rungs had drifted. The commit-trailer rung already skipped a trailer qualified to another repository; the body rung matched the qualifier and then discarded it, so a member pull request citing a sibling in its own repository produced a number looked up against the hub, where it usually means nothing. Worse, merely appearing in a body counted as implementation, so a body citing three sibling stories as background marked all three analyzed and the close gate then passed over code nobody read. Refuted alternative: accept the platform's closing keywords and nothing else, matching the commit-trailer rung exactly. It is the smallest rule and it is provably consistent between the two rungs. It loses because this project's own pull requests introduce a reference with "Implements", which is not a platform keyword, so real pull requests would stop the gate on the day the narrowing shipped.
