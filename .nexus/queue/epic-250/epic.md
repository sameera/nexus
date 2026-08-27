---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Rewrite every component invocation to name a toolkit, behind a build-time gate"
slug: invocations-name-a-toolkit
created: 2026-08-25
type: enhancement
complexity: L
complexity_drivers: [79 invocation sites across 23 bodies, three M stories, two toolkits with separate declared surfaces, a new build-time gate, partial migration is the default failure]
concepts: [portable-tooling, verb-reachability]
link: "#250"
record: "#325"
record_state: closed
---

# Epic: Rewrite every component invocation to name a toolkit, behind a build-time gate

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

The split was considered and declined: separating the build-time gate from the rewrites it protects reintroduces the partial-migration risk the gate exists to remove.

## Description

A Nexus component never encodes a path to the toolkit it invokes. It names the toolkit, and the toolkit resolves its own files from its own location at run time. That is the addressing rule the whole refactor rests on, and this epic is where it actually reaches the component bodies.

Today every invocation is a path. Forty-four TypeScript invocation sites across eight command bodies and seven skill bodies name a repository-relative script. Thirty-five Python sites do the same across six command bodies and two skill bodies, and twenty-three of those thirty-five name a bare `python` rather than `python3` — nine of them also naming a working-directory-relative script that resolves only when the working directory happens to be the skill directory. Nexus depends on no harness self-location variable to fix this: the only variable that reaches a command body is non-empty solely inside a plugin, which would make the entire distribution model conditional on the plugin system.

Rewriting strings is mechanical. What makes this an epic rather than a chore is that a partial migration is the default outcome across seventy-nine sites, and a missed site does not fail when the toolkit is installed — it fails when a lead is midway through a pipeline stage. So the rewrite ships with a gate: every toolkit invocation string in a shipped component body must resolve to a declared verb, checked at build time, on the same gate that already checks parity and the payload fingerprint.

That gate is also what makes an obligation legible that already exists and is currently invisible. Once components name verbs, the verb names, their flags, their exit codes and their standard-output shape are the interface between a repository and an installed toolkit. Command bodies already hard-code that interface; nothing checks it.

## Success Metrics

- No shipped component body contains a repository-relative path to a script or an executable.
- Every toolkit invocation in a shipped component body resolves to a name that the toolkit it addresses declares — the executable's verb registry for one, the Python toolkit's capability list for the other.
- A migrated body cannot regress: reintroducing a repository-relative path or a bare `python` fails the build.
- The build fails when a component names a verb that does not exist, and names the offending body and verb.
- No component invokes a bare `python`.

## Story sequence

Story 1 lands the gate first, against the sites as they are. Stories 2 and 3 then rewrite under it, so a missed or mistyped verb fails the build during the rewrite rather than after it. Story 4 depends on both rewrites.

## User Stories

### Story #301: The build fails when a component names a verb or capability that does not exist

**As a** Nexus maintainer, **I want** the build to reject a component that names an undeclared verb, **so that** a mistyped or stale invocation cannot reach an adopter and fail mid-stage.

## Acceptance Criteria

- [ ] **Given** a shipped component body that names a toolkit verb which the toolkit does not declare, **when** the build gate runs, **then** it fails, naming the component file and the undeclared verb.
- [ ] **Given** a component body naming a Python capability the Python toolkit does not declare, **when** the gate runs, **then** it fails, naming the component file and the undeclared capability.
- [ ] **Given** each toolkit's declared surface, **when** the gate reads it, **then** it reads that surface itself — the executable's verb registry and the Python toolkit's capability list — rather than a hand-maintained duplicate of either.
- [ ] **Given** an invocation written inside a fenced code block, **when** the gate runs, **then** it is checked; **given** a toolkit name mentioned in prose outside any fenced code block, **when** the gate runs, **then** it is not.
- [ ] **Given** the gate has run, **when** its inventory is read, **then** every fenced invocation in every shipped body appears in it, classified as resolving, undeclared, or not yet migrated.
- [ ] **Given** a body whose invocations have all been migrated, **when** a repository-relative path or a bare `python` is later reintroduced into it, **then** the gate fails — the migration cannot silently regress.

## Notes

The gate belongs on the existing parity and fingerprint gate rather than beside it — that gate already reads the payload and already fails the source-repo test run.

The executable's surface is `REGISTRY` in `libs/portable-tools/src/nexus-cli.ts`, which already derives its verb-name list (`VERB_NAMES`) rather than duplicating it. The Python toolkit's equivalent is the capability list #249 gives it — its entry point already has to report the available capability names when invoked with none, so the gate reads that rather than a second copy.

**The gate checks names, not flags.** Flags today exist only as prose inside each verb's multi-line usage string; there is no declared flag metadata to check against. Adding it would be a change to the registry's shape that this epic has no other reason to make, and prose-parsing the usage text would violate the read-the-surface-itself rule in AC4. Names are where the failure mode this gate exists for actually lives: a verb that does not exist fails immediately, while a bad flag fails inside a verb that at least ran and reported.

**What the gate does before the rewrite lands.** A path-form invocation names no toolkit, so it cannot name an undeclared verb — the gate reports it as *unmigrated* and lists it in the inventory, and unmigrated sites do not fail the build until Stories 2 and 3 declare their body done. That is what lets the gate land first and still produce a checklist rather than either an empty report or an immediately red build.

**The fenced-block rule is decided, not open.** The seventy-nine sites are not all instructions — some are illustrative examples in skill documentation. An invocation inside a fenced code block is an instruction and is gated; a toolkit name in running prose is not. The rule is stated so the exclusion is visible, because an unstated exclusion is exactly how a real invocation gets missed.

### Story #302: The TypeScript invocation sites name the executable

**As a** lead running any pipeline stage, **I want** every stage to invoke the toolkit by name, **so that** the stage works wherever the toolkit is installed and never depends on a path inside my repository.

## Acceptance Criteria

- [ ] **Given** any shipped command or skill body, **when** it is searched for a repository-relative path to a TypeScript file or a bundled executable, **then** there are no matches.
- [ ] **Given** each of the capabilities a component invokes, **when** the invocation is read, **then** it names the executable and a verb, and passes each value as its own argument rather than through an interpolated path.
- [ ] **Given** the build gate from Story 1, **when** it runs after this story, **then** it passes with no exclusions added to make it pass.
- [ ] **Given** a stage that previously carried a maintainer-only variant of an invocation for running from source, **when** its body is read, **then** the shipped body carries the named form only, and the from-source form lives in the repository's own documentation.

## Notes

Forty-four sites across eight command bodies and seven skill bodies. The count is the reason Story 1 precedes this one.

The maintainer's edit-and-rerun loop must keep a path that runs the TypeScript source directly inside the Nexus repository. That path already exists and is documented in this feature's own README; AC4 keeps it out of the shipped bodies rather than removing it.

Sites that name the retired vendored bundle are already gone — #257 deletes them, and this epic is blocked by it precisely so those strings are never rewritten and then discarded.

### Story #303: The Python invocation sites name the Python toolkit

**As a** lead running a stage that files issues, **I want** the Python capabilities invoked by name under `python3`, **so that** they resolve regardless of my working directory and regardless of what `python` means on my machine.

## Acceptance Criteria

- [ ] **Given** any shipped component body, **when** it is searched for an invocation naming a bare `python`, **then** there are no matches.
- [ ] **Given** any shipped component body, **when** it is searched for a path to a Python script — repository-relative or working-directory-relative — **then** there are no matches.
- [ ] **Given** each Python capability's invocation, **when** it is read, **then** it names the Python toolkit and the capability, in the form #249 established.
- [ ] **Given** a stage that invokes a Python capability, **when** it runs from a working directory that is not a skill directory, **then** the capability resolves and runs.
- [ ] **Given** the build gate from Story 1, **when** it runs after this story, **then** it passes over the Python invocations with no exclusions added to make it pass.

## Notes

Thirty-five sites across six command bodies and two skill bodies — nearly as many as the TypeScript rewrite, which is why this is sized M rather than S. The earlier figure of eighteen came from the stub and was measured wrong.

Most are already broken independently of this refactor: twenty-three of the thirty-five name a bare `python` rather than `python3`, and nine write a working-directory-relative script path that resolves only from inside the skill directory.

This story consumes what #249 built and is blocked by it — the name must exist before anything names it.

### Story #304: One invocation replaces the duplicated stage prose

**As a** lead reading a pipeline stage, **I want** each capability described once, **so that** two copies of one instruction cannot drift apart.

## Acceptance Criteria

- [ ] **Given** a stage body that described the same capability in more than one place, **when** it is read after this story, **then** that capability is described once.
- [ ] **Given** the shipped bodies, **when** they are searched for a passage that gives two alternative invocations of one capability for the reader to choose between, **then** there are none.
- [ ] **Given** a stage body that instructed the reader to choose an invocation based on the shape of their repository, **when** it is read, **then** it gives one invocation and no choice.

## Notes

The duplication this removes is what the hub branch and the single-repository branch produced between them. #257 deletes the hub branch; this story collapses whatever duplication survives that deletion within the single-repository prose.

This is the story that pays back the epic's own cost: the distill stage carried one instruction written twice in three separate places, and the two copies could diverge with nothing to catch it.

## Assumptions

- The toolkit is reachable by name on the caller's path. Placing it there is #252's manifest work; this epic assumes it and does not verify it.
- Both named toolkits exist before this epic rewrites anything: the executable from #247, the Python name from #249.
- The vendored-bundle invocation strings are already gone, from #257.
- Every value a component passes to a verb can pass as a discrete argument. No site depends on shell interpolation into a path that the named form cannot express.

## Out of Scope

- Adding, removing or changing any verb's behaviour. This epic changes how verbs are named, not what they do.
- Gating flags and argument shapes. The gate checks that a named verb or capability exists, not that its arguments are well-formed — there is no declared flag metadata to check against, and adding it is a registry change this epic has no other reason to make.
- Declaring the toolkit names in the package manifest or placing them on the path — that is #252.
- The permission allowlist entries the new invocation strings will need — those are documented and printed by #253.
- The from-source invocation path for the maintainer, which already exists and is not re-designed here.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #301 | none |
| #302 | #252, #301 |
| #303 | #252, #301 |
| #304 | #302, #303 |
