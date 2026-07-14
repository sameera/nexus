---
title: "Close Record: Portable Nexus Tooling"
epic: #44
feature: "Multi-Repo Workspaces"
date: 2026-07-14
analyze: ran 2026-07-14 @ 75153b1
---

# Close Record: Portable Nexus Tooling

## Key Decisions

- **Vendored tools directory is `.nexus/tools`:** a sibling of `.nexus/concepts/`, `.nexus/anchors/`,
  `.nexus/config/`, `.nexus/queue/`, exported as `portableToolsDir` (`PORTABLE_TOOLS_RELATIVE_PATH` in
  `libs/workspace/src/resolve.ts`). Why: matches the flat, function-first naming of every other
  Nexus-owned `.nexus/` dir and names the vendored executables' purpose. Refuted `.nexus/vendor` — a
  common idiom for committed build output, but it names *how the artifact got there* rather than *what
  it is*, diverging from the sibling dirs.
- **The vendor helper takes `--tools-dir <full path>` and does build + pin + copy in one command:**
  `src/vendor-bundle.ts` builds each entry in-process, writes the fingerprint pin, and copies each
  `.mjs` to the given dir from the same in-memory bytes it hashed (so the copied artifact provably
  matches the pin). Why: keeps build/pin/copy in lockstep and hard-codes no hub path. Refuted importing
  `PORTABLE_TOOLS_RELATIVE_PATH` from `@nexus/workspace` and taking `--hub` — **blocked** by the
  `enforceBuildableLibDependency` lint rule (portable-tools is a buildable lib, `@nexus/workspace` is
  not, so the import is forbidden). Passing the full path plus a doc-reference satisfies Invariant 13's
  single-producer rule without the dependency.
- **`buildBundle` pins esbuild's `absWorkingDir` to the entry's own directory** so bundle bytes (and
  their sha256) are identical regardless of the caller's cwd. Why: the fingerprint pin (Invariant 12)
  must be reproducible; without this the nx `test` target (cwd = project root) and a repo-root vendor
  step would hash differently and the committed pin could never match. Refuted an nx `vendor` target
  locked to a shared cwd — leaves a latent cwd-coupling bug, the antithesis of a drift-proof pin.
- **Fingerprint pin is `bundle-fingerprint.json`, mapping `<entry>.mjs` → sha256 hex.** Why: the key is
  exactly the vendored filename, so the pin reads as "these committed artifacts have these hashes"; JSON
  is diff-legible and the spec compares it in one read. Refuted per-file `.sha256` sidecars — more files
  for two hashes, no single object to compare.
- **Corpus at `libs/portable-tools/corpus/`, subdivided by concern** (`clean/` exit-0, `findings/` one
  page per finding category, `atlas/` clustering graph, `base/`+`head/` `--base` fixtures the spec
  assembles into a scratch git repo). Why: one concern per subdir stops malformed finding pages from
  polluting the atlas graph and the `--base` pairs, and living in-project makes the cached nx `test`
  target invalidate when the corpus changes (Invariant 10). Refuted one flat dir — each check's intent
  becomes unclear and the fixtures interfere.
- **The parity spec runs the source through `tsx` and the fresh bundle through plain `node`** (both
  subprocesses over the same corpus), with the comparator + fingerprint logic in `src/parity.ts`, not
  inline in the spec. Why: `node` on the `.mjs` is exactly what a hub runs and `tsx` on the source is
  exactly what single-repo distill runs, so the diff compares the two real execution paths; keeping the
  comparator in `src/` lets the self-test (AC 3.2) drive the *same* code that guards real drift. Refuted
  an in-process `runCli` call with a spec-local comparator — compares an in-process call rather than the
  shipped artifact, and the self-test would exercise throwaway spec code.
- **The hub-tooling install/placement guide is its own file** (`hub-tooling-install.md`, linked from the
  feature README) rather than a README section. Why: this repo holds `docs/features/<feature>/README.md`
  to a short epics-index role; a how-to guide is a separate concern. Refuted appending a section to the
  README — breaks its established minimal-index role.

## Deviation Rationale

- **Authoritative source relocated `utils/` → `libs/portable-tools/src/`** (Invariant 1 and the decision
  record pin it at `utils/`): the decision record's own "promote the scripts into a first-class buildable
  library" decision entailed the physical move — a buildable lib cannot live in `utils/` — so Invariant
  1's `utils/` wording simply lagged its own decision. `pnpm nexus:*` was repointed to the new source, so
  the single-repo executed authority is preserved. Side-effect: 4 code anchors still cite old `utils/`
  paths (analyze LOW-2); anchors are derived/self-healing and the next `/nxs.distill` R1 refresh rebuilds
  them — no page or invariant references them.
- **`/nxs.distill` selects the hub-vs-single-repo invocation with an inline
  `test -f .nexus/config/{workspace,hub}.yml` and a hard-coded `.nexus/tools/` path, not by calling
  `resolveWorkspace()`/`portableToolsDir`** (deviates from the letter of Invariants 7 and 13): distill is
  a markdown/bash command and cannot import the TypeScript resolver. It keys off the *same* authoritative
  committed artifacts the resolver reads and forbids any new heuristic (never "no `package.json`"), so the
  role rule and the tools path hold in spirit; the duplication in prose is inherent to distill being a
  command, not code (analyze LOW-1). It will not auto-follow a future resolver change — a constraint the
  follow-on multi-repo distill epic inherits.

## Deferred Scope

Deferred items appended to: `docs/features/multi-repo-workspaces/backlog.md` — none this epic (all
acceptance criteria met, no scope cut).

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-14-portable-nexus-tooling.md`
