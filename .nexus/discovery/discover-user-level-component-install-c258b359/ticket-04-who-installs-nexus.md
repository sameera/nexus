---
title: "Which pain must this refactor remove, and who installs Nexus into a repo?"
type: interview
status: resolved
blocked_by: none
claimed_by: sameera
claimed_at: 2026-08-15T12:55:09Z
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

### From `nxs-pm`, 2026-08-15

The agent measured the current state across the six repositories on this machine that carry Nexus
components, and reported the following.

**Staleness is real and severe.** All six repositories run a different component set. There are five
distinct hashes of `nxs.epic.md`. Four repositories still ship commands the pipeline has retired:
`nxs.tasks`, `nxs.hld`, `nxs.init`, `nxs.dev`, `nxs.qa`, and `nxs.yolo.dev`. The deploy step prunes
stale files whose names begin with `nxs`, so a re-run would have converged them. No consumer
repository has had one since a window running from February to July.

**Staleness is structural rather than neglect.** Ninety-seven of the two hundred and eighty-two
commits to the source repository in six months touch `.claude/`. The component set changes roughly
every third commit, so any per-repository mirror goes stale by construction.

**Commit churn is real but uneven.** The share of commits that touch `.claude` and carry no project
content ranges from five per cent in one repository to thirty-seven per cent in another. The commit
messages are variations of "update nexus".

**Onboarding is already cheap for the first install.** The deploy command is a single invocation of
a bare `node` binary with no install step and no build step. The cost falls on the repeated refresh,
not on the first install.

**Adoption today is single-maintainer.** Every consumer repository is authored almost entirely by
one person. The team-shares-a-repository hazard that the version-pinning ticket weighs is currently
hypothetical.

**There is no version identity to pin to.** The package manifest is private and has never been
bumped. No version string appears anywhere in the component payload. The only identity is a content
hash recorded in the bundle fingerprint file. Version pinning would therefore be a property this
refactor creates, not a property it preserves.

**The continuous-integration portability argument is currently unused.** No workflow in any of the
repositories invokes the Nexus components.

## Resolution

- **Decided:** Nexus is built for external adopters who never clone the Nexus repository, and the
  refactor must remove all three pains at once: staleness, commit churn, and onboarding cost. An
  install step is an acceptable prerequisite in any environment, including continuous integration
  and containers, so Nexus carries no second copy of the components for portability. Nexus acquires
  a semantic released version identity, with releases, tags, and a changelog, which gives an adopter
  a name to install and a version to pin.
- **Why:** The three pains cannot be traded against each other, because a fix for any one of them
  alone leaves the others in place. Removing commit churn means the components leave the repository.
  Removing staleness means something other than a manual per-repository command keeps them fresh.
  Removing onboarding cost means an adopter runs one step. Targeting external adopters is what
  forces all three: a person who never clones the Nexus repository has no source checkout to deploy
  from, so the toolkit must arrive by name and by version. That same target makes a released version
  identity mandatory rather than optional, because there is nothing today for an adopter to ask for.
  Accepting an install step as a prerequisite is what pays for this. It lets the components leave
  every repository completely, with no fallback copy, no precedence rule between two component sets,
  and no diagnostic explaining which set is active.
- **Refuted alternative:** Target the single maintainer that the evidence actually shows, keep one
  component version per machine, and drop version pinning entirely. That option is the cheapest
  build. It loses because it forecloses the adopter, and every property it saves would have to be
  re-added later. A machine-wide version with no declared identity re-creates staleness in a new
  place, because a repository would still have no way to say which component set it expects. A
  second refuted alternative is keeping a committed copy of the components as a portable fallback
  for environments with no install. It loses because it re-introduces both the commit churn and the
  staleness this refactor exists to remove, and it buys portability that no workflow currently uses.
- **Resolved by:** sameera on 2026-08-15
