---
title: "Close Record: Make the Python toolkit reachable by name and let it find the executable by name"
epic: "#249"
feature: "Component Distribution"
date: 2026-08-26
analyze: ran 2026-08-26 @ dbf1fabad7731f5c8e1d3770cf531a860b384a88
range:
  - repo: github.com/sameera/nexus
    base: f67c6eff71086fb9f8be3e33cf45ce8586c2976d
    head: 7b17dd760610bf045621a8a9b196859edd06aac1
---

# Close Record: Make the Python toolkit reachable by name and let it find the executable by name

## Key Decisions

- **The name is `nexus-gh`, and its home is `libs/gh-toolkit/`, not `.claude/skills/`.** An
  executable entry point at `libs/gh-toolkit/bin/nexus-gh` over a package `libs/gh-toolkit/nexus_gh/`,
  dispatching three capabilities (`config`, `create-epic`, `create-story`). A hyphenated sibling of
  the TypeScript `nexus` reads as the same toolkit's other half; `libs/` is where toolkit code lives,
  and #252 ships the Python files as a payload part distinct from the component payload, so `.claude/`
  was the wrong home. *Refuted:* keeping the package under `.claude/skills/` — the three modules sat
  in three different skill directories, none of which is an importable package name, and #256 moves
  that tree out from under the harness anyway.

- **The old script paths are not kept as shims.** The three `.py` files move; nothing is left at
  `.claude/skills/nxs-gh-*/scripts/`. A shim there could only reach the package through a
  repository-relative hop — the exact addressing #298 exists to delete. *Refuted:* shims until #250
  lands.

- **The by-name locator is an export on `@nexus/workspace`, not a new package.**
  `libs/workspace/src/gh-toolkit.ts`, exported as `@nexus/workspace/gh-toolkit`, resolving PATH first
  and then the entry point beside these libraries driven on `python3`. `@nexus/workspace` is the one
  package both `@nexus/epic-resolve` and `@nexus/pr-worktree` already depend on, so a new package
  would have bought nothing but nx/pnpm wiring. The from-source fallback is resolved from the
  *library's* own location, never from the repository being acted on — which is what #300 AC2 forbids.
  *Refuted:* a new `@nexus/gh-toolkit-locate` package.

- **A capability's arguments travel as a parameter, not through `sys.argv`.** `create_epic.main` and
  `create_story.main` now take `argv` and pass it to `parse_args`; the dispatcher hands each
  capability its `rest` list. The `CAPABILITIES` table declared every row as `fn(argv) -> int`, and
  for two of three rows that was a lie — the real channel was the dispatcher's process-global
  mutation, which the comment beside it explicitly denied. Any in-process caller, test, or nesting
  would have been handed the wrong arguments silently. *Refuted:* keep the global as the channel and
  correct only the comment — cheaper, but it leaves a dispatcher whose declared signature cannot be
  trusted.

- **The resolver's usage text is not pinned to its pre-move filename.** `prog="delivery_config"` is
  dropped from the resolver's `ArgumentParser` so it inherits `sys.argv[0]`, which the dispatcher
  sets to `nexus-gh config`. The pre-move filename was leaking into the user-facing text of the
  capability whose whole story is that it answers to one name. *Refuted:* pin `prog` to the literal
  `"nexus-gh config"` — correct output, but it re-hard-codes a name the dispatcher already knows and
  would drift on a rename.

- **Fixture repos stop carrying a seeded resolver.** `seedResolver` is deleted from
  `libs/pr-worktree/src/git-fixtures.ts` and from `parity.spec.ts`; the parity harness instead puts
  `libs/gh-toolkit/bin` on PATH beside the `gh` stand-in. The resolver is no longer read from the repo
  under test, so seeding one made fixtures unlike every real repo after the components stop being
  committed. A bundle built into a scratch directory has no checkout to fall back into, so source and
  bundle only agree if the toolkit is reachable by name for both. *Refuted:* teaching the locator to
  find a bundle-relative install layout.

- **The TypeScript suite is left red between stories 1 and 4, deliberately.** Commits for #297 and
  #298 leave `libs/epic-resolve` and `libs/pr-worktree` pointing at the moved resolver; #300 repairs
  them, because #300 is the story that replaces those three lookups and is sequenced last
  (`blocked_by` #297, #298). Repairing them earlier would do #300's work out of order.

## Deviation Rationale

Epic #249 has **no decision record**, so this pass ran downgraded: deviations are measured against
the epic's own stated approach, scope, and success metrics (#249), with no invariant check.

- **No compatibility shims — the rename ships to `main` with 31 references in Nexus's own command and
  skill bodies naming deleted files.** Deviates from #249's implied safety of deferring the rewrite to
  #250: the epic's Out of Scope hands the invocation strings to #250, and #299's Notes carry an
  explicit *"Known interval, accepted"* for the hub-defaults layer (affected population: zero), but no
  equivalent note covers the component bodies, whose affected population is this repo's own pipeline.
  **Why:** a shim under `.claude/skills/nxs-gh-*/` could only reach the moved package through a
  repository-relative hop — precisely the addressing #298 exists to delete — so shipping shims would
  have reintroduced the anti-pattern the epic was built to remove. The open interval was accepted as
  the cheaper of the two. The `$(…)` substitution sites degrade silently to empty strings; the two
  filer skills (`nxs-gh-create-epic`, `nxs-gh-create-story`) are now `SKILL.md` bodies pointing at
  deleted scripts and fail outright. The interval closes at **#252** (PATH reachability), not #250.

- **`prog=` dropped from the resolver's parser, so `--help` and parser error text diverge from the
  captured baseline.** Deviates from #297 AC1, which asks for output identical to the pre-change
  baseline. **Why:** the divergence is the point of the story — the pre-move filename was appearing in
  the user-facing text of the capability being renamed. It is confined to `--help` and parser error
  text and touches no value a component site consumes: every site reads `resolve` / `backlog-query`
  stdout through `$(…)`, and those are byte-identical across all 15 declared github-block keys, all
  three `backlog-query` forms, and an unknown key. Named as intended and ratified on #297.

- **A behaviour fix landed inside an epic that declared it changes no capability's behaviour**
  (commit `dbf1fab`, the `main(argv)` refactor of both filers). **Why:** the move exposed that the
  dispatcher's declared `fn(argv) -> int` contract was carried by a `sys.argv` global mutation for two
  of three rows. Leaving it would have shipped a new named entry point whose declared signature was
  already untrue. External stdout is unchanged; the change is to the in-process contract.

- **The by-name locator added a new export surface to `@nexus/workspace`.** #300's Notes named the
  three call sites to repair but left unstated where the locator would live — an elaboration of the
  epic rather than a contradiction of it. **Why:** `@nexus/workspace` is the sole package both
  affected libraries already depend on, so the alternative was a new package bought entirely with
  nx/pnpm wiring.

- **`libs/portable-tools` was touched by an epic that named no story over it** — `seedResolver`
  removed from the fixtures, the parity harness switched to a PATH-based toolkit, and
  `bundle-fingerprint.json` regenerated. **Why:** consequential, not elective. Once the resolver stops
  being read out of the repo under test, a fixture that seeds one is unlike every real repo, and the
  bundle fingerprint necessarily moves when the payload's files move.

## Deferred Scope

none — the remaining work is already owned by open issues. The accepted interval and the two dead
skill shells are recorded as a comment on **#250** (invocation rewrite); PATH reachability, which
actually closes the interval, is **#252**.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-26-python-toolkit-by-name.md`
