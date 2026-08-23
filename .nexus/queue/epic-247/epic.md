---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Collapse the component-invoked TypeScript capabilities into verbs on one named executable"
slug: typescript-capabilities-as-verbs
created: 2026-08-23
type: enhancement
complexity: M
complexity_drivers: [ten capabilities move behind one argument dispatcher, the fingerprint pin and the executed-diff parity gate must stay green through every move, a capability leaves the shipped component payload, the ordering gate requires every verb to land before any invocation string changes]
concepts: [portable-tooling, pr-worktree, record-digest, distiller, workspace-resolution]
link: "#247"
record: "#277"
record_state: closed
---

# Epic: Collapse the component-invoked TypeScript capabilities into verbs on one named executable

## Description

Nexus ships its TypeScript capabilities in two shapes today, and neither one runs outside this repository. Eight skill scripts are TypeScript files that import `@nexus/*` workspace packages, so they resolve only through the pnpm symlinks into `libs/`. Five more capabilities are separate bundles that each carry a fresh copy of the same shared core. A repository that installs Nexus components therefore receives skill scripts it cannot execute, and a distributed artifact of 1,835 KB that covers 6 of the 13 capabilities.

This epic applies one rule to that set. A capability that any Nexus component body invokes becomes a verb on a single named executable. A capability that only the Nexus build or release process invokes stays a TypeScript file in this repository and never ships. Ten of the thirteen capabilities gain new verbs: three read-only resolvers, two that drive git worktrees, and the five the distiller invokes. Two more are already reachable as workspace verbs on that executable and need no work. The thirteenth is the pull-request acceptance harness. It gains no verb and leaves the shipped payload, because no component invokes it and it requires a git checkout of Nexus itself. The logic does not move. It already lives in `libs/`, so only each script's argument-parsing shim relocates into the verb table.

The value is reachability rather than size. Once every component-invoked capability answers to a verb name, a component can name the toolkit instead of a path, which is what the rest of the component-distribution work depends on. The size reduction the discovery measured arrives when the standalone entry points are removed, and that removal follows the invocation rewrite in #250 rather than happening here. The ordering is a gate, not a preference: a component that names a verb which does not exist yet fails when a pipeline stage runs, not when the toolkit is installed, so every verb lands and passes the parity gate first.

## Success Metrics

- All ten component-invoked TypeScript capabilities run as verbs on one named executable, on a bare `node` binary, in a checkout with no installed packages.
- Every verb produces the same standard output, the same standard error and the same exit code as the script or bundle it replaces, for every case in the committed corpus.
- The bundle fingerprint pin matches a freshly built bundle after every capability has moved.
- The pull-request acceptance harness is absent from the vendored component payload, and the payload fingerprint matches a fresh build of the managed component set.
- The single executable carrying all ten newly added verbs stays under 450 KB.
- A maintainer runs any verb directly from the TypeScript source, with no build step between an edit and the next run.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #272: The three read-only resolver capabilities run as verbs

**As a** Nexus maintainer **I want** the documentation-path, epic-resolution and record-digest capabilities reachable as verbs on the named executable **so that** a component can invoke them on a machine that holds no Nexus checkout.

## Acceptance Criteria

- [ ] **Given** a directory with no installed packages and no Nexus checkout, **when** the built executable is run on a bare `node` binary as `nexus abs-doc-path`, as `nexus epic-resolve` and as `nexus record-digest`, **then** each verb runs to completion and none of the three fails to resolve a module.
- [ ] **Given** each committed corpus case for the documentation-path capability, **when** the executed-diff parity harness runs `get_abs_doc_path.ts` under `tsx` and runs the `abs-doc-path` verb on a freshly built executable, **then** it reports no divergence in standard output, standard error or exit code.
- [ ] **Given** each committed corpus case for the epic-resolution capability, **when** the parity harness compares `epic_resolve.ts` against the `epic-resolve` verb, **then** it reports no divergence, including for the cases that print a named failure diagnostic on standard error.
- [ ] **Given** each committed corpus case for the record-digest capability, **when** the parity harness compares `record_digest.ts` against the `record-digest` verb, **then** it reports no divergence.
- [ ] **Given** the three verbs have landed, **when** the bundle fingerprint check runs, **then** the committed bundle fingerprint pin matches the freshly built executable's hash.
- [ ] **Given** the executable is run with `--help` or with no verb, **when** the usage text is printed, **then** it names all three verbs and their required arguments.

## Notes

The logic already lives in `libs/`. Only each script's argument-parsing shim relocates into the verb table.

The existing script files stay in place. They are removed after the invocation rewrite in #250, because a component that still names a script path must keep finding one.

This story establishes how a verb is registered and how its parity coverage is written. The later verb stories follow that pattern.

### Story #273: The worktree and migration capabilities run as verbs

**As a** Nexus maintainer **I want** the pull-request worktree capability and the close-migration capability reachable as verbs **so that** the two stages that manage a git worktree stop depending on the target repository's Node toolchain.

## Acceptance Criteria

- [ ] **Given** a directory with no installed packages and no Nexus checkout, **when** the built executable is run on a bare `node` binary as `nexus pr-worktree` and as `nexus close-migration`, **then** both verbs run to completion and neither fails to resolve a module.
- [ ] **Given** each committed corpus case for the worktree capability, **when** the parity harness runs `pr_worktree.ts` under `tsx` and runs the `pr-worktree` verb on a freshly built executable, **then** it reports no divergence in standard output, standard error or exit code, and both runs leave the same worktrees present or absent.
- [ ] **Given** each committed corpus case for the close-migration capability, **when** the parity harness compares `close_migration.ts` against the `close-migration` verb, **then** it reports no divergence, including for the inputs the capability refuses.
- [ ] **Given** both verbs have landed, **when** the bundle fingerprint check runs, **then** the committed bundle fingerprint pin matches the freshly built executable's hash.
- [ ] **Given** either verb spawns `git` or `gh`, **when** it runs from the built executable, **then** the spawned process receives the same arguments the TypeScript source form spawns it with.

## Notes

These two capabilities write to the filesystem and drive git, so parity must cover the effect as well as the output.

Extends #272, which establishes the verb registration and parity pattern.

### Story #274: The five distiller capabilities run as verbs

**As a** Nexus maintainer **I want** the atlas, validator, entry-diff, drift-advisory and registry-seeding capabilities reachable as verbs on the same executable **so that** the distiller stops needing one bundle per capability and one invocation string per install shape.

## Acceptance Criteria

- [ ] **Given** every case in the committed corpus, **when** the built executable is run as `nexus generate-atlas`, `nexus validate-concepts`, `nexus derive-entry-diff`, `nexus drift-advisory` or `nexus seed-registry`, **then** each verb prints the same standard output and exits with the same code as the standalone `<name>.mjs` artifact it replaces.
- [ ] **Given** the atlas verb and the registry-seeding verb write files, **when** they run from the executable over the corpus, **then** the bytes they write are identical to the bytes the standalone `<name>.mjs` artifact writes.
- [ ] **Given** the entry-diff capability, which has no executed-diff coverage today, **when** the parity harness runs it, **then** the harness compares the TypeScript source against the built form over at least one corpus case and reports no divergence.
- [ ] **Given** the five distiller verbs have landed, **when** the bundle fingerprint check runs, **then** the committed bundle fingerprint pin matches a fresh build of every entry point it covers.

## Notes

The five standalone entry points keep building in this story. Removing them is blocked on the invocation rewrite in #250, because the distiller command still names `.nexus/tools/generate-atlas.mjs` and `pnpm nexus:generate-atlas` in its body. The distributed-artifact size reduction the discovery measured arrives at that removal, not here.

Extends #272, which establishes the verb registration and parity pattern.

### Story #275: The acceptance harness leaves the shipped component payload

**As a** Nexus maintainer **I want** the pull-request acceptance harness out of the vendored component payload **so that** an adopter never receives a capability that only runs inside a Nexus checkout.

## Acceptance Criteria

- [ ] **Given** a freshly vendored component payload, **when** its file list is inspected, **then** it contains no file belonging to the acceptance harness.
- [ ] **Given** the harness now lives outside the three vendored component subtrees, **when** a maintainer follows the acceptance runbook, **then** the runbook names that location and the command that runs the harness there.
- [ ] **Given** the vendored component payload has changed, **when** the payload fingerprint check runs, **then** the committed payload fingerprint pin matches a fresh hash of the vendored component payload.
- [ ] **Given** the harness in its new location, **when** it is run inside a Nexus checkout, **then** it provisions, drives and tears down its scenarios exactly as it does today.

## Notes

The harness gains no verb. No component body invokes it, and it archives the Nexus checkout it walks up to find, so it cannot work from an installed toolkit.

The requirement is that it sits outside the three vendored component subtrees. Which directory it lands in is an implementation choice for the decision record.

### Story #276: A maintainer runs any verb from the TypeScript source

**As a** Nexus maintainer **I want** to run any verb directly from the TypeScript source **so that** editing a capability and rerunning it does not gain a build step.

## Acceptance Criteria

- [ ] **Given** the contributor documentation, **when** a maintainer reads it, **then** it states one command shape that runs any verb from the TypeScript source.
- [ ] **Given** a Nexus checkout with packages installed, **when** the maintainer runs a verb through that command shape, **then** the verb produces the same standard output and the same exit code as the built executable for the same arguments.
- [ ] **Given** the maintainer edits a capability in `libs/`, **when** they rerun that verb through that command shape, **then** the edited behaviour takes effect with no rebuild of the executable.
- [ ] **Given** a verb name that does not exist, **when** it is run through that command shape, **then** the same usage text and the same exit code are produced as the built executable produces.

## Notes

The parity harness already runs the source under `tsx` at build time, so this path exists and needs to be kept and documented rather than invented.

This story is the mitigation the runtime-shape decision named load-bearing for its recommendation. It covers the whole verb table, so it follows #273 and #274.

## Assumptions

- The verbs keep each capability's current argument names, output shape and exit codes. Changing any of them would break the components that still invoke the script or bundle form, and no component is rewritten in this epic.
- Verb names are flat and carry no compatibility tiering. The version-pinning decision refused a public and internal split, because the release has no consumer outside itself.
- The bundle keeps inlining its one third-party dependency, so no verb introduces a package install at run time.
- Every verb resolves the repository it acts on the way its script does today. Replacing the six target-root conventions in use is #248 and happens after this epic.
- A verb that spawns `git` or `gh` keeps doing so. Those are external programs, not bundled code.

## Out of Scope

- Rewriting any component body to name a verb instead of a script path or a bundle path. That is #250, and it must follow this epic, because a component naming a verb that does not exist fails inside a running pipeline stage.
- Deleting the eight TypeScript skill script files and the five standalone bundle entry points. Both deletions are blocked on the invocation rewrite, and both belong with it. The distributed-artifact size reduction the discovery measured arrives at that point.
- Making the Python capabilities reachable by name. That is #249. The Python toolkit stays a second named toolkit, and Nexus requires both `node` and `python3`.
- Passing the target root explicitly instead of reading the working directory. That is #248.
- The version identity, the writer stamp and the build-time gate that checks every invocation string against the declared verb set. Those are #251 and #250.
- Publishing the release, installing it, and removing it. Those are #252, #253 and #254.
- Retiring the hub's vendored tools directory. That is #257.
- The stale component archive at `libs/origin/v1/.claude`. Issue #60 already rules it out of the managed set.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #272 | none |
| #273 | #272 |
| #274 | #272 |
| #275 | none |
| #276 | #273, #274 |
