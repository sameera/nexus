---
feature: "Component Distribution"
---

# Component Distribution

How Nexus components and their tooling are packaged, installed, and addressed outside the repository they manage.

## Epics

- **Collapse the component-invoked TypeScript capabilities into verbs on one named executable** — [#247](https://github.com/sameera/nexus/issues/247)
- **Reach project state through an explicitly passed target root** — [#248](https://github.com/sameera/nexus/issues/248)
- **Retire the hub's vendored tools directory** — [#257](https://github.com/sameera/nexus/issues/257)
- **Make the forge toolkit reachable by name and let it find the executable by name** — [#249](https://github.com/sameera/nexus/issues/249)
- **Rewrite every component invocation to name a toolkit, behind a build-time gate** — [#250](https://github.com/sameera/nexus/issues/250)
- **Give the release one version identity and a writer stamp** — [#251](https://github.com/sameera/nexus/issues/251)
- **Seed the project templates the pipeline stages read** — [#258](https://github.com/sameera/nexus/issues/258)
- **Publish the release as one package carrying both toolkits, the component payload and the changelog** — [#252](https://github.com/sameera/nexus/issues/252)
- **Build the install, removal and migration verbs on one component-mirror primitive** — [#253](https://github.com/sameera/nexus/issues/253)
- **Separate authoring from loading in the Nexus repository** — [#256](https://github.com/sameera/nexus/issues/256)
- **Port the toolkit shell and the shared delivery-config resolver to TypeScript** — [#351](https://github.com/sameera/nexus/issues/351)
- **Port the story filer to TypeScript** — [#353](https://github.com/sameera/nexus/issues/353)
- **Port the epic filer to TypeScript** — [#352](https://github.com/sameera/nexus/issues/352)
- **Retire the Python runtime and fold the toolkit into one executable** — [#354](https://github.com/sameera/nexus/issues/354)

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
