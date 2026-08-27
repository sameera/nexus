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

## 2026-08-26 — The Python floor is 3.10, declared in `engines`

- **Choice:** `engines.python: ">=3.10"` beside the Node floor, plus `os: ["darwin", "linux"]`, and a readme Requirements section naming both.
- **Why:** 3.10 is the lowest interpreter the toolkit actually runs on — `create_epic.py` annotates a module-level assignment `str | None`, which 3.9 evaluates at import and rejects. Declaring a higher floor would exclude adopters for no reason. `engines` is where a reader looks for an interpreter floor even though the registry only enforces the Node key.
- **Refuted alternative:** Declaring 3.12 (the development machine's version), which states a support boundary no code requires.

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

## 2026-08-26 — The changelog's rules are executable, not editorial

- **Choice:** `checkReleaseEntry` enforces the entry's content — no commit subjects, file paths or library versions; a stage named when a component body changed; an explicit statement when nothing changed — and the suite runs it against the live entry.
- **Why:** The story exists because a release-day habit is exactly what fails silently. A rule the test suite enforces is one a release cannot be cut past.
- **Refuted alternative:** Documenting the rules in the release procedure only, which is what "a release-day habit" means.

## 2026-08-26 — The changelog lives on the releases page

- **Choice:** `CHANGELOG.md` in the repository is the source, and step 6 of the procedure pastes the section into the GitHub release for the tag.
- **Why:** The registry listing is a weaker changelog surface, and the two are not exclusive — Nexus lives in a git repository whichever channel installs it.
- **Refuted alternative:** Relying on the registry listing alone.

## 2026-08-27 — Reconciling with #257: the pin step keeps no copy half

- **Choice:** When merging `main` (which retired the pin step's `--tools-dir` copy half with the vendored tools directory, #257), the branch's payload abstraction survives and the copy half does not: `vendorBundles` builds, hashes the stated payload, writes the pin and its manifest, and `runCli` rejects every argument by name. Staging the payload into a release tree stays with `pack-release.ts`.
- **Why:** The two epics decided the same question from opposite ends — #257 removed *where* the artifacts were copied, #252 redefined *what* ships. Only the destination conflicted, and the release tree is now the one destination, so the pin step has no copy to make.
- **Refuted alternative:** Keeping `--tools-dir` on the pin step for a non-hub destination, which would restore a second staging path alongside `pack-release.ts` and reopen the "two artifacts ageing independently" cost #257 paid to remove.

## 2026-08-27 — The pin script keeps main's name, and the release procedure follows it

- **Choice:** Adopt `nexus:pin-bundles` (main's rename of `nexus:vendor-tools`) and repoint the branch's remediation hint, release procedure and its AC2 test at it.
- **Why:** The step no longer vendors anything, so the merged name is the accurate one; a release procedure naming a script that does not exist fails on release day.
- **Refuted alternative:** Restoring `nexus:vendor-tools`, which re-adds an alias whose verb the code has stopped doing.

## 2026-08-27 — Invariant 15 becomes an executable release-time gate, not procedure prose
- **Choice:** `pnpm nexus:release-gate` scans the shipped component bodies and fails on any `.claude/…` path the payload itself does not carry; the release procedure runs it as step 4, ahead of tag and publish.
- **Why:** The analyze receipt's high finding was that a releaser following the procedure walks straight from re-pin to publish; a runnable check that names the 27 offending lines stops them where prose would not, and it goes green by itself when the invocation-rewrite epic lands.
- **Refuted alternative:** A prose precondition only. Cheaper, but it is the release-day habit the executed-changelog decision already rejected once.

## 2026-08-27 — The gate's rule is "the payload does not carry this path", not "no path appears"
- **Choice:** Flag a `.claude/…` reference only when that file is absent from the shipped component set, so `tsx ./.claude/skills/nxs-record-digest/scripts/record_digest.ts` passes and `python3 ./.claude/skills/nxs-gh-shared/delivery_config.py` fails.
- **Why:** Invariant 15 is about reaching a *toolkit capability* by path. A path the payload carries resolves wherever the components are deployed; a path it does not carry is a capability that moved into a toolkit and can only be reached by the toolkit's name.
- **Refuted alternative:** Flag every in-repo path reference (71 hits). Simpler regex, but it fails on component-internal scripts that work fine after deploy, so it could never go green.

## 2026-08-27 — The changelog's coverage risk is accepted in writing rather than derived from the diff
- **Choice:** Record in the release procedure that the suite checks the entry's *language*, not its *coverage*, and hand the author `git diff --name-only <previous tag>..HEAD -- .claude`; do not derive `touchedComponentBody` / `changedStageBehaviour` from the release diff.
- **Why:** Record #334 offers both exits. There is no previous tag to diff against for the first release, and wiring the unit suite to git tag history makes it fail on a shallow or tagless checkout for a fact a human still has to judge.
- **Refuted alternative:** Derive the two context facts from the release diff and fail when the entry does not account for them. Stronger, but it needs a tag history the project does not have yet.
