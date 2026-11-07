---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "A Member Repository Uses the Hub's Settings"
slug: member-uses-hub-settings
created: 2026-11-05
type: enhancement
complexity: M
complexity_drivers: [hub settings become a source of every resolved value, every filing stage must agree on the resolved value, single-repo checkouts must resolve exactly as today]
concepts: ["workspace-resolution", "remote-identity-normalization", "bare-name-guard", "portable-tooling", "nexus-setup-cli", "issue-sourced-planning", "publishing-config-resolution"]
link: "#1001"
record: "#1003"
record_state: closed
---

# Epic: A Member Repository Uses the Hub's Settings

## Description

A workspace has one hub repository and several member repositories. Today a lead configures the hub's own settings, and a member checkout ignores them. The only hub values a member sees are the workspace-wide defaults in the workspace manifest, and that list accepts only some settings. So a team either copies the same settings into every member or finds a member filing issues into a different project, with different labels, than the hub.

This epic makes the hub the place a team configures once. A member checkout uses any publishing setting the hub declares and the member leaves unset, except the test command, which belongs to each code repository. A member that declares its own value keeps it. A single-repo checkout resolves every setting exactly as it does today.

## Success Metrics

- A setting declared once on the hub reaches every member checkout with no edit in any member.
- Every stage run in a member checkout resolves a hub-declared setting to the same value.
- A single-repo checkout resolves every setting to the same value it resolved before this epic.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

A Member Uses Every Setting the Hub Declares and It Leaves Unset

## User Stories

### Story #1002: A Member Uses Every Setting the Hub Declares and It Leaves Unset

- **story_type:** user
- **size:** M

**As a** delivery lead in a multi-repo workspace, **I want** a member checkout to use the settings the hub declares, **so that** I configure publishing once for the whole workspace.

#### Acceptance Criteria

- [ ] **Given** the hub declares a setting that a member leaves unset, **when** the lead resolves that setting in the member checkout, **then** the hub's value is returned.
- [ ] **Given** the hub and a member both declare the same setting, **when** the lead resolves it in the member checkout, **then** the member's value is returned.
- [ ] **Given** the hub declares a setting the member leaves unset, **when** `/nxs.epic` or `/nxs.decision-record` files or labels an issue from the member checkout, **then** each one applies the hub's value, and `nexus close`, run from the hub for that epic, reads the same value.
- [ ] **Given** the hub declares a setting the member leaves unset, **when** `/nxs.setup` runs or a filing stage records what it decided in the member checkout, **then** the member's settings file still leaves that setting unset.
- [ ] **Given** the member's hub checkout is missing or unreadable, **when** the lead resolves a setting in the member checkout, **then** it resolves to the member's own value or the built-in, with the same exit code as before this epic.
- [ ] **Given** a single-repo checkout, **when** the lead resolves any setting, **then** it returns the same value it returned before this epic.

## Assumptions

- A member finds the hub the way it does today: through its hub pointer and the hub's sibling checkout.
- When the hub declares a setting both in its workspace-wide defaults and in its own settings, the hub's own setting wins, so a member resolves every setting it leaves unset to the value the hub checkout resolves.

## Out of Scope

- The docs root: a member keeps its own docs root and never takes the hub's.
- Document templates and the product context: a member does not take these from the hub.
- Writing a setting into the hub from a member checkout.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1002 | none |
