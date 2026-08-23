---
feature: "Component Distribution"
---

# Component Distribution

How Nexus components and their tooling are packaged, installed, and addressed outside the repository they manage.

## Epics

- **Collapse the component-invoked TypeScript capabilities into verbs on one named executable** — [#247](https://github.com/sameera/nexus/issues/247)

## Running a verb from source

Every capability the `nexus` executable exposes as a verb (`deploy`, `workspace`, `abs-doc-path`,
`epic-resolve`, `record-digest`, `pr-worktree`, `close-migration`, `generate-atlas`,
`validate-concepts`, `derive-entry-diff`, `drift-advisory`, `seed-registry`) is reachable through
one command shape with no build step:

```bash
tsx libs/portable-tools/src/nexus-cli.ts <verb> [args...]
```

This runs the same dispatcher (`runNexusCli` in `libs/portable-tools/src/nexus-cli.ts`) the built
`nexus.mjs` executable runs — same registry, same usage text, same exit codes — under the
type-stripping runner instead of `node`. There is no separate source-side entry point or
verb-specific source command; editing a capability under `libs/` and rerunning it through this
same command shape picks up the edit immediately, since `tsx` transpiles and runs fresh every
invocation. The root `package.json` `nexus:*` scripts (`nexus:generate-atlas`,
`nexus:validate-concepts`, `nexus:drift-advisory`, `nexus:seed-registry`) are this same shape
under a shorter alias.
