---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Publish the release as one package carrying both toolkits, the component payload and the changelog"
slug: publish-one-package
created: 2026-08-25
type: enhancement
complexity: M
complexity_drivers: [new publish surface on a private manifest, payload hygiene, determinism, a release process that did not exist]
concepts: [portable-tooling]
link: "#252"
record: "#334"
record_state: closed
---

# Epic: Publish the release as one package carrying both toolkits, the component payload and the changelog

## Description

Nexus has never been published. Its root manifest is private and carries no binary declaration, no published-files list and no publish configuration; its version has sat at its initial value and has never been bumped, so the only identity that distinguishes one build from another is a content hash. An adopter who never clones this repository has nothing to install.

This epic makes one package. It carries the bundled TypeScript executable, the Python toolkit's files and the component payload together, under the single version #251 defines, on the public npm registry. Nothing is fetched at install time beyond the package itself: the payload travels inside it, so there is no network step after installation and no way for the two halves to reach different versions. The Python toolkit ships inside the same package rather than through a Python registry, because a second registry would mean a second version identity.

Three things the registry already solves would otherwise have to be built. Holding an explicit older version — the only way back from a regression once per-repository pinning is ruled out — is an ordinary registry command rather than a self-hosted index of every past release. Complete removal follows the registry's own file manifest rather than one Nexus writes and keeps correct. And the executable reaches the caller's path by inheritance, because whatever installed Node already put the global binary directory there, so Nexus edits no shell startup file and has no edit to reverse on removal.

The payload also has to become *defined* rather than *whatever is on disk*. The file walk that produces it applies no ignore filter: it currently sweeps up test files and gitignored byte-code, which makes the fingerprint machine-dependent — a clean checkout with no cached byte-code, or a different Python minor version, produces a different hash and fails the gate.

Finally, this epic carries the changelog, and that is bound work rather than release hygiene. Once the components leave every repository, an adopter no longer sees component changes in their own diff. That review surface is gone and nothing replaces it unless the changelog does — and of the three failure classes, the one that fails silently is a change in what a stage *decides*, which no version check can detect. The changelog is the only thing that can report it.

## Success Metrics

- One package, one version, carrying all three payload parts, installable from the public registry.
- The shipped payload contains no test file and no byte-code.
- The payload fingerprint is identical on two clean checkouts on different machines.
- Every published release carries a changelog entry describing behaviour changes to pipeline stages in adopter language.

## Ordering note

#253 and #256 are recorded as depending on this epic, and what they depend on is the **package definition** — the binary declaration, the published-files list, the payload hygiene and the deterministic fingerprint — because the install verb copies from an installed package directory and needs that layout to exist.

They do not depend on the registry publish. Packing the manifest and installing the resulting tarball globally produces the same installed package directory, so #253 and #256 can be built and dogfooded before anything is published. The tag, the publish and the changelog entry are the tail of this epic, not its precondition.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #308: The manifest declares a publishable package with two named binaries

**As an** adopter, **I want** one package I can install by name, **so that** both toolkits land on my path without my cloning anything.

## Acceptance Criteria

- [ ] **Given** the packed package is installed globally, **when** each of the two toolkit names is invoked from any directory, **then** it runs.
- [ ] **Given** the packed package, **when** its contents are listed, **then** every binary the manifest declares is present along with the Python toolkit's files and the component payload, and the manifest is no longer marked private.
- [ ] **Given** the manifest, **when** its version is read, **then** it is the single semantic version #251 defines, moved off its never-bumped initial value.
- [ ] **Given** a machine with no Nexus checkout, **when** the package is installed and a verb is invoked, **then** it succeeds without resolving any workspace package.

## Notes

Two binaries, because the TypeScript capabilities and the Python capabilities are two named toolkits. This is also why the documented allowlist content in #253 is two entries.

**One JavaScript bundle ships, not six.** The build currently produces six: `nexus` plus five standalone launchers (`generate-atlas`, `validate-concepts`, `derive-entry-diff`, `drift-advisory`, `seed-registry`). Since #247 those five are all reachable as verbs on `nexus`, and the only consumer that ever needed them as separate files was the vendored bundle, which #257 retires. Story 2 removes them from the build and the pin.

The Python half has no packaged entry point today — no manifest, no console script, only two `__main__` guards on skill scripts. #249 creates the entry point this story declares; if that ordering slips, this story's AC1 cannot pass.

AC4 is the real test of the whole refactor: it is what proves the payload carries nothing that only a Nexus checkout can supply.

### Story #309: The shipped payload is defined rather than whatever is on disk

**As a** maintainer, **I want** the payload to be an explicit set, **so that** the fingerprint means something and nothing incidental ships to an adopter.

## Acceptance Criteria

- [ ] **Given** the packed package, **when** its contents are listed, **then** no test file and no byte-code appears.
- [ ] **Given** two clean checkouts of the same commit on machines with different `python3` minor versions and no cached byte-code, **when** the payload fingerprint is computed on each, **then** the two are equal.
- [ ] **Given** the payload walk, **when** it runs, **then** it applies a stated ignore filter rather than sweeping the directory.
- [ ] **Given** a run of any pipeline stage in a target repository, **when** that repository is inspected afterwards, **then** no byte-code was written into it by the toolkit.
- [ ] **Given** the build's entry-point set, **when** a release is built, **then** it produces one JavaScript bundle rather than six, and the fingerprint pin carries one bundle entry plus the payload entry.

## Notes

Today the live set is 53 files: 13 gitignored `__pycache__` byte-code files and 10 committed `test_*.py` files ride along with the 30 that belong. The committed pin matches that hash, so the gate passes only on a machine whose cached byte-code happens to match. AC2 is what turns the gate from machine-dependent into meaningful.

The source-checkout-bound set that must not ship is already identified: the workspace imports, the type-stripping runtime, the repository's own scripts, the whole pull-request acceptance harness, and the test files and byte-code.

### Story #310: The parity gate checks what was released

**As a** maintainer, **I want** the fingerprint gate to compare against the released artifact, **so that** the check that protects the release is pointed at the release.

## Acceptance Criteria

- [ ] **Given** the parity gate, **when** it runs, **then** it rebuilds the bundle and recomputes the payload hash and compares both against the committed pin, and it consults no copy of either inside any repository.
- [ ] **Given** a payload that differs from what the pin records, **when** the gate runs, **then** it fails and names what differs.
- [ ] **Given** the gate's remediation message, **when** it is read, **then** it names an action that requires no writing into any repository.

## Notes

This story moved here from #257 during the cut-and-merge pass. It belongs with the goal that defines the artifact the gate must point at, not with the goal that deletes the old one.

**"Parity gate" here means the pin comparison**, not the executed-corpus diff that lives in the same module. `checkFingerprint` is what this story repoints; `diffRunResults` and `diffAtlasBytes` are a separate mechanism and are untouched.

#257 leaves the gate working against the pin and only removes the vendoring vocabulary from its remediation string. This story repoints it.

### Story #312: One tagged release publishes all three parts with an adopter-language changelog

**As an** adopter, **I want** each release to tell me what changed in how a stage behaves, **so that** I can review a change I no longer see in my own diff.

## Acceptance Criteria

- [x] **Given** a release is assembled, **when** its version identity is checked, **then** the check reports any disagreement between the VERSION declaration, the published manifest, the newest changelog entry and the git tag — one version named by all four, or a named finding per divergence.
- [x] **Given** the written release procedure, **when** someone who did not write it follows it end to end without asking a question, **then** a release is cut.
- [x] **Given** a release whose diff touched a component body, **when** its entry is read, **then** the entry states what a lead running that stage will now experience differently, naming the stage.
- [x] **Given** a release entry, **when** it is read, **then** every item names a pipeline stage or an adopter-visible behaviour, and none is a commit subject, a file path or a library version.
- [x] **Given** a release whose diff touched no component body and changed no stage behaviour, **when** its entry is read, **then** it says so explicitly rather than being absent.

## Notes

This story absorbed stub #260 during the cut-and-merge pass.

AC3 through AC5 are the load-bearing ones and are why this is a story rather than a release-day habit. Under the current arrangement an adopter sees every component change in their own repository's diff because the components are committed there; once they leave, nothing replaces that surface unless the changelog does.

The changelog lives on the project's releases page rather than in the registry listing. The registry is weaker on changelog surface, and that is not a real loss, because the two are not exclusive — Nexus lives in a git repository whichever channel installs it.

## Amendment (2026-08-27, from the epic #252 conformance gate)

AC1 originally read: *"Given a release is cut, when it is inspected, then one tag, one registry version and one releases-page entry all name the same semantic version."* It required a release to have actually been cut.

That cannot hold inside this epic. Decision record #334 invariant 15 forbids the tag and the public publish while a shipped component body still reaches a toolkit capability by an in-repository script path — the condition epic #250 removes. `pnpm nexus:release-gate` enforces it and is red today, naming twelve such references.

AC1 is therefore rescoped to what this story actually built and can prove: the identity **check** (`checkReleaseIdentity`), which compares the four declarations and reports divergence. Cutting the release — the tag, the registry publish and the releases-page entry — is re-filed as its own backlog stub, blocked by #250.

## Assumptions

- An install step is an acceptable prerequisite in any environment, including continuous integration and containers, so Nexus carries no second copy of the components for portability.
- The registry's global binary directory is already on the caller's path, placed there by whatever installed Node. Nexus edits no shell startup file.
- A server session started outside a normal terminal — the Prime case — resolves the toolkit by the same rule as a local shell, because it spawns a login shell on the same machine with the full environment. Prime supplies nothing and needs nothing here.
- The package's published name is a naming detail, decided during implementation rather than here.

## Out of Scope

- The install verb, the removal verb and the migration verb — that is #253. This epic makes the package they install *from*.
- The version identity and the writer stamp themselves — that is #251, which this epic consumes.
- Publishing the Python toolkit through a Python registry. Refuted: it would give the release two version identities.
- A release asset fetched by an installer script, and a versioned installer script served from the project. Both refuted on the version index, the removal manifest and the shell startup file edit they would each require.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #308 | none |
| #309 | #308 |
| #310 | #309 |
| #312 | #308, #309, #310 |
