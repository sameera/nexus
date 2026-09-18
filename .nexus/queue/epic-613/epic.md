---
feature: "Issue Assets"
feature_path: docs/features/issue-assets
epic: "A filed issue's HTML asset links to a configured renderer"
slug: html-asset-rendered-reference
created: 2026-09-13
type: enhancement
complexity: M
complexity_drivers: [both stories change the one reference builder and the arity contract its tests pin, so they interlock rather than land independently, a new configuration key has to reach the publish path that resolves no configuration today, the epic supersedes a decision an approved record made and its own record has to state what it refutes]
concepts: [issue-asset-store, settings-key-catalogue, publishing-config-resolution]
link: "#613"
record: "#627"
record_state: closed
---

# Epic: A filed issue's HTML asset links to a configured renderer

## Description

Nexus publishes an HTML mockup to the asset store and writes a plain link to the file at the pinned commit. GitHub never renders HTML inside an issue body, so a reviewer who follows that link reads markup instead of looking at a mockup. Today the reference builder decides a reference's form by file type alone, and HTML falls into the same branch as every other non-image file.

This epic lets a team name where its HTML mockups are rendered. The configured value is a template with a slot for the asset's pinned address, not the address of one particular renderer. A team points the template at a preview service that already renders a file from a public store, and points it at a renderer of its own later, and Nexus writes the same kind of address in both cases. This is why the epic does not wait on the renderer epic #612 builds: #612 is what a private store needs, and that is epic #614's goal.

A repository that configures no template files exactly the bodies it files today, and the fallback is stated on the console rather than left silent. A renderer that stops answering is a risk this epic leaves open. An issue already filed then carries an address that no longer resolves, and changing the template repairs only the issues filed after the change.

## Success Metrics

- A reviewer following an HTML mockup's link from an issue filed by a repository that configures a renderer template reaches a rendered page rather than markup.
- A repository that configures no renderer template files the same issue bodies it filed before this epic.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

An HTML asset's reference is a rendered address built from the configured template; A repository with no template configured files the link it files today

## User Stories

### Story #621: An HTML asset's reference is a rendered address built from the configured template

- **story_type:** user
- **size:** S

**As a** reviewer reading a filed issue, **I want** an HTML mockup's link to open the mockup as a page, **so that** I review the design rather than its markup.

## Acceptance Criteria

- [ ] **Given** a repository that configures a renderer template, **when** an HTML asset a body references is published for a filed issue, **then** the issue carries a reference built from that template, addressing the asset at the commit the publish created.
- [ ] **Given** an issue filed with that reference, **when** a reviewer follows it, **then** the reviewer sees the mockup as a rendered page rather than as markup.
- [ ] **Given** a repository that changes its template to name a different renderer, **when** the next issue is filed, **then** that issue's HTML references address the new renderer and every issue filed before the change is left as it was.

## Notes

The template is one more configured value a repository may declare, alongside the store it already declares.

### Story #622: A repository with no template configured files the link it files today

- **story_type:** system
- **size:** S

**As a** team that configures no renderer, **I want** issue filing to be unchanged, **so that** taking a newer Nexus costs us nothing.

## Acceptance Criteria

- [ ] **Given** a repository that configures no renderer template, **when** an HTML asset is published for a filed issue, **then** the reference in the body is the plain link to the asset at the pinned commit, identical to the reference the same run files today.
- [ ] **Given** that same repository, **when** the run reports what it published, **then** the report states that no renderer template is configured and that the plain link was filed.
- [ ] **Given** any repository, **when** a reference is built, **then** the choice between the rendered address and the plain link turns on whether a template is configured and never on whether the store is public.

- [ ] **Given** any repository, **when** the approval gate is shown, **then** it states which of the two reference forms will be filed, before the issue is created.
- [ ] **Given** a repository whose store is private and which configures a renderer template, **when** the asset list is checked, **then** the run warns that the renderer must read a private store and continues rather than refusing.

## Notes

This story is the guard that the new branch is a configuration branch rather than a visibility branch, so invariant 4 of the issue asset store concept holds unchanged.


The last two criteria were named in decision record #627's scope note and were missing from this issue when it was filed; the behaviour shipped with the epic and is tested. Added so the issue matches what was built.

## Assumptions

- A team that configures a template points it at a renderer that can read the store; a private store needs the renderer epic #612 builds, and that is epic #614's goal.
- A team recovers from a renderer that has stopped answering by changing the template, which repairs every issue filed after the change and none filed before it.
- Decision record #600 stays frozen, and this epic's own decision record states the new decision and names #600's plain-link decision as the alternative it refutes.

## Out of Scope

- Hosting a renderer. Epic #612 builds the self-hosted renderer, and epic #614 makes it read a private store as the reader.
- Writing anything new to the asset store. This epic changes only what Nexus writes into an issue body.
- Revising decision record #600, because epic #594 is closed and its queue entry was drained and deleted.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #621 | none |
| #622 | #621 |
