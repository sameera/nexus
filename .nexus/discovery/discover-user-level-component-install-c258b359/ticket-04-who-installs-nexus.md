---
title: "Which pain must this refactor remove, and who installs Nexus into a repo?"
type: interview
status: open
blocked_by: none
claimed_by:
claimed_at:
---

## Question

Two things only the product owner knows.

First, which pain the current arrangement causes. The candidates are: repos accumulate commits that
are only component updates; repos silently run a stale component set because nobody re-ran
`nexus deploy`; a new repo is slow to onboard; or something else entirely. The answer decides what
"solved" means, because a refactor that removes commit churn is not the same refactor as one that
removes staleness.

Second, who installs Nexus and how many repos one person runs it against. A single maintainer with
several repos on one machine is a different target from a team where each member installs
separately, and both are different from an external adopter who never sees this repository.

## Why it blocks

The version-pinning trade-off cannot be weighed without knowing the adopters. A shared install
gives every repo on a machine the same component version. That is a benefit when one person keeps
several repos in step, and a hazard when several people share a repo and expect it to behave the
same for each of them.

## Evidence

## Resolution
