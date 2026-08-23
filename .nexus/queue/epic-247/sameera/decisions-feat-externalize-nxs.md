## 2026-08-23 — Hermetic `gh` stand-in for migration-axis parity (story #272)

- **Choice:** A committed, PATH-shimmed executable stand-in (`libs/portable-tools/corpus/bin/gh`)
  that reads a fixture named by the `NEXUS_PARITY_GH_FIXTURE` env var and answers the exact `gh`
  call shapes `epic-resolve`/`record-digest` make (matched by argv shape: `repo view`, `issue
  view <n>`, `api graphql` keyed by a query-body substring, `api repos/.../issues/<n>`). The
  parity spec prepends its directory to `PATH` for both the `tsx`-run script and the
  built-bundle-run verb, so both sides of a comparison hit the same fixture.
- **Why:** `defaultRunner` (`@nexus/close-migration/run`) shells out via `spawnSync(cmd, args,
  {cwd})` with no injectable seam at the CLI level (the libraries' own specs inject a `Runner`
  function directly, but a spawned child process can't receive an injected function — only an
  executable it can exec by name). No prior art for this existed in the repo (confirmed by grep).
- **Refuted alternative:** Reuse `libs/epic-resolve/src/gh-fixtures.ts`'s `FixtureGraph` +
  `makeGhRunner` directly inside the stand-in. Rejected: that file is spec-only (excluded from the
  lib build) and its `Runner`-shaped API doesn't cross a process/PATH boundary without
  reimplementing the argv-matching layer anyway; simpler to keep the stand-in's fixture format
  purpose-built and minimal.

## 2026-08-23 — Migration-axis corpus scope for epic-resolve kept to zero-sub-issue cases

- **Choice:** The `epic-resolve` migration-axis corpus covers a zero-sub-issue epic (success) and
  an unresolvable epic (named diagnostic), not a fuller epic with stories/records/blocked_by
  edges.
- **Why:** A non-empty sub-issue set triggers `resolveRecordClassification`, which shells out to
  `python3 … resolve <key>` (the shared publishing resolver) in addition to `gh` — a second
  external-program surface the hermetic stand-in would need to cover. The two AC-required cases
  (a clean resolve, and a named failure diagnostic on stderr) are both reachable with zero
  sub-issues, so the python3 stand-in is unnecessary for this story's acceptance criteria.
- **Refuted alternative:** Build a `python3` stand-in too, for a corpus case with real stories and
  a decision-record sub-issue. Rejected as unnecessary surface for this story; a fuller corpus can
  be added later (e.g. alongside #273/#274, or when the classification path itself needs parity
  coverage) without revisiting this decision.

## 2026-08-23 — pr-worktree effect parity runs script-then-verb against one shared scratch repo, not two independent copies

- **Choice:** The `open --mode analyze` / `open --mode close` migration-axis cases build ONE real
  scratch repo (real git, real merge-commit topology, bare origin with the PR branch pushed to
  `refs/pull/<N>/head`), then run the legacy script's `open` against it, then run the verb's
  `open` against the SAME repo, and diff their stdout/stderr/exit-code directly with no path
  normalisation. This works because `worktree.ts`'s worktree-path derivation is a pure function of
  `repoRoot` (via `checkoutSegment`) — since both calls share the same `repoRoot`, the derived
  `wtPath` is byte-identical for both sides, and the second call exercises `openAnalyzeWorktree`/
  `openCloseWorktree`'s documented idempotent re-run path (already covered by
  `libs/pr-worktree/src/worktree.spec.ts`) rather than two independent cold-starts.
- **Why:** Decision record #277 ("Effect parity is asserted hermetically") flags that several of
  these capabilities print absolute checkout/worktree paths, so "two runs against two scratch
  trees differ for reasons that are not divergence" — normalisation is the record's suggested fix
  for that case. Running both sides against one shared repo sidesteps the need for a
  normalisation primitive entirely (no two differing absolute base paths to reconcile), matches
  this file's own established pattern (every existing migration-axis case, e.g. workspace-status,
  already runs script-then-verb against one shared `repo` fixture), and the idempotent re-run path
  it exercises instead is a real, documented, already-tested behaviour of the underlying library —
  not a gap.
- **Refuted alternative:** Build two independent, structurally-identical scratch repos (one per
  side) and normalise each run's own absolute paths to a placeholder before diffing. More
  rigorous (proves the cold-start path is identical on both sides, not just the idempotent
  re-run), but requires either deterministic git SHAs across two independently-created repos
  (pinning `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`, fiddly and not otherwise needed anywhere in
  this file) or a new path-normalisation helper in `parity.ts` with its own test coverage — real
  added surface for a rigor increment this story's AC does not ask for. Left as a candidate for
  #274/#276 if a future story needs true cold-start-on-both-sides coverage.

## 2026-08-23 — pr-worktree `gh pr view` fixtures generated at test time, not committed to the corpus

- **Choice:** Unlike the epic-resolve/record-digest fixtures (committed JSON under
  `libs/portable-tools/corpus/{epic-resolve,record-digest}/`), the pr-worktree `gh pr view`
  fixture is generated in `parity.spec.ts` at test run time (`writePrViewFixture`), keyed to the
  real `baseRefOid`/`headRefOid`/`mergeCommitOid` values the freshly-built scratch repo just
  produced.
- **Why:** `deriveRange` and `openCloseWorktree` do real git operations (`rev-parse`,
  `rev-list --parents`, `merge-base --is-ancestor`) against the SHAs `resolvePr` reports, so a
  statically-committed fixture would need to reference commit SHAs from a repo that doesn't exist
  yet at commit time — impossible for a real (non-fake) git topology. Generating the fixture from
  the topology `buildPrWorktreeFixture` just built is the only way to keep both the `gh` answer
  and the git object graph mutually consistent.
- **Refuted alternative:** Commit a fixed scratch-repo `.git` directory (or a bundle of it) as
  corpus data, alongside a static `gh` fixture referencing its fixed SHAs. Rejected: a checked-in
  `.git` directory as test fixture data is unusual for this repo (no precedent), heavier to
  maintain than a ~20-line topology builder, and the topology builder itself is the natural
  common ancestor with `libs/pr-worktree/src/git-fixtures.ts`'s existing pattern.

## 2026-08-23 — No separate git-argument-recording facet for pr-worktree parity

- **Choice:** Story #273's AC ("the spawned process receives the same arguments the TypeScript
  source form spawns it with") is not covered by a dedicated argument-log comparator facet.
  Instead it's covered structurally: the CLI adapter in `nexus-cli.ts` calls the exact same
  `libs/pr-worktree`/`libs/close-migration` functions (`resolveRole`, `resolvePr`,
  `openAnalyzeWorktree`, `openCloseWorktree`, `deriveRange`, `removeWorktree`, `closePreflight`,
  `migrateEntry`) with the same `Runner` (`closeMigrationRunner`, the same `defaultRunner` both
  libraries re-export) that the legacy scripts call. There is exactly one place in the codebase
  that constructs the `git`/`gh` argv for any of these operations — the shared library function —
  regardless of which CLI form (script or verb) invokes it, so there is no second code path that
  could construct a different argv to diverge from.
- **Why:** A separate argument-recording stand-in (e.g. a fake `git` on PATH logging every
  invocation) would only be load-bearing if the two CLI forms could construct git argv
  differently — they structurally cannot, since neither form re-implements any git-invoking
  logic; both are thin argv-parsing shims over the identical library call. The existing
  worktree-presence assertions (`worktreeCount`) plus the byte-identical stdout/stderr/exit-code
  comparison already prove the *effect* of those spawned calls agrees; building a redundant
  argument-log mechanism on top would test the same invariant a second, more expensive way.
- **Refuted alternative:** A fake `git` executable on PATH (mirroring the `gh` stand-in) that logs
  every invocation's argv to a file, compared between the two runs. Rejected as redundant given
  the structural guarantee above; would also require real git behaviour to still work through the
  fake (a passthrough-and-log shim, not a pure stand-in), adding real complexity for a fact
  already established by code inspection and the effect-level assertions in place.

## 2026-08-23 — Standalone launchers hoist the process boundary out of the five distiller capabilities (story #274)

- **Choice:** All five distiller capability files (`generate-atlas.ts`, `validate-concepts.ts`,
  `derive-entry-diff.ts`, `drift-advisory.ts`, `seed-registry.ts`) lose their bottom-of-file
  `main()` + `import.meta.url` self-exec guard entirely — including the three that already had
  the filename-basename-keyed disambiguation (`generate-atlas.ts`, `drift-advisory.ts`,
  `seed-registry.ts`), not just the two un-disambiguated ones the decision record calls out
  (`validate-concepts.ts`, `derive-entry-diff.ts`). Each file keeps only its exported `runCli`.
  Each of the five gets a new, minimal, guard-free sibling file, `<name>-launcher.ts`, whose
  entire body is an import of `runCli` plus one unconditional `process.exit(runCli(process.argv
  .slice(2)))`. `ENTRY_POINTS` in `build-bundles.ts` now names the launchers, not the capability
  files, for these five keys (the `nexus` entry still names `nexus-cli.ts` directly — the
  dispatcher's own guard is the process boundary for every verb, including these five). The root
  `package.json` `nexus:*` pnpm scripts, and every capability's own `.spec.ts` "CLI (subprocess)"
  tests that previously ran `tsx <capability>.ts` directly, are repointed at the matching
  `<name>-launcher.ts` — the bare capability file, once guard-free, no longer does anything when
  run directly. `bundle.spec.ts`'s "bundle entry guard" tests are split across two bundles built
  from two different entries: the bare capability's bundle proves import-safety (dynamically
  `import()`-ing it does nothing — a stronger guarantee now, since there is no guard logic left
  to be structurally correct, only an absence of top-level side effects), while the launcher's
  bundle proves the standalone-artifact execution path still works when run via plain `node`.
- **Why:** Decision record #277 states the hazard is structural, not filename-specific: "inlining
  collapses every module's sense of which file was invoked down to one value," and the
  filename-basename mitigation "expires silently the moment the artifact is renamed" — which is
  exactly what `ENTRY_POINTS` repointing at a launcher does to three of these five files' existing
  guards (their guard's `path.basename(...).startsWith(...)` check would still literally match the
  *launcher's* filename only by the coincidence of the launcher and capability sharing a name
  prefix; keeping it would leave a second, now-redundant and confusing guard alive in a file the
  registry also imports). The record's explicit provision — "Each standalone artifact that must
  keep building through the duplication window gets its own minimal launcher, and the build's
  entry points name the launchers rather than the capabilities" — is the literal blueprint
  followed here. Verified concretely: built all six bundles fresh and ran every verb through
  `nexus.mjs` (including `drift-advisory`, which imports `generate-atlas.ts`, and `seed-registry`,
  which imports both `drift-advisory.ts` and `generate-atlas.ts` transitively) with no
  double-dispatch, alongside every standalone `<name>.mjs` artifact and every `pnpm nexus:*`
  script, all producing byte-identical output to before this change.
- **Refuted alternative 1:** Only touch the two un-disambiguated capabilities
  (`validate-concepts.ts`, `derive-entry-diff.ts`), leaving the other three's basename-keyed
  guards in place since they "already work." Rejected: once `ENTRY_POINTS` points at a launcher
  for build purposes, the capability file itself (still guard-bearing) would still self-execute
  the instant something else imports it directly under a name starting with its own prefix — which
  is exactly the launcher's own filename. Leaving three inconsistent guard styles across five
  near-identical files is also a maintenance hazard the decision record's "unrepresentable, not
  patched" framing argues against.
- **Refuted alternative 2:** Give the *dispatcher* (`nexus-cli.ts`) the only guard, as the decision
  record's dispatcher-eager-import section implies, but keep the five standalone `.mjs` builds
  pointed at the bare capability files and reintroduce guard logic only inside a `--check`-style
  flag read from `process.argv`. Rejected: this still requires each capability file to inspect
  `process.argv`/`import.meta.url` for its own invocation context, reintroducing the exact hazard
  (a capability sensing "am I the invoked file") the record calls unrepresentable-by-design; a
  separate launcher file is strictly simpler and needs no such runtime sensing anywhere.

## 2026-08-23 — Acceptance harness relocated to `libs/pr-acceptance/src/cli.ts` (story #275)

- **Choice:** The harness's entry point moved from `.claude/skills/nxs-pr-acceptance/scripts/pr_acceptance.ts`
  to `libs/pr-acceptance/src/cli.ts` — a plain sibling of the library modules it drives, using
  relative imports (`./capability.js` etc.) instead of `@nexus/pr-acceptance/*` self-imports.
  `.claude/skills/nxs-pr-acceptance/` (including `SKILL.md`) is deleted outright, not left as a
  stub or redirect. Its operating-constraints prose (the triple delete-guard, the subcommand
  table, the "run from `$CLONE`" rule) was folded into the runbook
  (`docs/features/pr-driven-delivery/live-acceptance-runbook.md`), which already sequenced the
  same commands and is the durable artifact per decision record #277.
- **Why:** Decision record: "The harness stops being invocable by an agent and becomes a command a
  maintainer types, and that trade is accepted." A `SKILL.md` is precisely what makes a capability
  agent-invocable, so keeping a neutered one around (e.g. as a pointer to the new location) would
  half-preserve the exact property being removed. `cli.ts` beside its own library (rather than a
  `bin/` subfolder or a name matching the old `pr_acceptance.ts`) matches this repo's existing
  convention of a package's CLI adapter living in its own `src/` (e.g. `nexus-cli.ts` in
  `portable-tools`) — there is no other CLI entry point in `libs/pr-acceptance` to collide with.
- **Refuted alternative:** Leave a minimal `.claude/skills/nxs-pr-acceptance/SKILL.md` that only
  points at the new location, for discoverability. Rejected: decision record's stated payload-
  boundary criterion is structural ("no vendored component file may import a workspace package or
  require the source-checkout runtime"), and a pointer-only `SKILL.md` with no `scripts/` would
  still register the harness as an agent-invocable skill, undoing the exact trade the record
  accepts. The runbook is already the documented discovery path.

## 2026-08-23 — Structural composition check as a new `component-composition.ts` module, keyed by static import-regex, not a TS/AST parse (story #275)

- **Choice:** New module `libs/portable-tools/src/component-composition.ts` exports
  `findWorkspaceImports(content: string): string[]` (a regex over `from "@nexus/..."` and
  `require("@nexus/...")`) and `checkComponentComposition(claudeDir, waivers): CompositionViolation[]`,
  which walks `listComponentFiles` (already the vendoring-payload's own file walk) and flags any
  `.ts`/`.js`/`.mjs`/`.cjs` file with an unwaived workspace import. The waiver register is a
  separate committed file, `component-composition-waivers.ts`, exporting a flat
  `readonly string[]` of repo-relative paths (posix-style, matching `listComponentFiles`'s own
  output format) — the 7 legacy `.claude/skills/*/scripts/*.ts` shims stories #272-#274 left in
  place (`get_abs_doc_path.ts`, `close_migration.ts`, `epic_resolve.ts`, `pr_worktree.ts`,
  `record_digest.ts`, `docs_root.ts`, `workspace_status.ts`). It is enforced by a live-tree test in
  `parity.spec.ts` (not just documented): `checkComponentComposition(liveClaudeDir(SRC_DIR), [])`
  must equal the waiver register exactly, so an unwaived new violation OR the register going stale
  (naming a file that no longer violates) both fail the suite.
- **Why:** A regex is enough because the surface being checked is narrow and adversarial-input-free
  (this repo's own component tree, not third-party code) — every real violation is a plain
  top-level `import ... from "@nexus/..."` or `require("@nexus/...")`, and the existing five
  distiller capabilities and the `nexus-cli.ts` registry already prove this repo's own composition
  check doesn't need a full TS AST walk anywhere else (`parity.ts`'s comparators are similarly
  plain string/line operations, not AST-based). A dedicated waiver-register file (rather than
  inline exceptions passed at each call site) makes the exception list itself grep-able, diffable,
  and the single place #250 empties out when the legacy scripts are finally deleted.
- **Refuted alternative:** Parse each file's AST (e.g. via TypeScript's compiler API) to find
  imports precisely, handling re-exports, dynamic `import()`, and computed specifiers. Rejected as
  disproportionate: none of the 7 waived files (or any file in the managed subtrees) uses a dynamic
  or computed import, and adding a TS-compiler dependency to a build-time payload check is a much
  heavier primitive than the property being checked warrants — a regex miss would only under-flag
  an exotic import form no file in this tree actually uses, which the live-tree test would still
  catch if it were ever added (the test compares against a hand-maintained expected list, not
  merely "check runs without crashing").

## 2026-08-23 — Repoint the `pnpm nexus:*` dev aliases at `nexus-cli.ts`, not at story #274's launchers (story #276)

- **Choice:** The four capability-invoking root `package.json` scripts —
  `nexus:generate-atlas`, `nexus:validate-concepts`, `nexus:check-atlas`, `nexus:drift-advisory`,
  `nexus:seed-registry` — now run `tsx libs/portable-tools/src/nexus-cli.ts <verb> [--check]`
  instead of `tsx libs/portable-tools/src/<name>-launcher.ts`. `nexus:vendor-tools` is untouched
  (it is the build/vendor orchestrator itself, not a capability-invoking alias). Verified each
  repointed script by hand: `pnpm nexus:check-atlas`, `pnpm nexus:validate-concepts`, `pnpm
  nexus:drift-advisory` against this repo's real `.nexus/concepts/`, and `pnpm exec tsx
  nexus-cli.ts seed-registry --out-dir <scratch>` — all produce the same output shape as before.
- **Why:** Decision record #277 ("The source run is the same dispatcher, and the in-repo aliases
  repoint to it"): "The in-repo build and release aliases that today invoke capabilities directly
  are redefined to go through that same shape... Repointing is in scope because the alias names
  that component bodies invoke do not change. Only the alias definitions change." The alias names
  are exactly what `.claude/commands/nxs.distill.md` already names literally (`pnpm
  nexus:generate-atlas`, `pnpm nexus:validate-concepts -- --base HEAD ...`, `pnpm
  nexus:drift-advisory`) — a command body, which per the epic's Out-of-Scope list must not be
  rewritten to name a verb directly (that's #250). Repointing only the alias's *definition*
  satisfies the decision record's instruction without touching that command body at all: the
  command still types `pnpm nexus:generate-atlas`; what that alias now runs underneath changed.
  Left ambiguous at first read: story #274 had *already* introduced one-launcher-per-capability
  specifically so these same pnpm scripts kept working post-guard-removal, so re-pointing them
  again looked like it might be reverting #274's fix. It isn't — the launchers exist so
  `build-bundles.ts`'s `ENTRY_POINTS` has a guard-free, self-contained esbuild entry per standalone
  artifact; the pnpm dev aliases are a separate concern (a maintainer's daily-driver command), and
  decision record #277's own words for *this* story say to run them through the dispatcher now
  that it exists, which is a stronger, more direct proof of "one command shape" than the launchers
  give (each launcher is still a distinct, per-capability source entry point — precisely what the
  decision record's Key Decision for this story rules out: "no separate source-side entry point,
  and no verb-specific source command").
- **Refuted alternative:** Leave the four `nexus:*` scripts pointed at their #274 launchers.
  Simpler (zero net script changes this story), and still produces identical output today since
  #274's parity tests already prove `<name>-launcher.ts` and the `nexus-cli.ts` verb are
  output-identical. Rejected because it does not satisfy the decision record's explicit
  instruction for this story ("the in-repo build and release aliases... are redefined to go
  through that same shape"), and it would leave two source-side ways to invoke the same
  capability (launcher vs. verb) where the record calls for exactly one.
