## 2026-08-26 — Published under a scoped name

- **Choice:** `@sameera/nexus`, with `publishConfig.access: public`.
- **Why:** The bare name `nexus` is taken on the public registry; the scope matches the repository owner, so the package name and the source are the same identity.
- **Refuted alternative:** An unscoped invented name (`nexus-pipeline`, `nxs`), which would make the package name and the project name diverge.

## 2026-08-26 — The workspace root manifest is the published manifest

- **Choice:** Publish the root `package.json` itself; move the app runtime dependencies (express, react, node-pty, ws, …) down into `apps/prime/package.json`.
- **Why:** The epic names the root manifest as the thing that is private, unversioned and binary-less. Leaving the app dependencies there would have every adopter fetch React and a native terminal binding to run a planning toolkit, contradicting "nothing is fetched at install time beyond the package itself".
- **Refuted alternative:** A second, publish-only manifest under `libs/`, which would give the release a second version identity to keep in step with `VERSION`.

## 2026-08-26 — The published parts are staged into one release tree

- **Choice:** `pnpm nexus:build-release` stages the bundle, the Python toolkit and the component payload under `dist/`; the manifest's `files` names `dist` and `VERSION`.
- **Why:** Both toolkits resolve the release version by walking up from their own file position. Staging them at a known depth under one package root is what makes that walk land on the same `VERSION` for both halves.
- **Refuted alternative:** Publishing the files where they sit in the checkout (`libs/gh-toolkit/`, `.claude/`), which puts the two halves at different depths under different roots.

## 2026-08-26 — The shebang lives in the esbuild banner

- **Choice:** `buildBundle` emits `#!/usr/bin/env node` as part of the banner; the five launcher sources drop their own `#!/usr/bin/env tsx`.
- **Why:** The bytes the fingerprint pin records must be the bytes that ship. Prepending the shebang while staging would make the released file differ from the pinned build. Two shebangs in one output is a syntax error, so the entry-file ones had to go.
- **Refuted alternative:** Prepending the shebang in the release-tree writer, which breaks the pin↔artifact identity the parity gate depends on.

## 2026-08-26 — The entry guard compares real paths

- **Choice:** `isDirectRun()` resolves both `import.meta.url` and `process.argv[1]` through `realpath` before comparing.
- **Why:** A package manager links a declared binary onto the caller's path as a symlink, so an installed run names the link while the module knows its resolved location. The old string comparison made the installed executable exit 0 having done nothing.
- **Refuted alternative:** none.
