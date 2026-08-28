---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Build the install, removal and migration verbs on one component-mirror primitive"
slug: install-remove-migrate-verbs
created: 2026-08-25
type: enhancement
complexity: L
complexity_drivers: [a destructive gated path over tracked files in repositories the user was not thinking about, config-directory resolution that exists nowhere today]
concepts: [portable-tooling, close-entry-migration]
link: "#253"
record: "#339"
record_state: closed
---

# Epic: Build the install, removal and migration verbs on one component-mirror primitive

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

The split was considered and declined: the migration verb ships in the same release as the install verb by decision, because shipping it later opens a window in which a repository holds two component sets with no remedy to name.

## Description

Exactly one Nexus component set exists per user account, at the Claude configuration directory. Getting there needs three operations: place the payload at that location, empty it again, and empty the committed copy every existing repository still carries.

Those are three call sites of one function that already exists. `deployComponents` mirrors a component payload into a target's `.claude/` and then removes every file under the managed subtrees whose first path segment carries the Nexus namespace prefix, leaving everything outside that namespace untouched. Its convergence property — a second run with no upstream change produces an identical set — is the property all three operations need. Install is that function against the configuration directory. Removal is that function with an empty payload. Migration is that function with an empty payload against a repository, with the namespace match widened by one path segment so that Nexus-named files sitting at the `.claude/` root are caught too.

The primitive's target is already a parameter, so the genuinely new work is elsewhere: resolve the configuration directory — which nothing in the toolkit does today — permit an empty payload, widen the namespace match by one path segment, add a verify-before-remove gate, print what the user must act on, and warn when two component sets resolve at once.

Two things this epic deliberately does not do. It writes no settings file — Nexus writes the components it owns and never the files that govern what those components are permitted to do. The deploy verb's own usage text already states that user-owned settings files are never touched, so a tool that documents that guarantee and then writes a permission entry has broken it. And it does not remove anything automatically. An automatic removal triggered by the first verb run would delete around forty tracked files in a repository the user was not thinking about, on whatever branch they happened to be on, mixed into their working diff — for a first external distribution, that spends the credibility the release is trying to earn.

**Terms used throughout.** The **install location** is the Claude configuration directory, resolved from `$CLAUDE_CONFIG_DIR` with `~/.claude` as the default — one per user account. Its **content** is either a copy of the release or a pointer at a checkout's authored tree. The **component payload** is the set of files the package ships; the **component set** is a copy of that payload sitting at a location. These are the only names used below for these things — in particular "shared install" is not one of them.

## Success Metrics

- After install, the component set exists at the resolved configuration directory, and no second set resolves from the repository a verb is invoked in. Nexus never scans the machine or an ancestor tree, so "nowhere else" is bounded to those two places (invariant 14).
- After removal, no Nexus-namespaced component file remains at that location.
- After migration, a repository carries no **tracked** Nexus-namespaced file under `.claude/` — including at its root — and the removals are left unstaged in the working tree for the owner to review and commit. Files git does not track are reported, not removed (record #339).
- No verb in this epic writes to any settings file.

## Story sequence

Story 1 lands the configuration-directory resolution and the install verb. Stories 2 and 3 are the primitive's other call sites and depend on it; Story 4 removes a call site and depends on it too. Story 5 depends on Stories 1-4, because its diagnostic fires when any verb runs. Story 6 documents what Story 1 prints and cannot be verified before Story 1 ships.

The rollup is **L**, carried by two drivers rather than by the story count: configuration-directory resolution that exists nowhere in the toolkit today, and a destructive path over tracked files in repositories the user was not thinking about. The sixth story exists because Story 3 was split, not because scope grew.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #313: The install verb places the payload at the configuration directory

**As an** adopter, **I want** one command that puts the components where Claude Code will find them, **so that** installing the package is followed by one explicit step and not by silence.

## Acceptance Criteria

- [ ] **Given** the package is installed and the install verb is run, **when** it completes, **then** the component payload is present at the Claude configuration directory, resolved from the configuration-directory environment variable with the home-directory default.
- [ ] **Given** the location already holds an older Nexus component set, **when** the verb runs again, **then** the location matches the new payload exactly, with Nexus-namespaced files no longer in the payload removed.
- [ ] **Given** the location holds files that are not Nexus-namespaced, **when** the verb runs, **then** those files are untouched.
- [ ] **Given** the verb is run with the flag that points the location at a checkout's authored tree, **when** it completes, **then** the location resolves to that checkout, and the install verb's own output names the checkout path it pointed at.
- [ ] **Given** the verb completes in either mode, **when** its output is read, **then** it prints the permission allowlist entry for each of the two named toolkits and states that it has written no settings file.
- [ ] **Given** the verb has run, **when** the account-level settings file at the install location and the local settings file at the current repository root are each compared with their prior content, **then** neither has changed.

## Notes

The primitive is `deployComponents` in `libs/portable-tools/src/deploy-components.ts`, and its target is already a parameter, already exposed as a flag on the deploy verb. The mirror-and-prune semantics are correct and tested and are not reimplemented.

**The genuinely new work is resolving the configuration directory.** Nothing in the toolkit resolves `$CLAUDE_CONFIG_DIR` or a home-directory default today — that resolution, its precedence and its failure modes are this story's actual substance, which is why it is M rather than S.

The second step is an explicit verb rather than a package-manager lifecycle script, deliberately: lifecycle scripts are blocked by default in the package manager this project uses and are commonly disabled in continuous integration, so a share of installs would end silently with no component set and no error. A silent partial install is worse than an explicit second command — particularly when the install has to print text the user must act on anyway.

One install location with two possible contents is what lets the maintainer's edit-and-rerun loop exist without an exemption the duplicate guard would have to carry.

### Story #314: The removal verb empties the installed component set

**As an** adopter uninstalling Nexus, **I want** a verb that removes the components, **so that** removing the package does not leave a component set behind that nothing tracks.

## Acceptance Criteria

- [ ] **Given** an installed component set, **when** the removal verb runs, **then** no Nexus-namespaced component file remains at the configuration directory.
- [ ] **Given** that same location holds files that are not Nexus-namespaced, **when** the verb runs, **then** they are untouched.
- [ ] **Given** the verb runs, **when** its output is read, **then** it states that it must run before the package itself is removed, and why.
- [ ] **Given** the install location points at a checkout's authored tree rather than a copy, **when** the removal verb runs, **then** it does not delete the checkout's files.
- [ ] **Given** removal is expressed as a mirror of an empty payload, **when** it runs, **then** it completes normally rather than failing on an absent payload directory — the primitive's throw-on-missing-directory behaviour is either satisfied or explicitly changed, and which is stated.

## Notes

Removal is the same primitive with an empty payload. The ordering — remove the components first, then the package — matters because the verb ships inside the package, and because the package manager has no record of a payload that was copied into the configuration directory. This is the same verify-before-remove ordering the close migration already uses.

AC4 is the sharp one: the checkout-pointing mode means the removal verb can be pointed at a maintainer's source tree, and deleting that would be catastrophic and silent.

### Story #315: A gated verb migrates a repository off its committed component set

**As a** repository owner, **I want** to remove the committed Nexus components deliberately, **so that** I am never surprised by tracked files disappearing from a branch I was working on.

## Acceptance Criteria

- [ ] **Given** the install location is empty or unresolvable, **when** the migration verb runs, **then** it removes nothing and reports that the components must be installed first.
- [ ] **Given** the install location is populated, **when** the verb runs, **then** it reports what that location holds — the resolved path and whether its content is a copied release or a pointer at a checkout — before it removes anything.
- [ ] **Given** a repository whose `.claude/` carries Nexus-namespaced files both under the managed subtrees and at its root, **when** the verb runs, **then** all of them are removed.
- [ ] **Given** that same repository carries files under `.claude/` that are not Nexus-namespaced, **when** the verb runs, **then** they are untouched.
- [ ] **Given** the verb completes, **when** the repository's git status is read, **then** the removals are unstaged working-tree changes and no commit was made, and the verb printed the git commands the owner may run.
- [ ] **Given** the verb completes, **when** the repository's ignore file is read, **then** it carries namespaced ignore entries for `commands`, `agents` and `skills` under `.claude/`, and no blanket ignore of `.claude/`.

## Notes

The verb's scope is deliberately wider than the deploy mirror's. The mirror matches only the first segment under a managed subtree; the verb also matches Nexus-namespaced files at the `.claude/` root, because repositories carry such files there and a migration that leaves them behind has not removed Nexus.

No blanket `.claude/` ignore, because that would hide an adopter's own components.

It builds no discovery of repositories on a machine, no dry-run flag, no per-file confirmation and no backup. The files are tracked, so git is the undo.

The verb ships in the same release as the install verb. Shipping it later would open a window in which a repository holds two component sets with no remedy to name.

There is no scheduled escalation from warning to refusal. Its target population is the repositories that exist now, and it cannot fire in the case it exists for — an old command body runs, invokes its old repository-relative script path, and never reaches any guard.

### Story #316: The workspace-init component deploy fan-out is retired

**As a** lead initialising a workspace, **I want** that step to stop deploying components into member repositories, **so that** it does not recreate the per-repository copies this refactor exists to remove.

## Acceptance Criteria

- [ ] **Given** the workspace initialisation path, **when** it runs, **then** it deploys no components into any repository.
- [ ] **Given** that path's output and prompt text, **when** they are read, **then** neither offers nor describes a component deploy.
- [ ] **Given** a lead initialises a workspace after this story, **when** they follow the output, **then** they are told that components come from the install location and are not deployed per repository.
- [ ] **Given** the rest of the workspace initialisation behaviour, **when** it runs, **then** it is unchanged — only the component fan-out is removed.

## Notes

This is a live code path, not dead code: the workspace-init verb currently fans `deployComponents` out across member repositories. Under replacement it has nothing to deploy.

It was carried inside the migration story as a seventh criterion, which made that story two deliverables and put a behaviour change affecting every workspace-init user inside a story about migrating one repository. It is separated here.

### Story #317: A duplicate component set is reported once

**As a** lead, **I want** to be told when two component sets resolve on my account, **so that** I learn about a collision the harness resolves by no contract and warns nobody about.

## Acceptance Criteria

- [ ] **Given** a repository-local Nexus component set and an installed one both resolve on the account, **when** any verb runs, **then** a diagnostic naming both locations is written once to standard error.
- [ ] **Given** the install location points at a checkout's authored tree, **when** the check runs, **then** no duplicate is reported, because the comparison is over resolved real paths.
- [ ] **Given** two accounts on one machine each hold a component set, **when** the check runs for either, **then** no duplicate is reported — the scope is the user account, not the machine.
- [ ] **Given** a duplicate is detected, **when** the verb finishes, **then** its exit code and its standard output are unchanged by the diagnostic.

## Notes

Two copies of one component on one account is a defect rather than a supported configuration, and a component cannot fix the collision, so the toolkit must report it.

This story depends on the verbs above existing, because its diagnostic fires when one runs.

Detection is the safety net, not the mechanism. The dangerous case — an old command body succeeding because its copy is right there, then running old code against a new store layout — never reaches this guard at all. That is why deletion in Story 3 is load-bearing and this story is not.

### Story #318: The allowlist entries are documented where an adopter will look

**As a** first-time adopter, **I want** the exact permission entry written down, **so that** I can grant the toolkit permission once for my account instead of being prompted per repository.

## Acceptance Criteria

- [ ] **Given** the install documentation, **when** it is read, **then** it carries exactly two allowlist entries — one per named toolkit — each in the trailing-wildcard prefix form that covers every verb and argument list with one entry, and each stated as belonging in the account-scoped settings file rather than a repository-local one.
- [ ] **Given** the upgrade notes, **when** they are read, **then** they carry the same two entries, byte-identical to the install documentation's.
- [ ] **Given** the install verb's printed output and the documented entries, **when** they are compared, **then** the text is the same.
- [ ] **Given** the documentation, **when** it is read, **then** it states that Nexus writes no settings file and that adding the entry is the user's action.

## Notes

The decision turns on a scope mismatch rather than on convenience. An interactive approval always saves to the repository's local settings file at the git repository root and offers the user no scope choice — so relying on the prompt yields a repository-scoped grant repeated once per repository, while the toolkit installs once per account. The documented account-scoped entry is not the cheap substitute for the prompt; it is the only path that yields a grant matching the install's scope.

Two uncertainties are recorded rather than resolved, because neither changes the decision: the prefix boundary the permission dialog chooses is undocumented, and whether a bare executable name and a pathed invocation match the same rule is undocumented. Both affect only how often a user who ignores the documented entry is prompted.

## Assumptions

- The configuration directory is the correct scope: the user account, not the machine. Two accounts on one machine holding two sets is correct rather than a defect.
- The package layout the install verb copies from exists, from #252.
- The two toolkit invocation names that the allowlist entries quote are fixed by #249. This epic consumes them and does not choose them.
- The `version` verb from #251 reports which of the two contents the install location holds. This epic's own ACs do not depend on it: the install verb names the path it pointed at in its own output, and the migration verb reports the install location's own state rather than a version. A slip in #251 does not block this epic.
- Old allowlist entries naming previous invocation strings are left alone, and the migration verb does not touch settings — a settings file is neither namespaced nor Nexus-owned. There are no accumulated entries naming the old strings to break.

## Out of Scope

- Writing any permission entry, with or without a consent gate. Refuted: the consenting form replaces a prompt from Claude Code with a prompt from Nexus and so removes no interruption, while the silent form needs the identical settings-file mechanism and lands the write where the user is least able to observe it.
- Automatic removal of a repository's committed set at the first run of any verb. Refuted on trust.
- A scheduled escalation converting the duplicate warning into a refusal. Refuted rather than deferred.
- Moving the Nexus repository's own authored tree — that is #256, which depends on this epic.
- A package-manager lifecycle script performing the install.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #313 | none |
| #314 | #313 |
| #315 | #313 |
| #316 | #313 |
| #317 | #313, #314, #315, #316 |
| #318 | #313 |
