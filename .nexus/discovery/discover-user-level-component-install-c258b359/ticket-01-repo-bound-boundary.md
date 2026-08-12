---
title: "Which Nexus component behaviours genuinely require running inside the target repo, and which only appear to?"
type: research
status: open
blocked_by: none
claimed_by:
claimed_at:
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

## Resolution
