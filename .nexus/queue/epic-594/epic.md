---
feature: "Issue Assets"
feature_path: docs/features/issue-assets
epic: "Durable asset store for filed issues"
slug: issue-asset-store
created: 2026-09-12
type: enhancement
complexity: M
complexity_drivers: [new toolkit verb, two filing stages changed, publishing to a second repository]
concepts: []
link: "#594"
record: "#600"
record_state: closed
---

# Epic: Durable asset store for filed issues

## Description

A lead who plans an epic or writes a decision record often has a picture that says more than the prose: a diagram, a screen mockup, a sketch. Today none of it reaches the filed issue. Nexus files issues from the command line, and GitHub offers no way to attach a file to an issue from there. The only durable place for a file is the docs tree, and the docs tree is behind a protected branch. The issue is filed at approval; the picture lands when a pull request merges, days later. Until then the issue says less than the lead approved.

This epic gives a team one place to put those files that the filing stages can write to directly. The team names the store once in its delivery settings: a repository every member can write to, or an unprotected branch of the repository that holds the issues. A lead hands `/nxs.epic` or `/nxs.decision-record` the local files. The draft refers to them by local path, so nothing leaves the machine before the reviewer approves. At filing the stage publishes each file to the store and replaces the local path with a reference pinned to the exact version published. An image then shows inline in the issue. Every other file, including an HTML mockup, is a link to the published version.

The pinned reference is what makes the store safe to share. A later upload to the same path never changes what an earlier issue shows, so nobody has to coordinate file names across epics, and the store is never deleted from. A repository that declares no store behaves exactly as it does today, plus one sentence saying that assets are unsupported.

## Success Metrics

- An epic filed with assets shows every image inline, and links every other file at the published version, on the day it is filed, with no pull request merged.
- A file uploaded to the same store path after an issue is filed leaves that issue's rendering unchanged.
- A repository with no store declared files the same issues with the same bodies as before this epic, with one added notice and no failure.

## Personas

Per `docs/product/context.md`, plus one persona specific to this epic. The **lead** runs `/nxs.epic` and `/nxs.decision-record` and approves at their gates. The canonical set describes the engineer running the pipeline in Prime and does not name this role.

## Smallest Usable Version

Declare the asset store once; Publish a file and receive a pinned reference; Reference each asset in the form its reader can render; File an epic with its assets.

## User Stories

### Story #595: Declare the asset store once

- **story_type:** system
- **size:** S

**As a** lead, **I want** to name the asset store once in the repository's delivery settings, **so that** every filing stage on the team publishes to the same place.

## Acceptance Criteria

- [ ] **Given** a repository whose delivery settings declare an asset store as `owner/repo` or `owner/repo@branch`, **when** a stage resolves the store, **then** the stage receives that location.
- [ ] **Given** a multi-repo workspace whose hub declares the store and whose member declares none, **when** a stage in the member resolves the store, **then** the hub's value is used.
- [ ] **Given** a repository that declares no store at any layer, **when** a stage resolves the store, **then** the stage learns that assets are unsupported and receives no default location.
- [ ] **Given** a declared store whose value is not in the `owner/repo` or `owner/repo@branch` form, **when** a stage resolves the store, **then** the run stops and names the malformed value.

## Notes

The store is declared in the same block as the other publishing targets, so it inherits the same precedence chain and the same hub layer as `issues-repo`. When no branch is given, the store's default branch is used.

### Story #596: Publish a file and receive a pinned reference

- **story_type:** system
- **size:** M

**As a** lead, **I want** one command that puts a local file in the store and prints a reference frozen to the version it published, **so that** the issue I file shows exactly what I approved.

## Acceptance Criteria

- [ ] **Given** a declared store and a local file, **when** the file is published for a feature, **then** the file is written under `features/<slug>/<filename>` in the store.
- [ ] **Given** a declared store, **when** a file is published, **then** no local clone or worktree of the store is created.
- [ ] **Given** a published file, **when** the same path is published again with different content, **then** the earlier reference still resolves to the earlier content.
- [ ] **Given** a local file larger than the size cap, **when** publication is attempted, **then** nothing is written and the cap and the file's size are reported.
- [ ] **Given** no declared store, **when** publication is attempted, **then** nothing is written and the command reports that assets are unsupported for this repository.

## Notes

This is a toolkit verb beside `abs-doc-path`: one file in, one reference out, and the filing stages call it rather than writing to the store themselves. The reference pins the commit the publish created, so the same file name can be reused across epics without coordination. The cap is a stated default the team can change.

### Story #597: Reference each asset in the form its reader can render

- **story_type:** user
- **size:** S

**As an** engineer reading a filed issue, **I want** an image to appear inline and every other published file to open at the exact version that was approved, **so that** I can judge the design without downloading files.

## Acceptance Criteria

- [ ] **Given** a published image, **when** it is referenced from an issue body, **then** the issue shows the image inline, including when the store is private and the reader is a member.
- [ ] **Given** a published file of any other type, including HTML, **when** it is referenced from an issue body, **then** the reference is a link to the published version at the pinned commit.

## Notes

The store's visibility is read from GitHub at filing time, not declared in settings. An HTML file is a plain link in this epic. Rendering it as a page is deferred to its own epic, because no durable way to render HTML from a private store was found at planning.

### Story #598: File an epic with its assets

- **story_type:** user
- **size:** M

**As a** lead, **I want** to hand `/nxs.epic` local asset files and have the filed issues carry them, **so that** the epic and its stories keep their fidelity from the day they are filed.

## Acceptance Criteria

- [ ] **Given** `--assets` naming one or more local files, **when** the draft is written, **then** the draft refers to each asset by its local path and nothing has been published.
- [ ] **Given** an approved draft with asset references, **when** the epic and story issues are filed, **then** every local path in an epic or story body is replaced with the pinned reference and no local path reaches an issue.
- [ ] **Given** a draft with asset references, **when** the reviewer chooses revise at the approval gate, **then** nothing has been published to the store.
- [ ] **Given** `--assets` in a repository with no declared store, **when** the run reaches the draft, **then** the stage says assets are unsupported and files the issues without them.
- [ ] **Given** an asset path that does not exist, **when** the run begins, **then** the run stops before drafting and names the missing path.

## Notes

An asset referenced from a story's section is rewritten in that story's issue body; one referenced from the epic's own sections is rewritten in the epic body. The rewrite happens on the derived filing body, after the approval gate and before the clean-body assertion, so a surviving local path fails the run the same way a surviving label does.

### Story #599: File a decision record with its assets

- **story_type:** user
- **size:** S

**As a** lead, **I want** to hand `/nxs.decision-record` local asset files and have the record sub-issue carry them, **so that** the approver sees the diagram the decision was made against.

## Acceptance Criteria

- [ ] **Given** `--assets` naming one or more local files, **when** the record is filed as a sub-issue, **then** every local path in the record body is replaced with the pinned reference.
- [ ] **Given** a record draft with asset references, **when** the lead does not approve at the record's pre-filing checkpoint (its approval gate), **then** nothing has been published to the store.
- [ ] **Given** `--assets` in a repository with no declared store, **when** the record is filed, **then** the stage says assets are unsupported and files the record without them.
- [ ] **Given** `--revise` with new asset files, **when** the record is updated, **then** the new assets are published and every reference in the earlier record still resolves.

## Notes

The record's own rules are unchanged: the body stays decisions-and-rationale prose, and an asset is a picture of a decision, never a substitute for its why.

## Assumptions

- Every member who files has write permission to the store. Nexus applies no permission check of its own, and a failed upload is reported as GitHub's error.
- The per-file size cap defaults to 5 MB.
- The store's visibility is read from GitHub at filing time rather than declared in settings.

## Out of Scope

- Deleting or pruning files from the store.
- Assets in discovery tickets or the discovery folder.
- Assets on close records, distillation pull requests or concept pages.
- Uploading through GitHub's own browser attachment store.
- Rendering an HTML mockup as a page. Deferred to epic stub #601.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #595 | none |
| #596 | #595 |
| #597 | #596 |
| #598 | #596, #597 |
| #599 | #596, #597 |
