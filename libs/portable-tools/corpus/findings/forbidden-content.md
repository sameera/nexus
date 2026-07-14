---
title: "Forbidden Content"
aliases: []
touches: []
last_updated_by: "bootstrap"
status: active
verification: verified
---

# Forbidden Content

This page includes content the validator rejects.

## How It Works

The loader reads ./config/settings.yml during startup.
It then calls initialize() before touching user_data_store.
A camelCaseHandler routes the events.

```js
const answer = 42;
```

## Key Invariants

1. Code belongs in source, not concept pages.

## Integration Points

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
