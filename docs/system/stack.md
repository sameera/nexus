---
stack: Nexus Technology Stack
version: 2.0.0
last_updated: 2026-09-18
---

# Technology Stack

Nexus is a **spec-driven delivery pipeline** delivered as two things from one repository: a set of
Claude components (commands, agents, skills) authored under `components/`, and a portable Node CLI
(`nexus`) that installs them, resolves workspaces and runs the deterministic checks the pipeline
stages depend on. There is no user interface — the pipeline is driven from an agent session and from
GitHub issues, which are the planning surface.

## Language and runtime

- **Language**: TypeScript ~5.9, strict, `nodenext` modules (see `tsconfig.base.json`)
- **Runtime**: Node >=22.22.0, pinned via `.nvmrc` and `engines`
- **Platforms**: darwin and linux (`os` in the root manifest)

## Published artifact

`@sameeraperera/nexus` ships one binary, `nexus` → `dist/nexus.mjs`. The package `files` allowlist is
`dist`-only, so the component payload never appears in its own diff — its fingerprint is pinned
instead, by `pnpm nexus:pin-bundles`, and `pnpm nexus:build-release` produces the payload the release
would ship. `tsx` runs the CLI entry points from source during development; `esbuild` bundles them
for release.

## Applications and libraries

- `apps/renderer/` — the issue-asset renderer. A small Node service that serves the mockups the
  filing stages publish, bundled with `esbuild` for either a long-running listener
  (`src/listen.ts`) or a Lambda Function URL (`src/lambda.ts`).
- `libs/portable-tools/` — the CLI itself: concept-store validation, the atlas generator, the release
  packer and the component installer.
- `libs/teaching/` — the teaching stage: the roadmap and plan surface, the workbook store and its
  renderer, the drill widgets and the `nexus workbook` verb. It is reached through exactly one
  import from the CLI, and depends on nothing in `libs/portable-tools/`, because it is leaving for a
  repository of its own (epic #677).
- `libs/delivery-config/`, `libs/epic-resolve/`, `libs/epic-verdicts/`, `libs/pr-acceptance/`,
  `libs/pr-worktree/`, `libs/record-digest/`, `libs/scope-razor/`, `libs/workspace/`,
  `libs/abs-doc-path/`, `libs/prose-verify/`, `libs/release-identity/` — the stage-facing libraries,
  one concern each.
- `libs/origin/` — the archived earlier generations of the pipeline, kept for provenance.

Libraries are **source-consumed**: their package `exports` point straight at `src/`, so consumers
import the TypeScript source and their own bundler compiles it. There is no per-library build step or
`dist/` output.

## Infrastructure

- **Monorepo**: Nx 23. `lint` and `typecheck` targets are inferred by the `@nx/eslint` and
  `@nx/js/typescript` plugins; `test` by `@nx/vitest`. Only `apps/renderer` declares explicit
  `nx:run-commands` targets, for its two bundles.
- **CI/CD**: none configured yet.

## Development

- **Package manager**: pnpm (workspaces; `pnpm-workspace.yaml` globs `libs/*` and `apps/*`)
- **Code quality**: ESLint 9 (flat config, `@nx/eslint-plugin`), Prettier 3
- **Testing**: Vitest 4. Node environment throughout, except the teaching-workbook specs, which
  render HTML and use `jsdom`.

## Commands

Run from the repository root:

```sh
npx nx run-many -t test --all       # the whole suite
npx nx run-many -t lint --all
npx nx run-many -t typecheck --all

pnpm nexus:validate-concepts        # the concept store's invariants
pnpm nexus:check-atlas              # docs/concepts.md matches the store
pnpm nexus:pin-bundles              # re-pin the release fingerprint
pnpm nexus:build-release            # build the payload a release would ship
```

## Related

- [Release procedure](../delivery/release-procedure.md) — how a version is cut.
- `CONTRIBUTING.md` — the authored component tree and the maintainer's loop.
