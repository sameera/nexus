---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Retire the Python runtime and fold the toolkit into one executable"
slug: retire-python-runtime
created: 2026-08-30
type: enhancement
complexity: L
complexity_drivers: [two published-surface removals (the `nexus-gh` binary name and the `python` key of `nexus version`), a component-invocation gate that fixes the landing order of four of the eight stories and requires the fold to ship additively so the rewrite can follow it, eight stories with M dominant]
concepts: []
link: "#354"
record: "#400"
record_state: closed
---

# Epic: Retire the Python runtime and fold the toolkit into one executable

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep — the stub deferred at #354 was sized M for runtime-retirement alone, and the toolkit fold is what took it to L.

## Description

Nexus is published as one npm package that has, until now, carried two runtimes. The TypeScript half is bundled and run by Node; the other half was a Python package, `nexus_gh`, reached by spawning `python3` against a self-locating entry point. Three consecutive port epics have emptied that half: #351 moved the toolkit shell and the delivery-configuration resolver, #353 moved the story filer, and #352 moved the epic filer. Every capability the toolkit declares now runs in process, and the dispatcher's own registry records that no row delegates any more.

What remains is the scaffolding those ports left standing. The release still stages the whole `libs/gh-toolkit/` tree into `dist/`, so every adopter downloads Python modules nothing executes. The package manifest still declares a `python: ">=3.10"` interpreter floor and the readme still lists it as a requirement, so adopters are told to install a runtime the product no longer uses. The environment guard still probes `PATH` for `python3` and reports a defect when it cannot find one, and `nexus version` still publishes what it found. A delegation seam — the interpreter constant, the entry-point locator and the child-process call — sits unimported in the source tree. The component-invocation gate still recognises `python <script>` as an addressing form it must reject, and still classifies `nexus-gh` as the *Python* toolkit by name.

That last point is what turns a cleanup into a decision. `nexus-gh` exists as a second executable name for one reason: epic #247 collapsed every component-invoked TypeScript capability into verbs on the single `nexus` executable, and exempted this toolkit because it was written in another language and could not fold. That exemption is now void — the toolkit is TypeScript, bundled by the same builder, published from the same manifest. This epic closes it out. The four capabilities become verbs on `nexus`, the second binary name and its bundle are withdrawn, and every component body that names `nexus-gh` is rewritten to the one name. Adopters are left with a package that declares one runtime, ships only what it runs, and answers to a single executable.

## Success Metrics

- A built release tree contains no file with a `.py` extension and no `gh-toolkit` directory, and the published package manifest declares exactly one engine, `node`.
- The published manifest declares exactly one binary name, `nexus`; `nexus-gh` is absent from `bin`, from the bundle entry points, and from the release tree.
- No file under `libs/` or `components/` spawns, names, or documents a Python interpreter, and no source module retains a Python entry-point locator or delegation call.
- Every capability reachable as `nexus-gh <capability>` before this epic is reachable as a `nexus` dispatch name after it, and the component-invocation gate passes over the rewritten component set with no waiver added.
- The executable answers to exactly one dispatch name that reports release identity, whatever surface that name is listed on.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #392: The release payload stops carrying a Python tree

**As an** engineer adopting Nexus, **I want** the package I install to contain only files it executes, **so that** I am not downloading and storing a dead runtime's source.

## Acceptance Criteria

- [ ] **Given** a clean checkout, **when** the release payload is enumerated, **then** the returned set contains no entry whose staged path begins with `gh-toolkit/` and no entry whose name ends in `.py`.
- [ ] **Given** a built release tree, **when** its files are walked, **then** no `.py`, `.pyc` or `__pycache__` entry is present at any depth.
- [ ] **Given** the payload no longer carries interpreter artefacts, **when** the stated ignore filter is read, **then** the entries that existed only to exclude Python byte-code and Python tests (`__pycache__`, `*.pyc`, `tests`, `test_*.py`) are gone, and no remaining entry excludes a file the payload would otherwise ship.
- [ ] **Given** the payload set has changed, **when** the release gate compares the committed payload manifest and fingerprint pin against a fresh computation, **then** the two agree — the pin and manifest are regenerated as part of this story, not left to fail the next build.
- [ ] **Given** the `libs/gh-toolkit/` directory and the staged `dist/gh-toolkit/` copy, **when** the repository is searched after this story, **then** neither exists and no source module, test, or configuration file references either path.

## Notes

Three distinct artefacts are asserted over, and all three need it: the **payload set** is what the build declares it will stage, the **release tree** is the staged directory on disk, and the **published package** is the manifest's `files` allowlist over that tree. The first two can disagree — a stale entry left in the tree by a previous build is invisible to the declared set — so enumerating the set is not a substitute for walking the tree.

The payload's ignore filter is a denylist of incidental entries. Removing the Python-specific entries is part of the story rather than a follow-up: leaving `*.pyc` in a filter that can never match again is dead configuration that reads as though the payload still carries an interpreter's output. The committed `payload-manifest.json` and `bundle-fingerprint.json` are regenerated here, because the release gate compares them on every build and would otherwise fail red for a reason unrelated to whatever change came next.

Carries no ordering constraint against any other story in this epic.

### Story #393: The package declares one runtime, and the readme says so

**As an** engineer evaluating Nexus, **I want** the stated requirements to list only runtimes the product actually uses, **so that** I do not install Python to satisfy a floor nothing enforces.

## Acceptance Criteria

- [ ] **Given** the package manifest, **when** its `engines` block is read, **then** it declares `node` only and carries no `python` key.
- [ ] **Given** the readme's requirements section, **when** it is read, **then** it names Node as the sole required runtime and makes no claim that Python is needed, and the install line carries no Python version parenthetical.
- [ ] **Given** the readme's requirements section, **when** its runtime bullets are counted, **then** there is exactly one, and no sentence elsewhere in the readme describes the package as carrying "both toolkits" or as having two halves.

## Notes

Supported-platform statements (macOS and Linux, WSL on Windows) are unrelated to the interpreter and stay as written.

Carries no ordering constraint against any other story in this epic.

### Story #394: The delegation seam is removed from the source tree

**As a** maintainer, **I want** no code that can reach a Python process, **so that** a future change cannot quietly restore a dependency the release has dropped.

## Acceptance Criteria

- [ ] **Given** the delivery-configuration source, **when** it is searched after this story, **then** the interpreter constant, the entry-point candidate list, the entry-point locator, and the delegation call and its process seam are all absent, along with their tests.
- [ ] **Given** the two filer cut-over test suites, which assert against the interpreter by importing its name, **when** they run after this story, **then** they still assert that no interpreter is spawned on any path, expressed without importing a constant that no longer exists.
- [ ] **Given** the whole repository, **when** it is searched for a child-process invocation naming a Python interpreter, **then** the only matches are in historical lesson documents under `docs/delivery/lessons/`, which are records of what happened and are not edited.

## Notes

The cut-over suites are the regression guard for the ports that just landed, so they are rewritten rather than deleted — the assertion they make is still worth making, it just cannot keep sourcing the interpreter name from a module being removed.

Carries no ordering constraint against any other story in this epic.

### Story #395: The environment guard and the version verb stop reporting on an interpreter

**As an** engineer diagnosing a broken install, **I want** the guard to name only defects that can actually stop Nexus running, **so that** a missing Python is not reported as a problem with a product that does not use it.

## Acceptance Criteria

- [ ] **Given** a machine with no `python3` on `PATH`, **when** any verb is dispatched, **then** no environment defect is reported on standard error and the verb's exit code is unchanged.
- [ ] **Given** the environment guard's source, **when** it is read after this story, **then** it contains no interpreter resolution and no interpreter defect, and the remaining defect — two component sets resolving on one account — is detected and reported exactly as before.
- [ ] **Given** `nexus version`, **when** it is run, **then** the JSON object it prints on standard output carries no `python` key, and no other key it carried before this story is removed or changed in meaning.
- [ ] **Given** the version verb's own usage text, **when** it is read, **then** it describes only the fields the verb still prints.

## Notes

This story only removes a key; it never blocks #396 from adding one. #397 withdraws the second binary outright, so the executable's `version` is the only release-identity surface that can survive the fold, and anything the decision record chooses to carry across from the narrower one arrives as an addition. The two stories are therefore unordered with respect to each other.

Dropping the `python` key is a breaking change to a published output contract, and is called out in the epic's description for that reason. It is the correct break: the key reported a runtime the release no longer has, so retaining it would mean reporting on something Nexus neither uses nor is responsible for.

### Story #396: The toolkit's capabilities become verbs on the one executable

**As an** author of a Nexus component, **I want** one executable name to reach every capability, **so that** I do not have to know which of two names a capability happens to live behind.

## Acceptance Criteria

- [ ] **Given** the executable's verb registry, **when** its dispatch names are listed — a *verb* being what a person types, a *dispatch name* being the complete verb-plus-subverb form the invocation gate resolves against, which is the distinction the registry already draws — **then** every capability the toolkit declared — the delivery-configuration resolver, the epic filer and the story filer — is present as a dispatch name, and each is reached with the arguments and flags it accepted before.
- [ ] **Given** any folded capability, **when** it is invoked through the executable with its own arguments, **then** its output, its exit code and its usage text are those it produced under the toolkit name, except that the program name it reports is the executable's.
- [ ] **Given** the executable and the toolkit each declared a capability for reporting release identity, **when** the dispatch names are listed after the fold, **then** exactly one name reports release identity and the other is gone.
- [ ] **Given** a capability that fails, **when** it is invoked through the executable, **then** it signals failure the same way it did before, with the same exit code.

## Notes

**This story is additive, and that is what keeps it separable from #398.** The verbs appear on the executable while the toolkit name goes on declaring the same capabilities, so for the length of this story both names resolve and the invocation gate passes over component bodies that have not been rewritten yet. #398 then rewrites the bodies against names that already exist, and #397 withdraws the second name once nothing points at it. Without that overlap the fold and the rewrite would have to land in one commit; with it, each story is shippable and verifiable on its own.

The two `version` surfaces overlap but are not identical: the executable's prints release version, component-payload fingerprint and install location, while the toolkit's prints release version alone, read through the same shared reader. Which one survives, and whether anything of the narrower one is retained, is a design decision for the record — this story requires only that exactly one survives. The machine-readable capability listing is a declared part of the surface for readers outside the build; whether it merges into the executable's own listing or is withdrawn is likewise the record's call, so long as exactly one dispatch name still reports release identity, which is what the final success metric checks.

### Story #397: The second binary name and its bundle are withdrawn

**As an** engineer installing Nexus, **I want** the package to put one command on my path, **so that** there is no second name that resolves to a subset of the same product.

## Acceptance Criteria

- [ ] **Given** the package manifest, **when** its `bin` block is read, **then** it declares `nexus` only.
- [ ] **Given** the bundle entry points, **when** they are enumerated, **then** exactly one entry is declared and no bundle is built from the toolkit's own entry module.
- [ ] **Given** a built release tree, **when** its files are listed, **then** no `nexus-gh.mjs` is present.
- [ ] **Given** the toolkit's own entry module, its dispatcher, its capability registry and its program-name helper, **when** the source tree is read after this story, **then** each is either removed or has no remaining importer, and no module outside the executable's own entry point is bundled.

## Notes

Sequenced after #396 and #398: the capabilities need somewhere to go before the name is withdrawn, and no shipped body may still point at it. This story is what ends the overlap #396 opened. The two-bundle arrangement existed because some package managers link a binary while others generate a shim that erases the invoked name; with one name that hazard disappears.

### Story #398: Every component body names the one executable

**As an** engineer running a Nexus pipeline stage, **I want** the commands a stage tells me to run to exist, **so that** a stage does not instruct me to invoke a binary the release no longer installs.

## Acceptance Criteria

- [ ] **Given** the shipped component set, **when** every code span in every body is scanned, **then** no invocation names `nexus-gh`.
- [ ] **Given** each rewritten invocation, **when** it is classified against the executable's declared dispatch names, **then** it resolves — no body names a dispatch name the executable does not declare.
- [ ] **Given** the component-invocation gate, **when** it runs over the rewritten component set, **then** it reports no problems and no waiver has been added to let a body pass.
- [ ] **Given** prose around a rewritten invocation that described the toolkit as a separate thing to be reached, **when** it is read after this story, **then** it describes one executable, so no reader is sent looking for a second name.

## Notes

Thirty-seven references across nine bodies: six pipeline stage commands and three skills. The component-invocation gate makes this verifiable rather than a search-and-hope, and it also fixes this story's position: the gate resolves a body's invocation against the live registry, so the names must exist before a body can name them. **Sequenced after #396, and separable from it** — because #396 ships additively, both names resolve while this rewrite is in flight, so an unrewritten body still passes the gate and this story can land on its own.

### Story #399: The component-invocation gate and the delivery documentation drop the interpreter

**As a** maintainer cutting a release, **I want** the gate and the procedure to describe the release that exists, **so that** I do not run a step against a test suite that is gone or rely on a check for a form that can no longer occur.

## Acceptance Criteria

- [ ] **Given** the component-invocation gate's addressing forms, **when** they are read after this story, **then** the interpreter-script form is gone from the closed set and from the legacy list, no leader token names a Python interpreter, and the form that recognised the second toolkit is gone with it.
- [ ] **Given** the gate after those removals, **when** it scans a body that names a repository-bound artefact by a form it still recognises, **then** it fails exactly as it did before — narrowing the form set removes no enforcement.
- [ ] **Given** the release procedure document, **when** it is read, **then** it contains no step that runs a Python test suite and no statement that the manifest or readme declares an interpreter floor.
- [ ] **Given** the live acceptance harness and its runbook, **when** they are read, **then** no scenario spawns an interpreter to reach a filer and no documented command pipes through one, and each such step names the executable instead.
- [ ] **Given** the feature's navigation index, **when** it is read, **then** no entry describes the toolkit as the Python toolkit.

## Notes

**Sequenced after #398.** AC1 removes the gate's recognition of the second-toolkit addressing form, which is exactly what lets an unrewritten body pass during #396's overlap. Landing this story while any body still names the old toolkit would fail the build. It is the last of the four order-constrained stories: 05 opens the overlap, 07 rewrites under it, 06 withdraws the name, 08 removes the gate's memory of it.

The runbook's two interpreter uses are incidental — a one-liner parsing JSON from harness output — and are replaced rather than removed, since the step they serve is still needed. The acceptance harness's two uses are load-bearing: it spawns the Python entry point directly by repository path to drive the filers, so it moves to the executable along with everything else. The feature index's stale wording is the epic-level counterpart to #398's prose criterion — the same claim, in the durable navigation surface rather than in a shipped body.

## Assumptions

- The three port epics (#351, #353, #352) are complete and merged, so no capability still needs a Python implementation to fall back to. The registry's own note that no row delegates is treated as the evidence for this.
- Lesson documents under `docs/delivery/lessons/` are historical records of epics that happened and are never edited to match a later state, so their references to the Python half stay as written.
- The vendored origin snapshot under `libs/origin/v1/` is an archived copy of a superseded component set, not part of what this release builds or ships, so its Python scripts are out of scope.
- Withdrawing the `nexus-gh` binary name is acceptable to break on. Nexus is pre-1.0 and its own component set is the primary caller; adopters holding scripts that call `nexus-gh` directly are outside the supported surface.

## Out of Scope

- Choosing which release-identity surface survives the `version` collision, and what becomes of the machine-readable capability listing. Both are design decisions for the decision record; Story 5 fixes only the outcome that exactly one survives.
- A deprecation shim that keeps `nexus-gh` resolving to the executable for a release or two. The assumption above is that the break is taken cleanly; if that is wrong, the shim is its own scope.
- Any change to what the capabilities do. This epic moves and deletes; a folded capability that behaved differently afterwards would be a defect, not a feature.
- Retiring `libs/origin/v1/`, which carries Python scripts of its own and is a separate question about how long an archived component set is kept.
- Backlog stub #365 ("Demonstrate that the retained Python filers file issues unchanged") describes a demonstration of a half this epic removes. Closing or rewriting it is a backlog-grooming action, not work inside this epic.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #392 | none |
| #393 | none |
| #394 | none |
| #395 | none |
| #396 | none |
| #397 | #396, #398 |
| #398 | #396 |
| #399 | #398 |
