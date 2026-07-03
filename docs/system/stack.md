---
stack: Nexus Prime Technology Stack
version: 1.0.0
last_updated: 2026-06-28
---

# Technology Stack

Nexus Prime is a **React terminal emulator** that runs Claude Code inside an in-browser
terminal and drives the Nexus pipeline through it. Prime runs as a React Router 8
framework-mode app fronted by a custom Node server: the server owns its underlying HTTP
server (rather than the fully-managed `@react-router/serve` binary) specifically so it has
a free WebSocket-upgrade path — the seam the PTY Bridge (issue #11) mounts its WebSocket
endpoint on. App chrome server-renders; the terminal region stays client-only (a real
terminal library isn't wired in yet).

## Frontend

- **Framework**: React 19
- **Language**: TypeScript ~5.9 (strict mode, see `tsconfig.base.json`)
- **Routing / framework**: React Router 8 (framework mode, SSR for chrome)
- **Terminal**: [`wterm`](https://github.com/vercel-labs/wterm/) — the in-browser terminal the
  app embeds (integration is the work to build)
- **Styling**: Tailwind CSS 3.4 (+ PostCSS, Autoprefixer)
- **Build Tool**: Vite 8

## Backend

A custom Node server (`apps/prime/server.ts`), built on Express and React Router's
`createRequestHandler`. It owns the underlying `http.Server` in both dev (Vite middleware
mode) and prod (the built server bundle), leaving the `upgrade` event free for a
WebSocket endpoint to mount on the same origin — currently proven by a stub handshake
(`apps/prime/server/http-server.spec.ts`); the PTY Bridge epic (#11) replaces the stub with
the real endpoint.

## Database

Not applicable.

## Infrastructure

- **Monorepo**: Nx 22.7. `prime`'s build/dev/preview targets are explicit
  `nx:run-commands` in `apps/prime/project.json` (no Nx plugin understands RR8 framework
  mode); its `test` target still comes from `@nx/vitest` inference.
- **CI/CD**: none configured yet

## Development

- **Package Manager**: pnpm (workspaces; `pnpm-workspace.yaml` globs `apps/*`)
- **Code Quality**: ESLint 9 (flat config, `@nx/eslint-plugin`), Prettier 3
- **Testing**: Vitest 4 (unit, jsdom) + Playwright (e2e)
- **Node**: >=22.22.0, pinned via `.nvmrc` / `engines` (RR8's floor)

## Workspace layout

- `apps/prime/` — the terminal-emulator app (RR8 root `apps/prime/app/root.tsx`, home route
  `apps/prime/app/routes/home.tsx`, server entry `apps/prime/server.ts`)
- `apps/prime-e2e/` — Playwright e2e suite

## Commands

Run from repo root:

```sh
npx nx dev prime          # custom server in dev mode, Vite middleware (port 4200)
npx nx build prime        # react-router build (build/client + build/server)
npx nx preview prime      # build, then serve it via the custom server in prod mode
npx nx test prime         # vitest unit tests
npx nx e2e prime-e2e      # playwright e2e
npx nx lint prime         # eslint
npx nx typecheck prime    # tsc
npx nx show project prime # list all targets
```

## Related

- [Product context](../product/context.md) — who Prime is for, anti-goals, guiding principles.
</content>
