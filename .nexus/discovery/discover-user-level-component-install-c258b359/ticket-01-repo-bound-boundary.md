---
title: "Which Nexus component behaviours genuinely require running inside the target repo, and which only appear to?"
type: research
status: resolved
blocked_by: none
claimed_by: sameera
claimed_at: 2026-08-15T11:42:53Z
---

## Question

Draw the boundary between two sets, naming every member of each.

1. Behaviours that must read or write the target repo, and therefore stay repo-bound regardless of
   where the component file lives. The `.nexus/` store, the resolved docs root, the git worktree,
   and the GitHub remote are the candidates.
2. Behaviours that only look repo-bound because a path is written relative to the current working
   directory. Roughly forty invocations across the command set are written as
   `tsx ./.claude/skills/<skill>/scripts/<script>.ts`, and the path is repo-relative rather than
   component-relative.

The earlier attempt at a user-level install concluded that "most skills assume they are running
inside the repo". This ticket tests that conclusion against the actual component set instead of
accepting it.

## Why it blocks

Until the two sets are named, nobody can say what a shared install has to change. If set 2 is
nearly all of it, the refactor is an addressing change and a runtime change. If set 1 contains
behaviours that read files shipped beside a skill, or that assume the component tree and the
project tree are the same tree, those are separate goals and separate stubs.

## Evidence

### From the `Explore` agent, 2026-08-12

**The managed set.** `nexus deploy` mirrors three subtrees, `commands/`, `agents/` and `skills/`
(`libs/portable-tools/src/vendor-components.ts:21`), into the target's `.claude/`
(`libs/portable-tools/src/deploy-components.ts:63`). The payload is 8 commands, 3 agents and 11
skills. The skills carry 7 TypeScript scripts, 2 Python scripts and 1 shared Python module.

**Set 1, genuinely repo-bound.** Four resource families, each with many call sites.

1. The `.nexus/` store. Config at `.nexus/config/settings.yml`, the queue, the discovery folder,
   the concepts and anchors, the gitignored `.nexus/tmp/`, and the hub's vendored tools at
   `.nexus/tools/`. Read and written across all 8 commands and 4 of the scripts.
2. The resolved docs root. Both agents that read product context, the setup skill that writes
   `product/context.md`, and the commands that write features, lessons and the atlas.
3. The git worktree and history. Worktree creation for the pull-request flow, `git rev-parse
   --show-toplevel`, the diff passes in analyze and close, and every commit the pipeline makes.
4. The GitHub remote. This family is the sharpest, because the repository a `gh` call hits is not
   passed as an argument. It is inferred by `gh` from the working directory's remote unless
   `--repo` overrides. See `libs/record-digest/src/fetch.ts:46` and `libs/epic-resolve/src/gh.ts:9`.

**Set 2, only apparently repo-bound.** 34 sites write `tsx ./.claude/skills/<skill>/scripts/<x>.ts`,
spread across all 8 command files and 8 SKILL.md files. A further 13 sites invoke
`python3 ./.claude/skills/nxs-gh-shared/delivery_config.py`. Two skills document their own script as
`./scripts/<x>.py`, relative to the skill directory, while the commands that call the same file use
the full `.claude/skills/...` form. Every one of these paths names a file that ships in the payload.
None names a project resource. Note that `delivery_config.py` already takes the config root as an
explicit `--root` argument, so the project root and the module path are separable and already
separated at that command-line surface.

**Finding: does any component read a data file shipping beside a skill?** Almost none. There is no
`references/`, `assets/`, `templates/` or corpus directory anywhere under `.claude/skills/`. The one
file read from beside a skill is `delivery_config.py`, imported as a Python module by the two
issue-creating scripts. Every template a component reads is a project resource under
`.nexus/config/templates/`.

There is one leak. `.claude/commands/nxs.close.md:463` falls back to
`common/templates/close-record-template.md`, which exists only in the Nexus checkout. The agent
reports that nothing in `libs/portable-tools/src/` seeds or vendors `.nexus/config/templates/`, so
the claim at `.claude/commands/nxs.setup.md:234` that the install step seeds the tool-agnostic
templates is not satisfied by `nexus deploy`. That is a defect in the current arrangement, found
while answering this question.

**Finding: are the skill scripts self-contained?** No, and this is the heaviest fact in the report.
All 7 TypeScript scripts import `@nexus/*` workspace packages. Those resolve through
`node_modules/@nexus/*`, which are pnpm symlinks into `libs/`, declared as `workspace:*`
dependencies. Node and `tsx` resolve them by walking up from the script file's own directory, so
today the scripts are bound to the ancestors of `.claude/`, meaning the Nexus checkout itself.
`libs/pr-acceptance/src/provision.ts:189` exists only to lend the source checkout's `node_modules`
to a clone, and its comment states the constraint directly.

Only the workspace status and docs-root capabilities have a bundled, dependency-free form. The
bundled entry points are the atlas generator, the validator, the hub diff derivation, the drift
advisory, the registry seeder and the `nexus` command-line tool
(`libs/portable-tools/src/build-bundles.ts:14`). The `epic-resolve`, `record-digest`, `pr-worktree`,
`close-migration` and `pr-acceptance` capabilities have no bundled form at all. That is why five
commands offer a `node <tools-dir>/nexus.mjs` alternative for the docs-root read-out and offer no
alternative for anything else.

The two Python scripts are self-contained. They use only the standard library plus the sibling
module, and they locate that sibling from `__file__` rather than from the working directory.

**Finding: how does each script find the repo root?** Every script does it differently. The
mechanisms in use are an upward search from the working directory, an optional positional argument
falling back to the working directory, a `--dir` flag falling back to the working directory, a
`--root` flag defaulting to the current directory followed by an upward search, and derivation from
the script's own path. `pr_worktree.ts` is the only TypeScript script with no override at all: it
reads `process.cwd()` at lines 81 and 140. Underneath them, `libs/workspace/src/resolve.ts:121`
performs no search of its own. It stats the exact directory it is handed, so whatever a script
passes must already be the repo root.

**Finding: does anything assume the component tree and the project tree are the same tree?** Yes,
in four places.

1. `.claude/skills/nxs-pr-acceptance/scripts/pr_acceptance.ts:61` resolves `TOOL_ROOT` by walking
   four levels up from its own directory, landing on the repo root that owns `.claude/`. Its own
   comment names the assumption. That root is then used as an authenticated repo root, as the
   source of the toolchain commit stamp, and as the tree that gets archived, lent its
   `node_modules`, and later stripped of worktrees and branches.
2. `libs/portable-tools/src/vendor-components.ts:31` is the mirror image on the producing side. It
   finds the live component tree by walking up from `libs/portable-tools/src/`, assuming `.claude/`
   sits at the Nexus repo root.
3. The close-record template fallback described above.
4. `.claude/commands/nxs.distill.md` reaches its tools through `pnpm nexus:*` scripts that exist
   only in the Nexus checkout's `package.json`. Every other repo takes the `.nexus/tools/*.mjs`
   branch instead. Single-repo mode and the Nexus repo itself are conflated there.

### From the `nxs-architect` agent, 2026-08-15

The agent was asked to verify the `Explore` report rather than repeat it. It confirmed the shape and
returned six corrections, three of which change what the boundary is.

**Counts.** The managed set is 12 skills, not 11: `nxs-gh-shared` is a bare module directory with no
`SKILL.md`. There are 8 TypeScript scripts, not 7: the report dropped
`.claude/skills/nxs-abs-doc-path/scripts/get_abs_doc_path.ts`, which also imports
`@nexus/workspace/resolve` at line 38. The invocation sites are 45, not 34: 28 across the 8 command
files and 17 across 8 `SKILL.md` files. The Python invocation sites are 12, not 13. The payload
carries 13 Python files, because 10 `test_*.py` files ship with it.

**Correction 1 — the payload is whatever is on disk, and it is already leaking.**
`listComponentFiles` at `libs/portable-tools/src/vendor-components.ts:47` walks the tree with no
ignore filter. The live set is 45 files, two of which are gitignored `.pyc` byte-code under
`__pycache__`. The committed pin at `libs/portable-tools/bundle-fingerprint.json` currently matches
that hash, so the byte-code is baked into the fingerprint. The parity gate at
`libs/portable-tools/src/parity.spec.ts:51` is therefore machine-dependent: a clean checkout with no
`__pycache__`, or a different Python minor version, produces a different hash and fails. And
`nexus deploy` writes byte-code into every target repo.

**Correction 2 — `pr-acceptance` is not a component-tree assumption. It is a maintainer-only tool
that should not be in the payload at all.** `TOOL_ROOT` at
`.claude/skills/nxs-pr-acceptance/scripts/pr_acceptance.ts:61` is not used as a target repo. It is
used as the Nexus source checkout: `git archive`d at `libs/pr-acceptance/src/provision.ts:115`, and
its `node_modules` symlinked into a scratch clone at `libs/pr-acceptance/src/provision.ts:189`. No
command invokes this skill.

**Correction 3 — the problem is already solved once, in hub mode.**
`libs/portable-tools/src/vendor-bundle.ts` builds six entry points
(`libs/portable-tools/src/build-bundles.ts:12`) into dependency-free `.mjs` files and vendors them,
with the component payload, into a hub's `.nexus/tools/`. They are invoked as plain
`node .nexus/tools/*.mjs` (`.claude/commands/nxs.distill.md:718`, and
`docs/features/multi-repo-workspaces/hub-tooling-install.md`). `delivery_config.py:417` already
locates that bundle from Python, including by way of a member's sibling hub. A shared install is a
generalisation of a pattern Nexus already ships, not new ground.

**Three smaller corrections.** `vendor-components.ts:31` walks three levels up, not four, and it is
producing-side code legitimately naming its own repo. The template leak is wider than one line:
`.claude/commands/nxs.close.md:462`, `.claude/commands/nxs.decision-record.md:330` and
`.claude/commands/nxs.setup.md:194` all read `.nexus/config/templates/`, and nothing in
`libs/portable-tools/src/` seeds any of them. A third addressing form exists and is already broken:
`.claude/skills/nxs-gh-create-epic/SKILL.md:21` and `nxs-gh-create-story/SKILL.md:16` write
`python ./scripts/<x>.py`, which resolves only when the working directory is the skill directory,
contradicting the working-directory-is-repo-root assumption every other site makes.

**The criterion the agent proposes.** Ask of every path a component touches: does this path identify
project state, the toolkit, or the toolkit's source? Each set gets one test. For set 1, copy the
component to another machine and run it against a different repo; if the correct answer changes, the
repo is an input, and the path must be reached from an explicitly passed target root. For set 2, run
the same test; if the answer does not change, the path names something identical for every repo on
the same Nexus version, and it must be reached from the component's own location. For set 3, ask
whether the behaviour requires a git checkout of Nexus itself; if it does, it belongs to neither set
and must not ship in the payload.

**The set-1 hole and the six conventions.** Every entry point resolves the target root differently:
an optional positional argument falling back to the working directory (`close_migration.ts:35`,
`workspace_status.ts:28`, `docs_root.ts:31`), a `--dir` flag falling back to it
(`epic_resolve.ts:86`, `record_digest.ts:53`), an upward search for `.git` or
`.nexus/config/settings.yml` (`get_abs_doc_path.ts:99`), a `--root` flag defaulting to `.` followed
by an upward search (`delivery_config.py:867`), and no override at all in `pr_worktree.ts` at lines
81 and 140. Only two of these do the upward search that makes the working directory safe.
`libs/workspace/src/resolve.ts:119` performs no search: it stats exactly the directory handed to it.

**Set 3, named.** All 8 TypeScript scripts import `@nexus/*`, resolved through pnpm symlinks into
`libs/`; six capabilities have no dependency-free form (`epic-resolve`, `record-digest`,
`pr-worktree`, `close-migration`, `pr-acceptance`, `abs-doc-path`). `tsx` itself is a devDependency
of this repo, presumed on the path by all 45 invocation sites. The `pnpm nexus:*` scripts at
`.claude/commands/nxs.distill.md:714` exist only in this repo's `package.json`, and the branch that
uses them is labelled single-repo when it means the Nexus repo. `pr-acceptance` in full. The 10
`test_*.py` files and 2 `.pyc` files. Producing-side `vendor-components.ts` and `vendor-bundle.ts`.

**The agent's headline finding.** The deployment story is already broken before any refactor. A
`nexus deploy` into a plain repository installs 8 commands whose scripts cannot resolve their
imports, and templates that nothing seeds. The only two configurations where the payload works from
end to end are the Nexus repo itself and a hub that has been vendored by hand.

**The agent's open clarification.** Does a shared per-machine install replace the hub's vendored
`.nexus/tools/`, or sit beside it? `docs/features/multi-repo-workspaces/hub-tooling-install.md`
commits the bundle into the hub repo deliberately, one time per repository rather than per machine.
A per-machine install inverts that trade, and `delivery_config.py:428` already hard-codes the
two-candidate search.

## Resolution

- **Decided:** The boundary has three sets, not two, and it is drawn by a criterion rather than a
  list. The criterion is: what does this path identify — project state, the toolkit, or the
  toolkit's source checkout? **Set 1, repo-bound**, is four resource families: the `.nexus/` store,
  the resolved docs root, the git worktree and history, and the GitHub remote. Each must be reached
  from a target root that is passed explicitly, with the working directory as its default rather
  than as its definition. **Set 2, addressing only**, is every invocation path and nothing else: 45
  TypeScript sites, 12 Python sites, and 6 skill-relative Python sites. No component reads a data
  file that ships beside a skill, with the single exception of `delivery_config.py`, which already
  locates itself from `__file__` and is the model for the rest. **Set 3, bound to the Nexus source
  checkout**, is the category the two-set framing had no room for, and it is the one that decides
  the refactor: the `@nexus/*` workspace imports in all 8 TypeScript scripts, the `tsx` runtime
  itself, the `pnpm nexus:*` scripts in `nxs.distill.md`, the whole of `pr-acceptance`, and the test
  files and byte-code that ride along in the payload. Set 3 must leave the payload; it cannot be
  addressed or parameterised into working.
- **Why:** The working directory is not a category. It is today's implicit encoding of the set-1
  target root, and it is simultaneously being used as the set-2 component root. Because Nexus is
  developed inside the repo it manages, those two roots and the Nexus source checkout are the same
  directory, so the conflation is invisible here and only here. Naming three sets turns one variable
  into three, and each one becomes a separate goal with a separate test. A criterion rather than a
  list is what makes the boundary survive a component written next year: its author asks the
  question once per path. The two-set framing also produced a wrong conclusion earlier. The claim
  that "most skills assume they are running inside the repo" is wrong at the level of data and right
  only at the level of string form — almost nothing reads project state that it should not, and
  almost everything writes a path that it should not. Set 3 is what the earlier attempt actually hit
  and could not name. A further consequence follows and should be recorded now: a `nexus deploy`
  into a plain repository does not work today, because the scripts cannot resolve their imports and
  nothing seeds the templates three commands read. The refactor is therefore not an improvement to
  installation. It is the first installation that works outside the Nexus repo and a hand-vendored
  hub.
- **Refuted alternative:** Keeping the two-set framing the ticket was written with, and treating the
  `@nexus/*` and `tsx` dependencies as a set-1 member that a runtime flag could satisfy. It loses
  because those dependencies are not satisfiable by any target repo at all. A repo cannot supply
  `node_modules/@nexus/*` without being a Nexus checkout, so parameterising the path to them
  produces components that look relocatable and fail when invoked. A sequencing constraint follows
  from the same fact: giving the six unbundled capabilities a dependency-free form must precede
  changing the addressing strings, because the reverse order ships components that appear to be
  installed correctly and break at run time.
- **Resolved by:** sameera on 2026-08-15
