# 3. How do Nexus and Graphify compose?

## Summary judgment

Nexus treats Graphify as a swappable implementation behind a Nexus-defined graph contract. The integration mechanism is the Graphify CLI invoked via subprocess — used directly as the primary surface, not as a fallback to MCP. A thin TypeScript adapter inside Nexus is the only place that knows about Graphify-specific commands and JSON shapes; every other Nexus command consumes a stable, internal graph interface. Python stays out of the Nexus tree. When Nexus needs a capability Graphify does not expose, the default is to contribute upstream rather than work around or fork. This keeps Nexus's identity sharp (curation and delivery orchestration, not graph engineering) and bounds the cost of swapping graph backends if Graphify's trajectory changes.

## Decisions

### D1. Graphify is a swappable implementation, not a built-in

A Nexus-defined graph contract (TypeScript interface) sits between the pipeline and any graph backend. Graphify is the first and currently only implementation. The contract surface is the union of what Nexus actually queries — communities, node/file lookups, neighbors, deltas between graph states, and bootstrap discovery — not the full surface of what Graphify happens to expose. Anything outside that surface is not a Nexus concern.

**Why:** preserves Nexus's identity as the curation/orchestration layer and bounds the swap cost if Graphify diverges or stalls.

**How to apply:** every new pipeline call site goes through the contract. Adding a method to the contract is a deliberate decision; calling Graphify directly from a command is a code-review reject.

### D2. CLI subprocess is the integration mechanism — primary, not fallback

Nexus invokes Graphify via its CLI as a subprocess. Output is parsed JSON from stdout or files written to a known location. MCP is explicitly not used.

**Why:**
- The CLI is universal across agent clients (Claude Code, Gemini, Codex, Cursor). MCP coverage varies — and Nexus targets multiple agents per `CLAUDE.md`.
- The CLI surface is explicit and versioned by Graphify. An MCP server adds a parallel, separately-evolving surface that has to be kept in sync with the CLI.
- Subprocess invocation matches Nexus's existing skill/script pattern (e.g. `tsx` scripts) — no new runtime model.
- One less moving piece. No long-lived MCP server process to keep alive across Nexus runs or to fail in subtle ways.
- Outputs land as files or piped JSON, which fits Nexus's git-native, files-not-databases constraint.

### D3. No Python in the Nexus tree

Graphify is a runtime dependency installed by the user, not vendored, not bundled. Nexus contributors do not need Python to develop or test Nexus itself. The graph adapter knows how to *call* Graphify; it does not import or embed any of it.

### D4. One thin adapter, central to the codebase

A single TS module implements the graph contract by shelling out to Graphify. Every command (`/nxs.iteration`, `/nxs.concept`, `/nxs.decide`, `/nxs.tasks`, `/nxs.dev`, `/nxs.close`) consumes the contract — never Graphify directly. Replacing Graphify is replacing one adapter.

### D5. Upstream-first on capability gaps

When the pipeline needs something Graphify does not currently expose (e.g. a specific delta query at close time, a structured community-overlap report for layered matching), the default is to file an issue or PR upstream. Working around in the adapter is a short-term measure; forking is a last resort triggered only by demonstrated upstream unresponsiveness.

**Why:** customizing or forking Graphify silently transfers ownership of graph engineering to Nexus, which contradicts D1. Upstreaming keeps the abstraction line honest.

### D6. Graph state is repo-local and gitignored

Graphify's graph cache, indexes, and derived artifacts live under a known directory in the repo (e.g. `.graphify/`) and are gitignored. They are derived state, not source of truth. Source of truth remains the code plus Nexus's git-tracked artifacts (concept pages, decision records, task index). The graph is rebuilt or incrementally updated on demand.

### D7. Graphify version is pinned, with an opt-in override for newer versions

Nexus pins to a known-good Graphify version recorded in the adapter (or a sibling `graphify.version` file). The adapter detects mismatch at runtime. Upgrades to the pinned version are an explicit Nexus change with a known surface area, not an ambient drift.

An opt-in override (env var or config flag) lets users run a *newer* Graphify than the pinned version at their own risk:

- Newer versions are accepted with a one-line warning that behavior is unverified for the running version.
- Older versions remain rejected — they may lack capabilities the contract depends on.
- The user owns any breakage from CLI flag drift or output-shape changes when the override is active.

**Why:** mitigates two risks together — Graphify project health (the pin holds if upstream stalls or churns) and CLI/output stability (pinning is what lets the adapter assume specific flags and JSON shapes work). The override gives advanced users an escape hatch without making it the default and without forcing every user to wait for a Nexus release to track a newer Graphify.

**How to apply:** the adapter checks the override at startup alongside the capability check (D8). When the override is active and a newer-than-pinned version is in use, the warning is emitted once per session.

### D8. Missing or incompatible Graphify is a clear, actionable failure

If Graphify is not installed, not on PATH, or version-mismatched (older than pinned, or newer than pinned without the D7 override), any Nexus command that needs it errors out with a one-line install/upgrade hint — not a stack trace and not a silent skip. The adapter performs a single capability check on first invocation per session.

### D9. Graphify outputs that touch the PM layer flow through changeset-approval

Anything Graphify emits that becomes part of the PM-curated layer (community → concept suggestions in the reverse loop, cold-start concept candidates, bootstrap inventories) goes through the universal changeset-approval pattern from Q2 D14. Graphify is never authoritative over the concept layer; the PM is.

### D10. The adapter is a standalone TS module, not a skill

The graph adapter lives as a TS module that skills and commands import, rather than as a skill invoked via subprocess from other skills. Skills are self-contained units of agent-runnable behavior; the adapter is a shared library dependency.

**Why:** seven-plus pipeline touch points need the same contract. A skill-shaped adapter would require skill-to-skill invocation, which is awkward, costly per call, and not how Claude Code skills are designed to compose. A standalone module is a normal import — type-checked, testable in isolation, and reusable by the Gemini target without duplicating the integration logic.

**How to apply:** the module exports both the graph contract interface and the Graphify adapter; skills and commands `import` from it directly. The exact filesystem location (under `claude/.claude/lib/`, a sibling of `skills/`, or a workspace package) is a packaging detail to settle during implementation, but the shape — module, not skill — is fixed.

### D11. Graph freshness is git-hook-driven; the pipeline owns explicit ops; the adapter never refreshes blindly

Graphify's git hooks (post-commit, post-checkout, post-merge) keep the graph current with the committed working state. The adapter performs no eager refresh on contract calls. The pipeline explicitly invokes graph operations only where git hooks cannot:

- `/nxs.concept` cold-start performs initial extraction and installs the git hooks.
- `/nxs.close` records a pre-iteration snapshot at iteration start and a post-iteration snapshot for the drift check; the pipeline pairs them.

The adapter's only freshness responsibility is staleness *detection*: if HEAD has moved since the last recorded graph state, it errors with an actionable hint (likely "hooks missing — reinstall via `<command>`"). Working-tree changes that are not yet committed are intentionally invisible to the graph; `/nxs.dev` queries reflect last-commit state, which is appropriate for understanding the system before changing it.

**Why:** moves freshness cost to commit time (where the user is already paused) instead of taxing every Nexus command with an update on first contract call. Keeps the adapter dumb about pipeline semantics — it cannot know when a snapshot pairing is needed or when a cold bootstrap is appropriate.

**How to apply:** any new pipeline call site assumes the graph is current. If a stage genuinely needs a forced refresh, that's a pipeline-level decision recorded as an explicit step, not a hidden adapter behavior.

### D12. One graph per repository

Graphify builds and maintains a single graph per repo. In monorepos with multiple semi-independent products, the graph remains one — Leiden community detection will reflect natural code-coupling boundaries, which usually align with product seams anyway.

**Why:** matches Graphify's default operating mode (no fighting upstream) and keeps the adapter free of product-aware configuration. Product separation in Nexus already lives in the file layout — concept pages, iteration scopes, and decision records sit in product-scoped directories. The graph layer doesn't need to mirror that organizational split; it just needs to be queryable across whatever scope a command operates in.

**How to apply:** the contract does not expose a "product" or "subgraph" parameter. Pipeline stages that need product-scoped views filter graph results by file path or community membership in the consuming code, not by partitioning the graph itself.

### D13. Docs default to in-repo `./docs/` excluded from the graph; Graphify operates on code only

Nexus's `docs/` tree (concept pages, iteration scopes, decision records, task indexes) lives at `./docs/` in the active repo by default. The directory is excluded from Graphify via `.graphifyignore` so the graph stays code-only. Repos that need a different shape — out-of-tree at a custom name, on a shared mount, or in a parent folder for multi-repo products — set the path explicitly per D14.

**Why:**

- In-repo is the lowest-friction default. New users get a working layout without configuration; the docs sit next to the code they describe and version-pin with it.
- Excluding via `.graphifyignore` (instead of relocating the folder) keeps Graphify's value pure. Q2 D6 puts concepts and communities on related-but-separate layers; Q2 D14 routes concept curation through explicit human approval. Feeding docs into the graph adds no capability the pipeline relies on.
- Each repo's code graph stays fast, deterministic, and uncoupled from doc churn — consistent with D6 (graph state is derived, not source of truth).

**How to apply:**

- `/nxs.init` ensures `./docs/` exists and that `.graphifyignore` lists it, creating the ignore file if absent.
- Pipeline commands resolve docs paths through `resolveDocsRoot()` (D14); the default resolution is `./docs/` relative to the active repo.
- The graph contract has no "docs corpus" parameter. The adapter only ever feeds Graphify the active repo's code tree.
- The schemas defined in Q2 (concept page, iteration scope, epic stub) keep their structure regardless of where the docs root resolves.

**Trade-off accepted:** Graphify cannot auto-suggest concept candidates from doc prose. That capability is replaced by the reverse-direction loop (community → concept suggestion) operating on code-derived communities, which matches the curation model already chosen in Q2.

### D14. Docs root is configurable; out-of-repo locations are supported via `.nexus/config`

The location of the Nexus-managed docs tree is a per-repo configuration value. The default (D13) is `./docs/` in-repo. Repos override the path when they need a different shape — an out-of-tree custom name, an absolute path on a shared mount, or the multi-repo parent-folder pattern (`../docs/`) where several products share one concept inventory.

**Why:**

- Multi-repo products: a parent-folder location lets multiple repos share a single concept inventory without git submodules or duplicated trees. This was originally the universal default; it remains the right shape for that case, just not for everyone.
- Established conventions: teams with a `documentation/` directory, an out-of-tree wiki root, or a shared mount don't have to reorganize as the price of adoption.
- Single source of truth: every command, skill, and agent reads through one helper, so the path is changeable without auditing the whole tree.

**How to apply:**

- Configuration lives in `.nexus/config.{json,yaml}` at the repo root. Single field today: `docsRoot` (resolved relative to the config file's location, or absolute). Absent file → in-repo default per D13.
- A `resolveDocsRoot()` helper in the LLM-agnostic toolchain (D15) is the single source of truth. Every command, skill, and agent that mentions `docs/` reads through it. Direct `docs/` strings in command files or skills are a code-review reject.
- For non-default locations, `/nxs.init` writes `.nexus/config` and skips the `.graphifyignore` step (the docs tree is no longer in-repo, so the exclusion is moot).
- Multi-repo override: when several repos point at the same `docsRoot`, concept-page community references are repo-qualified (exact frontmatter shape contingent on the open question below) so a single concept page can reference communities across repos' graphs.
- Migration cost: a one-time sweep of the ~100 hardcoded `docs/` references across `claude/.claude/` (commands, agents, skills, scripts) is a precondition. New commands added after the sweep must use the helper from day one.

### D15. `.nexus/` is the home for LLM-agnostic Nexus configuration and (eventually) source-of-truth tooling

`.nexus/` at the repo root holds the configuration above (D14) and is the intended destination for LLM-agnostic command and skill definitions. Today, command and skill bodies are duplicated under `claude/.claude/` and `gemini/.gemini/`; the long-term shape is canonical sources under `.nexus/` with thin per-harness shims that point at them.

**Why:** the duplicated shape was acceptable when Nexus shipped one harness (Claude Code only). With Gemini supported and more harnesses likely, duplication scales as O(harnesses × commands) and drift between copies becomes the dominant maintenance cost. A canonical source bounds that to O(commands).

**How to apply:**

- Phase 1 (now): `.nexus/config.{json,yaml}` holds `docsRoot` and any future cross-harness config; `.nexus/lib/` (or similar) hosts the `resolveDocsRoot()` helper and other LLM-agnostic utilities. The `claude/.claude/` and `gemini/.gemini/` trees stay duplicated for command/skill bodies — D15 only commits to the destination, not the migration timeline.
- Phase 2 (deferred): canonicalize commands and skills under `.nexus/`, with per-harness directories holding loaders/shims. Out of scope for the wiki feature; tracked as a separate initiative.
- The `.nexus/` directory is git-tracked. It is not Graphify state (`.graphify/` from D6) and must not be confused with it.

## Integration touch points

Where the pipeline calls into the graph contract, and why each call exists:

| Stage | Operation | Why |
|---|---|---|
| `/nxs.concept` cold-start | Discover communities + extract candidate concepts from existing code/docs | Bootstrap concept inventory in a non-empty repo |
| `/nxs.concept` Validate | Layered matching: community-overlap step | Step 3 of layered matching (Q2) — cheaper than semantic, more precise than text similarity |
| `/nxs.iteration` | Resolve concept references to community IDs; check coverage | Concept-page `communities:` frontmatter is filled from this |
| `/nxs.decide` | Generate impact data for the diagram (affected nodes/communities) | "Visualizations replace prose for what-is" (Q2 D15) |
| `/nxs.tasks` | Resolve graph pointers per task entry to file paths | Task index references nodes/communities, not raw paths |
| `/nxs.dev` | On-demand graph queries from the dev agent (read-only) | Replaces pre-baked LLD context |
| `/nxs.close` | Graph delta between pre-iteration and post-iteration state | Drift check vs. decision record (Q2 D11) |
| Post-close | Detect communities without concept pages | Reverse-direction loop (Q2 patterns) |

The adapter must support each as a contract method. Anything Graphify cannot do directly is composed in the adapter from its primitives — and tracked as an upstream candidate per D5.

## Patterns and guardrails

### The contract is the abstraction line

Pipeline code imports the graph contract, never the Graphify adapter directly. Code review enforces this. It is the discipline that makes "swap the backend" cheap; without it, the abstraction rots within a quarter.

### JSON over text-parsed prose

Graphify outputs consumed by Nexus are JSON (or another structured format), never `grep`-parsed prose. If a needed query is only available as prose, file an upstream issue for a structured output mode rather than parsing brittle text.

### Idempotent, incremental invocation

Every Graphify call Nexus makes assumes incremental-update mode. Full re-extraction is reserved for explicit bootstrap. The adapter is responsible for ensuring graph freshness before queries that depend on it (notably `/nxs.close` drift check).

### Per-run query cache

Repeated graph queries within a single Nexus command run go through an in-memory cache in the adapter. Avoids paying subprocess + parse cost N times for what is effectively the same view of the graph.

## Action items

### Adapter and contract
- [ ] Define the graph contract TypeScript interface from the integration touch points above.
- [ ] Implement the Graphify adapter as a single TS module: subprocess invocation, JSON output, version check, query cache.
- [ ] Add the startup capability check (Graphify present, version matches pinned, graph cache initialized).

### Pipeline wiring
- [ ] Wire `/nxs.concept` (cold-start, Validate) through the contract.
- [ ] Wire `/nxs.iteration` for concept ↔ community resolution.
- [ ] Wire `/nxs.decide` for impact-diagram data.
- [ ] Wire `/nxs.tasks` for graph-pointer resolution.
- [ ] Wire `/nxs.dev` agent prompt for contract-mediated graph queries (replacing pre-baked LLDs).
- [ ] Wire `/nxs.close` for graph delta and the drift check.
- [ ] Implement the reverse-direction loop using the contract's "communities without concept pages" query.

### Repo and runtime
- [ ] Add `.graphify/` (or whatever cache path is agreed) to `.gitignore`.
- [ ] Document the Graphify install step in Nexus's setup docs.
- [ ] Pin a known-good Graphify version and record it in the adapter or a `graphify.version` file.
- [ ] Implement the clear "missing or incompatible Graphify" error path with install/upgrade hint.

### Configurable docs root and `.nexus/` toolchain (D13–D15)
- [ ] Define `.nexus/config.{json,yaml}` schema; commit a `docsRoot` field with `./docs/` as the implicit default.
- [ ] Implement `resolveDocsRoot()` in the LLM-agnostic toolchain under `.nexus/lib/` (location settled during implementation).
- [ ] Sweep `claude/.claude/` (commands, agents, skills, scripts) for hardcoded `docs/` references — replace each with a call to the helper.
- [ ] Update `/nxs.init` to (a) ensure `./docs/` exists, (b) ensure `.graphifyignore` lists it for the in-repo default, (c) write `.nexus/config` when the user picks a non-default location.
- [ ] Add a code-review note (in `CONTRIBUTING` or equivalent) that new commands/skills must consume the helper, not hardcode `docs/`.
- [ ] Decide the configuration filename (`.nexus/config.json` vs `.nexus/config.yaml` vs both); pick one to avoid drift.

### Upstream relationship
- [ ] For each contract method that requires composition or workaround in the adapter, file an upstream issue describing the desired primitive.
- [ ] Document the upstream-first policy in `CONTRIBUTING` (or equivalent): contribute upstream first, work around second, fork only on demonstrated unresponsiveness.

## Open questions

### Stable community identity across Graphify runs

Concept pages reference Graphify community IDs in frontmatter (`communities: [...]`). Leiden community IDs are typically derived from each clustering pass and can shift across runs as code changes — a stored ID may resolve to a different community after the next graph rebuild, or to nothing at all.

Two resolution paths:

1. **Upstream:** Graphify exposes stable community identifiers natively — signature-based, member-derived hash, or human-assignable name. Aligns with D5 (upstream-first on capability gaps).
2. **Adapter-side:** concept-page frontmatter stores enough community fingerprint (member-file set, top-N nodes, signature hash) for the adapter to re-resolve the community after each run. Implementable but adds drift-handling complexity in the adapter.

The cross-repo dimension introduced by D13 compounds this: a community reference must encode which repo it came from in addition to surviving cluster shifts. Likely frontmatter shape is along the lines of `communities: [{ repo: "<id>", ref: "<stable-fingerprint>" }]`, but the concrete shape is contingent on which resolution path wins.

This must be settled before:

- D9 (changeset-approval over community-derived suggestions) is implementable end-to-end.
- The reverse-direction loop is reliable across more than one Graphify run.
- The cold-start bootstrap inventory can be persisted as a durable concept inventory.

Until then, both can be prototyped against single-run graphs without committing to a frontmatter shape.

## Deferred

- **Cost ceiling per command.** What's the acceptable wall-clock budget for graph operations inside a single Nexus command? Deferred until the pipeline is running end-to-end and real numbers exist to set a meaningful threshold. Premature without empirical data.
