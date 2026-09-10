## 2026-09-08 — Relocation tool lives in portable-tools, not a new package

- **Choice:** `relocateQueue` is a new module in the existing `@nexus/portable-tools` package
  (`queue-relocate.ts`), wired into `nexus-cli.ts`'s verb registry, rather than a new standalone
  `libs/queue-relocate` package.
- **Why:** portable-tools already holds every other CLI-facing feature module that isn't itself
  a shared library dependency of several packages (derive-entry-diff, handoffs, workbook-store,
  …); the relocation tool has exactly one consumer (the CLI) and reuses `parseRange` from
  `derive-entry-diff.ts` in the same package, so a same-package relative import is simpler than a
  new package with its own package.json/tsconfig/exports map.
- **Refuted alternative:** a new `libs/queue-relocate` package. Matches the shape of
  `close-migration`/`pr-worktree` (one capability, one package), but adds workspace-config
  ceremony for a tool with a single consumer and no reuse pressure from elsewhere.

## 2026-09-08 — Stranded-entry detection reads the filesystem directly in status.ts, not through resolveWorkspace

- **Choice:** `findStrandedQueueEntries` (in `libs/workspace/src/status.ts`) stats each present
  member's `.nexus/queue` directory and the hub's own queue directly, rather than adding a
  `queueEntries` field to `ResolvedMember`/`ResolvedWorkspace` in `resolve.ts`.
- **Why:** `ResolvedMember` is asserted against with `toEqual` throughout `resolve.spec.ts`,
  `manifest.spec.ts`, and other consumers; adding a required field there ripples into every one
  of those fixtures for a concern (a leftover queue entry) that is specific to the status
  read-out, not to workspace resolution itself. `status.ts` already owns presenting
  member-checkout state and is the one command decision record #514 names as the home for this
  check, so it can read the extra directories itself without widening the resolver's own
  contract.
- **Refuted alternative:** extend `ResolvedWorkspace`/`ResolvedMember` with the queue-entry list,
  computed once in `resolveWorkspace`. More "pure" (status.ts stays a pure formatter over the
  resolver's output), but it forces an unrelated shape change onto every resolver consumer and
  test for a value only the status command uses.

## 2026-09-08 — pr-worktree's member refusal is left in place; #211/#212/#213/#214 are still open

- **Choice:** Story #511 (retiring the close-and-migrate path) ships the library split, the CLI
  verb retirement, and the single-remover guard, but does **not** lift `pr-worktree`'s
  `member-unsupported` refusal (`libs/pr-worktree/src/identity.ts`) or otherwise change what a
  member repo can do in the `--pr` post-merge flow.
- **Why:** decision record #514's own BLOCKER risk states this epic must not merge until #213
  and #214 are in the tree, precisely because lifting the member refusal before the epic-addressed
  close-over-N-PRs flow exists would leave a member epic with no correct close path and no
  refusal saying so — worse than today. #211, #212, #213, and #214 are all still open issues on
  this checkout (verified via `gh issue view`), so the flow the lift hands off to does not exist
  here. Implementing the split/deletion/guard is safe and independently correct regardless of
  those predecessors' state; lifting the refusal is not.
- **Refuted alternative:** lift the refusal anyway, on the theory that the calling process (not
  this implementation) controls when the branch is pushed or merged. Rejected because the
  decision record's own stated harm is about a codebase state (the refusal's absence with no
  replacement flow present), not about merge timing alone — shipping the code change on this
  branch would misrepresent the acceptance criteria as met when the prerequisite behavior they
  depend on isn't buildable here yet.

## 2026-09-08 — identity.ts's member-unsupported wording now echoes nxs.close.md's hard-block text verbatim

- **Choice:** analyze-receipt's high finding said `libs/pr-worktree/src/identity.ts`'s comment and
  `member-unsupported` diagnostic still describe the retired close-and-migrate flow. Fixed by
  reusing the exact phrasing `components/commands/nxs.close.md` already gives the lead
  ("`/nxs.close` does not run inside a member repository. A member epic closes from the hub
  now, over its merged pull requests...") rather than writing new prose for the same refusal.
- **Why:** two differently-worded refusals for the same retired flow is exactly the problem the
  finding named (a lead bounced between two messages that disagree). Quoting the one
  `nxs.close.md` already settled on removes the second wording instead of adding a third.
- **Refuted alternative:** write a shorter, `identity.ts`-local message that just says the flow is
  gone without repeating the hub-close instruction. Rejected because the diagnostic is the only
  thing a `--pr` caller sees; it needs the actionable next step, not just the negative fact.
