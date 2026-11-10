---
title: "Hub Settings Layer"
aliases: ["hub layer", "hub settings inheritance", "member inherits hub settings", "workspace-wide publishing defaults", "repository-specific key"]
touches: ["publishing-config-resolution", "workspace-resolution", "config-write-back", "settings-key-catalogue"]
last_updated_by: "#1001"
status: active
verification: verified
---

# Hub Settings Layer

The hub layer is the step in the publishing precedence chain between a checkout's own settings and the built-in values. It holds the hub's own settings first, then the workspace-wide defaults in the hub manifest. A member checkout therefore resolves every publishing key it leaves unset to the value the hub checkout resolves.

## How It Works

The layer runs only when the checkout declares a workspace, so a single-repo checkout reads no other checkout. It takes the workspace from the workspace resolver as a value and never parses the manifest itself.

The layer reads the hub's own settings from the hub checkout that resolver located. It uses the same reader a checkout's own settings go through. Key by key, the hub's own settings win over the manifest defaults. A key the hub declares in its own settings reaches members without a second registration on the manifest allowlist.

Only publishing keys cross. A key the catalogue marks as describing one code repository never reaches a member. Today the test command is the only such key. The docs root, templates and product context also stay with each repository.

The layer is best-effort. An unresolvable workspace contributes nothing. An unreadable hub settings file drops only the hub's own settings, and the manifest defaults still apply. Neither case prints a warning or changes the exit code.

## Key Invariants

1. In a member, every publishing key the member leaves unset resolves to the value the hub checkout resolves, except a repository-specific key.
2. When the hub declares a key in both its own settings and its manifest defaults, the hub's own setting wins.
3. A member's non-empty value wins over both hub sources. An empty value counts as unset at every step.
4. A member never takes the test command, the hub's cross-reference docs location, the docs root, templates or product context from the hub.
5. The hub's settings are read only from the hub checkout the workspace resolver located and verified. No path is built from a setting's value, and nothing is written to the hub.
6. Each hub source fails on its own and silently, and the exit code never changes.
7. A single-repo checkout reads no other checkout, and the hub checkout resolves every key to the value its own settings give.

## Integration Points

- [publishing-config-resolution](publishing-config-resolution.md) — the precedence chain this layer is one step of; split out from there, which keeps the order of the whole chain.
- [workspace-resolution](workspace-resolution.md) — locates and verifies the hub checkout this layer reads, and carries the manifest defaults it applies.
- [config-write-back](config-write-back.md) — skips every key this layer supplies, so no member freezes a copy of a hub value.
- [settings-key-catalogue](settings-key-catalogue.md) — marks which keys are repository-specific and so never cross from the hub.

## Decision Log

### 2026-11-07 — #1001 — Split from publishing-config-resolution; the hub's own settings join the layer

Split from publishing-config-resolution, whose own content could not take this change under the cap. A member used to see only the manifest's workspace-wide defaults, so teams copied the same settings into every member or found a member filing into a different project with different labels. The layer now also reads the hub's own settings, inside the one publishing resolver, so every filing consumer gets the change at once and none gets a reader of its own. The hub's own setting wins over the manifest default, because the other order makes the hub and a member disagree on a key declared in both places: a record filed from a member would carry one marker, and close, run in the hub, would look for another. The test command never crosses, because a wrong inherited test command is silent and harmful, while a missing one costs one line per member. Each source fails silently, because a stage resolves many keys per run and a warning would repeat. **Refuted alternative:** merge the manifest allowlist into the key catalogue and declare workspace values only in the manifest. That keeps one source, but the hub's own filing still reads the hub's own settings, so teams would keep the same value in two files in the hub.
