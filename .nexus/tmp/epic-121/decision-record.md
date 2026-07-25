---
title: "Decision Record: GitHub Publishing Config"
epic: #121
feature: "Multi-Repo Workspaces"
rating: M
concepts: []
date: 2026-07-22
---

# Decision Record: GitHub Publishing Config

## Summary

This epic replaces every hard-coded or probe-by-failure GitHub-publishing decision
with one declared configuration block, resolved by a single shared resolver that all
four consumers — both issue-creation scripts, epic filing, and epic close — go through.
The design is deliberately conservative: with no block present, every consumer
reproduces today's issue outcome, with exactly one intended change (the epic fallback
label moves from a generic label to an epic-specific one, made safe by an idempotent
label upsert). The first fallback run persists the decisions it reached, so the fragile
probe runs at most once per repo.

## Chosen Approach

Extract the copy-pasted config reader into one resolver defined exactly once, imported
directly by both creation scripts and invoked by the non-script consumers, so no
consumer re-derives config by parsing settings on its own. The resolver applies one
precedence chain — an imperative invocation-time argument, then per-item frontmatter,
then repo settings, then workspace hub defaults, then built-in defaults — and returns
concrete decisions for classification mode, project target, and repo targeting. Two
producers keep the block populated: setup seeds it proactively at bootstrap with a human
present, and runtime write-back fills any still-absent keys the first time a repo falls
back, freezing only the gaps it filled and never touching a value the operator declared.

## Key Decisions

### One shared resolver, not the copy-paste status quo

- **Decision:** Define the config-resolution logic exactly once; both creation scripts
  import it from that single source, and the non-script consumers (epic filing and epic
  close) obtain resolved values by invoking that resolver rather than reading settings
  themselves.
- **Why:** The two verbatim copies are the drift mechanism this epic exists to kill — the
  settings-reader bug and the inconsistent issues-repo handling both lived in duplicated
  code. One definition is also the only way the four-consumer equivalence invariant can
  hold, and it gives the resolver direct unit tests independent of either script.
- **Refuted alternative:** Keep a private copy in each script and fix them in lockstep. It
  lost because "keep two copies in sync by discipline" is exactly what already failed here;
  nothing prevents the next divergence.

### Declared config, not probe-by-failure

- **Decision:** Move the classification, project, and repo-targeting decisions into
  declared config resolved before any GitHub call, so publishing consults intent instead
  of discovering it through API calls that may fail or return nothing.
- **Why:** Probing bakes in implicit assumptions — that the repo has org issue-types, that
  a project is auto-discoverable — that are false on a personal repo, the original trigger.
  Declared config makes personal-repo and org-repo publishing behave identically and stay
  reasonable offline.
- **Refuted alternative:** Keep probing but harden it (catch every failure, suppress
  warnings). It lost because it cannot distinguish "intentionally none" from "not found
  yet," so it re-probes forever and can never be reasoned about without a live API.

### Three-way classification mode, with `legacy-auto` mandatory

- **Decision:** Support an explicit types mode (apply the configured issue-type, no
  fallback label), an explicit labels mode (apply the configured label, no issue-type
  probe), and a legacy-auto mode that runs today's probe-then-fallback flow; legacy-auto
  is the built-in default when no block is present.
- **Why:** The explicit modes serve repos that have decided, but a repo with no block must
  still reproduce today's exact outcome — and today's outcome depends on whether the repo
  happens to have issue-types, which is itself a probe. Legacy-auto is that behavior named
  and preserved; it makes the "no regression when no block" guarantee true, and it is what
  write-back later freezes into a concrete types or labels choice.
- **Refuted alternative:** Only types and labels, defaulting to one when absent. It lost
  because either default silently changes the classification for the half of existing repos
  that would have resolved the other way — a regression this epic forbids.

### Project target as none | auto | explicit, with `none` first-class and silent

- **Decision:** Let the project target be none (no lookup, no add-to-project call, no
  warning), an explicit target (add to exactly that project, no discovery), or auto
  (today's discovery); auto is the built-in default when no block is present.
- **Why:** The personal-repo case genuinely has no project, and today that path emits a
  false-alarm "no project found" warning on every run and wastes a lookup. A first-class
  none encodes "intentionally no project" as a silent, warning-free, zero-call path.
- **Refuted alternative:** Treat a missing project as auto and merely suppress the warning.
  It lost because it still re-discovers on every run and cannot express deliberate absence —
  the operator can never turn the probe off.

### Precedence: invocation argument > frontmatter > repo settings > hub defaults > built-in

- **Decision:** Resolve every key most-specific-first. An imperative invocation-time
  argument (the project passed directly to epic filing today) stays the top override; then
  per-item frontmatter, then the repo's declared settings, then workspace hub defaults, then
  the built-in default.
- **Why:** The invocation argument is an explicit operator command for this run and must win,
  preserving today's behavior. Frontmatter is per-epic/per-story intent and must override a
  repo default for a one-off; a member repo must override a workspace-wide default locally;
  the built-in is the last resort that guarantees a value always exists. This chain is also
  what lets epic close stop ignoring the configured issues-repo — it now resolves that key
  the same way and targets the configured repo.
- **Refuted alternative:** Put repo settings above frontmatter (config-as-law). It lost
  because it removes the per-item override, which is the reason frontmatter exists.

### Split setup-time seeding from runtime write-back, keeping both

- **Decision:** Setup seeds the block proactively at bootstrap; runtime write-back fills
  still-absent keys on the first fallback run. Keep both, not one.
- **Why:** Setup has a human present, so it can resolve an ambiguous project (multiple
  candidates → ask before writing) and fall back to safe values when the CLI is unavailable,
  recording that it did — decisions no unattended run should make. But setup never re-runs on
  repos bootstrapped before this feature, so those would probe forever; write-back is the
  unattended safety net that closes that gap without a human.
- **Refuted alternative:** Write-back only, no setup seeding. It lost because it forfeits
  human disambiguation of ambiguous projects and only acts after the first fallback, rather
  than deciding up front when someone is watching.

### Write-back freezes only absent keys, and never pins "current repo"

- **Decision:** Write-back fills keys that were absent from the block and leaves every
  declared key untouched — an explicit auto keeps re-discovering, an explicit none stays
  none. When the resolved repo target is "the current repo" (no issues-repo declared),
  write-back leaves that key absent rather than pinning a concrete owner/repo.
- **Why:** A declared value is operator intent; freezing an explicit auto to its discovered
  concrete value would silently override an opt-in to re-discovery. Gap-filling is the only
  write that is always safe. Leaving the repo target absent keeps "current repo" meaning
  the current repo, so a later rename or move does not strand publishing on a stale
  pin — an absent key is the durable expression of "wherever this repo is."
- **Refuted alternative:** Persist all resolved values after every run, including pinning the
  current repo as an explicit target. It lost because it overwrites deliberate auto/none
  choices and pins a repo identity that breaks on rename — turning a convenience into a
  surprise.

### The one deliberate outcome change — epic fallback label — made safe by the upsert

- **Decision:** In the fallback (legacy-auto) path, the epic's fallback label becomes the
  epic-specific label instead of the generic one, and an idempotent label upsert guarantees
  the label exists before it is applied — the same mechanism story filing already uses for
  its label.
- **Why:** The generic label does not classify the issue as an epic and is asymmetric with
  the label the sibling story path applies. The upsert removes the only risk of the change —
  filing stranding on a label that does not yet exist — so the change carries no failure
  surface.
- **Refuted alternative:** Keep the generic label to avoid any behavior change. It lost
  because it is semantically wrong and asymmetric with the story path, and the upsert makes
  the correct label free of risk.

### Hub defaults inherited per key; epic and story repo targets resolved separately

- **Decision:** Workspace hub defaults merge into a member's resolution per key, not
  all-or-nothing. The epic-repo and story-repo targets are ordinary keys in the repo-level
  block resolved through the standard chain — a repo may declare them directly, and the more
  specific epic-repo/story-repo win over the general issues-repo, which is the fallback for
  whichever is unspecified. The target repo is resolved independently for the epic issue and
  for the story issues, and the epic issue lands in the hub when a member has no primary code
  repo.
- **Why:** A member that overrides one key must still inherit the rest from the hub;
  block-level replacement would force every member to restate the whole block and re-introduce
  the drift this epic fights. Keeping epic-repo/story-repo as repo-level keys (with per-key
  hub inheritance as fallback) means a member controls placement locally without depending on
  workspace-wide config. Separate epic/story targeting expresses the real workspace shape —
  epics as cross-cutting planning artifacts, stories in the code repo — and handles the member
  with no code repo at all.
- **Refuted alternative:** Treat the whole block as one inherited unit and use a single
  issues-repo for both epic and stories. It lost because it forces per-member duplication and
  cannot express "epic in hub, stories in member," breaking the no-primary-repo case.

## Constraints & Invariants

1. **Behavior-preservation parity:** with no configured block present, every consumer must
   reach the same issue type, label, project, and repo it reaches today — with the single
   exception of the epic fallback label default.
2. **Single source of truth:** the resolution logic exists in exactly one module; a search
   must find zero duplicate definitions, and no consumer re-derives config by parsing
   settings itself.
3. **Four-consumer resolution equivalence:** given identical config and frontmatter, both
   creation scripts, epic filing, and epic close must resolve any given key to the same value.
4. **Precedence order:** resolution is invocation argument > frontmatter > repo settings > hub
   defaults > built-in; the imperative invocation-time argument always wins, and each lower
   level is a fallback for the one above it.
5. **Write-back never overwrites declared keys:** it fills only keys that were absent; any
   declared value, including an explicit auto or none, survives untouched.
6. **Write-back never pins "current repo":** when the repo target resolves to the current
   repo, write-back leaves that key absent, so an absent target continues to mean "current
   repo" and survives a later rename or move.
7. **The `none` project path stays silent:** when the project target is none, no project
   lookup and no add-to-project call is made and no warning is emitted.
8. **Ensure-label idempotency:** the epic label is upserted before it is applied, so re-runs
   are harmless and filing never fails on a missing label.
9. **Per-key hub-defaults inheritance and repo-target specificity:** a member inherits each
   unset key from the hub defaults independently; the more specific epic-repo/story-repo win
   over the general issues-repo, which is the fallback for whichever is unspecified.
10. **Write-back preserves the rest of the settings file:** the block is merged in surgically,
    leaving unrelated sections, comments, and formatting intact — a runtime side effect must
    not rewrite or corrupt the file.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — write-back is a mutating side effect on a tracked config file:** runtime
  write-back edits the project settings file during issue creation or close, producing an
  uncommitted working-tree change while the operator may be mid-flow (the planning model
  commits nothing until close). Recommended decision: leave the change uncommitted and surface
  a clear "seeded config block — review and commit" message rather than staging or committing
  it automatically. The mitigation must also guarantee the surgical-merge invariant with a
  round-trip test, plus an assertion that the filed issue's outcome is unchanged by the write.
- **ADDRESS — the current config parser is lossy and read-only in spirit:** it handles only
  a shallow scalar structure and was never meant to write. Both runtime write-back and reading
  the workspace hub manifest push past what it safely supports. This forces a real
  dependency/team-capability decision: extend the hand-rolled read/merge/write carefully enough
  to satisfy the surgical-merge invariant, or adopt a real configuration-format library as a
  dependency.

## Open Clarifications

<!-- none — all three clarifications raised at the /nxs.hld gate were resolved and folded
     into the decisions and invariants above:
       1. invocation-time project argument stays the top override (Precedence decision / Invariant 4);
       2. epic-repo/story-repo are repo-level keys; specific keys win, issues-repo is the fallback
          (Hub-defaults decision / Invariant 9);
       3. write-back leaves the repo target absent, never pinning "current repo"
          (Write-back decision / Invariant 6). -->
