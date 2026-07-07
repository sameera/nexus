# Backlog: Terminal Integration

<!-- Append-only re-triage queue. Writers: /nxs.epic (decomposition stubs),
     /nxs.close (deferred scope). One consumer: the next /nxs.epic.
     Promote a proposed stub with `/nxs.epic <slug>`. -->

## pty-bridge

- **status:** promoted
- **goal:** Local PTY-over-WebSocket sidecar in the monorepo that spawns a normal login shell and streams its I/O; reachable and verifiable on its own.
- **estimate:** M
- **blocked_by:** none
- **source:** decomposition of "Wire up wterm to the Terminal Placeholder" (2026-07-03)
- **candidate stories:** Sidecar spawns a shell and streams it over WebSocket; Bridge run target and config (port, shell); Session teardown on socket close

## terminal-mount

- **status:** promoted
- **goal:** Replace the terminal placeholder with `@wterm/react` wired to the pty-bridge — a real interactive shell inside Prime — with connection states and reconnection, preserving the region's recede/dim behavior.
- **estimate:** M
- **blocked_by:** [pty-bridge]
- **source:** decomposition of "Wire up wterm to the Terminal Placeholder" (2026-07-03)
- **candidate stories:** Mount @wterm/react in the terminal region; Connect the terminal to the bridge and stream I/O; Connection states (connecting / disconnected / error) and reconnection

## pty-bridge-prod-smoke-check

- **status:** proposed
- **goal:** Smoke-test that the *built* Prime server (`build/server/index.js`), not just the dev/middleware mount, actually spawns a PTY over the bridge — covering the prod SSR + externalized-`node-pty` path end-to-end.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic PTY Bridge (#11) (2026-07-04)

## terminal-compose-panel

- **status:** promoted
- **goal:** Button-invoked, full-height compose panel that splits the terminal area for long-form prompt authoring and injects the composed text into the live shell on submit (Enter = newline, Ctrl+Enter and an explicit Send button submit), then closes and returns focus to the terminal. Reuses the `@nexus/editor` (#25) input.
- **estimate:** M
- **blocked_by:** [terminal-mount]
- **source:** split of "terminal mount" epic promotion — deferred rich-input goal (2026-07-06)
- **candidate stories:** Compose button that splits the terminal to a full-height editor; Long-form editor with Enter=newline and Ctrl+Enter / Send submit; Inject composed text into the live PTY and return focus to the terminal
