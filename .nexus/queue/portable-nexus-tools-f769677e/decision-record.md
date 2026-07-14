---
title: "Decision Record: Portable Nexus Tooling"
epic: #44
feature: "Multi-Repo Workspaces"
rating: M
concepts: [distiller, concept-store, workspace-resolution]
date: 2026-07-13
---

# Decision Record: Portable Nexus Tooling

## Summary

This epic makes the two distill-time deterministic scripts — the concept validator and the atlas
generator — runnable in a bare docs hub that has Node.js and git but no `tsx`, no `node_modules`, and
no pnpm workspace. The chosen shape keeps the in-repo TypeScript as the single authoritative source
and ships a compiled, dependency-inlining bundle vendored into the hub, with `/nxs.distill` selecting
between the in-repo scripts and the vendored bundle based on workspace resolution, and a load-bearing
parity check guarding the two paths against drift.

## Chosen Approach

Compile the existing `utils/` TypeScript scripts with a dependency-inlining bundler into
self-contained executable artifacts (one per entry point — validator and atlas generator, the latter
still covering its `--check` sync mode via a flag) targeting the hub's Node floor. Vendor those
artifacts into the hub repo, committed alongside the concept store, so every hub checkout carries
identical offline tooling. `/nxs.distill` consumes the existing workspace resolver: in a hub it runs
the vendored bundle via `node`; in a single repo (neither manifest nor pointer present) it keeps
today's `pnpm nexus:*` invocation unchanged. A parity check — run in the source monorepo, where both
the source and a freshly built bundle exist — executes both over one committed representative corpus
and fails on any divergence in validator findings, exit codes, or atlas bytes.

## Key Decisions

### Single TypeScript source, compiled — not reimplemented, not type-stripped

- **Decision:** The `utils/` scripts stay the sole source of validator and atlas logic; the
  distributable is a compiled build of that source. No hand-written JS twin.
- **Why:** Parity then holds structurally at the logic level (identical source), and maintenance
  stays single-headed — which is exactly what makes the parity guarantee meaningful (the epic's own
  assumption: portability tracks the source).
- **Refuted alternative:** Rely on Node's native TypeScript type-stripping to run the source directly
  under `node` in the hub. Genuinely viable for these two annotation-only, builtin-only scripts and it
  avoids a build step entirely — but it is Node-version-gated (experimental below the 22.18 line; the
  dev box here is 22.15) and, decisively, offers no path to inline an npm dependency (`yaml`) in a hub
  that has no `node_modules`, which the shared vehicle must support later. A separate plain-JS
  reimplementation was also refuted: it doubles maintenance and turns the parity check into a
  permanent guard against two diverging codebases.

### A dependency-inlining bundle is the packaging vehicle

- **Decision:** Promote the two scripts from loose `tsx`-invoked files into a first-class buildable
  project — a standalone library with its own build target, the way the repo already packages its
  libs — and build it to a self-contained bundle via a dep-inlining bundler (esbuild is already in the
  tree via Vite/tsx), Node-targeted, with all non-builtin dependencies inlined into the artifact.
- **Why:** This is the single mechanism that both runs under `node` alone today and lets later tools —
  the workspace resolver plus its `yaml` dependency — ship through the same vehicle into a
  `node_modules`-free hub. It satisfies the epic's forward requirement without shipping anything extra
  now (today's two scripts inline nothing, because they use only builtins).
- **Refuted alternative:** Per-file transpile with `tsc` or `swc` (both present). Simpler config for
  today's builtin-only scripts, but neither inlines npm dependencies, so the vehicle would fail its
  stated forward requirement the moment `yaml` arrives — forcing a packaging redesign under a later
  epic that is supposed to just consume this one.

### Placement: vendored and committed into the hub — no registry, no per-machine install

- **Decision:** The built artifact is copied into the hub repo under the Nexus-owned area (beside the
  concept store, anchors, and queue) and committed. The documented one-time "install/placement" step
  (Story 2) is that copy-and-commit; there is no `npm install` and no registry fetch.
- **Why:** Every hub clone then carries identical, offline, reproducible tooling — consistent with
  workspace-resolution's "identical description from any checkout" philosophy and with the hub being a
  docs-only repo. It also gives `workspace-setup-cli` a concrete artifact to distribute later.
- **Refuted alternative:** Publish to npm and pull it in via a global install or `npx`. Idiomatic and
  it keeps the hub free of a committed build artifact — but it adds a registry + network +
  version-pinning dependency to a docs repo, makes each engineer's hub non-reproducible, and registry
  publishing is explicitly out of scope for this epic.

### `/nxs.distill` resolves the invocation by branching on workspace resolution

- **Decision:** distill consumes the existing resolver; in a hub it invokes the vendored bundle via
  `node`; in single-repo mode (neither artifact present) it keeps today's `pnpm nexus:*` invocation
  verbatim.
- **Why:** This keeps the single-repo path literally unchanged and the in-repo scripts the *executed*
  authority (exercised on every single-repo drain), and it reuses the resolver that already exists
  rather than re-deriving workspace context — honoring the resolver's "sole producer of workspace
  context" invariant.
- **Refuted alternative:** One unified invocation that always runs the compiled bundle in both
  contexts. Genuinely simpler — one code path, parity becomes trivially structural — but it demotes
  the in-repo source to mere build input, forces the bundle to be built and committed inside code
  repos too, and changes the single-repo mechanism, breaking the epic's "in-repo authoritative" and
  "single-repo unchanged" invariants. This is why the parity check (below) must stay load-bearing
  rather than being dissolved.

### Parity is enforced by a load-bearing check over a committed corpus, run in the source repo

- **Decision:** A check runs both the in-repo source and the (freshly built or committed) bundle over
  one representative committed corpus and fails, naming the divergence, on any difference in validator
  findings, exit codes, or atlas bytes. It runs in the source monorepo — the only place both the
  source and the bundle coexist — not in the hub.
- **Why:** Single-source compilation gives structural parity of *logic*, but the vendored artifact is
  a committed derived file that can lag its source (someone edits `utils/` and forgets to rebuild and
  re-vendor). Only an executed diff over a corpus catches that staleness, and Story 3 explicitly
  requires an *enforcing* check, not documentation.
- **Refuted alternative:** Lean on structural parity alone ("single source, therefore cannot
  diverge") and skip a runtime check. False for a committed build output, and it fails Story 3's
  second acceptance criterion outright.

### The parity gate's trigger is the nx test suite, hardened by a committed bundle fingerprint

- **Decision:** The parity check is a vitest spec in the packaging project's nx `test` target. It
  builds the bundle in-process (esbuild API, already in the tree), diffs source vs fresh bundle over
  the committed corpus (findings, exit codes, atlas bytes), and asserts the fresh build's hash equals
  a committed fingerprint pin that the vendor step updates. A `utils/` edit without rebuild and
  re-vendor breaks the pin match and fails the suite.
- **Why:** The repo has no CI and no git-hook infrastructure; the test suite is the one gate that
  already runs and already counts (TFD, the coverage bar). The suite also catches drift a
  path-scoped hook misses — bundler-config changes, an esbuild version bump, corpus edits. The
  fingerprint leg exists because a rebuild-and-diff alone can never catch vendored staleness: both
  sides of that diff are always current.
- **Refuted alternative:** A pre-commit/pre-push hook scoped to `utils/**` and the vendored
  artifact. It would introduce per-machine hook infrastructure the repo doesn't have, hooks don't
  travel with `git clone`, `--no-verify` skips them silently with no CI backstop, and the path
  scoping misses drift from outside `utils/`. When CI arrives, the suite test upgrades to a hard
  remote gate unchanged; a hook wouldn't.

## Constraints & Invariants

1. The in-repo `utils/` TypeScript scripts remain the single authoritative source of validator and
   atlas logic; the distributable is a derived build and is never hand-edited. *(Stories 1, 3)*
2. The distributable runs on a plain Node.js runtime alone — plus the `git` CLI for the validator's
   `--base` append-only mode — and must not require `tsx`, `typescript`, `nx`, or a pnpm workspace.
   *(Story 1)*
3. For identical input, the distributable's atlas output is byte-identical to the in-repo generator's,
   and its validator findings and exit codes (0 clean / non-zero on findings) match the in-repo
   validator's exactly. *(Stories 1, 3)*
4. The atlas's DERIVED-file header uses environment-neutral wording — it names no toolchain-specific
   rebuild command or source path — so the single byte-identical atlas output reads correctly in both
   a code repo and a docs hub. *(Stories 1, 3; resolves the design-gate clarification, preserving
   Invariant 3)*
5. The packaging build inlines every non-builtin npm dependency into the self-contained artifact;
   nothing is resolved from a `node_modules` at hub runtime. *(Story 1 forward-compat)*
6. The compiled artifact's executable entry point must run its main routine when launched by `node`;
   the entry guard must stay correct under the chosen module format (an ESM bundle preserves the
   `import.meta.url` guard the atlas generator uses today; a CJS bundle would require the
   `require.main` idiom instead). *(Story 1)*
7. `/nxs.distill` selects its invocation from workspace resolution — hub → vendored bundle via `node`;
   single-repo (neither artifact) → the existing in-repo invocation — and re-derives no workspace
   shape of its own. *(Story 2)*
8. Single-repo distillation is unregressed: no hub-only assumption may enter the single-repo path, and
   its deterministic steps still run and pass unchanged. *(Story 2.3)*
9. The vendored artifact is committed into the hub's Nexus-owned directory so the hub needs no network
   and no install step at drain time; it executes trusted, review-gated committed code, and distill
   invokes it (and the validator invokes `git`) via argument-vector execution, never a
   shell-interpolated command string, so page paths and refs cannot inject. *(Story 2.1/2.2; security
   boundary)*
10. The parity check is a required gate: a spec in the packaging project's nx `test` target that
    rebuilds the bundle in-process and fails naming the divergence on any finding, exit-code, or
    atlas-byte mismatch. It runs in the source repo. The corpus, bundler config, and fingerprint pin
    live inside that project so the cached nx target invalidates whenever any of them change.
    *(Story 3.2)*
11. The representative corpus exercises every validator finding category (frontmatter completeness,
    §8.3 code/path/identifier rejections, word cap, `touches` == Integration Points, slug format, and
    — via `--base` — the exactly-one-new-Decision-Log-entry and append-only checks) and non-trivial
    atlas clustering (multiple connected components, singleton/Standalone handling, and the
    degree-then-slug ordering with ties). *(Story 3.1)*
12. The parity spec asserts the freshly built bundle's hash equals a committed fingerprint pin; the
    vendor step updates the pin and copies the matching artifact into the hub. A source edit without
    rebuild-and-re-vendor fails the suite on the pin mismatch, so staleness is caught in the source
    repo before it ships. *(Story 3; resolves the ADDRESS risk)*
13. The vendored artifact's hub path has exactly one producer: workspace resolution exports it as
    part of workspace context — the same context Invariant 7 already makes distill consume — and the
    Story 2 placement doc and the vendor step name that path from this single definition; no
    consumer hard-codes it independently. The literal directory is fixed at implementation and
    recorded here once chosen, because renaming a committed artifact across hub clones is a
    migration. *(Story 2; extends workspace-resolution's sole-producer invariant)*

## Risks (BLOCKER / ADDRESS only)

_None open. The one ADDRESS risk raised — the parity/staleness gate had no automatic trigger — was
resolved: the check is bound to the packaging project's nx `test` target, with a committed bundle
fingerprint catching source-edited-but-not-re-vendored staleness. Folded into the parity-trigger
decision and Invariants 10 and 12._

## Open Clarifications

_None. The one clarification raised at the design gate — the atlas DERIVED-header wording under
byte-parity — was resolved (environment-neutral wording) and folded into Invariant 4._
