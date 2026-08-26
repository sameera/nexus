---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Make the Python toolkit reachable by name and let it find the executable by name"
slug: python-toolkit-by-name
created: 2026-08-25
type: enhancement
complexity: S
complexity_drivers: [four stories, three Python files repackaged, resolution replaced in both directions]
concepts: [portable-tooling]
link: "#249"
---

# Epic: Make the Python toolkit reachable by name and let it find the executable by name

## Description

Nexus keeps two toolkits. The TypeScript capabilities have collapsed onto one named executable; the Python capabilities are deliberately held out of that collapse and stay a second toolkit, because every import across the three Python files is standard library — there is no package install to fail and no resolver to supply, so the reason the TypeScript scripts could not ship as files does not apply to them.

Being held out of the collapse is not the same as being exempt from the addressing rule. A component names the toolkit it invokes and never encodes a path to it, and that rule covers every invocation regardless of runtime. Today the Python side satisfies neither half. The capabilities are reached through repository-relative script paths, several of which name `python` rather than `python3` and resolve only when the working directory happens to be the skill directory — broken already, independently of this refactor. And the Python side reaches back into the TypeScript executable by searching two candidate file paths inside a repository, one of which is a hop into a sibling hub directory.

This epic gives the Python capabilities one name to be invoked by, and replaces the candidate-path search with resolution by name. It changes no capability's behaviour. Two contracts that were bought with real debugging effort must survive it intact: the hub-defaults lookup degrades to an empty result rather than failing when anything goes wrong, and it spawns nothing at all for a single-repository checkout.

## Success Metrics

- The three Python capabilities are reachable through one name, with no repository-relative path and no dependence on the working directory.
- The Python side locates the TypeScript executable by name, and no code path enumerates candidate file locations for it.
- A single-repository checkout still spawns no subprocess during issue creation.
- Every failure mode of the hub-defaults lookup still yields an empty result rather than an exception reaching the issue-creation path.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #297: The Python capabilities answer to one name

**As a** component author, **I want** the Python capabilities reachable through a single name, **so that** a component body can invoke them without knowing where they live.

## Acceptance Criteria

- [ ] **Given** the named Python toolkit is on the caller's path, **when** it is invoked with each capability's name and that capability's arguments, **then** each of the three capabilities runs and produces output identical to the same invocation through today's script path, captured before the change as the baseline.
- [ ] **Given** the toolkit is invoked from a working directory that is not a skill directory and is not a Nexus checkout, **when** a capability runs, **then** it behaves identically to a run from any other directory.
- [ ] **Given** the toolkit is invoked, **when** the interpreter is selected, **then** it is `python3` and never a bare `python`.
- [ ] **Given** the toolkit is invoked with no capability name, or with an unknown one, **when** it exits, **then** it reports the available capability names and exits non-zero.
- [ ] **Given** the name chosen for the Python toolkit, **when** #250 rewrites invocations and #252 declares the binary, **then** all three use the same literal string, fixed by this story and recorded on its issue.

## Notes

The three capabilities are the shared delivery-configuration resolver, the epic filer and the story filer.

Whether the name is placed on the path *for an adopter* is #252's concern — the package manifest declares it. This story is what makes there be something for the manifest to declare and for #250 to name.

**How the path-dependent criteria are demonstrated at completion.** Nothing puts either name on the path today. These ACs are satisfied by an editable or packed local install, or by placing the entry point on `PATH` within the test — not by waiting for #252. State which was used when the story is signed off.

### Story #298: The Python toolkit finds its own files without the skill-directory layout

**As a** maintainer, **I want** the Python files to locate each other by their own packaging, **so that** the toolkit keeps working once it ships inside a package rather than under a skill directory.

## Acceptance Criteria

- [ ] **Given** the Python files are installed at a location that is neither a Nexus checkout nor a `.claude/skills/` tree, **when** any capability runs, **then** it imports the shared resolver successfully.
- [ ] **Given** the sources, **when** they are searched for `sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "nxs-gh-shared"))`, **then** neither of its two occurrences remains.
- [ ] **Given** a capability that accepts an explicit target root, **when** it is invoked without one, **then** it still falls back to the invoking working directory exactly as it does today.

## Notes

Today both filers reach the shared resolver by inserting `Path(__file__).resolve().parent.parent.parent / "nxs-gh-shared"` onto the import path — three levels up and across, which describes the skill-directory layout rather than the files' own relationship to each other. That layout stops being true the moment the toolkit ships in a package.

The discovery recorded that the shared resolver already locates itself from `__file__` and is the model for the rest. That is not accurate: `delivery_config.py` contains no `__file__` reference — it takes a target root and walks upward for config. The only `__file__` uses in the toolkit are the two sibling hops this story removes. Self-location is **introduced** by this story, not generalised.

The target-root fallback is #248's landed convention and must be preserved, not revisited.

### Story #299: The executable is resolved by name, with both guards intact

**As a** lead filing issues from any repository, **I want** the Python side to find the Nexus executable by name, **so that** the lookup works wherever the toolkit is installed and never depends on a copy inside a repository.

## Acceptance Criteria

- [ ] **Given** the executable is on the path, **when** the hub-defaults lookup needs it, **then** it is found by name, and no candidate file path inside any repository — including a sibling-hub hop — is consulted.
- [ ] **Given** a checkout that declares no workspace artifact, **when** issue creation runs, **then** no subprocess is spawned at all, as today.
- [ ] **Given** the executable is absent from the path, **when** the hub-defaults lookup runs, **then** it yields an empty result and issue creation proceeds, rather than raising.
- [ ] **Given** the executable is present but exits non-zero, **when** the lookup runs, **then** it yields an empty result and issue creation proceeds — and the exit code is inspected deliberately rather than passing only because unparseable output happens to yield the same result.
- [ ] **Given** the executable emits output that is not parseable as the expected object, **when** the lookup runs, **then** it yields an empty result and issue creation proceeds.
- [ ] **Given** the existing injectable runner used by the tests, **when** the suite runs, **then** every one of the failure modes above is covered by a test that fails if the guard is removed.

## Notes

The site is `_workspace_cli_command` in the shared resolver: it builds a candidate list of `.nexus/tools/nexus.mjs` inside the project, then optionally a sibling hub directory read from a member's hub pointer, and returns the first that exists.

Both properties this story protects are load-bearing and were stated as decisions rather than as implementation detail. The single-repository guard exists so the common case pays nothing; the degrade-to-empty contract exists so the hub layer can never break publishing.

The sibling-hub hop disappears rather than being ported, because a hub and a member now reach the same install by the same name.

**Known interval, accepted.** Between this story and #252 the name is not on an adopter's path, so the hub-defaults layer resolves nothing and — by AC3 — degrades silently to empty. That is correct behaviour for a layer that is best-effort by design, and the population affected is zero: no hub exists in any repository.

### Story #300: The toolkit's own callers reach the Python resolver by name

**As a** maintainer, **I want** the TypeScript libraries to find the shared Python resolver by name, **so that** they keep working once no repository carries a committed copy of it.

## Acceptance Criteria

- [ ] **Given** a target repository that carries no committed Nexus components, **when** a capability that needs the shared publishing resolver runs against it, **then** it resolves the resolver and succeeds.
- [ ] **Given** the TypeScript sources, **when** they are searched for a constant naming a repository-relative path to the shared resolver script, **then** there are none.
- [ ] **Given** the resolver cannot be found at all, **when** such a capability runs, **then** it reports the absent toolkit and names the remedy, rather than reporting a missing file inside the user's repository.

## Notes

Three sites build the path `<target-root>/.claude/skills/nxs-gh-shared/delivery_config.py` and shell out to it: `libs/epic-resolve/src/classify.ts`, `libs/pr-worktree/src/worktree.ts` and `libs/pr-worktree/src/git-fixtures.ts`. Two of them name the constant `RESOLVER_SCRIPT` and describe it in a comment as living in the checkout's *vendored component tree* — which is exactly the arrangement this refactor removes.

**This is a fourth class of invocation the parent epic's other goals do not cover.** #250 rewrites invocations inside component bodies; these are inside the toolkit's own TypeScript libraries, calling the toolkit's own Python half. They were found while gating #256, whose Story 2 deletes the very file these three read.

The direction is the mirror of Story 3: there, Python finds the executable by name; here, the executable's libraries find Python's resolver by name. Both stop reaching into a repository for a toolkit file.

## Assumptions

- `python3` is a prerequisite of Nexus alongside `node`, stated rather than probed. This was decided when the Python capabilities were held out of the collapse.
- Every import across the three Python files is standard library, so there is no third-party dependency to install and no package resolver to supply.
- No component reads a data file that ships beside a Python skill, so nothing beyond the code itself needs relocating.

## Out of Scope

- Rewriting the invocation strings in component bodies to use the new name. That is #250, which is blocked by this epic precisely because the name must exist before anything names it.
- Rewriting the Python capabilities into TypeScript so that one toolkit remains. Refuted: every import is standard library, so the rewrite would reduce the number of toolkits rather than enable the installation.
- Declaring the name in the package manifest or placing it on the path. That is #252.
- Excluding byte-code and test files from the shipped payload. That is #252's payload hygiene.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #297 | none |
| #298 | none |
| #299 | none |
| #300 | #297, #298 |
