---
title: "Reading Surface Tokens"
aliases: ["shared reading definition", "reading subset", "lifted tokens", "one palette two surfaces", "print token exception"]
touches: ["theme-tokens", "offline-page", "lesson-renderer"]
last_updated_by: "#405"
status: active
verification: verified
---

# Reading Surface Tokens

The colour and typography values a reading surface needs are defined in one place that both the application and the workbook read. The workbook declares none of its own, which is only possible while a shared definition exists, because a library cannot depend on an application. Only the reading subset is shared; application chrome stays with the application.

## How It Works

The shared subset is background, ink levels, accent, rules, code surfaces, type stacks and radius. Application chrome values stay where they were, so the shared definition does not become a home for gate trays, drawer shadows and badge tints. Both consumers read the same rendered values: the application imports the generated file, the workbook's stylesheet embeds it, and neither restates a value. The choice was one shared definition or a copy, and a copy is defining its own. Refuted alternative: give the workbook a small palette deliberately matched to the application's, which decouples the two, but it loses the requirement that a page present the same colours and typography as the product, and a pair of hand-matched palettes drifts within a release or two. Print is the one place literal values are written. Print must be ink on white whatever the screen theme is, and the shared definition carries no print set, so the workbook's print rules assign literals onto the shared token names.

## Key Invariants

1. A reading surface resolves every colour and typography value from one shared definition, and no consumer restates a value.
2. Only the reading subset is shared. Application chrome values stay with the application.
3. The workbook declares no colour or typography value of its own for the screen surface.
4. Print is the single exception: it assigns literal values, every one of them onto a shared token name and confined to the print rules, and a test fails when a literal appears outside them.
5. Both consumers read the same rendered values rather than two matched copies.

## Integration Points

- [theme-tokens](theme-tokens.md) — the application's token vocabulary, whose reading subset was lifted out into this shared definition.
- [offline-page](offline-page.md) — the surface resolving every one of its values from here, on screen and on paper.
- [lesson-renderer](lesson-renderer.md) — embeds this definition in the one stylesheet it writes per workbook.

## Decision Log

### 2026-09-07 — #405 — The reading subset is lifted, and print is the one place literals live

A second reading surface can only declare none of its own values while a shared definition exists, because a library cannot depend on an application, so the reading subset was lifted rather than copied. Restricting the lift to that subset stops the shared definition becoming a home for application chrome. Refuted alternative: a small palette for the workbook, hand-matched to the application's, which decouples the two but drifts within a release or two. Print deviates from the record's invariant that the workbook declares no value of its own. Print must be ink on white whatever the screen theme is, and the shared definition carries no print set, so literals are unavoidable somewhere. They are confined to the print rules and assigned only onto shared token names, pinned by a test, so the invariant holds for the screen surface it was written about and yields to the print requirement.
