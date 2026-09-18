---
feature: "Issue Assets"
feature_path: docs/features/issue-assets
epic: "The renderer reads a private store as the reader"
slug: private-store-as-reader
created: 2026-09-18
type: enhancement
complexity: M
complexity_drivers: [a reader credential enters a service that has never held one, the sign-in round trip has to return the reader to the exact mockup they asked for, access is answered entirely by the store's host so the renderer must keep no rule of its own]
concepts: []
link: "#614"
record: "#660"
record_state: closed
---

# Epic: The renderer reads a private store as the reader

## Description

The renderer built by epic #612 serves a mockup from a public store and holds no credential. A team whose store is private gets nothing from it. The store is the ordinary case for a team planning work in a private repository, so the renderer as it stands serves the smaller half of its audience.

This epic makes the renderer read the store as the person looking at it. A reader who opens a mockup link signs in once, the renderer fetches the file under that reader's own access, and the page appears. A reader who cannot open the store cannot open the mockup either. Access to a mockup is then exactly access to the store, and the renderer keeps no list of who may see what.

That equivalence is the whole design. A rule of the renderer's own would be a second answer to a question the store's host already answers, and the two would disagree the moment someone's access changed. It also means no per-reader administration: nobody grants a reader access to a mockup, because they already did when they granted access to the repository. There is one-time setup per store, done by someone with administrative rights on it, and after that no reader is ever administered.

Holding a reader's credential is new for this service, and it is what makes epic #612's origin boundary load-bearing rather than precautionary. A mockup is markup any member can write, and it now runs in a browser that is holding a session for the renderer. The separation built in #612 is what keeps the mockup away from it.

## Success Metrics

- A reader with access to a private store opens a mockup link from a filed issue and sees the rendered mockup.
- A reader without access to that store is refused, and never sees any part of the mockup.
- The renderer decides nothing about who may see a mockup; every such answer comes from the store's host.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The reader signs in before a private mockup is served; A private mockup is served by reading the store as the reader; A reader without access to the store is refused, not shown the mockup

## User Stories

### Story #655: The reader signs in before a private mockup is served

**As a** reviewer opening a mockup link from a filed issue, **I want** to sign in once when the mockup is private, **so that** I reach the mockup instead of an error.

- **story_type:** user
- **size:** M

## Acceptance Criteria

- [ ] **Given** a mockup link naming a file in a private store, **when** a reader who has not signed in opens it, **then** the reader is asked to sign in rather than shown a refusal.
- [ ] **Given** a reader who has just signed in, **when** the sign-in completes, **then** the reader is returned to the address they originally opened, rather than to a page of the renderer's own.
- [ ] **Given** a reader who signed in earlier and is still within that session, **when** they open a second mockup link, **then** they are not asked to sign in again.
- [ ] **Given** a mockup link naming a file in a public store, **when** any reader opens it, **then** it is served without a sign-in, exactly as it is served today.

## Notes

The renderer holds a reader's credential from this story onward. The origin separation epic #612 built is what keeps a served mockup away from it, and nothing here may weaken it.

### Story #656: A private mockup is served by reading the store as the reader

**As a** reviewer with access to a private store, **I want** the mockup fetched under my own access, **so that** what I can see in the store is exactly what I can see rendered.

- **story_type:** user
- **size:** M

## Acceptance Criteria

- [ ] **Given** a signed-in reader who has access to a private store, **when** they open a mockup link naming a file in it, **then** the browser shows that file rendered as a page.
- [ ] **Given** a signed-in reader and a file they can already open in the store, **when** they open the mockup link for that file, **then** the page shows them the same content the store shows them.
- [ ] **Given** a mockup served from a private store, **when** a second reader opens the same link, **then** that reader's own access is answered again before anything is served to them.

### Story #657: A reader without access to the store is refused, not shown the mockup

**As a** team keeping its planning private, **I want** a reader outside the store refused, **so that** a mockup link shared beyond the team discloses nothing.

- **story_type:** user
- **size:** S

## Acceptance Criteria

- [ ] **Given** a signed-in reader with no access to the store a link names, **when** they open that link, **then** they are refused and no part of the mockup is shown.
- [ ] **Given** that refusal, **when** the reader reads it, **then** it does not reveal whether the file exists, only that the reader cannot reach it.
- [ ] **Given** any refusal decision, **when** it is made, **then** it is made from the store's own answer about that reader and from no rule the renderer keeps.

## Assumptions

- A reader who can open the store's repository can be identified by the store's host, so the renderer needs no account of its own for them.
- The renderer is reached over a connection a session can safely be carried on.
- Where the renderer runs, who pays for it and who repairs it stay deferred, as they were in epic #612.

## Out of Scope

- Serving a mockup's relative stylesheets and images, which is epic #615's goal.
- Any rule of the renderer's own about who may see which mockup.
- Granting, revoking or reviewing access to the store itself.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #655 | none |
| #656 | #655 |
| #657 | #656 |
