---
title: "Does a shared per-machine install replace the hub's vendored .nexus/tools/ bundle, or sit beside it?"
type: council
status: resolved
blocked_by: [ticket-03-script-runtime-shape.md, ticket-05-version-pinning.md]
claimed_by: sameera
claimed_at: 2026-08-16T15:01:33Z
---

## Question

Nexus already ships one answer to the shared-install problem, and that answer is per repository
rather than per machine. `libs/portable-tools/src/vendor-bundle.ts` builds dependency-free `.mjs`
entry points and vendors them, with the component payload, into a hub's `.nexus/tools/`. The
components then invoke them as plain `node .nexus/tools/<x>.mjs`.
`docs/features/multi-repo-workspaces/hub-tooling-install.md` states the trade deliberately: every
clone of the hub already carries the bundle, one time per repository rather than one time per
machine. `delivery_config.py:417` locates that directory from Python, including by way of a
member repo's sibling hub, and its candidate list is hard-coded at line 428.

A per-machine shared install inverts that trade. Decide which arrangement Nexus keeps.

1. The shared install replaces the vendored bundle. `.nexus/tools/` stops being written, and the
   hub-versus-member distinction stops mattering for tooling.
2. Both arrangements survive. State which one wins when a machine has a shared install and the hub
   also carries a vendored bundle, and state where that precedence is enforced — the components
   resolve the directory in at least two languages today.
3. The vendored bundle survives and the shared install is built on top of it, so that a machine-wide
   install is a place the bundle is fetched from rather than a second copy of it.

Weigh what each option costs against the properties the vendored bundle buys: a continuous-
integration checkout and a git worktree both carry the tooling with them, and a clone needs no
install step at all.

## Why it blocks

The question came from "Not yet specified" and could not be stated until the repo-bound boundary was
drawn. Now that it can be stated, it changes the goal set rather than adding to it. Option 1 makes
the hub tooling install a migration goal. Option 2 adds a precedence rule and a diagnostic for the
case where the two copies disagree. Option 3 makes the shared install a distribution mechanism
rather than a run-time location, which is a different goal with different stories.

## Evidence

### From `nxs-architect`

**The vendored bundle has a deployed population of zero.** No `.nexus/tools/` directory exists in
any repository on this machine. No `.nexus/config/workspace.yml` and no `.nexus/config/hub.yml`
exist either. No hub has ever been instantiated. The arrangement this ticket asks about is a
shipped design that no checkout has ever used.

**Nexus has no continuous integration.** `.github/` is absent from the working tree and
`git ls-files .github` returns nothing. Every Nexus stage is a slash command at a human
checkpoint, so no stage runs unattended.

**What the vendored bundle contains.** `libs/portable-tools/src/vendor-bundle.ts:59-79` writes
three things into the tools directory: six `.mjs` entry points named by `ENTRY_POINTS` at
`libs/portable-tools/src/build-bundles.ts:10-17`, the whole managed `.claude/` tree copied into
`claude-components/`, and the committed pin `libs/portable-tools/bundle-fingerprint.json`.
`libs/portable-tools/dist/bundle/` measures 1.8 megabytes across six near-identical bundles of
about 300 kilobytes each, because each one inlines the same shared code. The component payload
adds about 976 kilobytes.
`docs/features/multi-repo-workspaces/hub-tooling-install.md:47` instructs the operator to run
`git add` on those files, so every re-vendoring is a generated-artifact commit of roughly 1.8
megabytes in the hub's history.

**Thirteen invocation sites and three resolvers, one of which is dead.** Five sites hard-code the
literal path `node .nexus/tools/<name>.mjs`, all of them in `.claude/commands/nxs.distill.md` at
lines 357, 720, 745, 746 and 853. Eight sites use the abstract form `node <tools-dir>/nexus.mjs`.
The resolvers are: `libs/workspace/src/resolve.ts:38` and `:107`, which no code consumes and which
is therefore a dead export; `.claude/skills/nxs-gh-shared/delivery_config.py:417-437`, which is
live and searches two candidates, the repository's own tools directory at line 428 and the sibling
hub named by `hub.yml` at line 433; and the literal path written five times into the distill
command body as prose. `docs/delivery/lessons/2026-07-14-portable-nexus-tooling.md:20-28` already
records the prose duplication as an accepted defect that will not follow a future resolver change.

**The property the ticket asks us to weigh is inverted in practice.** The claim that a git worktree
carries its tooling is mechanically true for a hub, because `.nexus/tools/` is committed and is not
matched by `.gitignore`, which ignores only `.nexus/tmp/`. It is load-bearing in exactly one place:
`/nxs.distill` runs inside the close worktree and its hub-mode invocations are relative to the
current working directory. The `--pr` flows do not depend on it, because
`/nxs.analyze` and `/nxs.close` invoke the worktree helper from the outer checkout and pass the
worktree path as an argument rather than executing inside it. Meanwhile the branch that repositories
actually run today is broken in a worktree: `.claude/commands/nxs.distill.md:713-715` runs
`pnpm nexus:generate-atlas` in single-repo mode, the worktree is created outside the repository, and
`node_modules/` is not tracked, so the `tsx` binary that script needs is absent. The vendored bundle
protects the worktree case for the mode that has never run, and leaves the worktree case broken for
the mode that does run.

**Option 2 is foreclosed by decision 02, not merely disfavoured.** The precedence site this ticket
imagines is genuinely Nexus-owned, unlike the harness component loader that decision 06 considered,
because `delivery_config.py:434` is Nexus code. That difference is real but it does not survive
decisions 02 and 03. Once every component names the toolkit instead of a path, all thirteen
invocation sites become bare-name calls, and a bare name is resolved by the operator's shell against
`PATH`. Nexus owns no part of that resolution. A precedence rule would then be enforceable at one
site out of fourteen.

**Option 3 costs everything option 1 costs and adds to it.** It keeps `vendor-bundle.ts`,
`parity.ts`, the fingerprint pin, and the hub placement document alive, and it adds a staleness
detector for the vendored copies. At least one of its goals exceeds size M.

### From `nxs-pm`

**The vendored bundle serves nobody in the audience decision 04 named.**
`docs/features/multi-repo-workspaces/hub-tooling-install.md` states the problem it solves: the hub
is a documentation-only repository with no `package.json`, no `node_modules`, and no `pnpm`. That
is the same problem the whole refactor solves for every repository. The setup path also excludes
the external adopter by construction, because step 1 of that document requires running
`pnpm nexus:vendor-tools` from a clone of the Nexus monorepo. An adopter who never clones Nexus
cannot execute that line, so the hub install is reachable only by the maintainer.

**Keeping the bundle in any form reinstates all three pains decision 04 requires the refactor to
remove together.** Commit churn returns in its most byte-heavy form, and it is instructed rather
than incidental, because the placement document tells the operator to commit the generated files.
Staleness returns through the same manual per-repository refresh mechanism that produced five
distinct component hashes across six repositories between February and July. Onboarding cost
returns, because standing up a hub requires cloning Nexus, installing `pnpm`, running a build,
copying artifacts into a second repository, and committing in both.

**Staleness handling has already leaked into a shipped component body.**
`.claude/commands/nxs.distill.md:360` carries a compatibility branch that reads "If
`.nexus/tools/derive-entry-diff.mjs` does not exist, the hub's vendored tooling predates…". Keeping
the vendored bundle means keeping and growing that class of branch.

**No claimed benefit of the vendored bundle is real for this audience.** Decision 04 already
accepted an install step in every environment, including continuous integration and containers, and
already refuted keeping a committed copy of the components as a portable fallback. The worktree
argument runs the other way: an install at the Claude configuration directory covers every worktree
automatically, while per-repository vendoring works only if the bundle is committed on the branch
the worktree is on. The air-gapped case is not real for this product, because anyone running Claude
Code can already write to the Claude configuration directory, which is where Claude Code puts its
own components. A machine where the user cannot write there cannot run Claude Code skills at all,
so Nexus is not the binding constraint.

**`docs/product/context.md` is scoped to Nexus Prime and names no toolkit adopter and no hub
maintainer.** Ticket 04 is the audience source for this decision, and the product context document
is not.

### Verified by this session

`~/projects/prime/.nexus/` contains `config/` and `queue/` only. Prime has never carried a vendored
tools directory. This contradicts the coupling `nxs-architect` drew to ticket 09, and the
contradiction is recorded in the resolution below.

`.claude/commands/nxs.distill.md:713-721` carries both branches as described: `pnpm
nexus:generate-atlas` for single-repo and `node .nexus/tools/generate-atlas.mjs` for hub.
`.claude/skills/nxs-pr-worktree/SKILL.md:29-42` confirms the worktree base is outside the
repository, defaulting to the system temporary directory and overridable by the `worktree-path`
key.

## Resolution

- **Decided:** The shared install replaces the vendored bundle. `.nexus/tools/` stops being
  written, and no repository holds a copy of the toolkit. Six things follow, and each is part of
  the decision.

  1. **The hub-versus-member distinction stops mattering for tooling, and for tooling only.** A hub
     and a member reach the same install by the same name, so the sibling-hub hop at
     `delivery_config.py:433` disappears. The distinction continues to govern everything decision 01
     placed in the project-state set: where the concept store lives, which repository holds the
     queue, and who drains it. This decision changes where the toolkit lives and changes nothing
     about workspace semantics.
  2. **The vendored bundle was the right answer at the wrong scope, and its insight is kept.** It
     correctly identified that the consumer has no Node toolchain, and it correctly solved that with
     a dependency-free bundle executed by bare `node`. The shared install keeps the bundle, keeps
     the self-contained entry point, and keeps bare-`node` execution. The only thing discarded is the
     per-repository copy and the commit churn that copy generates.
  3. **Options 2 and 3 are foreclosed by earlier decisions rather than outscored by option 1.**
     Option 2 requires a precedence rule that decision 02 leaves enforceable at one site out of
     fourteen, because a bare name is resolved by the operator's shell and Nexus owns no part of
     that resolution. Option 3 reinstates per-repository version pinning through the back door,
     because two repositories vendored on two dates hold two toolkit versions addressed per
     repository, which is the outcome decision 05 places out of scope. Choosing either option would
     require reopening a resolved ticket, and neither is chosen here.
  4. **The removal cost is documentation only, because the migration population is zero.** No
     `.nexus/tools/` directory, no `workspace.yml`, and no `hub.yml` exists in any repository on
     this machine. This decision discards no working infrastructure. It is recorded so that a later
     reader does not mistake the removal for the deletion of something in use.
  5. **The accepted trade is named rather than left implicit.** After this change a bare `git clone`
     no longer runs Nexus stages, and there is no committed fallback copy to fall back to. Decision
     04 already accepted an install step in every environment and already refuted the committed
     portable fallback, so this is the trade that decision priced, not a new cost.
  6. **This decision does not depend on ticket 09, and it does not change what ticket 09 decides.**
     Nexus Prime has never carried a vendored tools directory, so option 1 removes nothing Prime
     has today. Prime's fallback was already removed by decision 06, which ended the
     repository-local installation mode. Ticket 09 remains open, independent, and unchanged in
     scope.

  The goal set this decision implies is two backlog stubs, both size M or smaller. The first retires
  the vendored tools directory: the copy path and the payload copy leave `vendor-bundle.ts`, the
  dead `portableToolsDir` export and its specification assertions are deleted,
  `hub-tooling-install.md` is retired, and the fingerprint gate is repointed from what was vendored
  to what was released. The second makes the Python toolkit find the executable by name, replacing
  the two-candidate path search in `delivery_config.py` while preserving both its degrade-to-empty
  contract and its guard against spawning `node` for a single-repo checkout.

  Two pieces of work that look like goals here are not, and are recorded so they are not counted
  twice. Rewriting the thirteen invocation sites belongs to decisions 02 and 03, which already
  require it whatever this ticket decided. Collapsing the two branches in `nxs.distill.md` into one
  bare-name invocation also belongs to decision 03, because `pnpm nexus:generate-atlas` is a
  capability invoked from a component body. That collapse repairs the single-repo worktree defect
  found above as a side effect, and the repair should be claimed by the decision 03 goal rather than
  by either goal of this ticket.

- **Why:** Both perspectives reached option 1 independently, and the reasoning that decides the
  ticket is not preference but the two facts that remove the trade the ticket asks us to weigh. The
  ticket asks what the vendored bundle buys, and names two properties: a continuous-integration
  checkout carries the tooling, and a clone needs no install step. Neither property has an instance.
  There is no continuous integration in this repository, and there is no hub anywhere to carry a
  bundle. The third property, that a git worktree carries the tooling, is real but points the other
  way: it protects the hub branch that has never run, while the single-repo branch that does run is
  broken in a worktree today, because the worktree is created outside the repository and the `tsx`
  binary it needs lives in an untracked `node_modules/`. An install resolved by name is inherited by
  any shell in any directory, so option 1 repairs the case the vendored bundle was credited with
  protecting.

  The commit churn is the second decisive fact. The placement document instructs the operator to
  commit roughly 1.8 megabytes of generated artifacts into a documentation repository, once per
  release. That is the exact pain decision 04 requires this refactor to remove, in its heaviest
  form, and keeping it would mean the refactor removed staleness and onboarding cost while
  preserving churn in the one repository type least able to absorb it. Decision 04 requires the
  three to be removed together.

  Finally, the compatibility branch already written at `nxs.distill.md:360` shows the direction the
  vendored arrangement travels. A component body already carries prose handling a hub whose
  vendored tooling predates a capability. Keeping the bundle means keeping that branch and adding
  more of them, in prose that a lessons document has already classified as duplication that will not
  follow a resolver change.

- **Refuted alternative:** Both surviving options were refuted, each by a resolved decision rather
  than by comparison. Option 2, in which both arrangements survive under a precedence rule, lost
  because decision 02 converts every invocation site to a bare name resolved by the operator's
  shell. The one Nexus-owned precedence site that remains is the Python candidate list, which covers
  one site out of fourteen, so the rule would be a promise Nexus cannot keep across the other
  thirteen. Option 3, in which the shared install becomes a place the bundle is fetched from, lost
  because it keeps both the commit churn and the staleness that decision 04 requires removed, adds a
  staleness detector for the vendored copies, and reinstates per-repository version divergence that
  decision 05 places out of scope. Option 3's only defensible residue is an opt-in vendoring verb
  for an air-gapped machine, and that residue is refuted on its own evidence: a user who cannot
  write to the Claude configuration directory cannot run Claude Code components at all, so Nexus is
  not the binding constraint on such a machine.

- **Resolved by:** sameera on 2026-08-16

### What each perspective gave up

`nxs-pm` gave up the review and portability story in full. It accepted that a bare `git clone` no
longer runs Nexus stages and that no committed copy remains as a fallback, on the grounds that
decision 04 already priced that trade.

`nxs-architect` gave up the one shape it found technically coherent. It judged an opt-in vendoring
verb buildable and nearly free, since `vendor-bundle.ts` already does most of the work, and still
declined to keep it, because a resolution path that no component consults is not an architecture and
a verb nobody needs should not be built.
