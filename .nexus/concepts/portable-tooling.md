---
title: "Portable Tooling"
aliases: ["portable distill tooling", "vendored tooling bundle", "hub tooling", "portable tools distributable", "bare-runtime validator and atlas generator"]
touches: ["distiller", "workspace-resolution", "nexus-setup-cli", "verb-reachability", "release-identity", "published-package", "shipped-payload"]
last_updated_by: "#252"
status: active
verification: verified
---

# Portable Tooling

Portable tooling is the offline form of distillation's deterministic steps — the concept validator, the atlas generator, and a hub diff-derivation tool — built to run on a bare Node.js runtime. It lets a checkout with no development toolchain validate its concept store and regenerate its atlas as a code repo does, reaching it as an installed toolkit, not a committed copy. The in-repo tooling stays authoritative; the portable form is a derived build.

## How It Works

Distillation's validator and atlas steps were written to run through a code repo's development toolchain, which a docs-only checkout lacks. The portable form drops that dependency: each check is compiled into a self-contained artifact that runs under a bare runtime (the validator still calling git). Every outside dependency is folded in, so nothing resolves from an installed package tree at run time. The same distributable carries the `nexus` setup CLI and the component payload under one fingerprint gate, and now reaches a machine inside the published package. The build produces exactly one executable: the five standalone launchers are deleted, their capabilities reachable as verbs. The artifact and the payload it carries share one version identity, which it can report alongside the payload it would actually install. The build copies nothing into any repository.

## Key Invariants

1. The in-repo tooling is the single authoritative source; the portable artifact is a derived build, never hand-edited.
2. The artifact runs on a bare Node.js runtime alone (plus git for the validator's append-only mode), needing no workspace install, transpiler, or package manager.
3. For identical input the artifact's atlas output is byte-identical, and its validator findings and exit codes match the in-repo tooling exactly.
4. The build folds every outside dependency in; nothing is resolved from an installed package tree at run time.
5. ~~The committed artifact runs offline with no install step, executing only trusted, review-gated code.~~ It is never written into the repository it acts on.
6. A parity check is a required gate in the source repo: it rebuilds from source over a representative corpus and fails, naming any mismatch in findings, exit codes, or atlas bytes, and reads no copy of the artifact inside any repository.
7. A committed two-entry pin — the executable and the payload — catches an artifact left stale against its source, and the bytes it records are the bytes that ship.

## Integration Points

- [distiller](distiller.md) — a hub drain derives its cross-repo diff through this tooling; its validator and atlas steps run one in-repo invocation in every mode.
- [workspace-resolution](workspace-resolution.md) — the resolver these bundled tools consult at run time; it no longer reports any location for this tooling.
- [nexus-setup-cli](nexus-setup-cli.md) — ships as a vendored entrypoint on this distributable, its component payload pinned by the same fingerprint gate.
- [verb-reachability](verb-reachability.md) — the shared declarative registry ten more component-invoked capabilities now dispatch from as verbs on this distributable's executable.
- [release-identity](release-identity.md) — the one version identifying this distributable and its payload together, declared at the release root the artifact's own walk-up finds.
- [published-package](published-package.md) — the package this artifact ships inside as a declared binary, staged into its release tree rather than committed anywhere.
- [shipped-payload](shipped-payload.md) — the other half of the two-entry fingerprint pin this artifact's parity gate compares against a fresh build.

## Decision Log

### 2026-07-14 — #44 — Compiled single source, vendored, guarded by a parity check

The portable tooling is a compiled build of the one in-repo source — not a reimplementation and not source run through the runtime's native type-stripping: a single source keeps parity structural at the logic level and maintenance single-headed, and a dependency-inlining build is the only packaging that both runs under a bare runtime today and can carry an outside dependency into an install-free hub later. It is vendored — committed into the hub — rather than published to a registry, so every hub clone is identical, offline, and reproducible. Because a committed build can silently lag its source, a parity check over a representative corpus is load-bearing, not documentation, with a committed fingerprint catching a build that was edited but not re-vendored. Refuted: running the source directly under native type-stripping — viable for these annotation-only checks and build-free, but version-gated and unable to inline the outside dependency the shared vehicle must carry later; and publishing to a registry — idiomatic, but it adds network and version-pinning to a docs repo and makes each hub non-reproducible.

### 2026-07-15 — #54 — A third portable tool: resolver-consuming hub diff derivation

The bundle grew a third tool that derives a hub entry's cross-repo diff, joining the validator and the atlas generator, and the bundled validator learned to check the derived anchor sidecars in their new per-repo shape. Unlike the two checks, this tool must consult the workspace resolver at run time to find where each member's code is checked out, so it is the first portable tool that carries a cross-library dependency into the install-free hub — the packaging always anticipated this. The considered alternative — leave hub diff derivation as command prose rather than a bundled tool — was rejected because resolving members to checkouts needs real workspace context, not a presence bit a markdown command can read, so it belongs in code that actually consults the resolver.

### 2026-07-16 — #60 — The setup CLI and a vendored component payload join the distributable

The `nexus` setup CLI ships on this same distributable, and it makes the distributable carry two things it did not before: an inlined package dependency (the manifest parser needs it) and a vendored copy of the live component tree as plain review-gated files, because a distributed CLI has no line of sight back to the source components. A committed payload can lag its source exactly like a compiled bundle, so it is covered by the same fingerprint gate — one `claude-components` pin beside the bundle hashes — rather than a separate discipline. Refuted alternatives: inlining the component tree as base64 blobs — self-contained too, but a blob diff is unreviewable, breaking the ship-only-reviewable-code posture; and a separate component-fingerprint pin — avoids touching the existing gate, but forks the pin discipline into two files.

### 2026-07-18 — #74 — The atlas generator becomes a resolver-consuming tool; re-vendoring tracks inlined source

The atlas generator gained a run-time dependency on the workspace resolver — it now places its output at the resolved docs root — so it joins the diff-derivation tool as a bundled tool carrying the workspace dependency into the install-free hub, which the packaging simply inlines. Because that new inlined source, together with the vendored component edits this epic also made, staled the fingerprint pin the moment the intermediate stories landed — before the generator itself was touched — the bundle was re-vendored on every story that changed inlined source or components, not once at the end. Refuted alternative: defer all re-vendoring to the generator-change story or the epic's end — fewer vendor commits, but it leaves the fingerprint gate red across every intermediate commit, breaking the green-on-every-commit rigor this epic held to.

### 2026-07-19 — #81 — The docs-root read-out is reachable through the portable CLI

A docs-only hub has no in-repo toolchain, so the resolved docs root its planning commands need must also be reachable offline. The portable CLI gained a docs-root read-out verb — a single-value view over the same resolver selector the in-repo read-out uses — so the docs-only-hub vehicle reaches the value exactly as a code repo does, re-vendored under the one fingerprint gate to stay byte-parity with the source. This is the same dual-vehicle pattern setup already relies on for the workspace status read-out. Refuted alternative: extend the existing status read-out to also emit the docs root as a parseable field, reusing an invocation commands already make — but that turns the human-facing status render into a machine-parsed contract every planning command would couple to, and contradicts the dedicated single-purpose selector this value was deliberately given.

### 2026-07-19 — #89 — A shared registry parser joins the inlined source, re-vendored per story

The new domain-registry parser is standalone — no imports — so it inlines into both the validator and atlas-generator bundles exactly like every other shared module here, and it entered the fingerprint gate the same way prior inlined-source changes did: re-vendoring on every story that touched inlined source, keeping the pin green on each commit rather than red until the epic's last story landed, the discipline already established for a resolver-consuming atlas generator. Refuted alternative: defer re-vendoring to the epic's final story once the parser and both consuming tools were done — fewer vendor commits, but it reintroduces the stretch of red-pin commits that discipline exists to prevent, so it wasn't reconsidered here.

### 2026-07-20 — #94 — Two new bundled tools; a self-invoke guard hardened against cross-tool bundling

The bundle grew two entry points — the drift advisory and the registry seeder — joining the validator, the atlas generator, and the hub diff-derivation tool under the one fingerprint gate. Both new tools reuse the atlas generator's link-graph construction, so they import it; because the packaging inlines every imported module into each tool's self-contained artifact, the atlas generator's own run-only-when-invoked-directly guard was inlined too, and after inlining every module in an artifact shares one sense of which file was invoked — so running one tool could silently trigger and exit through another tool's guard. Refuted alternative: leave each guard keyed only on that shared signal — rejected because it was already misfiring across the bundled tools; keying each guard additionally on the name of the tool actually invoked is the minimal fix that stays correct in both source and vendored-bundle form.

### 2026-08-23 — #247 — Ten more capabilities join the distributable as verbs; the payload boundary becomes a structural composition check

The distributable's `nexus` executable gained ten more verbs — three read-only resolvers, two that drive git worktrees, and the five distiller tools already vendored here — dispatched from one shared declarative registry (see [verb-reachability](verb-reachability.md)); the five distiller tools keep building as their own standalone artifacts too, through a duplication window bounded by a separate invocation-rewrite epic. Parity gained a temporary migration axis alongside the durable source-vs-build one, and, for capabilities driving external programs, the comparison broadened from console output alone to also cover the exact spawned arguments and the resulting file tree, asserted hermetically against committed stand-ins so the required gate needs no network access or credentials. Separately, the vendored payload's boundary — which components ship and which stay checkout-bound — moved from an implicit "these three subtrees, whole" understanding to a structural composition check: no vendored component file may import a workspace package, enforced against a shrinking, explicitly enumerated waiver register that names the legacy scripts still awaiting the invocation rewrite. The pull-request acceptance harness was relocated to sit beside its own library, outside every vendored subtree, and lost its component manifest — it gains no verb and is no longer agent-invocable, because it walks up to and archives the Nexus checkout it runs from, which no installed toolkit has. Refuted alternative: keep excluding the harness from vendoring by name — smaller change, but it leaves the payload boundary a curated list that the next checkout-bound file added to the component tree would have to be remembered against, rather than caught structurally.

### 2026-08-26 — #251 — The distributable reports the payload it would actually install

The artifact gained one version identity covering its executable, the second toolkit and the component payload together, and a verb that reports it. What that verb fingerprints is the payload that would actually be installed — the vendored copy beside the artifact when it exists, the live component tree otherwise — so a source checkout and a distributable each report the components they would really deploy. Refuted: reporting the committed fingerprint pin the parity gate already maintains, which is the obvious source but does not travel with the distributable, so the verb would report nothing in the posture that matters most.

### 2026-08-27 — #257 — The distributable stops being copied into the repository it acts on

The per-repository copy was retired outright: no build step writes the artifacts or the component payload into a target checkout, the exported location is gone, the operator instruction to commit them is gone, and the component bodies lost the second invocation branch that named the copied files. The insight the copy carried is kept — a dependency-free bundle, a self-contained entry point, bare-runtime execution — and only the placement changed, from once per repository to once per machine, because the copy's cost was commit churn in its heaviest form plus a second artifact ageing independently of the installed one, against a migration population of zero. The build-and-hash half survives under its own name so the fingerprint gate stays reachable, and it now rejects every argument rather than ignoring the retired one, since an invocation that exits zero while writing nothing reads as a successful copy. The shared copy helper and the vintage identifiers keep their names: they outlive this arrangement and have a caller waiting, so renaming them is churn that would be wrong again shortly. Refuted alternatives: deleting the build-and-hash entry point alongside the copy half, which leaves the surviving half reachable only by file path; accepting-and-ignoring the retired option for compatibility, the standard courtesy and exactly wrong when the caller population is zero and the option's whole meaning was the removed behaviour; and renaming the surviving helpers now for one clean vocabulary.

### 2026-08-27 — #252 — One executable, a two-entry pin, and a gate pointed at the release

The build collapses to a single entry point and the five standalone launchers are deleted rather than left unbuilt: every one of their capabilities has been reachable as a verb since the verb collapse, the only consumer that ever needed them as separate files is gone, and one entry point is what makes a two-entry pin possible at all. The pin becomes the executable plus the payload and stays the sole pass or fail authority, with the gate rebuilding and re-walking from source rather than reading any copy inside a repository — which is what "the gate checks what was released" means once nothing is vendored. The interpreter line is emitted by the build rather than prepended while staging, so the pinned bytes are the shipped bytes. Refuted: hashing the packed archive instead, the most literal reading of checking the release, but it forces a pack step into every gated run and makes the gate depend on packer behaviour and archive metadata rather than on content.
