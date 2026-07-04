---
title: "Close Record: PTY Bridge"
epic: #11
feature: "Terminal Integration"
date: 2026-07-04
---

# Close Record: PTY Bridge

## Key Decisions

- **Rely on Vite/RR8 default SSR externalization for `node-pty` rather than an explicit
  external marking.** RR8/Vite externalize `node_modules` dependencies from the SSR bundle by
  default, so the native addon is already left unbundled; `pnpm.onlyBuiltDependencies:
  ["node-pty"]` drives the native prebuild/rebuild. Same outcome the decision record wanted
  (addon not bundled, binary resolvable) with less build config to maintain. *Refuted
  alternative:* an explicit `ssr.external` / `noExternal` entry — redundant given the default and
  an extra surface to keep in sync with the dep list.
- **`encoding: null` on the PTY plus a Buffer cast on `onData`.** `node-pty`'s typings claim
  `IEvent<string>`, but byte-for-byte fidelity (Invariant 5) requires the raw bytes; under
  `encoding: null` the runtime value is a `Buffer`, cast through and sent as a binary frame
  verbatim. This is the concrete realization of the "binary frames carry raw PTY bytes"
  decision — input and output bytes reach the other side unaltered and in order.

## Deviation Rationale

- **`node-pty` SSR externalization mechanism (Invariant 7 / Risk #1):** the record named an
  explicitly-marked external in the SSR build input; the shipped code instead relies on Vite/RR8
  default externalization of `node_modules` SSR deps plus `pnpm.onlyBuiltDependencies` for the
  native rebuild. The bundling-avoidance outcome holds; the explicit config was judged redundant.
- **Prod-mode PTY smoke check not shipped (Risk #1 mitigation):** the mitigation named a smoke
  test that the *built* server (`build/server/index.js`) actually spawns a PTY, not just the dev
  path. Coverage instead exercises the shared mount via `createAppServer` +
  `attachPtyBridgeHandler` (dev-equivalent, since `server.ts` funnels dev and prod through the
  same mount). A true built-server smoke test was deferred to the feature backlog, not dropped.

## Deferred Scope

Deferred items appended to: `docs/features/terminal-integration/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-04-isolate-the-hard-concern-first.md`
