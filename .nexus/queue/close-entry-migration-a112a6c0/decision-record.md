---
title: "Decision Record: Close-Entry Migration to the Hub Queue"
epic: #49
feature: "Multi-Repo Workspaces"
rating: M
concepts: []
date: 2026-07-15
---

# Decision Record: Close-Entry Migration to the Hub Queue

## Summary

`/nxs.close` gains a cross-repo tail. After it writes the close record it stamps the exact diff
range into that record in every mode, then — only when the closing checkout is a workspace member —
commits the full closed entry into the sibling hub's queue and removes it from the code repo. The
move is migrate → verify → gated-remove, ordered so the only tolerable failure is a recoverable
duplicate, never a lost entry. Single-repo and hub closes keep today's behavior.

## Chosen Approach

Three seams are added to the existing close command, all keyed on the shared workspace resolver
rather than any new heuristic:

1. **Range stamping (unconditional).** When the close record is written, its frontmatter gains a
   range block: a list with one populated entry naming the home repo's identity, the base the
   branch forked from, and the branch head — both pinned to full commit SHAs, taken from the same
   branch diff the close-from-diff pass already computes.
2. **Role gate and fail-fast reachability (read-only preflight).** Close resolves its own role from
   the committed workspace artifact it carries: a hub pointer means "member" and arms the migration;
   a manifest means "hub"; neither means single-repo. In member mode, hub reachability is checked up
   front through the resolver so an unresolvable hub blocks before anything irreversible happens.
3. **Gated cross-repo move (at the existing closure checkpoint).** Migrate and remove are named in
   the Phase 7 closure checkpoint's "about to" list and executed after approval: copy the full
   working-tree entry into the hub checkout's queue and commit it there, verify that commit, then —
   strictly on that confirmation — remove the entry on the current code-repo branch and commit it,
   then perform the GitHub writes.

The deterministic parts (resolve the hub root, copy, commit in the hub, verify, gated remove) are
encapsulated in one small helper invoked the same way the existing workspace tooling invokes the
resolver — not as a portable-tools bundle and not as loose inline shell steps in the command prose.

## Key Decisions

### The cross-repo move is gated by the existing closure checkpoint, not run ahead of it

- **Decision:** Migration and removal are added to the existing Phase 7 closure checkpoint's "about
  to" list and executed after approval, before the GitHub writes — not performed earlier as
  unreviewed local work.
- **Why:** A hub commit and a branch removal mutate a second repository's working tree on disk. That
  is exactly the consequential, cross-boundary action the closure checkpoint exists to let a human
  see and approve. Folding it into the one existing gate keeps closure a single human decision, and
  hub reachability is already proven before the checkpoint so the move cannot surprise-fail there.
- **Refuted alternative:** Run migrate/remove before the checkpoint as "just more reversible local
  work," leaving the checkpoint to gate only the GitHub writes. Viable — the git operations are
  reversible — but it writes into a sibling repo silently, and "reversible" hides real cost: the
  engineer must know to reset the hub, which may hold unrelated uncommitted work. A separate
  dedicated checkpoint was also rejected: it doubles the interactive stops for one logical "commit
  the closure."

### Order is migrate → verify → gated-remove → GitHub; safe-failure ordering replaces atomicity

- **Decision:** Migrate the entry to the hub and verify the hub commit first; remove from the code
  repo only on that confirmation; do the GitHub writes last.
- **Why:** There is no cross-repo transaction, so the two commits cannot be atomic. The ordering is
  chosen by the asymmetry of failure cost: migrate-first means a migration failure leaves the entry
  fully intact in the code repo (removal never fires) — recoverable. The transient window where the
  entry exists in both places is local and bounded and never reaches any shared `main`, because the
  hub commit stays local and the code-repo removal rides the feature branch. GitHub writes go last
  so the "epic done" signal is sent only once the relocation succeeded.
- **Refuted alternative:** Close the GitHub issue first, then migrate. Viable (the command already
  tolerates an already-closed issue on re-run), but it declares the epic done before the entry is
  safely relocated; a later migration failure then leaves a closed issue over an un-migrated entry —
  more confusing than an open issue over an intact entry.

### The deterministic move lives in a helper, not a portable-tools bundle and not inline shell

- **Decision:** Encode the resolve/copy/commit/verify/gated-remove sequence as one ordinary helper
  script, consuming the resolver the way the existing workspace tooling does.
- **Why:** The portable-tools bundle exists to give a runtime-poor docs hub offline, install-free
  copies of distillation's checks. Close runs in the code repo, which already has git and a
  toolchain, and the move is plain git and filesystem work with no inlinable dependency — the
  compile/vendor/parity machinery buys nothing and would wrongly place migration logic in the hub.
  But the sequence is safety-critical and order-dependent (verify before remove, commit or roll
  back), so encoding it as code makes the gating structural instead of prompt-dependent — the same
  "mechanics as code, judgment as prompt" split the distiller already follows.
- **Refuted alternative:** Express the move as inline shell steps in the command prose. Viable and
  lighter, but it puts a no-data-loss, strictly-ordered mutation at the mercy of prompt adherence —
  the model could reorder, skip the verify, or remove before confirming. The invariant belongs in
  code.

### Role is gated on the resolver's committed artifacts, never a new heuristic

- **Decision:** Decide single-repo / member / hub from the same committed artifact the resolver keys
  on (hub pointer → member, manifest → hub, neither → single-repo), and take the authoritative hub
  root from the resolver. Migration and removal fire only in the member case.
- **Why:** This mirrors the distiller's runner-selection (#44) and the resolver's own internal
  branching, so the role decision cannot drift from how the rest of the system determines role. The
  hub case is treated like single-repo: the hub drains its own queue, so its entry must stay and
  reach the hub's `main`.
- **Refuted alternative:** Infer mode from an incidental signal such as the absence of a code
  project. Rejected on the same grounds #44 rejected it — an independent heuristic drifts from the
  authoritative role determination.

### The range is shaped as a list now, populated with exactly one entry

- **Decision:** Record the diff range as a list of per-repo entries and populate exactly one (the
  home repo) for this epic.
- **Why:** Cross-repo epics are out of scope and owned by the future `distill-multi-repo` consumer,
  but shaping the range as a list today lets that consumer extend it without a frontmatter schema
  migration. The cost is nil.
- **Refuted alternative:** Record a single scalar range now and widen to a list later. Viable and
  marginally simpler to read, but promoting a scalar to a list is a breaking frontmatter change the
  distiller would then have to parse in two shapes — paying later what a list costs nothing to avoid
  now.

### base/head are pinned to full commit SHAs, and the range lives in the close record

- **Decision:** Record base and head as full commit SHAs, in the close record rather than the epic.
- **Why:** Symbolic refs drift and stop resolving once the branch is deleted; full SHAs survive
  deletion. After migration the entry's introducing commit no longer describes the code change, so
  the recorded range is the only thing the workspace-side drain can recompute from. Base and head
  are known only at close time (while the branch exists), so the close record — not the
  planning-time epic — is their home. Stamping is unconditional so single-repo closes populate the
  recorded-range fallback the distiller already supports, with the introducing-commit method still
  primary there. Durability of the recorded head beyond branch deletion is addressed under Risks and
  the merge-policy assumption in Constraints.

## Constraints & Invariants

1. **Exactly-one-place end state (member mode).** After a successful member-repo close, the entry
   exists in the hub queue and nowhere in the code repo, under the same `<epic-slug>-<local-id>`
   directory name.
2. **Removal is strictly gated on a confirmed migration.** The code-repo removal fires only after the
   hub commit is verified to exist and contain the entry; a failed or aborted migration leaves the
   entry fully intact in the code repo.
3. **No partial hub state on failure.** Migration either lands a complete hub commit or leaves the
   hub unchanged; a partial copy is cleaned up before the failure is reported, and the reported error
   names which checkout is missing and how to supply it (the resolver's own diagnostic).
4. **Single-repo and hub closes preserve today's behavior.** In single-repo and hub modes no hub
   write is attempted and the entry is never removed — it must reach that checkout's `main` for that
   checkout's own distiller. "Identical behavior" means migration and queue behavior are unchanged;
   it does not freeze close-record content, since the range block is added uniformly in every mode.
5. **The resolver is consumed, never re-derived.** Hub location and role come from the shared
   workspace resolver and its committed artifacts; this epic adds no independent workspace-shape
   detection or missing-checkout error of its own.
6. **Migration carries the full working-tree entry.** The migrated directory includes every sibling
   in the entry as it stands at close time — the just-written, possibly-uncommitted close record and
   analyze receipt included — so the hub receives the complete entry even though the code repo never
   commits the close record.
7. **The recorded range is full-SHA, list-shaped, complete, and verifiable.** base and head are full
   commit SHAs; the range is a list with exactly one populated home-repo entry; the committed close
   record leaves no placeholder and no empty range; and diffing the recorded base against head in the
   named repo reproduces the change the close-from-diff pass derived.
8. **Cross-repo mutations execute only after the closure checkpoint** and, in member mode, before the
   GitHub writes; the checkpoint summary names the migrate and remove actions and their target hub
   root and branch.
9. **Member code repos preserve the merged commit.** Member repos must not squash-then-garbage-collect
   away the recorded head; the recorded range is the sole recovery path in workspace mode, so the
   commit it names must remain resolvable after the branch is gone. Detecting and reporting a range
   that fails to resolve at recompute time is owned by the downstream `distill-multi-repo` consumer.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — the recorded head can become unresolvable under squash-merge plus branch deletion plus
  GC.** Full SHAs survive branch deletion (the stated requirement), but a squash-merge creates a new
  commit and orphans the branch tip; once collected, the recorded head no longer resolves, and in
  workspace mode there is no fallback. It cannot be fully closed here — at close time the merge has
  not happened, so head can only be the branch tip. Resolution: the record states a preserve-the-
  merged-commit assumption for member repos (Constraint 9), and detection/reporting of an
  unresolvable range at recompute time is deferred to `distill-multi-repo`.
- **ADDRESS — the hub side of the move is local-only while the code-repo removal reaches the remote.**
  Pushing the hub commit is out of scope (it follows the hub owner's workflow), but the code-repo
  removal is pushed when the feature branch merges. Between those, the migrated entry exists only as
  an unpushed local hub commit while the code remote has already dropped it — a window where the sole
  remote copy is absent. Mitigation: the completion report must instruct the operator to push the hub
  commit and make clear that closure is not durable until it is pushed. The migrate-before-remove
  ordering prevents a shared-`main` duplicate but does not by itself guarantee remote durability of
  the hub side.

## Open Clarifications

None. One clarification — the code repos' merge strategy and its effect on range durability — was
raised at the design gate and resolved: member repos are constrained to preserve the merged commit
(Constraint 9), and detection of an unresolvable range is deferred to `distill-multi-repo` (see the
first ADDRESS risk).
