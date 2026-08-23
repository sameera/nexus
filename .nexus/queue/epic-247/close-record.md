---
title: "Close Record: Collapse the component-invoked TypeScript capabilities into verbs on one named executable"
epic: "#247"
feature: "Component Distribution"
date: 2026-08-23
analyze: ran 2026-08-23 @ 31fdeaae5ede15c394849509321c9c45a962d2c5
record: "#277"
record_hash: ce3bf375199c26537c5007c06bbc41c22aabde938646178282f944f964d97455
range:
  - repo: github.com/sameera/nexus
    base: 696237948ed63725bb9c0bec62c305935ddb737e
    head: ca0553675f0bfb2cf1ce23679c10572f2e0467ce
---

# Close Record: Collapse the component-invoked TypeScript capabilities into verbs on one named executable

## Key Decisions

- **Hermetic `gh` stand-in for migration-axis parity (story #272):** a committed, PATH-shimmed executable stand-in (`libs/portable-tools/corpus/bin/gh`) answers the exact `gh` call shapes `epic-resolve`/`record-digest`/`pr-worktree` make, matched by argv shape and read from a fixture named by `NEXUS_PARITY_GH_FIXTURE`. Needed because `defaultRunner` shells out via `spawnSync` with no injectable seam at the CLI boundary — only an executable on `PATH` can stand in for a spawned child process. Refuted: reusing `libs/epic-resolve/src/gh-fixtures.ts`'s spec-only `FixtureGraph`/`makeGhRunner`, which doesn't cross a process boundary without reimplementing the argv-matching layer anyway.
- **Migration-axis corpus for `epic-resolve` kept to zero-sub-issue cases:** the two AC-required cases (clean resolve, named failure diagnostic) are both reachable without a second external-program surface (`python3` classification resolution), so that stand-in was skipped as unnecessary for this story's ACs. A fuller corpus remains addable later without revisiting the choice.
- **`pr-worktree` effect parity runs script-then-verb against one shared scratch repo, not two independent copies:** since the worktree path derivation is a pure function of `repoRoot`, running both sides against the same repo makes the second call exercise the already-tested idempotent re-run path instead of requiring a path-normalisation primitive for two independently built repos. Refuted: two independent scratch repos with path normalisation — more rigorous but adds real surface (deterministic git SHAs or a new normaliser) for a rigor increment the story's AC didn't ask for.
- **`pr-worktree`'s `gh pr view` fixture is generated at test time, not committed:** `deriveRange`/`openCloseWorktree` do real git operations against SHAs a freshly built scratch repo produces, so a statically committed fixture would reference commit SHAs from a repo that doesn't exist yet at commit time. Refuted: committing a fixed scratch-repo `.git` (or bundle) as corpus data — no precedent in this repo, heavier to maintain than the topology builder already in place.
- **Standalone launchers hoist the process boundary out of all five distiller capabilities (story #274), not just the two the decision record's Risk section named:** all five capability files lose their `main()`/self-exec guard entirely (including the three that already had filename-basename disambiguation), each gaining a guard-free `<name>-launcher.ts` sibling that `ENTRY_POINTS` now names. The record states the hazard is structural ("inlining collapses every module's sense of which file was invoked down to one value") and that the basename mitigation "expires silently the moment the artifact is renamed" — exactly what repointing `ENTRY_POINTS` at a launcher does to the three already-guarded files. Verified concretely: all six bundles built fresh, every verb and every standalone `<name>.mjs`/`pnpm nexus:*` script run, byte-identical output.
- **Acceptance harness relocated to `libs/pr-acceptance/src/cli.ts`, and `.claude/skills/nxs-pr-acceptance/` deleted outright (story #275):** a `SKILL.md` is what makes a capability agent-invocable, so keeping a neutered pointer would half-preserve the exact property the decision record's accepted trade removes. Its operating-constraints prose moved into the live-acceptance runbook, which already sequenced the same commands. Refuted: leaving a discoverability-only `SKILL.md` stub — undoes the payload-boundary trade the record accepts.
- **Structural composition check as a new regex-based module, not an AST parse (story #275):** `component-composition.ts`'s `findWorkspaceImports` is a regex over `from "@nexus/..."` / `require("@nexus/...")`, enforced against a committed `component-composition-waivers.ts` register (the 7 legacy `.claude/skills/*/scripts/*.ts` shims stories #272–#274 left in place) via a live-tree test that fails if the register goes stale in either direction. A regex suffices because the surface is this repo's own component tree, where every real violation is a plain top-level import. Refuted: an AST-based check — no file in the managed subtrees uses a dynamic/computed import, so the added compiler-dependency weight isn't warranted.
- **`pnpm nexus:*` dev aliases repointed at `nexus-cli.ts` directly, not at story #274's per-capability launchers (story #276):** decision record #277 explicitly calls for "no separate source-side entry point, and no verb-specific source command" for this story; the launchers exist so `build-bundles.ts` has a guard-free standalone entry per artifact, a distinct concern from the maintainer-facing dev alias. `nexus:vendor-tools` is untouched (it's the vendoring orchestrator, not a capability alias). Verified each repointed script by hand against real repo state.

## Deviation Rationale

- **No dedicated "recorded argument log" comparison facet in `pr-worktree`/`close-migration` parity, contrary to the decision record's stated five-facet comparison ("standard output, standard error, exit code, the recorded argument log, and the resulting file tree"):** the CLI adapter in `nexus-cli.ts` calls the exact same shared library functions (`resolveRole`, `resolvePr`, `openAnalyzeWorktree`, `openCloseWorktree`, `deriveRange`, `removeWorktree`, `closePreflight`, `migrateEntry`) with the same `Runner` the legacy scripts call — there is exactly one place in the codebase that constructs `git`/`gh` argv for these operations, so no second code path could construct a diverging one. A dedicated argument-log stand-in (a fake `git` on `PATH` logging every invocation) was judged redundant given that structural guarantee, plus the existing worktree-presence assertions and byte-identical stdout/stderr/exit-code comparison, which together already prove the spawned calls' effect agrees. Story #273's AC ("the spawned process receives the same arguments") is satisfied by construction rather than by a runtime facet, which is a real divergence from the record's literal chosen approach even though the underlying property holds. Flagged to the decision record in the close amendment (#277).

## Deferred Scope

None. All follow-on work this epic's Out-of-Scope section names (#248–#254, #257) was already filed before this epic started; nothing new surfaced during implementation that isn't already tracked.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-23-typescript-capabilities-as-verbs.md`
