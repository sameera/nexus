---
title: "Does Nexus own the permission allowlist entry that lets its toolkit run, and if so which stage writes it?"
type: council
status: resolved
blocked_by: none
claimed_by: sameera
claimed_at: 2026-08-16T15:40:12Z
---

## Question

Claude Code decides whether a Bash command may run by matching it against the permission allowlist
in `.claude/settings.local.json`. That file is user-owned today, and Nexus never writes it. Users
who have been running Nexus have accumulated allowlist entries that match the current invocation
strings, which all begin `tsx ./.claude/skills/`.

The resolution on component self-location changes every one of those strings. A component now names
the toolkit instead of pathing to it, so every accumulated allowlist entry stops matching on the
day the refactor lands.

Decide who owns the replacement entry. The options to weigh are:

1. Nexus documents the entry and the user adds it. Nexus keeps its hands off a user-owned file, and
   the first run after upgrading prompts for permission.
2. `/nxs.setup` offers to write the entry during bootstrap, with the user's consent at the moment
   it writes.
3. The install step writes the entry, so a fresh install is usable with no permission prompt.
4. Nexus writes nothing and accepts the prompt on every fresh machine.

State which file the entry lands in when Nexus does write it, and state what happens on a machine
that already has the old entries.

## Why it blocks

A backlog stub cannot be written for the invocation rewrite until this is decided, because the
rewrite either does or does not carry a settings change with it. The two versions are different
sizes and touch different files.

The decision also has a boundary in it that is larger than this refactor. Nexus has never written a
user-owned settings file. Deciding that it may do so now sets a precedent for every later stage, so
the decision belongs to the product owner and the architect together rather than to whoever writes
the rewrite.

## Notes

A named toolkit invocation improves the allowlist surface regardless of who owns the entry. One
stable command prefix replaces the eight skill-specific paths that entries match today. That makes
the entry easier to state, and it does not answer who states it.

## Evidence

### Verified by this session — the ticket's premise is false

The ticket states that users who have been running Nexus have accumulated allowlist entries
matching the current invocation strings, and that all of those strings begin `tsx ./.claude/skills/`.
I inspected every settings file on this machine: nine files across seven repositories, plus the
user-level file. **Not one entry matching `tsx ./.claude/skills/` exists.** The only entry
containing the letters `tsx` is `Bash(npx tsc:*)` in the user-level file, which is the TypeScript
compiler and is unrelated. This repository's own `.claude/settings.local.json` holds five entries
and none of them are Nexus-related.

What Nexus users actually accumulated is a weaker thing than the ticket describes. Three entries
exist in one repository, `~/projects/kairo`, and all three are exact strings with a document path
baked into the argument, for example
`Bash(python ./.claude/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/all-tasks/README.md")`.
Each one matches exactly one call with one argument value, so each already fails to match the next
call to the same script with a different document path. They are dead weight today, before this
refactor changes anything.

Two further observations bear on the options. Where users wanted to stop being prompted, they wrote
a broad prefix themselves: `Bash(python3:*)`, `Bash(python:*)`, `Bash(pnpm:*)`, `Bash(grep:*)`. A
single prefix entry for a named toolkit is therefore the same idiom these users already write
without being asked. Separately, part of the Nexus permission surface today is `Skill(…)`-typed
rather than `Bash(…)`-typed: `~/projects/awzm` carries `Skill(nxs.council)` and `Skill(nxs.analyze)`.

### Verified by this session — the non-write promise is published, not merely conventional

`nxs-architect` reported that Nexus has never written a user-owned settings file and that the
boundary is stated in code. That is correct, and it understates the position. The promise appears in
three places, and the third is user-facing. `libs/portable-tools/src/deploy-components.ts:11` states
that user-owned files, naming `settings.local.json`, are never touched.
`libs/portable-tools/src/vendor-components.ts:6-7` states that everything in `.claude/` other than
the three managed subtrees, naming the per-repository `settings.local.json`, is user-owned and is
never vendored, never deployed, and never hashed. `libs/portable-tools/src/nexus-cli.ts:43` prints
the same guarantee inside the `nexus deploy` usage text that an adopter reads on screen:
"user-owned files such as .claude/settings.local.json are never touched." Options 2 and 3 would
therefore not merely set a new precedent. They would contradict a guarantee the command already
prints.

### From `claude-code-guide` — where an interactive approval actually lands

An approval taken through the permission dialog with the "don't ask again" option is saved to
`.claude/settings.local.json` **at the root of the git repository**, resolved through worktrees to
the main checkout. **The user does not choose the scope.** An interactive approval can never produce
an entry in the user-level settings file.

The dialog writes a command-prefix form rather than the bare literal string, but the rule that
decides where the prefix ends is not documented. Whether approving one toolkit verb covers a
different verb with different arguments is therefore not established. The three exact-string entries
found in `~/projects/kairo` are consistent with a narrow prefix, since each carries a full argument
value, but they are evidence about one client version rather than a specification.

A hand-written prefix entry is documented and does cover every invocation of one executable. The
forms `Bash(nexus *)` and `Bash(nexus:*)` are equivalent, and a single `*` matches any sequence of
characters including spaces, so one entry spans every verb and every argument list.

Two behaviours relevant to this decision are not documented: whether a bare executable name and a
pathed invocation of the same executable match the same rule, and the exact prefix boundary the
dialog chooses.

### From `nxs-pm`

Ticket 04 says nothing about permission prompts. Its friction discussion is scoped entirely to
whether an install step exists at all: "An install step is an acceptable prerequisite in any
environment, including continuous integration and containers, so Nexus carries no second copy of the
components for portability." Reading that acceptance as extending to a settings write, or to a
prompt, is an inference ticket 04 never tested. The lead should treat the extension as unresolved
rather than inherited.

`docs/product/context.md` is the Nexus Prime product document. It covers Prime's personas, anti-goals
and success metrics, and it says nothing about the toolkit's install or permission flow. It does not
answer this ticket and must not be leaned on.

Option 3 differs from option 2 only in timing, not in kind. Both are Nexus writing a user-owned
permission file it has never written. Moving the write earlier relocates it from the moment the user
is paying most attention to a moment they may be paying less, possibly non-interactively. Option 2's
"consent at the moment it writes" is functionally the same prompt Claude Code would show anyway,
re-implemented by Nexus. If the goal is to remove the first-run interruption, option 2 does not
achieve it; it moves the interruption from Claude Code to `/nxs.setup`. The one thing option 2 buys
over option 1 is that Nexus authors the content of the entry, so the entry is correctly shaped. That
is a real but narrow win: a better-shaped prompt, not the absence of one.

The boundary Nexus would trade away is legible and currently free to keep: Nexus writes only the
components it owns, never the files that control what those components are allowed to do. Once
broken, the next asks are individually reasonable and cumulatively erase the line between a tool and
a thing that configures its own trust level: broader entries for convenience, hook configuration,
server lists, and re-synchronising settings on every upgrade.

### From `nxs-architect`

The scope-matching answer is the user-level settings file at `$CLAUDE_CONFIG_DIR`. Decision 06
installs the toolkit once per user account, so an allowlist entry for that executable is a property
of the one install rather than of any repository. A project-scoped entry would have to be written
once per repository and again for every new repository that adopts Nexus, which contradicts the
once-per-account model. A checked-in `.claude/settings.json` is additionally shared with the
adopter's team, which is a different blast radius from a personal grant.

Writing into a user-owned settings file carries concrete failure modes: clobbering entries the user
added by hand, blind-merge damage to adjacent unrelated keys, a hand-edited or malformed file that
fails to parse and either aborts the install or silently does nothing, an entry the user deliberately
removed being silently re-added on every upgrade with no way to opt out, and concurrent edits during
a fan-out. Mechanical add-if-absent is tractable, but "absent" is the wrong test once a user has
generalised to a broader prefix. Suppressing a redundant add requires prefix-aware comparison rather
than string equality, which is real complexity rather than boilerplate.

Option 3 needs the same mechanism as option 2 minus the consent gate, so it is the same size with a
worse trust posture. It is the weaker version of option 2, not the cheaper one.

## Resolution

- **Decided:** Nexus does not own the entry. Nexus documents it, and the user adds it. No stage
  writes it, because no stage may write a user-owned settings file. Six things follow, and each is
  part of the decision.

  1. **A durable product boundary is stated, and it is wider than this ticket.** Nexus writes the
     components it owns and never the files that govern what those components are permitted to do.
     This is not a new promise. `nexus deploy` already prints it, so the boundary is published rather
     than internal, and options 2 and 3 would contradict text the command shows on screen.
  2. **The documented entry is account-scoped, and that is the only way to obtain it.** The entry
     belongs in the user-level settings file at the Claude configuration directory, because decision
     06 installs the toolkit once per user account and the grant is a property of that install. An
     interactive approval cannot produce it. The permission dialog always saves to
     `.claude/settings.local.json` at the git repository root and the user is given no scope choice,
     so relying on the prompt produces a repository-scoped grant repeated once per repository. The
     documented entry is therefore not the cheap substitute for the prompt. It is the only path that
     yields a grant matching the scope of the install.
  3. **One entry per named toolkit, in the broad prefix form.** Decision 03 leaves two named
     toolkits, so the documented content is two entries rather than one. The form is the trailing
     wildcard, which is documented to match any sequence of characters including spaces and therefore
     covers every verb and every argument list with one entry. This is the same idiom these users
     already write for other tools without being asked.
  4. **The install step prints the entry and writes nothing.** Printing the exact text the user
     should add is the implementation of this decision, not a softening of it. It adds no mechanism,
     needs no settings parser, and leaves the write where the boundary puts it.
  5. **Old entries are left alone, and the migration verb does not touch settings.** The entries that
     exist are three exact-string entries in one repository, and they are already dead, because each
     carries a hardcoded argument that fails to match the next call. Nexus removes none of them.
     Decision 06 scopes the migration verb to Nexus-namespaced files under `.claude/`, and a settings
     file is neither namespaced nor Nexus-owned, so removing entries from it falls outside that verb
     by the same rule that defines it. Stale entries grant nothing once the paths they name stop
     existing, so leaving them costs a small amount of clutter in a file the user owns and can edit.
  6. **The upgrade-day breakage this ticket was written to manage does not exist.** The ticket's
     premise, that accumulated entries beginning `tsx ./.claude/skills/` stop matching when the
     invocation strings change, is false. There are no such entries on this machine. The rewrite of
     the invocation strings therefore carries no settings change with it, which is the question
     "Why it blocks" asked.

  The goal set this decision implies is one backlog stub of size S. It publishes the two allowlist
  entries in the install documentation and the upgrade notes, and has the install step print the same
  text. There is no code that reads, parses, merges, or writes a settings file, in any stage.

  Two uncertainties are recorded rather than resolved, because neither changes the decision. The
  prefix boundary the permission dialog chooses is undocumented, and whether a bare executable name
  and a pathed invocation match the same rule is undocumented. Both affect only how often a user who
  ignores the documented entry is prompted. Neither affects who writes the entry, and the documented
  account-scoped entry makes both moot for a user who adds it.

- **Why:** The decision turns on a scope mismatch that neither option list anticipated, and on a
  promise Nexus has already published.

  The scope mismatch is decisive. The ticket frames the choice as convenience against principle:
  writing the entry removes a prompt, and refusing to write it accepts one. That framing assumes the
  prompt and the entry produce the same grant. They do not. An interactive approval is saved to the
  repository's local settings file with no scope choice offered, so the prompt path grants permission
  once per repository while decision 06 installs the toolkit once per account. Option 4, which
  accepts the prompt, therefore does not cost one prompt per machine. It costs one grant per
  repository, forever, in the file that a user who works across several repositories has to maintain
  several times. The documented user-level entry is the only mechanism that matches the install's
  scope, so option 1 is not the option that gives up convenience. It is the option that produces the
  better grant.

  The published promise settles the rest. `nexus deploy` prints that user-owned files such as
  `.claude/settings.local.json` are never touched. A tool that prints that sentence and then writes a
  permission entry into a settings file has broken a guarantee its own output makes, and the entry it
  writes is precisely the kind that decides what that tool is allowed to run. The cost of keeping the
  promise is one documented line that a user pastes once per account. The cost of breaking it is a
  settings parser, prefix-aware duplicate suppression, a re-add-on-every-upgrade failure mode with no
  opt-out, and the loss of a boundary that is currently free to keep and hard to recover.

  The upgrade-day concern that motivated the ticket dissolved on inspection, which removes the
  argument that Nexus must act to repair something it is about to break. There are no accumulated
  entries to break. The three that exist are already dead for a reason unrelated to this refactor,
  and they belong to a file Nexus has promised not to edit.

- **Refuted alternative:** Option 2, in which `/nxs.setup` offers to write the entry with consent at
  the moment it writes, is the strongest alternative and it lost on its own logic. Its purpose is to
  remove the first-run interruption, and it does not remove it. It replaces a prompt from Claude Code
  with a prompt from `/nxs.setup`, so the user still stops and answers a question before the toolkit
  is usable. What option 2 buys over option 1 is that Nexus authors the text of the entry so the
  entry is correctly shaped, and that benefit is obtainable without any write by printing the same
  text and letting the user paste it. Option 2 therefore pays the whole precedent, and contradicts
  the guarantee the CLI prints, to buy a correctly-shaped string that option 1 also delivers.

  Option 3, in which the install step writes the entry silently, is option 2 without the consent
  gate. It needs the identical settings-file mechanism, so it is not cheaper, and it removes the one
  thing that made option 2 defensible. It also lands the write at the moment the user is least able
  to observe it, including non-interactive installs.

  Option 4, in which Nexus writes nothing and documents nothing, is refuted by the scope finding
  rather than by preference. It produces a repository-scoped grant once per repository, and it leaves
  a first-time adopter facing an unexplained prompt with no text to reach for.

- **Resolved by:** sameera on 2026-08-16

### What each perspective gave up

`nxs-pm` gave up the claim that the two populations want different answers. It argued that existing
users face a stale-entry migration problem while new adopters face a first-grant problem. The
inspection removed the first population: there are no stale entries worth migrating, so both
populations receive the same documented line and no migration path is built.

`nxs-architect` gave up its own feasibility finding. It established that idempotent add-if-absent is
tractable and sized option 2 at M, meaning the write was buildable within the destination's limit.
It still declined to build it, on the grounds that prefix-aware duplicate suppression is genuine
complexity and that a re-add on every upgrade has no opt-out the user can express.
