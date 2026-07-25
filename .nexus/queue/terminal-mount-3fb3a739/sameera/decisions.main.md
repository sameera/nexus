## 2026-07-08 — Single `reconnect()` serves both manual retry and start-new-session
- **Choice:** One controller method (`reconnect()`) backs both the disconnected-state "Retry now" and the exited-state "Start new session" controls.
- **Why:** Both intents reduce to the same action — cancel any pending backoff and open a fresh socket now — so the state, not a second method, decides the button's label.
- **Refuted alternative:** Separate `retry()` / `restart()` methods; needless surface for identical behavior.

## 2026-07-08 — Manual retry presents as `connecting`, auto-retry stays `disconnected`
- **Choice:** `reconnect()` resets `hasOpened=false` so a user-initiated attempt shows "Connecting…", while auto-reconnect keeps `hasOpened=true` and holds a stable "Disconnected — reconnecting…" banner across attempts.
- **Why:** A user who just clicked Retry/Start expects immediate "connecting" feedback; auto-retries should not flicker the banner between connecting/disconnected on every backoff tick.
- **Refuted alternative:** One state for all reconnect attempts — either flickers on auto-retry or gives no feedback on manual retry.

## 2026-07-08 — Injectable timers/random via a 4th options arg
- **Choice:** `createPtyConnection(url, handlers, options?)` where options carry `createSocket`, `timers`, `random`, `backoff`, replacing the old positional `createSocket` third arg.
- **Why:** Backoff + jitter need deterministic timers and randomness under test; an options bag keeps the seam injectable without a growing positional list.
- **Refuted alternative:** Keep piling positional params; unreadable and order-fragile.

## 2026-07-08 — Status layer split into its own presentational `TerminalStatus`
- **Choice:** The connecting/disconnected/exited overlay is a standalone component the widget composes, taking `state` + `onReconnect`.
- **Why:** Lets the visible states be tested directly (jsdom can't run the WASM grid), keeping the widget test focused on wiring.
- **Refuted alternative:** Inline the status markup in the widget; only reachable through the un-runnable grid.
