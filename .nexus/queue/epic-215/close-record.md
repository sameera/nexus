---
title: "Close Record: Retire the Member Close-and-Migrate Path"
epic: "#215"
feature: "Multi-Repo Workspaces"
date: 2026-09-11
nexus_version: 0.30.0
analyze: "ran 2026-09-09 @ 0aee4ea (local receipt; no PR machine block) — overridden: 1 critical / 0 high finding(s) open; stale — 1 commit (a merge of main) unanalyzed; waived 2026-09-11"
record: "#514"
record_hash: 515a3fcb841ae6f1a4b94fcb05eb82342396aceeb38c5dde26c02b63dc868139
range:
  - repo: github.com/sameera/nexus
    base: 05f96622db747798b040bf907091c881ba80c67c
    head: f1273e609d2f4bb5bfeea175777d62776c5a7ebd
---

# Close Record: Retire the Member Close-and-Migrate Path

## Key Decisions

- **The relocation tool is a module in `@nexus/portable-tools`, not a package of its own.**
  `queue-relocate.ts` has exactly one consumer, which is the command-line interface, and it reuses
  `parseRange` from `derive-entry-diff.ts` in the same package. A same-package relative import is
  simpler than a new package carrying its own `package.json`, `tsconfig` and exports map.
  *Refuted alternative:* a new `libs/queue-relocate` package. That shape matches `close-migration`
  and `pr-worktree`, which are one capability per package. It loses because it adds workspace
  configuration ceremony for a tool with a single consumer and no reuse pressure from anywhere else.

- **Stranded-entry detection reads the filesystem directly in `status.ts`.** `findStrandedQueueEntries`
  stats each present member's `.nexus/queue` directory and the hub's own queue, rather than adding a
  `queueEntries` field to `ResolvedMember` and `ResolvedWorkspace`. `ResolvedMember` is asserted
  against with `toEqual` throughout `resolve.spec.ts` and `manifest.spec.ts`, so a required new field
  there ripples into every one of those fixtures. The concern is specific to the status read-out, and
  record #514 names the status read-out as its home.
  *Refuted alternative:* compute the queue-entry list once in `resolveWorkspace` and keep `status.ts`
  a pure formatter. That is the cleaner layering. It loses because it forces an unrelated shape change
  onto every resolver consumer and test, for a value only the status command uses.

- **The role gate survives as a new `close-role.ts` rather than a moved `preflight.ts`.** The gate
  keeps all three role values, because the member value is what the re-aimed close refusal is written
  against. It loses the hub-location-and-branch lookup, whose only purpose was arming the deleted
  migration. Record #514's first Key Decision sanctions that loss directly.

- **The retired verb answers with a marker rather than a generic unknown-verb error.** `nexus
  close-migration` and its former `preflight` and `migrate` subcommands print one named refusal
  saying the path is retired and that a member epic now closes from the hub over its merged pull
  requests, then exit 1. The verb is listed as retired in the help output rather than as usable.
  *Refuted alternative:* ship no marker. That keeps the verb list honest about what exists and leaves
  nothing to retire later. It loses because the generic error names no replacement, and the lead's
  next move is to search a document deleted in the same release.

- **`identity.ts`'s member refusal quotes `nxs.close.md`'s wording verbatim.** An earlier analyze
  finding said the diagnostic still described the retired flow. The fix reuses the exact phrasing the
  command specification already gives the lead, rather than writing new prose for the same refusal.
  Two differently worded refusals for one retired flow is the problem the finding named.
  *Refuted alternative:* a shorter message local to `identity.ts` stating only that the flow is gone.
  It loses because the diagnostic is the only thing a `--pr` caller sees, so it needs the actionable
  next step and not just the negative fact.

## Deviation Rationale

- **The member pull-request-set lift did not ship (record #514, invariant 4 and Key Decision 3).**
  Record #514 decided that a pull-request set naming a declared member is accepted, and that the
  deletion and the lift are one change in one release where neither half ships alone. This diff ships
  the deletion alone. `libs/pr-worktree/src/identity.ts` still refuses a member pointer, and
  `range-list.ts` still refuses a member up front, so story #511's first acceptance criterion is
  unmet. *Why:* at implementation time #211, #212, #213 and #214 were all still open issues on this
  checkout. Record #514's own BLOCKER risk forbids lifting the refusal before the epic-addressed
  close-over-several-pull-requests flow exists, because a member epic would then have no correct
  close path and no refusal saying so. The engineer shipped the safe half and deliberately held the
  lift. The lift is filed as deferred scope below, and #213 and #214 have since merged.

- **The role gate's tests were rewritten rather than moved (record #514, invariant 1).** Invariant 1
  requires the three surviving modules to move with no change in behaviour and their existing tests
  to move with them rather than be rewritten. `identity.spec.ts` and `run.ts` did move verbatim, at
  100% rename similarity. `preflight.ts` and `preflight.spec.ts` were deleted, and `close-role.ts`
  and `close-role.spec.ts` were written fresh. *Why:* record #514's first Key Decision separately
  states the role gate loses its hub-location-and-branch block. A gate whose behaviour is reduced
  cannot carry forward tests written against the removed behaviour, so invariant 1 and that Key
  Decision are in tension inside the record itself. The implementation followed the Key Decision,
  which is the more specific statement.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #536 — a pull-request set naming a declared member is accepted by the close, so a member epic
  closes from the hub with no member-specific step.
- #537 — the retired verb marker and the one-shot relocation verb are both removed, in one
  changelog line, once the relocation has served its purpose.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-11-retire-member-close-and-migrate.md`
