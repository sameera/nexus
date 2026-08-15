---
title: "Do the skill scripts stay as separate TypeScript files, or collapse into the one portable bundle?"
type: council
status: resolved
blocked_by: [ticket-02-component-self-location.md]
claimed_by: sameera
claimed_at: 2026-08-15T13:53:44Z
---

## Question

Today every skill script is a TypeScript file run with `tsx`, which needs the target repo's Node
toolchain. A shared install cannot assume that toolchain exists. Nexus already ships a
self-contained answer for exactly this case: the `nexus.mjs` bundle runs on a bare `node` binary
with no install step and no build step, and the docs-root read-out is already reachable through it.

Decide the shape:

1. Every skill script becomes a verb on the one portable bundle, so a shared install carries one
   executable file and the parity gate covers all of it.
2. Each skill keeps its own script file, and the components gain a shared way to find a runtime
   that can execute it.
3. Some third split, stated explicitly.

Weigh what each option costs. Option 1 grows one bundle and one fingerprint pin, and it moves every
script behind a verb name rather than a path. Option 2 keeps the scripts readable beside the skill
that documents them, and it keeps the toolchain requirement.

## Why it blocks

The stub set differs by option. Option 1 produces goals about verb migration and bundle packaging.
Option 2 produces goals about runtime discovery and about what a repo must still install. The two
sets do not overlap enough to be planned as one.

## Evidence

### Verified in this session, before either agent ran

The ticket's premise that Nexus ships "the one portable bundle" is false. `ENTRY_POINTS` at
`libs/portable-tools/src/build-bundles.ts:10` builds six bundles: `generate-atlas`,
`validate-concepts`, `derive-entry-diff`, `drift-advisory`, `seed-registry`, and `nexus`. The
committed pin at `libs/portable-tools/bundle-fingerprint.json` covers all six plus the
`claude-components` payload, so one pin file already spans several bundles. "One bundle, one pin" is
therefore not a trade this ticket can make. The pin is singular under every option.

All eight TypeScript skill scripts import `@nexus/*` workspace packages. Not one of them holds its
own logic. Each is an argument-parsing shim over a library in `libs/`. The claim that a script file
keeps logic "readable beside the skill that documents them" does not describe the current tree.

`libs/portable-tools/src/vendor-components.ts:21` sets `COMPONENT_SUBTREES` to `commands`, `agents`,
and `skills`, and the payload copies that `skills/` tree verbatim. A deployed skill script therefore
arrives in the target repo carrying `@nexus/*` imports that the target repo cannot resolve.

The dual invocation form is not confined to skill scripts. `/nxs.distill` documents
`pnpm nexus:generate-atlas` for the single-repository case at `.claude/commands/nxs.distill.md:714`
and `node .nexus/tools/generate-atlas.mjs` for the hub case at line 720, and repeats that pairing at
lines 736 and 745, and again at lines 852 and 853. Every such pair is a place where two copies of
one instruction can diverge.

The Python surface is larger than the ticket's framing suggests. Production Python totals 3,362
lines across `delivery_config.py` (988), `create_gh_issues.py` (1,359), and
`nxs_gh_create_epic.py` (1,015). Command bodies invoke it at `nxs.analyze.md:103`, `nxs.setup.md:206`,
`nxs.close.md:201`, and `nxs.close.md:646`, among others. `delivery_config.py:417` already locates
`nexus.mjs` and shells to it on a bare `node` for `workspace github-defaults`, which proves a
cross-runtime seam works, though it locates the bundle by searching two candidate paths rather than
by name.

`.claude/skills/nxs-pr-acceptance/scripts/pr_acceptance.ts:61` sets `TOOL_ROOT` by walking up from
`import.meta.dirname` to the Nexus checkout root, and passes it to provisioning that archives that
checkout. This capability is bound to the Nexus source tree and no command body invokes it.

### From `nxs-architect`

Measured rather than estimated. The agent built the configurations. Adding all five unbundled
TypeScript capabilities to `nexus.mjs` moves it from 301 KB to 333 KB, a growth of 32 KB or 10.6
percent, and build time from 15 ms to 33 ms. One bundle carrying every TypeScript capability,
including the five distiller tools, measures 395 KB. Today's six bundles total 1,835 KB while
covering 6 of 13 capabilities. The agent verified the cause: `generate-atlas.mjs` shares 7,693 of its
8,243 lines with `nexus.mjs`, so each extra bundle carries a fresh copy of roughly 258 KB of shared
core. Collapsing to one bundle cuts the distributed artifact by about 78 percent while covering more
capability.

Third-party dependency surface across the bundleable libraries is one package, `yaml`, at four
import sites. The agent searched `libs/workspace`, `libs/epic-resolve`, `libs/record-digest`,
`libs/pr-worktree`, and `libs/close-migration` for native dependencies, dynamic imports, and
`import.meta.dirname`. It found one hit, at `libs/pr-worktree/src/git-fixtures.ts:49`, which is a
test fixture helper and not a runtime path. Spawning `git` and `gh` is unaffected, because
`child_process` is a Node builtin that esbuild leaves external. Interactive input already works
inside the bundle: `libs/portable-tools/src/nexus-cli.ts:117` runs a `readline` prompter for
`workspace init`.

On the parity gate, the agent found two independent layers. The fingerprint pin iterates
`ENTRY_POINTS` automatically at `libs/portable-tools/src/parity.ts:39`, so collapsing to one entry
point shrinks the pin from seven entries to two, and adding verbs costs the pin nothing. The executed
corpus diff is hand-written per capability and covers four entry points. `nexus-cli` has no
executed-diff coverage today. That coverage gap is real work, and it is identical under both options.

The agent corrected ticket 01's sequencing constraint. The six capabilities without a dependency-free
form are five to build plus one to delete, not six to build. `pr-acceptance` does not need a
dependency-free form, because it must leave the payload.

The agent judged Option 2 unreachable rather than merely expensive. Shipping the scripts as files
requires shipping `node_modules/@nexus/*` with them, which means publishing each library, carrying a
resolver and a lockfile, and accepting an install that can fail behind a proxy or a private registry.

The agent also found that `docs/delivery/lessons/2026-07-14-portable-nexus-tooling.md:38` records
that the bundle was built to inline npm dependencies deliberately, so that the workspace resolver and
its `yaml` dependency could ship through the same vehicle, and that the decision record of that epic
explicitly refused a per-file transpile for this reason.

### From `nxs-pm`

The agent proposed the rule this resolution adopts: a capability that a component body can reach
becomes a verb on one executable, and a capability that only Nexus's own build reaches stays a
TypeScript file in the source repository and never ships.

The agent checked six consumer repositories on this machine. The skill scripts that actually deployed
and ran there are the older Python ones, which are standard-library only and dependency-free. The
TypeScript generation of these scripts coincides with a window in which nothing re-deployed. So the
TypeScript skill scripts have never worked outside this repository.

On who reads a script file, the agent separated three readers. The external adopter cannot execute
the script and reads `SKILL.md` prose instead. The contributor reads the library in `libs/`, where
the logic is, and treats the shim as duplication to keep in sync. The maintainer reads the shim
occasionally when debugging an invocation string. Only the third case is served by the file's
location, and the source does not move under a collapse, so that case is preserved.

On the installation experience, the agent argued that a partial install is structurally impossible
with one artifact and is the normal failure mode with several. Under several files, staleness becomes
granular, which is worse than the current situation rather than better, and failure surfaces
mid-pipeline inside a gated stage as a module-resolution error.

The agent judged the verb list an asset. Nexus has no adopter-visible interface today except prose.
It recommended two tiers from the start: a public tier that is governed by the version identity
decision 04 introduced, and an internal tier under `nexus internal <verb>` that carries no
compatibility promise. It sized the surface at roughly 20 to 25 verb and subcommand pairs.

The agent named one mitigation as load-bearing for its recommendation: keep a way to run the
TypeScript source directly inside the Nexus repository, so the maintainer's edit-and-rerun loop does
not gain a build step.

## Resolution

- **Decided:** The split is stated as a rule rather than a list, and the rule is drawn by reachability
  rather than by file type. **A capability that any Nexus component body invokes becomes a verb on a
  single named executable. A capability that only Nexus's own build or release process invokes stays
  a TypeScript file in the Nexus repository and never ships.** Four consequences follow, and each is
  part of the decision. First, seven of the eight skill scripts become verbs, and the logic does not
  move, because it already lives in `libs/`. Only the argument-parsing shim relocates into the verb
  table. Second, the five existing distiller bundles collapse into that same executable, because
  `/nxs.distill` invokes them from a component body, and the rule does not distinguish them from a
  skill script. Third, `pr-acceptance` gets no verb and leaves the payload, because no component
  invokes it and it requires a git checkout of Nexus itself. It stays a maintainer tool in the Nexus
  repository, and the acceptance runbook must be pointed at its new home rather than left to
  discover the deletion. Fourth, this ticket collapses the TypeScript capabilities only. The Python
  capabilities remain a second toolkit, named separately, and Nexus requires both `node` and
  `python3`. The honest claim is that the refactor reduces four run-time prerequisites to two. It is
  not one executable file.
- **Why:** The ticket's cost framing was inverted, and correcting it decides the question. Option 1
  was written as growth, and it is consolidation. Nexus does not ship one bundle. It ships six that
  are about 93 percent the same bytes, so the shipped artifact falls from 1,835 KB to 395 KB while
  covering 13 capabilities instead of 6. The measured cost of adding every skill script to the
  existing bundle is 32 KB and 18 ms. Option 2's stated benefit does not exist in the current tree,
  because every script is a shim and the logic is already in `libs/`. Option 2's stated cost was
  understated as "keeps the toolchain requirement". Its real cost is a published package graph, a
  resolver, and a lockfile, because a target repository cannot supply `node_modules/@nexus/*` without
  being a Nexus checkout. Ticket 01 already refuted that parameterisation, and ticket 04 already
  refused a second copy of any component. The decisive fact is that the TypeScript skill scripts have
  never worked outside this repository, so Option 2 is not a status quo to preserve. It is a rewrite
  that reaches the same destination by a longer route and re-creates per-repository staleness on the
  way. Extending the rule to the five distiller bundles is what retires the dual invocation prose in
  `/nxs.distill`, where the same instruction is written twice and can diverge. Holding Python out is
  what keeps the decision honest: the Python scripts are standard-library only, they need no package
  install, and `delivery_config.py:417` already shells to `nexus.mjs` across the runtime boundary, so
  a second named toolkit is a proven shape rather than a new risk.
- **Refuted alternative:** Option 2, keeping each skill script as its own file and giving the
  components a shared way to find a runtime that can execute it. It loses on reachability before it
  loses on cost. Finding a TypeScript-capable runtime is solvable; supplying `@nexus/*` to the script
  is not, unless every library is published and installed per machine. That converts a single
  artifact into a dependency tree, makes the install non-hermetic in the continuous-integration and
  container cases decision 04 named, and adds a release surface per library on top of the version
  identity decision 04 already requires. It also makes staleness granular, so a repository can run
  seven current capabilities and one stale one with no single answer to which version is installed.
  A second alternative, keeping the five distiller bundles separate and collapsing only the skill
  scripts, is refuted for a narrower reason. It leaves the dual invocation prose in `/nxs.distill`
  in place, and it keeps paying about 258 KB per bundle for a shared core, which is the cost this
  decision exists to remove.
- **Resolved by:** sameera on 2026-08-15

### What this binds, and what it hands to other tickets

Two ordering constraints bind the eventual backlog, and both must be stated as gates rather than as
notes.

Ticket 01's sequencing constraint is corrected but not lifted. Five capabilities must gain a
dependency-free verb, and `pr-acceptance` must be removed from the payload. Every verb must land and
pass the parity gate before any invocation string changes, because a component that names a verb that
does not exist yet fails when a pipeline stage runs, not when the toolkit is installed. There are 45
TypeScript invocation sites across 8 command bodies and 17 skill bodies, so a partial migration is
the default outcome unless the order is enforced.

The maintainer's edit-and-rerun loop must keep a path that runs the TypeScript source directly inside
the Nexus repository. The product perspective named this mitigation as load-bearing for its
recommendation, and the parity gate already runs the source under `tsx` at build time, so the path
exists and needs only to be kept.

This resolution hands ticket 05 a concrete compatibility surface. Once components name verbs, the
verb names, their flags, their exit codes, and their standard-output shape become the interface
between a pinned repository and an installed toolkit. That obligation exists today and is invisible,
because command bodies already hard-code script paths and argument strings. Making it legible is what
lets a version pin protect it. The public and internal tiering the product perspective proposed is a
candidate answer, and ticket 05 decides it.

This resolution does not decide where copies of the executable live. One bundle for the whole
TypeScript toolkit is compatible with a per-machine install, with a hub-vendored copy, and with both.
Ticket 07 decides that, and ticket 10 decides the channel the executable arrives through.
