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
