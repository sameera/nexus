## 2026-07-07 — Client-only terminal via lazy widget + mount gate
- **Choice:** Split the mount into `terminal-widget.tsx` (imports `@wterm/react` + its css) loaded through `React.lazy`, behind a `terminal-surface.tsx` post-mount gate (`mounted` flag, inert frame until mounted).
- **Why:** Guarantees the terminal library module never evaluates during SSR/first hydration (decision-record constraint #1), not just its render.
- **Refuted alternative:** Top-level `import { Terminal } from "@wterm/react"` gated only by a `mounted` flag — the module (and any browser-global access at import time) would still load on the server.

## 2026-07-07 — Rely on @wterm's inlined WASM (no wasmUrl)
- **Choice:** Mount `<Terminal autoResize />` with no `wasmUrl`; do not add `@wterm/core` or serve a `.wasm` asset.
- **Why:** `@wterm/core`'s `WasmBridge.load(undefined)` decodes an inlined base64 WASM binary, so the default core needs no served asset. Simpler than a Vite `?url` import or a `public/` copy.
- **Refuted alternative:** Import `@wterm/core/wasm?url` and pass it as `wasmUrl` — extra dependency and asset plumbing for no gain, since the inlined default already loads.

## 2026-07-08 — Connection controller takes an injectable socket factory
- **Choice:** `createPtyConnection(url, handlers, createSocket?)` — the real browser `WebSocket` is the default third arg; tests inject a fake socket.
- **Why:** The `@wterm/react` WASM grid can't run in jsdom, so the wire behaviour (bytes in→grid, keystrokes→binary, resize→control) is unit-tested against the fake at the controller seam rather than through the widget.
- **Refuted alternative:** Test the wiring only through the widget in a real browser — leaves the frame encode/decode logic unverified in CI.

## 2026-07-08 — Demultiplex inbound frames by `typeof data === "string"`
- **Choice:** Treat string messages as JSON control (Story 3) and everything else as raw PTY bytes, rather than branching on `instanceof ArrayBuffer`.
- **Why:** Mirrors the server's own binary/text split and is robust to the cross-realm `instanceof ArrayBuffer` failure seen under the jsdom test environment.
- **Refuted alternative:** `data instanceof ArrayBuffer` — fails across realms in tests and is narrower than the server's discrimination.

## 2026-07-08 — Drop keystrokes typed before the socket is open
- **Choice:** `sendInput` no-ops until `readyState === OPEN`; pre-open keystrokes are dropped, not buffered.
- **Why:** Story 2 has no prompt before connect, so there is nothing meaningful to type into; buffering adds state for a case the connection-state work (Story 3) surfaces to the user anyway.
- **Refuted alternative:** Queue pre-open input and flush on open — extra buffering for input the user has no reason to be typing yet.
