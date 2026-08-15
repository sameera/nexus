---
title: "Through which channel does an external adopter install, update, and remove the Nexus toolkit?"
type: council
status: open
blocked_by: [ticket-03-script-runtime-shape.md]
claimed_by:
claimed_at:
---

## Question

The audience decision named an adopter who never clones the Nexus repository, and it gave Nexus a
semantic released version identity. Neither of those states how the toolkit actually reaches that
adopter's machine. Decide the channel, and decide the three operations it has to support: the first
install, the update to a newer release, and the complete removal.

The options to weigh include: a package on the public npm registry, installed and updated by an
ordinary package manager command; a GitHub release whose asset is fetched by a small installer
script; or a versioned installer script served from the project itself.

Weigh each against three things. First, what the adopter must already have on the machine before the
first install can run. Second, what an update costs, given that the whole point is that no adopter
re-runs a per-repository command. Third, whether removal can put the machine back to its prior state,
which matters because the audience decision accepted an install step as a prerequisite and therefore
owes the adopter a way out.

### Added by the version-pinning resolution, 2026-08-15

Three requirements and one question were handed to this ticket by the resolution of "Does a repo keep
the ability to pin the Nexus component version it runs?".

1. The channel carries **one** semantic version naming the whole release: the TypeScript executable,
   the Python toolkit, and the component payload together. It never publishes the two toolkits under
   two version identities.
2. The channel must support installing and **holding an explicit older version** on a machine. Per
   repository version staging is out of scope, so per-machine version selection is the only
   regression recourse that remains, and a channel that only ever installs the newest release does
   not provide it.
3. The channel must support a **complete removal**, which is already stated above, and the guard that
   reports two copies of one component on a machine depends on removal actually removing.

The question this ticket must also answer: **does the channel install per machine or per user?** The
answer changes what the duplicate-copy guard compares across, because a shared continuous-integration
image or a multi-tenant machine turns "detect two copies" into "detect two copies across users". It
also changes the precedence rule the coexistence ticket decides. The channel determines the answer,
which is why it is asked here rather than in a ticket of its own.

## Why it blocks

The channel decides a whole goal's worth of stories, and the stories differ by option. A registry
package produces goals about package metadata, publishing, and release automation. A fetched release
asset produces goals about the installer script, its own update path, and checksum verification. The
two sets barely overlap, so they cannot be planned as one.

The channel is also what the version identity attaches to. A release name that no channel serves is
not something an adopter can ask for. The pinning decision can be made without this one, because
whether a repository declares a version is a separate question from where that version is fetched
from. The two answers have to agree before either becomes a stub.

## Evidence

## Resolution
