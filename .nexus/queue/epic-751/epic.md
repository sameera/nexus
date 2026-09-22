---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "A Published Verdict's Story Numbers Name the Repository They Belong To"
slug: verdict-issue-repository-scoping
created: 2026-09-21
type: enhancement
complexity: M
complexity_drivers: [a writer change and a reader change that must land without rejecting the verdicts already published, the whole of which omit the key the reader would start comparing]
concepts: [provenance-reference, conformance-gate, aggregated-epic-receipt]
link: "#751"
record: "#764"
record_state: closed
---

# Epic: A Published Verdict's Story Numbers Name the Repository They Belong To

## Description

A published verdict names the stories it covers as bare numbers. Which repository those numbers resolve against is stated once, by the key naming the issues repository, and that key is left out whenever it equals the code repository the verdict stamps. Nothing checks that it was written when the two differ. A reader then matches a story by number alone. Two repositories that share a number cross-match, and the reader cannot tell the difference.

This has already happened. The verdicts on `geo-nexus/giccp#665` stamp `github.com/geo-nexus/giccp` as the code repository, name no issues repository, and cover epic `#114` and story `117`. Both numbers exist in `geo-nexus/giccp` as unrelated items. The real epic and story are `geo-nexus/docs#114` and `geo-nexus/docs#117`, which the prose above each verdict names correctly. The verdict left out a key it was required to write, because the two repositories differ.

The fix has two halves that cannot be made in either order alone. The writing half must state the issues repository whenever it differs, and that must be checked rather than asked for in prose, because prose is what failed. The reading half must compare the repository before it matches a number. Neither half may reject the verdicts already published: every one of them omits the key, legitimately, because their issues and code live in the same repository. A reader that demanded the key would reject the whole published population, which is the defect epic #747 removed, facing the other way.

## Success Metrics

- A verdict published from a checkout whose issues and code live in different repositories names both repositories.
- A story number carried by a published verdict matches an issue in exactly one repository.
- No verdict published before this change is rejected for naming no issues repository.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The published verdict names the repository its story numbers resolve against; A reader resolves a verdict's story numbers against the repository the verdict names

## User Stories

### Story #757: The published verdict names the repository its story numbers resolve against

- **story_type:** system
- **size:** M

**As a** delivery lead running the conformance gate, **I want** the published verdict to name the repository its story numbers belong to, **so that** a later reader never has to guess which repository a bare number points at.

## Acceptance Criteria

- [ ] **Given** a checkout whose issues live in a different repository from its code, **when** the conformance gate publishes its verdict, **then** the published verdict names the issues repository.
- [ ] **Given** a checkout whose issues and code are the same repository, **when** the conformance gate publishes its verdict, **then** the verdict names the same repositories it names today.
- [ ] **Given** a verdict whose issues repository differs from its code repository and which does not name the issues repository, **when** the gate reaches the point of publishing it, **then** the gate stops and reports the omission instead of publishing.

## Notes

The third criterion is what makes the first stick. The gate has asked for this key in prose since the key existed, and the prose was followed everywhere except the one case it was written for.

### Story #758: A reader resolves a verdict's story numbers against the repository the verdict names

- **story_type:** system
- **size:** M

**As a** delivery lead closing an epic, **I want** a published verdict's story numbers matched only against the repository they belong to, **so that** an unrelated issue that happens to share a number is never read as my story.

## Acceptance Criteria

- [ ] **Given** two repositories that share a story number, **when** a reader matches a verdict that names one of them as its issues repository, **then** it matches that repository's story and not the other's.
- [ ] **Given** a verdict that names no issues repository, **when** a reader resolves its story numbers, **then** it resolves them against the code repository the verdict stamps and accepts the verdict.
- [ ] **Given** the verdicts published before this change, **when** a reader reads them, **then** none is rejected for naming no issues repository.

## Notes

The second and third criteria are the same rule read from two sides. The fallback is what the whole published population already relies on, so it is behaviour to preserve rather than a concession.

## Assumptions

- The conformance gate already resolves the issues repository of the checkout it runs in, so naming it in the verdict needs no new resolution.
- Verdicts already published are not rewritten. One that omits the issues repository stays as it is and is read under the fallback.

## Out of Scope

- Re-running the conformance gate on any epic whose verdicts cross-matched while this defect was live. That is the lead's action once the fix ships.
- What the conformance gate judges. Findings and severities are carried through unchanged.
- The code-repository stamp itself and how it is compared, which epic #747 settled.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #757 | none |
| #758 | none |
