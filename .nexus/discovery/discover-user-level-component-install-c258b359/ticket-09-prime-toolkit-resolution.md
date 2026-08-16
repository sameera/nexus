---
title: "Does a Nexus Prime session resolve the toolkit by the same rule as a local shell, or must Prime supply it?"
type: research
status: resolved
blocked_by: none
claimed_by: sameera
claimed_at: 2026-08-16T17:31:06Z
---

## Question

Nexus Prime drives Claude Code inside a browser terminal. The resolution on component self-location
decided that a component names the toolkit and the toolkit locates its own files at run time.
Naming works only if the name resolves in the environment the command actually runs in.

Establish what Prime's terminal session inherits. Report:

1. How Prime launches Claude Code, and what environment that process receives. State specifically
   whether it inherits the user's login shell environment, including whatever makes an installed
   toolkit reachable by name.
2. Whether Prime's session runs with the target repo as its working directory, which is what the
   repo-bound half of the boundary depends on.
3. Whether a Prime session can reach a shared per-machine install at all, or whether it is confined
   to files inside the repo it opened.
4. What Prime does today when a command invokes `tsx ./.claude/skills/...`, since that is the
   arrangement currently in the tree. If it already works, name the mechanism that makes it work,
   because that mechanism is what the refactor must preserve.

## Why it blocks

Prime is one of the environments Nexus components run in. If a Prime session cannot resolve a
toolkit by name, then either Prime gains an install step of its own, or the refactor keeps a
repo-local fallback for Prime's sake. Those are different functional goals with different sizes, and
neither can be stated as a backlog stub until this is known.

## Notes

The self-location resolution recorded that the toolkit resolves its own payload from its own file
location. That property holds in any environment that can start the toolkit at all. The open part is
reachability, not self-location.

## Evidence

### From `Explore` — what Prime does today

**The PTY bridge is shipped, not planned.** `apps/prime/server/pty-bridge.ts:34` calls
`pty.spawn(file, args, …)` using `node-pty`, from a WebSocket connection handler wired into the
HTTP server's upgrade event at `apps/prime/server.ts:60-61`. Tests exist for the bridge, the
session, the origin guard, and the shell resolution. `.nexus/concepts/pty-bridge.md` carries status
`active` and verification `verified`.

**The spawn options answer the ticket's first question directly.**
`apps/prime/server/pty-bridge.ts:34-41` passes `cwd: process.env.HOME`, `env: process.env`, and
`encoding: null`. The environment is the Node server process's full, uncleaned environment rather
than a curated or cleared one. `apps/prime/server/pty-shell-resolve.ts:8` defines
`LOGIN_SHELL_ARGS = ["-l"]` and line 14 always applies it, choosing the binary as `PRIME_SHELL`,
then `SHELL`, then `/bin/bash`, then `/bin/sh`. Prime therefore spawns a login shell.

**The working directory is `$HOME`, not the target repository.** This is
`apps/prime/server/pty-bridge.ts:38`. It is not the repository the user opened, and it is not even
the server's own working directory.

**Prime does not spawn Claude Code anywhere.** No code path launches `claude`. The frontend
`TerminalRegion` component at `apps/prime/app/terminal/terminal-region.tsx:21-78` is a static
placeholder with no terminal emulator, no WebSocket client, and no connection to the `/pty`
endpoint. The backend PTY spawn is real; the frontend is not yet wired to it.

**There is no remote-hosting model in the tree.** `apps/prime/server.ts:63-65` logs
`Prime server listening on http://localhost:<port>` and reads `process.env.HOME` and
`process.env.SHELL`. No deployment configuration, hosting document, or statement of a hosted mode
was found. As written, Prime's machine is whichever machine runs the Node server.

The separate checkout at `~/projects/prime` is an earlier snapshot with no PTY bridge and no
WebSocket server code. It is not authoritative; the Nexus repository is ahead of it.

### Verified by this session — the shell startup files on this machine

The user's shell is zsh. Neither `~/.zprofile` nor `~/.zshenv` exists. `~/.zshrc` adds several
directories to `PATH`, including the pnpm home and `/home/sameera/bin`. `~/.profile` exists and adds
`$HOME/.local/bin`, but **zsh never reads `~/.profile`**, so nothing in this user's zsh startup
sequence adds that directory.

`$HOME/.local/bin` is nevertheless first on the current `PATH`. It is therefore present by
inheritance from whatever process started the shell, not because any shell startup file this user
owns puts it there. That is a live instance of the fragility described below, on the machine the
product is being built on.

### From `nxs-architect` — pressure-test of the draft conclusion

The architect judged the draft conclusion directionally right and overstated on the word "reliably".
Its correction: the claim "Prime resolves the toolkit by the same rule as a local shell" holds only
when Prime's own Node server process was started from a normal terminal context. A service launch —
a systemd unit, a container, a graphical launcher, or an editor's run button — typically gives the
server a minimal environment, and `env: process.env` cannot carry what the server never had.

It judged the `cwd: $HOME` finding a real problem but scoped to Prime rather than to this refactor.
No resolved decision depends on the session's starting working directory, because decisions 02, 06
and 07 govern which toolkit a component names and where the toolkit is installed, not where the
shell starts.

It judged the absence of a remote-hosting model correctly deferred, because nothing in the tree
implies one, and deciding for a hosted Prime now would change the install-location invariant of
decision 06 on speculation rather than on validated scope.

It concluded that Prime implies zero functional goals, and that the PATH-file placement caveat is a
constraint on the install step rather than a Prime-side gap.

### Correction to the architect's reasoning, which sharpens the finding

The architect argued the risk is login files against interactive files: that a login shell sources
`~/.profile` or `~/.zprofile` but not `~/.zshrc`, and that macOS zsh users are exposed because
`.zshrc` is interactive-only. **That is wrong for the shell Prime actually spawns.** Prime attaches
the shell to a pseudo-terminal, so the shell is interactive, and `-l` additionally makes it a login
shell. An interactive login zsh sources the login files **and** `~/.zshrc`. Prime's terminal
therefore reads the widest set of startup files available, not a narrower set. Prime's environment is
the same as or wider than the user's own terminal, never narrower.

The real fragility is the one the architect named second, and it is the only one that survives: the
environment the Node server process itself inherited. Anything on `PATH` that no shell startup file
adds is present only because the server's parent had it. The `$HOME/.local/bin` finding above is
exactly that case on this machine, and `$HOME/.local/bin` is a conventional install location for a
per-user command-line tool. The exposure is therefore concrete rather than theoretical, and it
belongs to the choice of install location, which is ticket 10.

## Resolution

- **Decided:** A Nexus Prime session resolves the toolkit by the same rule as a local shell, and
  Prime supplies nothing. Prime implies zero functional goals for this refactor. Four things follow,
  and each is part of the decision.

  1. **Prime's terminal is an interactive login shell on the same machine, with the server's full
     environment inherited.** It therefore reads the widest set of shell startup files available and
     resolves a name the same way the user's own terminal does. There is no Prime-specific
     resolution rule, no Prime install step, and no repository-local fallback kept for Prime's sake.
  2. **The ticket's concern is inverted: the refactor helps Prime, and the current arrangement is
     the one Prime cannot run.** Prime's session starts in `$HOME`, so a repository-relative
     invocation like `tsx ./.claude/skills/…` resolves against the home directory and finds nothing.
     A named toolkit resolves from `PATH` and does not depend on the working directory at all. The
     mechanism the refactor must preserve, which the ticket's fourth question asked for, does not
     exist, because the current arrangement has never worked in Prime.
  3. **The one real exposure belongs to ticket 10, not to Prime.** A Prime server started outside a
     normal terminal session inherits a reduced environment, and any `PATH` entry that no shell
     startup file adds is then absent. On this machine `$HOME/.local/bin` is exactly such an entry:
     it is first on `PATH`, it is a conventional per-user install location, and no zsh startup file
     this user owns adds it. The install location must therefore be one that a shell startup file
     establishes, or the install step must establish it. That is a constraint on the distribution
     channel and it is recorded for ticket 10 to carry.
  4. **A hosted Prime is not decided here and is not deferred silently.** No remote-hosting model
     exists anywhere in the tree. A hosted Prime would separate the user's machine from Prime's
     machine and would change the install-location invariant of decision 06 rather than merely
     consuming it, so it is a new question rather than a variation of this one. Deciding it now
     would be speculation ahead of validated scope.

  Two observations are recorded without becoming goals of this discovery. Prime does not yet spawn
  Claude Code at all, because the frontend terminal is a placeholder with no client wired to the
  bridge, so nothing in Prime runs a Nexus component today. Separately, a Prime session starting in
  `$HOME` means the user must change directory into a repository before any repository-bound stage
  works. That is a Prime experience question, it is not caused by this refactor, and no resolved
  decision depends on the session's starting directory.

- **Why:** The ticket asks whether Prime is a second environment needing its own answer, and the
  spawn options settle it in four lines of code. Prime passes the server's whole environment through
  and asks for a login shell, on the same machine, with no filtering. There is no boundary for a
  resolution rule to differ across, so the question of a Prime-specific install answers itself.

  What makes the decision worth recording is that the ticket's premise runs backwards. It was written
  to protect Prime from the refactor, and asks in its fourth question for the mechanism that makes
  the current repository-relative arrangement work in Prime, so the refactor can preserve it. There
  is no such mechanism. Prime's working directory is the home directory, so a path beginning `./`
  cannot reach a repository's files. The arrangement the refactor removes is the one incompatible
  with Prime, and naming the toolkit is what makes a Prime session able to run a Nexus stage at all.

  The exposure that does survive is not about Prime. Prime inherits the server's environment
  faithfully, so if a name resolves for the user it resolves for Prime. The failure case is a server
  process that never had the entry, and that case is created by where the toolkit is installed rather
  than by how Prime launches a shell. Moving it to ticket 10 puts it with the decision that can act
  on it.

- **Refuted alternative:** The alternative the ticket names is that Prime gains an install step of
  its own, or that the refactor keeps a repository-local fallback for Prime's sake. Both are refuted
  by the same fact. Prime spawns a login shell on the same machine with the server's full
  environment, so a per-account install is already reachable and a second install would be a second
  component set on one account, which decision 06 rules a defect. The repository-local fallback is
  refuted twice over: decision 06 already ended that installation mode for every repository, and the
  fallback would not help Prime in any case, because Prime's session does not start inside a
  repository and could not address a repository-relative path.

- **Resolved by:** sameera on 2026-08-16
