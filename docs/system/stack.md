---
stack: Nexus Prime Technology Stack
version: 1.0.0
last_updated: 2026-06-28
---

# Technology Stack

Nexus Prime is a **React terminal emulator** that runs Claude Code inside an in-browser
terminal and drives the Nexus pipeline through it. There is **no backend, database, or auth
layer** — Prime is a client-side app that orchestrates a local toolchain.

## Frontend

- **Framework**: React 19
- **Language**: TypeScript ~5.9 (strict mode, see `tsconfig.base.json`)
- **Routing**: react-router-dom 6.30
- **Terminal**: [`wterm`](https://github.com/vercel-labs/wterm/) — the in-browser terminal the
  app embeds (integration is the work to build)
- **Styling**: Tailwind CSS 3.4 (+ PostCSS, Autoprefixer)
- **Build Tool**: Vite 8

## Backend

Not applicable. Prime runs entirely client-side and shells out to the local Nexus toolchain
(`../nexus`) and Claude Code via the embedded terminal.

## Database

Not applicable.

## Infrastructure

- **Monorepo**: Nx 22.7 with inferred targets (most targets come from `@nx/*` plugins, not
  `project.json`)
- **CI/CD**: none configured yet

## Development

- **Package Manager**: pnpm (workspaces; `pnpm-workspace.yaml` globs `apps/*`)
- **Code Quality**: ESLint 9 (flat config, `@nx/eslint-plugin`), Prettier 3
- **Testing**: Vitest 4 (unit, jsdom) + Playwright (e2e)
- **Node types**: `@types/node` 20

## Workspace layout

- `apps/prime/` — the terminal-emulator app (entry `src/main.tsx`, root `src/app/app.tsx`)
- `apps/prime-e2e/` — Playwright e2e suite

## Commands

Run from repo root:

```sh
npx nx serve prime        # dev server (port 4200)
npx nx build prime        # production bundle
npx nx test prime         # vitest unit tests
npx nx e2e prime-e2e      # playwright e2e
npx nx lint prime         # eslint
npx nx typecheck prime    # tsc
npx nx show project prime # list all (mostly inferred) targets
```

## Related

- [Product context](../product/context.md) — who Prime is for, anti-goals, guiding principles.
</content>
