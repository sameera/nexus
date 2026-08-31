---
title: "Close Record: Retire the Python runtime and fold the toolkit into one executable"
epic: "#354"
feature: "Component Distribution"
date: 2026-08-31
nexus_version: 0.1.0
analyze: overridden — 1 critical / 1 high finding(s) open; waived 2026-08-31
record: "#400"
record_hash: 0d9e8b47f4b63143d96a3da21165df1fe18066d310d5ac47eafb3207ae9c4c3d
range:
  - repo: github.com/sameera/nexus
    base: 92f56ea2c11078744a272eaa1ba52a37de35c2e1
    head: a6cf39d817c3cb82a6aaa2e5faacb81e96cd1fa8
---

# Close Record: Retire the Python runtime and fold the toolkit into one executable

Eight stories landed in one PR (#401), one commit each, in the corrected order record #400
adopted: the fold first, then the guard and manifest corrections, then the seam removal carrying
the acceptance-harness cut-over, then the payload deletion, the body rewrite, the name withdrawal,
and the gate cleanup last. Invariant 6 holds at every commit. The record's own decisions are not
restated here; what follows is what implementation decided or changed against them.

## Key Decisions

- **The folded resolver's subverbs are derived from its dispatch table, while the three
  pre-existing subverb lists stay hand-maintained.** `CONFIG_SUBVERBS` is `Object.keys(CONFIG_COMMANDS)`,
  read from the table that dispatches those commands, so the gate composes the resolver's two-token
  dispatch names from the same value that produces its usage text. Invariant 7 demands exactly that,
  and the newly folded verb was the one place the epic was actively adding a surface, so it cost
  nothing to satisfy there. The workspace, pr-worktree and close-migration lists were left as literal
  string arrays: converting them would have touched verbs no story in this epic owned.
  *Refuted alternative:* hand-list the resolver's subverbs alongside the existing three, for
  consistency of style within the registry — rejected because it would introduce the hand-maintained
  copy invariant 7 forbids, in the one file the epic was adding to.

- **The release payload's ignore filter is emptied, not deleted.** `PAYLOAD_IGNORE` becomes `[]`
  while the filter and its call site survive. All four patterns it carried (`__pycache__`, `*.pyc`,
  `tests`, `test_*.py`) existed only to keep an interpreter's byte-code and an interpreter's tests
  out of the payload, and the tree that held them is gone — so retaining them would read to the next
  maintainer as though the payload still carried interpreter output. The mechanism stays so the next
  incidental category is named in the filter that already exists rather than in a new one.
  *Refuted alternative:* remove the filter, its constant and its call site outright, since nothing
  matches any more — rejected because the payload walk would then have no stated exclusion point, and
  reinstating one later costs more than an empty array does now.

- **The permission-grant test asserts the surviving entry's identity, not its count.** The
  withdrawal changed `expect(ALLOWLIST_ENTRIES).toHaveLength(2)` to
  `expect(ALLOWLIST_ENTRIES).toEqual(["Bash(nexus:*)"])`. A count assertion would pass if the wrong
  name were the one that survived, which is a live risk in a story whose whole subject is which of
  two names goes away.
  *Refuted alternative:* keep the count assertion and rely on the three-way byte-identity comparison
  across the install documentation, the upgrade notes and the install verb's output — rejected
  because that comparison proves only that the three surfaces agree, never that they agree on the
  correct name.

## Deviation Rationale

- **Invariant 14 breached — `README.md:17` still counts two permission entries (record #400).**
  The record assigns "the install and upgrade prose that counts executable entries" to #397, and
  invariant 14 gives each README span exactly one owning story. `README.md:278-287` was corrected to
  one entry; the Get Started summary at line 17 was not, so the shipped README states both counts.
  The enforcement that made the topic split safe to reason about — the three-way byte-identity check
  in `allowlist-docs.spec.ts:22-28` — slices the README from `# Installing` onward, and the Get
  Started summary duplicates the same claim above that line. The split the record reasoned about was
  correct; the check backing it was narrower than the claim it was protecting, so nothing failed.

- **#394's record-added live-run criterion is unmet, and its window is now closed (record #400).**
  The record required one live acceptance-harness run against the executable, in a scratch
  repository, recorded before the old implementation was deleted — naming that story as "the last
  point at which the superseded implementation still exists to compare against". The cut-over itself
  landed: `libs/pr-acceptance/src/scenario.ts` now drives `create-epic` and `create-story` through
  `tsx …/nexus-cli.ts` rather than spawning an interpreter. The run did not. The harness refuses to
  provision a scratch repository it could not tear down, and the credential carried no `delete_repo`
  scope; granting an account-wide irreversible scope and provisioning a real repository are both
  outward-facing acts the implementation run would not take unattended. The payload deletion was not
  held back for it, so the ported filers shipped on unit evidence alone and the comparison the record
  identified is no longer available.

- **The record's ADDRESS mitigation was skipped — the four scope edits were never written onto the
  filed story issues (record #400).** The record required the corrected sequence, the harness
  cut-over, the reduced gate criterion and the readme topic split be edited onto the affected issues
  before implementation started. #394's body still carries only its three original acceptance
  criteria. Implementation worked from the record directly rather than from the issue bodies, so the
  mitigation lost the only reader it had; the failure it guarded against — an engineer landing the
  original sequence from the filed criteria alone — did not materialise. The closed issues now
  understate what their stories actually owed.

- **Success metric 3 is not literally met — the epic-filer golden corpus names both the interpreter
  and the withdrawn binary (record #400).** `libs/delivery-config/src/epic-filer/corpus/epic-352.md:30`
  and its golden pair carry "`nexus-gh create-epic` … with no Python interpreter process spawned".
  The metric was written as a repo-wide grep over `libs/` and `components/`, and the epic's
  exemptions name `docs/delivery/lessons/` and `libs/origin/v1/` but not fixture content. The corpus
  is a frozen input whose byte-identity is the property under test, so editing it to satisfy the grep
  would defeat the test it exists to be.

## Deferred Scope

none

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-31-retire-python-runtime.md`
