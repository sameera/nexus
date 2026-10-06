---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "Close the two low gaps analyze 0.91.0 left in its answer and registry reads"
slug: close-analyze-answer-registry-gaps
created: 2026-10-06
type: enhancement
complexity: S
complexity_drivers: [two independent single-file fixes, no cross-story integration]
concepts: []
link: "#875"
---

# Epic: Close the two low gaps analyze 0.91.0 left in its answer and registry reads

## Description

The verdict on sameera/nexus#874 left two low findings open. Each one lets a safeguard of the pull-request flow fail quietly.

The first is in the unattended implement run. After each fix round, the run checks whether the round posted an answer on the pull request, because an unattended run must never accept, waive or approve anything. The check compares which comments hold answer lines before and after the round. If the round adds an answer by editing a comment that already held one, the set of comments is unchanged, so the run does not stop. An answer the lead never wrote then counts as the lead's own.

The second is in analyze's ID registry read. Every other verdict and answer read names the pull request's repository explicitly. The registry read does not, so it asks the checkout's default repository instead. In a checkout whose default repository is not the pull request's, the registry reads as empty and numbering restarts at DV1 and F1. A re-run then gives an existing departure or finding a new ID, and an answer written against the old ID no longer matches it.

## Success Metrics

- An unattended fix round that adds an answer line to the pull request by any means, a new comment or an edit, stops the run before the next push.
- A re-run of analyze on a pull request reuses the IDs of its newest verdict, whatever the checkout's default repository is.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The implement run stops on an answer edited into an existing comment; The ID registry read finds the pull request's verdict in any checkout

## User Stories

### Story #884: The implement run stops on an answer edited into an existing comment

- **story_type:** system
- **size:** S

**As a** lead running the unattended implement run, **I want** the run to stop whenever a fix round adds an answer line to the pull request, **so that** no accept, waive or approve answer can reach the pull request under my account without my review.

#### Acceptance Criteria

- [ ] **Given** a fix round that edits a comment already holding an answer line so that the comment holds an additional or changed answer line, **when** the round ends, **then** the run exits non-zero before pushing and names that comment.
- [ ] **Given** a fix round that posts a new comment holding an answer line, **when** the round ends, **then** the run exits non-zero before pushing and names that comment, as it does today.
- [ ] **Given** a fix round that leaves every answer line on the pull request unchanged, including one that edits only other text in a comment holding answer lines, **when** the round ends, **then** the run continues to the push.

### Story #885: The ID registry read finds the pull request's verdict in any checkout

- **story_type:** system
- **size:** S

**As a** lead re-running analyze on a pull request, **I want** the ID registry read to find the pull request's newest verdict whatever checkout I run from, **so that** a departure or finding keeps its ID across runs and the answers written against it still apply.

#### Acceptance Criteria

- [ ] **Given** a checkout whose default repository is not the pull request's repository, and a pull request whose newest verdict carries IDs, **when** analyze reads the ID registry, **then** the registry holds that verdict's IDs.
- [ ] **Given** that same checkout and pull request, **when** analyze numbers a departure or finding the newest verdict already numbered, **then** the item keeps its existing ID and new items are numbered after the highest existing one, rather than restarting at DV1 and F1.
- [ ] **Given** a checkout whose default repository is the pull request's repository, **when** analyze reads the ID registry, **then** the result is the same as before this change.

## Assumptions

- An unattended fix round that removes an answer line, without adding or changing one, does not need to stop the run, because removing an answer accepts, waives or approves nothing.

## Out of Scope

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #884 | none |
| #885 | none |
