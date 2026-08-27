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

## 2026-08-26 — The payload filter is a denylist of categories

- **Choice:** `PAYLOAD_IGNORE` names the incidental categories (`__pycache__`, `*.pyc`, `tests`, `test_*.py`) rather than allowlisting the files that ship.
- **Why:** A new capability module must ship the moment it is written and a new test file must never ship. Naming the categories gives both; an allowlist gives neither without an edit each time.
- **Refuted alternative:** An explicit manifest of shipped files, which would silently omit any module someone forgot to add.

## 2026-08-26 — The payload is one pin entry covering both parts

- **Choice:** One `payload` key over the Python toolkit *and* the component tree, replacing the `claude-components` key.
- **Why:** The story requires the pin to be one bundle entry plus the payload entry, and the Python toolkit is now part of what ships — a pin that covered only the components would leave half the payload unguarded.
- **Refuted alternative:** A third key for the toolkit, which contradicts the stated pin shape.

## 2026-08-26 — Ordering is by code unit, not locale

- **Choice:** The canonical manifest sorts staged paths with a code-unit comparison instead of `localeCompare`.
- **Why:** A locale-sensitive comparison makes the manifest order — and so the fingerprint — a property of the machine, which is exactly what the story removes.
- **Refuted alternative:** none.

## 2026-08-26 — Byte-code is suppressed at the entry point

- **Choice:** `bin/nexus-gh` sets `sys.dont_write_bytecode = True` before importing anything.
- **Why:** It is the one place every capability passes through, so no capability can forget it. Excluding byte-code from the payload alone would still leave `__pycache__` in the repository a stage ran against.
- **Refuted alternative:** Exporting `PYTHONDONTWRITEBYTECODE` from the callers, which every new caller would have to remember.

## 2026-08-26 — The five launchers are deleted, not just unbuilt

- **Choice:** Removing the five entry points from `ENTRY_POINTS` also deletes the launcher sources, and every spec that ran one now runs the dispatcher with the matching verb.
- **Why:** Nothing referenced them except as bundle entry points. Left in place they would be unreachable files that still look like entry points.
- **Refuted alternative:** Keeping them as unbuilt sources, which leaves dead code claiming a process boundary that no longer exists.

## 2026-08-26 — A diagnostic payload manifest sits beside the pin

- **Choice:** `payload-manifest.json` records a per-file content hash; the pin keeps its two entries and remains the sole pass/fail authority.
- **Why:** A single payload digest can only report that something moved. Naming *what* differs needs per-file evidence, and writing it in the same step as the pin means the two can never describe different runs.
- **Refuted alternative:** Expanding the pin into a per-file structure, which would break the stated "one bundle entry plus the payload entry" shape.
