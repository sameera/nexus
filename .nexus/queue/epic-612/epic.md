---
feature: "Issue Assets"
feature_path: docs/features/issue-assets
epic: "The renderer serves a pinned HTML mockup as an isolated page"
slug: html-mockup-renderer
created: 2026-09-13
type: enhancement
complexity: M
complexity_drivers: [first hosted service in a package that has only ever shipped a command-line tool, a security boundary fixed before there is a session to lose, an operational home with a named owner]
concepts: []
link: "#612"
record: "#653"
record_state: closed
---

# Epic: The renderer serves a pinned HTML mockup as an isolated page

## Description

Epic #594 publishes an HTML file to the asset store and writes a plain link to it into the issue body. GitHub never renders HTML inside an issue, so a reviewer who follows that link reads markup instead of looking at a mockup. A link to unrendered markup is not a mockup anyone can review.

This epic delivers the renderer that closes the gap. A reader opens a published HTML mockup from a public store and the browser shows it as a rendered page, at the version the issue pinned. A later publish to the same path leaves that issue showing what it showed before.

The renderer is the first thing Nexus has needed to host. Nexus ships as a command-line package on npm, with no server, no deployment target and no secrets to hold. This epic does not answer where the renderer runs, who pays for it or who repairs it when it stops. Those are deferred with the deployment itself. What it does answer is the shape that keeps the deferred deployment cheap: the renderer is a single stateless request handler, small enough to run as a serverless function, answering at an address the team designates rather than one compiled in. It also fixes the security boundary before there is anything to lose. The renderer serves HTML that any member can write into the store, so a served page must reach nothing the renderer holds. When epic #614 later signs a reader in, the separation is already in place.

## Success Metrics

- A reviewer who opens an HTML mockup link from a filed issue sees the rendered mockup rather than its markup.
- An issue filed before a later publish to the same path still shows the mockup as it was when that issue was filed.
- A mockup served by the renderer reads nothing the renderer holds, whatever its markup attempts.
- The renderer answers at an address the team designates, and its deliverable is a single stateless request handler that holds nothing between requests.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

A reader opens a mockup link and sees the rendered page; The renderer answers at one stated address

## User Stories

### Story #618: A reader opens a mockup link and sees the rendered page

**As a** reviewer of a filed issue, **I want** the HTML mockup the issue links to open as a rendered page, **so that** I can judge the mockup instead of reading its markup.

- **story_type:** user
- **size:** M

## Acceptance Criteria

- [ ] **Given** an HTML file published to a public store, and an address naming that file at one pinned version, **when** a reader opens the address, **then** the browser shows the file rendered as a page.
- [ ] **Given** the same path in the store has been published again since, **when** a reader opens the earlier address, **then** the page shows the content that earlier address pinned.
- [ ] **Given** a mockup whose markup reads whatever the browser holds for the renderer itself, **when** a reader opens the mockup, **then** the markup reads nothing.
- [ ] **Given** a mockup whose markup sends a request back to the renderer, **when** a reader opens the mockup, **then** the request carries no credential the renderer holds.

## Notes

The separation the last two criteria state is part of this story rather than a story after it. The initiative is explicit that it is a condition of serving the content at all, not a later hardening step. The renderer holds no reader session yet, so the separation is built and proved now, and epic #614 then has somewhere safe to put one.

This story is demonstrated against a renderer a developer runs. Reaching it from outside the team's network is #619's criterion, not this one's.

The address form this story accepts is what epic #613 later writes into an issue body. #613 is a separate epic and depends on this one.

### Story #619: The renderer answers at one stated address

**As a** team linking mockups from filed issues, **I want** the renderer to answer at one address the team designates, **so that** a link written into an issue today still opens the mockup months later.

- **story_type:** system
- **size:** S

## Acceptance Criteria

- [ ] **Given** a renderer started with an address designated by the team, **when** a reader opens a mockup link built for that address, **then** the renderer answers at it.
- [ ] **Given** a renderer started with no address designated, **when** it starts, **then** it answers at a stated default rather than failing.
- [ ] **Given** the renderer is packaged for delivery, **when** its deliverable is measured, **then** it is a single stateless request handler that holds no state between requests and starts without a long-lived process of its own.

## Notes

Narrowed from the originally filed criterion, which asserted reachability from outside the team's
network. Hosting the renderer is out of scope for this initiative: where it runs, who pays for it
and who repairs it when it stops are deferred with the deployment itself. What remains here is the
behaviour the link depends on — the address is designated by the team rather than compiled in, so
the address epic #613 writes into an issue body and the address the renderer answers at are the
same value.

The third criterion is the shape constraint that keeps the deferred deployment cheap. The renderer
is intended to run as a function on a serverless host, so it must be a stateless handler small
enough to deploy as one. The invariant behind it is stated in this epic's decision record; the
criterion above is the part a test can observe.

## Assumptions

- The store this epic serves from is public, and reading a private store as the reader is epic #614's goal.

## Out of Scope

- Signing a reader in, and reading a private store as that reader.
- Hosting the renderer: choosing a host, deploying to it, paying for it, and naming who repairs it when it stops. The renderer is built to a shape that a serverless host can take, and it is demonstrated against an instance a developer runs.
- Resolving a mockup's relative stylesheets and images, which is epic #615's goal.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #618 | none |
| #619 | #618 |
