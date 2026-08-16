---
title: "Must both installation modes coexist, and what happens to repos that already carry a committed .claude directory?"
type: council
status: resolved
blocked_by: [ticket-01-repo-bound-boundary.md, ticket-05-version-pinning.md]
claimed_by: sameera
claimed_at: 2026-08-16T10:44:40Z
---

## Question

Decide two linked things.

First, whether the repo-local install survives alongside the shared install, or is replaced by it.
If both survive, state which one wins when a machine has a shared install and the repo also carries
a committed `.claude/`, and state where that precedence rule is enforced.

Second, what a repo that already carries a committed `.claude/` does. The options are: leave the
files and let the shared install take precedence; remove the Nexus-namespaced files in a migration
step; or leave the repo alone until its owner opts in. The `deployComponents` function already
knows how to remove Nexus-namespaced files that the payload no longer carries, so a migration step
has a place to live.

## Why it blocks

The answer is the difference between one goal and three. A clean replacement is a single migration
goal. Coexistence adds a precedence rule, a way to tell a user which set is active, and a
diagnostic for the case where the two disagree.

## Evidence

### From `nxs-architect` — the harness mechanics, read from the installed binary

Ticket 02 recorded that it could not find the rule the harness uses when the same component name
exists at two scopes. This session found it. The method was to read the bundled JavaScript out of
the installed Claude Code binary, version 2.1.233, at
`/home/sameera/.nvm/versions/node/v22.23.1/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`.

- **The user-scope copy wins, for commands and for skills.** The directory loader builds its list
  with the user configuration directory before the project directory, and dispatch takes the first
  match by name. The sort between those two steps is stable and both entries compare equal, so the
  user entry stays first.
- **The behaviour is undocumented and uncontracted.** There is no name-resolution function, no
  scope-precedence constant, and no test-visible contract. The winner is an emergent property of a
  concatenation order and a first-match lookup, so it can change in a patch release without being
  called a breaking change.
- **Nothing reports the collision to the user.** The only collision handler emits an analytics
  event. For skills it is called with a flag saying the collision was not resolved, so it does not
  even record a winner. Every other trace is a debug log.
- **Two distinct files with the same name are both kept.** The command and agent loader deduplicates
  by inode, and the skill loader deduplicates by resolved real path.
- **Adding a repository-local component set to `.gitignore` does not stop the harness loading it.**
  The project-scope load applies no ignore filter. Only dynamic subdirectory discovery checks
  `.gitignore`. Deletion is the only way to remove a repository-local set.
- **A directory-level symbolic link collapses the two sets into one.** Because deduplication is by
  inode and by real path, an install directory that is a link into a checkout resolves to the same
  file as the project-scope copy, and the loader drops the duplicate.
- **The install location is per user account, not per machine.** It is `$CLAUDE_CONFIG_DIR`, with
  `~/.claude` as the default. Any Nexus code that looks for the shared install must honour the
  environment variable or it silently sees nothing.
- **No site Nexus owns can express "prefer".** A command body cannot learn its own scope, because no
  variable carrying it exists. A toolkit verb runs after the harness has already dispatched. The
  installer knows only the repositories it is pointed at. Every site Nexus owns can express refuse
  or unify, and none can express precedence.

Tree facts from the same agent:

- The removal loop at `libs/portable-tools/src/deploy-components.ts:83-99` already implements the
  right semantics, but `deployComponents` throws when the payload directory is missing at
  `libs/portable-tools/src/deploy-components.ts:63-65`, so driving it with an empty payload is a
  hack. Extract the loop into a named function instead.
- `pruneEmptyDirs` is invoked per subtree root at `libs/portable-tools/src/deploy-components.ts:98`
  and never on `.claude/` itself, so `.claude/settings.local.json` survives removal.
- `.gitignore` carries `.claude/worktrees` and `.claude/settings.local.json` today. Both survive.
- `nexus workspace init` fans `deployComponents` across every member at
  `libs/portable-tools/src/nexus-cli.ts:180-182` and `libs/portable-tools/src/workspace-init.ts:247`.
  Under replacement there is nothing to fan out.
- `libs/portable-tools/src/parity.spec.ts:51` pins the Nexus repository's own `.claude/` through the
  payload fingerprint, and `libs/portable-tools/src/vendor-components.ts:30-32` is where that tree is
  named.
- `README.md:214-230` and `docs/features/README.md:30-31` document the per-repository deploy flow and
  a skill-relative Python path. Both are invalidated by this change.

The same agent raised one finding as a blocker. Once the release is installed at the user scope, a
maintainer editing the Nexus checkout's own `.claude/commands/nxs.epic.md` and running `/nxs.epic`
in that checkout gets the installed release, not the edit. The edit appears to do nothing, and
nothing reports why.

### From `nxs-pm` — the population that actually exists

- **Six sibling repositories carry committed Nexus components today.** `awzm` has 40 Nexus files and
  11 commands, last touched 2026-04-18. `kairo` has 36 files and 10 commands, last touched
  2026-05-25. `ripples` has 36 files and 10 commands, last touched 2026-03-07. `awzm-shadow` has 18
  files and 6 commands, last touched 2026-01-12. `prime` has 12 files and 3 commands, last touched
  2026-07-01. `awzm-notes` carries none.
- **The overlap with today's 8 installed commands is 4 to 6 names per repository**, including
  `nxs.analyze`, `nxs.close`, `nxs.council`, and `nxs.epic`. The local side of each collision is
  between two and seven months stale.
- **Those stale sets still offer retired commands**: `nxs.hld`, `nxs.tasks`, `nxs.dev`, `nxs.qa`,
  `nxs.init`, `nxs.yolo.dev`, and `nxs.product-context`. They name pipeline stages that no longer
  exist.
- **Three repositories carry `.claude/nxs.yolo.sh` and `.claude/nxs_yolo.py` at the `.claude/`
  root.** The current removal predicate matches on the first path segment under a managed subtree, so
  it cannot see a file at the root. A migration that uses the predicate unchanged leaves those files
  behind.
- **User-owned files that must survive:** `awzm` and `awzm-shadow` each carry
  `.claude/agents/product-manager.md` and `.claude/agents/product-strategist.md`, and three
  repositories carry `.claude/settings.json`. The Nexus namespace predicate already protects all of
  them. None of the three committed `settings.json` files references a `.claude` path, so migration
  cannot break a permission allowlist in the population that exists.
- **Nothing in the Nexus tree reads the user configuration directory today.** The only use of the
  home directory is tilde expansion at `libs/pr-worktree/src/worktree.ts:75`.

The same agent looked for the fresh reason ticket 05 demanded and found none. Continuous integration
and container portability were already paid for by decision 04's acceptance of an install step, and
no workflow in any repository invokes a pipeline stage. A Nexus Prime cache is a delivery detail of
one installation mode rather than a second mode. The hub's vendored bundle is the toolkit, not the
component set, and belongs to ticket 07.

## Resolution

- **Decided:** The repository-local installation mode does not survive, and no precedence rule is
  written, because Nexus owns no site that can enforce one. Seven things follow, and each is part of
  the decision.

  1. **Exactly one Nexus component set exists per user account.** It lives at the Claude
     configuration directory, resolved from `$CLAUDE_CONFIG_DIR` with `~/.claude` as the default.
     The scope is the user account and not the machine, because that is what the configuration
     directory is. Two accounts on one machine holding two sets is correct and is not a defect.
  2. **Authoring is separated from loading in the Nexus repository, and no repository is exempt.**
     The authored component tree moves out of `.claude/` into a directory the harness never loads.
     `liveClaudeDir()` at `libs/portable-tools/src/vendor-components.ts:30-32` and the payload
     fingerprint at `libs/portable-tools/src/parity.spec.ts:51` follow it. After the move the Nexus
     repository carries no committed component set and consumes the shared install exactly as an
     adopter does.
  3. **There is one install location with two possible contents.** The installer either writes a copy
     of the release into that location, or points that location at a checkout's authored tree. The
     maintainer's edit-and-rerun loop is the second content. The invariant that exactly one component
     set exists per user account holds in both, so the collision guard needs no exemption and the
     toolkit needs no source-mode flag. The `version` verb reports which of the two contents is
     present, and reports the checkout path when the location points at one.
  4. **Every other repository that carries committed Nexus components runs a gated migration verb.**
     The verb verifies that the shared install is present and reports its version before it removes
     anything, which is the verify-before-remove order `nxs-close-migration` already uses. It then
     removes every file under `.claude/` whose name or first path segment carries the Nexus namespace
     prefix `nxs.` or `nxs-`. It removes nothing outside that namespace. It prints the git commands
     and leaves the commit to the repository owner.
  5. **The migration verb's scope is wider than the deploy mirror's, deliberately.** The mirror
     matches only the first segment under a managed subtree. The verb also matches Nexus-namespaced
     files at the `.claude/` root, because three repositories carry two such files and a migration
     that leaves them behind has not removed Nexus. The verb adds namespaced ignore entries for the
     three managed subtrees. It never adds a blanket `.claude/` ignore, which would hide an adopter's
     own components.
  6. **The migration verb ships in the same release as the shared install.** It is delivered by the
     toolkit, so it cannot ship earlier, and shipping it later opens a window in which a repository
     holds two sets with no remedy to name.
  7. **The duplicate-set diagnostic is a warn-once line on standard error, and there is no scheduled
     escalation to a refusal.** It is a rider on the guard decision 05 already places in the
     executable's argument dispatcher, not a goal of its own. It compares resolved real paths, so an
     install location that points at a checkout is not reported as a duplicate. It compares within
     the user account, not across the machine.

  The migration verb is a single-repository verb, run once per repository. It builds no discovery of
  repositories on a machine, no dry-run flag, no per-file confirmation, and no backup. The files are
  tracked, so git is the undo, and the affected population is six repositories belonging to one
  person.

- **Why:** The ticket asks where a precedence rule would be enforced, and the answer settles the
  first half before preference enters. There is no such site. A command body cannot learn its own
  scope, a toolkit verb runs after the harness has already dispatched, and the mechanisms Nexus does
  own express refuse or unify but never prefer. A precedence rule would therefore be a written
  promise with no enforcement point.

  The measured harness behaviour makes the case stronger rather than weaker. The user-scope copy does
  win today, which is the outcome coexistence would want, but it wins by a concatenation order and a
  first-match lookup that no contract pins. If that order changes, an unmigrated repository silently
  reverts to a component set that is up to seven months old and that still offers commands for
  pipeline stages Nexus has removed. The diagnostic cannot catch it, because in exactly that case the
  old command body runs, invokes its old repository-relative script path, and never reaches the
  guard. Detection cannot cover the case that most needs covering, so deletion has to be the
  load-bearing mechanism and diagnosis has to be the safety net.

  Ticket 05 required a fresh reason for coexistence. The investigation produced the opposite: a
  reason coexistence cannot be made safe. Adding the set to `.gitignore` does not help, because the
  project-scope load applies no ignore filter, so the only removal is deletion.

  Separating authoring from loading in the Nexus repository is what makes the one-set invariant hold
  without depending on the harness at all. The alternative keeps the authored tree at `.claude/` and
  relies on the loader deduplicating a linked install by inode, which is the same class of
  undocumented detail this decision just refused to depend on for precedence. Moving the tree also
  removes a false affordance: a file sitting at a path the harness loads, which is not the file the
  harness runs whenever the maintainer has not linked. After the move the Nexus repository runs the
  adopter path, which is the only way the adopter path stays honest.

  A gated migration rather than an automatic one follows from what the user experiences. The install
  is per user account, so an automatic removal triggered by the first verb run would delete 40
  tracked files in a repository the user was not thinking about, on whatever branch they happened to
  be on, mixed into their working diff. Leaving repositories alone with no end is the other failure:
  while it lasts the user sees four to six undefined-winner collisions per repository plus retired
  commands in their menu, which is misleading rather than merely stale.

  There is no scheduled escalation because the escalation targets a population that will be empty.
  Every adopter arriving after the refactor receives Nexus only through the shared install and never
  holds a committed set, so the only repositories the escalation could ever fire against are the six
  that exist now. Building a second release's worth of mechanism for them is mechanism ahead of the
  decision it serves, and the escalation is unreachable in the one case it would most want to catch.

- **Refuted alternative:** Leave the committed files in place and rely on the user-scope precedence
  that was measured. It is the tempting option, because it is zero work and the harness already does
  the right thing today. It loses on three counts. The precedence is an emergent implementation
  detail with no contract, so a change reverts repositories to component sets that ship removed
  pipeline stages. The model is shown duplicate command names with no indication which one ran. The
  diagnostic that would catch a reversal is unreachable in exactly the case where the reversal
  occurs.

  A second alternative is to exempt the Nexus repository, keep its authored tree at `.claude/`, and
  serve the maintainer's loop by linking the install location into that checkout so the loader
  deduplicates the two paths. It is coherent and it costs less work. It loses on consistency and on
  the false affordance. It makes the one-set invariant depend on inode and real-path deduplication,
  which is undocumented harness behaviour of the same class this decision refuses to rely on
  elsewhere. It also leaves component files at a loaded path in the one repository whose maintainer
  most needs to know which copy is running, and the exemption becomes a second rule the guard must
  carry.

  A third alternative is automatic removal at the first shared-install run. It loses on trust. For a
  first external distribution, deleting tracked files as a side effect of an unrelated command spends
  the credibility the release is trying to earn.

  A fourth alternative is a scheduled escalation release that converts the duplicate-set warning into
  a refusal. It is refuted rather than deferred, for the reason given above: its target population is
  the six repositories that exist now, and it cannot fire in the case it exists for. The revisit
  trigger is named, and it is an adopter who took Nexus up before the refactor and still carries a
  committed set.

- **Resolved by:** sameera on 2026-08-16

### What this binds, and what it hands to other tickets

**Three ordering gates.**

1. **The source-link install content must exist and work before the authored tree moves out of
   `.claude/`, and before any maintainer installs a release on the machine that develops Nexus.**
   This is the sharpest gate in the discovery so far and no earlier ticket named it. Get the order
   wrong and the first person to install Nexus discovers that Nexus can no longer be developed.
2. **The migration verb ships in the same release as the shared install**, as decision point 6
   states.
3. **Install, verify, then remove, in that order, in one invocation.** The window in which a
   repository has neither component set must be zero.

**A scope deletion rather than a new goal.** The `deployComponents` fan-out in `nexus workspace init`
at `libs/portable-tools/src/nexus-cli.ts:180-182` and `libs/portable-tools/src/workspace-init.ts:247`
has nothing to deploy under replacement. It and its prompt text are removed with the rest, inside the
migration goal.

**A correction handed to ticket 09.** Ticket 05 allowed a repository-local copy for Nexus Prime on
the condition that it is written by the installer and is a cache of the same release. This session
found that the condition is not sufficient on its own. The project-scope load applies no ignore
filter, so a gitignored, installer-written copy inside a repository is still loaded by the harness
and is still a second component set by the harness's own definition. Ticket 09 must therefore place
any Prime copy outside the repository, or establish that it is the only set that session can reach.
Gitignoring it is not an answer.

**Two inputs handed to ticket 08.** Nexus-related permission allowlist entries live outside the three
managed subtrees, so they survive migration while pointing at deleted paths. Separately, the shared
install has no repository-local path for an allowlist entry to name, which changes what an entry can
be written against.

**Three inputs handed to ticket 10.** The component set is per user account, so ticket 10 must say
whether the executable installs per user account as well. If the executable is machine-wide while the
components are per account, a user can hold components with no matching executable. Second, this
decision removes the last per-repository insulation from a bad release, so the requirement to install
and hold an explicit older version is now the sole regression recourse rather than a convenience.
Third, whether a maintainer on Windows outside the Windows Subsystem for Linux is supported decides
whether the source-link content is unconditional or whether an install-from-source path must be
first-class, because creating a directory link there needs Developer Mode or elevation.

**One input handed to ticket 07.** This ticket settles the component set only. The hub's vendored
`.nexus/tools/` bundle is the toolkit, and ticket 07 still owns it. The rule established here is that
the component set has one location per user account, which does not by itself decide where the
executable lives.

**The goal count this ticket produces is two, both small.** One goal migrates a repository off
committed components, covering the migration verb, the wider namespace scope, the namespaced ignore
entries, user-file survival, and the workspace fan-out deletion. The second goal separates authoring
from loading in the Nexus repository and adds the source-link install content, covering the tree
move, the two code sites that name it, and the `version` verb reporting which content is present. The
duplicate-set diagnostic is a rider on the guard ticket 05 already placed, not a third goal.
