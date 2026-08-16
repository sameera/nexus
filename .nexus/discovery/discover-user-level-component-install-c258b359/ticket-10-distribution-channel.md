---
title: "Through which channel does an external adopter install, update, and remove the Nexus toolkit?"
type: council
status: resolved
blocked_by: [ticket-03-script-runtime-shape.md]
claimed_by: sameera
claimed_at: 2026-08-16T17:40:15Z
---

## Question

The audience decision named an adopter who never clones the Nexus repository, and it gave Nexus a
semantic released version identity. Neither of those states how the toolkit actually reaches that
adopter's machine. Decide the channel, and decide the three operations it has to support: the first
install, the update to a newer release, and the complete removal.

The options to weigh include: a package on the public npm registry, installed and updated by an
ordinary package manager command; a GitHub release whose asset is fetched by a small installer
script; or a versioned installer script served from the project itself.

Weigh each against three things. First, what the adopter must already have on the machine before the
first install can run. Second, what an update costs, given that the whole point is that no adopter
re-runs a per-repository command. Third, whether removal can put the machine back to its prior state,
which matters because the audience decision accepted an install step as a prerequisite and therefore
owes the adopter a way out.

### Added by the version-pinning resolution, 2026-08-15

Three requirements and one question were handed to this ticket by the resolution of "Does a repo keep
the ability to pin the Nexus component version it runs?".

1. The channel carries **one** semantic version naming the whole release: the TypeScript executable,
   the Python toolkit, and the component payload together. It never publishes the two toolkits under
   two version identities.
2. The channel must support installing and **holding an explicit older version** on a machine. Per
   repository version staging is out of scope, so per-machine version selection is the only
   regression recourse that remains, and a channel that only ever installs the newest release does
   not provide it.
3. The channel must support a **complete removal**, which is already stated above, and the guard that
   reports two copies of one component on a machine depends on removal actually removing.

The question this ticket must also answer: **does the channel install per machine or per user?** The
answer changes what the duplicate-copy guard compares across, because a shared continuous-integration
image or a multi-tenant machine turns "detect two copies" into "detect two copies across users". It
also changes the precedence rule the coexistence ticket decides. The channel determines the answer,
which is why it is asked here rather than in a ticket of its own.

### Added by the allowlist-ownership resolution, 2026-08-16

The install step prints the permission allowlist entries a user should add, one per named toolkit,
in the broad prefix form, and it writes no settings file. Nexus writes the components it owns and
never the files that govern what those components may run. Whatever channel is chosen must have a
place to print that text at install time.

### Added by the Prime toolkit-resolution resolution, 2026-08-16

The install location must be one that a shell startup file puts on `PATH`, or the install step must
put it there itself. It is not enough for the location to be on `PATH` in the installing user's
current terminal.

The evidence is on the development machine itself. `$HOME/.local/bin` is first on `PATH` and is a
conventional per-user install location for a command-line tool, but the user's shell is zsh and no
zsh startup file adds it. `~/.profile` adds it and zsh never reads `~/.profile`, so the entry is
present only by inheritance from the process that started the shell. Any process that starts without
that inheritance — a Nexus Prime server launched as a service, a container, a graphical launcher —
gets a shell in which the toolkit is unreachable by name even though it works in the user's own
terminal.

Choosing an install location therefore has to state which startup file establishes it, and the
removal operation has to undo that too.

Note also that the question this ticket carries about installing per machine or per user is
partly settled: decision 06 fixed exactly one component set per user account at the Claude
configuration directory. What remains open here is where the toolkit executable itself lands and
whether the channel can serve a per-user install without administrator rights.

## Why it blocks

The channel decides a whole goal's worth of stories, and the stories differ by option. A registry
package produces goals about package metadata, publishing, and release automation. A fetched release
asset produces goals about the installer script, its own update path, and checksum verification. The
two sets barely overlap, so they cannot be planned as one.

The channel is also what the version identity attaches to. A release name that no channel serves is
not something an adopter can ask for. The pinning decision can be made without this one, because
whether a repository declares a version is a separate question from where that version is fetched
from. The two answers have to agree before either becomes a stub.

## Evidence

### From `nxs-architect`

Every distribution of Node ships npm alongside it, and npm is not separable from Node. The global
binary directory that npm installs into is placed on `PATH` by whatever installed Node, not by npm
and not by the tool being installed. Version managers solve this deliberately: nvm, volta and fnm
each edit a shell startup file at Node-install time for exactly this purpose, Homebrew's directory
is placed by its own shell environment step, and a system package lands in a directory the operating
system already has on `PATH`. An installer script, by contrast, must choose a directory, detect the
user's shell, edit a startup file across the bash, zsh and fish variants, and reverse that edit on
removal.

The three operations come free under npm. Install and update are one command, holding an explicit
older version is `npm install --global <package>@<version>` with no machinery, and removal is
complete by construction because npm tracks its own file manifest. Under either script option, an
explicit older version requires a version-parameterised fetch and a self-hosted index of every prior
release, which the architect sized at L rather than M, and removal requires Nexus to maintain its own
manifest of everything the install touched.

Lifecycle scripts are not dependable in 2026. pnpm blocks arbitrary lifecycle scripts by default,
continuous-integration runners and security-conscious users commonly pass `--ignore-scripts`, and
Yarn's Plug'n'Play adds its own restrictions. A payload step that silently does nothing on a
meaningful share of installs is a correctness defect rather than a rough edge. An explicit verb the
user runs after installing the package is safer, and it costs nothing extra in onboarding because
decision 08 already requires the install step to print allowlist text the user must act on. The
workflow was never going to be a single command.

### From `nxs-pm`

Ticket 04 does not steer this question. It fixes the audience and accepts an install step, and it is
silent on the channel.

A shell-piped installer is not an adoption barrier for this audience. rustup, bun, deno and uv all
ship that way and this audience already runs them. Inflating it into a risk would be dishonest. The
trust ordering is nevertheless real: a registry package carries version history, deprecation
signalling and provenance; a script fetched from a release is trusted sight-unseen; a project-served
script has no independent platform vouching and no audit trail.

The changelog is the one dimension where npm loses. A releases page is a purpose-built per-version
notes surface, which is what decision 05's load-bearing changelog obligation needs, whereas a
registry page shows version tags and a readme. The loss is not structural: Nexus lives in a git
repository whichever channel installs it, so a releases page can host the changelog even when npm is
the install channel.

Holding an older version is muscle memory for this audience under npm and bespoke engineering under
either script option. The project-served script is dominated by the release-asset script: it inherits
every cost and adds hosting of versioned endpoints, while losing both the native changelog surface
and the platform's trust signal.

Two items were flagged as needing engineering judgement rather than a product call: whether one
package can carry three payload kinds under one version without the placement step becoming its own
failure surface, and whether npm's binary-directory convention really does sidestep the `PATH`
constraint ticket 09 handed this ticket.

### Verified by this session — the prerequisite claim, corrected

The architect's case rested on the adopter already having Node because Claude Code requires it. That
premise is false. `claude` on this machine is an npm global, `@anthropic-ai/claude-code` at version
2.1.233, but the file it installs is `bin/claude.exe`, and that file is a native ELF executable
rather than a JavaScript entry point. The npm package is a delivery vehicle for a native binary, so
Claude Code does not require a Node runtime and an adopter may hold Claude Code without Node.

The conclusion survives by a different and better route. Decision 03 makes the toolkit a `.mjs`
executable run by `node`, so Node is a prerequisite Nexus imposes on its own account regardless of
how the adopter obtained Claude Code. Since npm ships with every Node distribution, npm is free
given a prerequisite already stated rather than free by inheritance from another product.

### Verified by this session — the `PATH` constraint is satisfied without touching a startup file

`~/.zshrc:111-112` sources nvm's own `nvm.sh`. That is what places
`~/.nvm/versions/node/<version>/bin` on `PATH`, and that directory is the same one npm installs
global binaries into under nvm. The directory ticket 09 requires a shell startup file to establish is
therefore established by the Node installation's own integration, before Nexus is involved. Nexus
edits no startup file, and removal has no startup-file edit to undo. Under either script option Nexus
would have to make and then reverse that edit itself, which is the precise failure class ticket 09
recorded.

### Verified by this session — no publishing setup exists

The root `package.json` is `private: true`, carries no `bin`, no `files` and no `publishConfig`, and
`libs/portable-tools/package.json` is a private package at version 0.0.1. Publishing is genuinely new
work rather than the flipping of an existing switch, though modest in size.

## Resolution

- **Decided:** The channel is a package on the public npm registry, and the changelog lives on the
  project's releases page. Seven things follow, and each is part of the decision.

  1. **One package carries the whole release.** The package contains the bundled TypeScript
     executable, the Python toolkit's files, and the component payload, published under one semantic
     version. Nothing is fetched at install time beyond the package itself. This is what makes
     decision 05's rule of one release identity hold in practice rather than on paper.
  2. **The Python toolkit ships inside the same package and is not published separately.** Its files
     are ordinary files that `python3` runs, and every import is standard library, so it needs no
     Python package installation. Publishing it to a Python registry would create a second version
     identity, which decision 05 forbids. Nexus requires `node` and `python3`, and it distributes
     through one of them.
  3. **The install has two steps, and the second is an explicit verb rather than a lifecycle
     script.** Installing the package places the executable on `PATH`. A verb the user then runs
     copies the component payload into the Claude configuration directory and prints the permission
     allowlist entries. A lifecycle script is refused because pnpm blocks such scripts by default and
     `--ignore-scripts` is common, so a share of installs would silently end with no component set
     and no error. The second step costs no extra onboarding, because decision 08 already requires
     the install to print text the user must act on.
  4. **The copy is local, and there is no second fetch.** The payload travels inside the package, so
     the verb copies from the installed package directory into the Claude configuration directory. No
     network access, no separate artifact, and no way for the two halves to reach different versions.
  5. **The `PATH` requirement ticket 09 handed this ticket is satisfied by inheritance.** The
     registry's global binary directory is placed on `PATH` by whatever installed Node, and the
     version managers do that by editing a shell startup file themselves. Nexus edits no startup
     file, and removal has no edit to reverse. This is the single largest difference between the
     options, because both script options would require Nexus to make and later reverse exactly the
     edit ticket 09 identified as fragile.
  6. **Complete removal is two steps and the order matters.** Removing the package does not remove
     the component payload, because that payload was copied into the Claude configuration directory
     and the package manager has no record of it. The toolkit therefore carries a removal verb that
     removes the component set, and it must run before the package is removed, because the verb ships
     inside the package. This is the same verify-before-remove ordering decision 06 already uses, and
     decision 05's duplicate-copy guard depends on removal actually removing.
  7. **Per-machine version selection is inherited rather than built.** Installing an explicit older
     version is a standard registry command, which is the only regression recourse decision 05 left
     after per-repository pinning was ruled out. Under either script option this would be a
     self-hosted version index, which the architect sized above M and which would therefore not fit
     the destination.

  The maintainer's checkout-pointing mode from decision 06 is a flag on the same install verb rather
  than a separate mechanism, so it adds a branch and not a goal.

  The goal set this decision implies is four backlog stubs, all size M or smaller. Publish the
  release as one package containing all three payload parts under one semantic version. Build the
  install verb that copies the component payload into the Claude configuration directory, supports
  pointing at a checkout, and prints the allowlist entries. Build the removal verb that removes the
  component set. Publish the changelog on the releases page in adopter language, which is where
  decision 05's load-bearing obligation finally lands.

  The package's published name is not decided here. It is a naming detail rather than a decision that
  changes the goal set.

- **Why:** Three of this ticket's requirements are already solved by the registry and would have to
  be built under either alternative, and the fourth requirement is one the alternatives actively make
  worse.

  Holding an explicit older version is the clearest case. Decision 05 removed per-repository pinning
  and left per-machine version selection as the only way back from a regression, which makes this a
  requirement rather than a convenience. A registry answers it with an ordinary command this audience
  already knows. A script-based channel answers it with a self-hosted index of every past release,
  which is both new infrastructure and, on the architect's sizing, larger than the destination allows.
  Complete removal follows the same pattern: the registry tracks its own file manifest, while a script
  must maintain a manifest Nexus writes and keeps correct.

  The `PATH` requirement decides the rest, and it is the one this discovery generated for itself.
  Ticket 09 established that an install location must be put on `PATH` by a shell startup file rather
  than by inheritance, using a live case on the development machine. The registry's global binary
  directory satisfies that already, because the Node installation's own integration establishes it,
  verified at `~/.zshrc:111-112`. Both script options would have to detect the user's shell, edit a
  startup file, and reverse that edit on removal. Choosing them would mean building the exact
  mechanism ticket 09 identified as the fragile one, when a channel exists that removes the problem
  instead.

  The one dimension where the registry is weaker is the changelog surface, and it is not a real loss
  because the two are not exclusive. Nexus lives in a git repository whichever channel installs it, so
  the releases page hosts the changelog while the registry serves the install. Decision 05 made the
  changelog the only carrier of behaviour changes, so giving it a purpose-built home is part of
  meeting that obligation rather than a concession.

  The trust question was checked and does not decide anything. A shell-piped installer is normal for
  this audience, and inflating it into a barrier would be dishonest. The registry's advantage there is
  a preference ordering, not a finding.

- **Refuted alternative:** The versioned installer script served from the project is refuted first
  and most simply: it is dominated by the release-asset script. It carries every cost of that option,
  adds hosting of versioned endpoints, and loses both the platform's trust signal and the native
  changelog surface. Nothing in this discovery requires self-hosting, so nothing pays for it.

  The release asset fetched by an installer script is the serious alternative, and it loses on three
  counts. It must build a version-parameterised fetch and a self-hosted index to support holding an
  older version, which the architect sized above M. It must maintain its own manifest of what the
  install touched so that removal is complete. And it must edit a shell startup file to put its
  install directory on `PATH`, then reverse that edit on removal, which is precisely the mechanism
  ticket 09 found fragile enough to record as a constraint. It wins on changelog placement, and that
  win is available to the registry option anyway by publishing the changelog on the releases page.

  A lifecycle script that places the component payload during package installation is refuted as the
  mechanism, though it is the obvious shortcut. pnpm blocks such scripts by default and
  `--ignore-scripts` is common in continuous integration, so a share of installs would complete with
  no component set and no error. A silent partial install is worse than an explicit second command,
  particularly when the install already has to print text the user must act on.

  Publishing the Python toolkit through a Python registry is refuted by decision 05 rather than by
  preference, because it would give the release two version identities.

- **Resolved by:** sameera on 2026-08-16

### What each perspective gave up

`nxs-pm` gave up the changelog argument as a channel-deciding factor. It identified the releases page
as the better home for the load-bearing changelog and rated that a real edge for the release-asset
option, then noted itself that the two channels are not exclusive, which dissolved the edge.

`nxs-architect` gave up nothing it argued for, but its central premise did not survive checking. It
reasoned that Node comes free because Claude Code requires it, and Claude Code ships a native
executable. The conclusion held on the independent ground that Nexus requires Node on its own
account.
