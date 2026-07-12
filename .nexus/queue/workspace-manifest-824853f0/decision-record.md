---
title: "Decision Record: Workspace Manifest & Resolution"
epic: #38
feature: "Multi-Repo Workspaces"
rating: S
concepts: [nexus-pipeline, committed-queue, distiller]
date: 2026-07-10
---

# Decision Record: Workspace Manifest & Resolution

## Summary

This epic makes the workspace a declared, discoverable thing before any pipeline stage operates
across a repo split: one committed manifest in the hub declares the hub and its member repos, and a
small committed pointer in each member repo locates the hub. A single deterministic resolver reads
these to produce one canonical workspace description from any starting point, falls back to today's
single-repo behavior when no workspace signals exist, and reports precisely what is missing when it
cannot resolve. A read-only status read-out is the epic's observable surface and the verification
vehicle for every other story.

## Chosen Approach

Two committed artifacts plus one resolver. The hub manifest is the single source of truth for
workspace shape (hub identity, the member set, each member's remote identity, and its expected
sibling checkout name). Each member carries a thin pointer naming only the hub — enough to locate
it, nothing that redeclares membership. One deterministic resolver is the sole producer of workspace
context: from the hub it reads the manifest directly; from a member it reads the pointer, finds the
hub as a named sibling under the shared parent folder, then reads that same manifest — so both entry
points converge on identical output. When a repo has neither artifact, the resolver returns the
current single-repo answer and existing commands behave exactly as today. Commands consume the
resolver by invoking it (the established shell-out-to-script pattern), never by re-deriving workspace
context themselves.

## Key Decisions

### Hub manifest is the single source of truth; the member pointer only locates the hub

- **Decision:** The manifest declares the full shape (hub + members + remote identities + expected
  checkout names) and lives committed in the hub; the pointer names only the hub. On disagreement —
  a member whose pointer resolves to a hub whose manifest does not list that member — the manifest
  wins and the mismatch is reported naming both sides.
- **Why:** Member-add stays a two-file change (the manifest entry plus the new member's pointer,
  satisfying the setup-cost metric), and a member never needs to know the workspace's full shape to
  work locally. Membership is never inferred from a pointer.
- **Refuted alternative:** Declare members only in the manifest and have each member discover the hub
  by scanning siblings for a manifest. Viable, and it removes the pointer file — but a member checked
  out beside several sibling repos has no deterministic way to know which sibling is the hub, and
  scanning invites picking the wrong one silently.

### Format and home: YAML, committed in the repo's existing Nexus config area

- **Decision:** Both artifacts are YAML, co-located with today's committed delivery settings, and are
  committed (not gitignored).
- **Why:** It matches the one config convention already in the tree (settings and label config are
  YAML), reuses the existing lightweight config-reading approach, and treats the artifacts as shared
  workspace truth rather than per-engineer configuration.
- **Refuted alternative:** A new dotfile at each repo root in JSON. Viable and conventional
  elsewhere, but it splits Nexus config across two formats and two locations, and JSON forfeits the
  comments a lead uses to annotate a hand-authored manifest.

### Resolution is deterministic code, and it is the single producer of workspace context

- **Decision:** Workspace resolution is implemented once as a shared, importable module that every
  command invokes; it lives on the deterministic (mechanics) side of Nexus's judgment-vs-mechanics
  seam.
- **Why:** Resolution is pure mechanics with one correct answer, so it does not belong in model
  prose. A single producer is what makes parity hold and what lets every later capability
  (close-entry migration, cross-repo distill, Prime's workspace state) consume resolution instead of
  re-deriving it.
- **Refuted alternative:** Let each consuming command resolve the workspace inline as it needs it.
  Viable short-term and less upfront plumbing, but it guarantees divergent behavior and inconsistent
  diagnostics across commands — the exact "get it right once" failure this epic exists to prevent.

### From a member, the hub is found as a named sibling under the shared parent — never by absolute path

- **Decision:** The pointer carries a bare directory name (plus the hub's remote identity for
  verification), and the resolver looks for that name as a sibling of the current checkout. This is
  the only v1 layout by design.
- **Why:** A bare sibling name is machine-independent and committable — every engineer's parent
  folder differs, but the sibling layout is the same.
- **Refuted alternative:** Store an absolute or configurable path to the hub in the pointer. Viable
  and it would support non-sibling layouts, but an absolute path cannot be committed as shared truth,
  and per-engineer path overrides are explicitly deferred (Out of Scope).

### Single-repo fallback is an explicit branch keyed on the absence of both artifacts

- **Decision:** When the current repo has neither a manifest nor a hub pointer, the resolver reports
  single-repo mode and returns today's answer, leaving existing relative-path resolution untouched.
  Zero regression is the pass/fail gate: the existing test suite must pass unmodified.
- **Why:** The epic's headline promise is "existing projects untouched"; an explicit, reversible
  fallback branch protects that guarantee for an S epic.
- **Refuted alternative:** Model single-repo as a "workspace of one" so there is a single always-on
  code path. Conceptually cleaner, but it routes every existing command through new resolution logic
  and puts the zero-regression guarantee at risk for no user benefit.

### Every failure returns a named, structured diagnostic distinguishing four modes

- **Decision:** Resolution never fails generically. It names the artifact, the offending entry, and
  expected-vs-actual state for each of: malformed manifest (missing/unknown/duplicate), missing hub
  checkout, missing member checkout, and undeclared-member mismatch. It explicitly distinguishes
  "declared member has no checkout" from "this is not a workspace," and never produces a silently
  partial workspace.
- **Why:** The Diagnosability success metric requires that setup problems be self-diagnosable without
  tribal knowledge.
- **Refuted alternative:** A simple resolved-or-not result with the error left to the caller. Viable
  and smaller, but it fails the Diagnosability metric outright.

### The status read-out is a read-only view over the shared resolver, rendered as terminal text

- **Decision:** Story 4 renders the resolver's output — hub, each declared member, each member's
  checkout state (found/missing) — and in single-repo mode states "no workspace declared," not an
  error. It reuses the existing script-invocation pattern rather than introducing a standalone CLI
  (deferred).
- **Why:** Being a deterministic surface over the same resolver (not independent logic) is what makes
  it a trustworthy verification vehicle for Stories 1–3.
- **Refuted alternative:** Build the read-out as its own workspace-inspection command with
  independent logic. Viable, but a second code path deriving workspace state separately could report
  a state the resolver disagrees with — defeating its purpose as the resolution contract's witness.

## Constraints & Invariants

1. Resolution is strictly read-only: it never clones, fetches, writes, or otherwise mutates any
   checkout — it reports missing state, it does not repair it.
2. With neither a manifest nor a hub pointer present, single-repo behavior is unchanged, verified by
   the existing test suite passing without modification.
3. The hub manifest is the sole authority for workspace membership; a member pointer locates the hub
   but never adds, removes, or redeclares membership, and manifest-vs-pointer disagreement is
   reported, never reconciled by inference.
4. The manifest is committed in the hub and each pointer is committed in its member repo; both are
   shared truth and are never per-engineer or gitignored configuration.
5. The sibling-checkout layout under one shared parent is the only supported v1 layout; a pointer
   references the hub by bare sibling name and remote identity, never by an absolute or per-engineer
   path.
6. Resolution from the hub and from any member yields an identical workspace description — same hub,
   same member set, same checkout locations.
7. A single deterministic resolver is the only producer of workspace context; every command consumes
   it and none re-derives workspace shape.
8. Every resolution failure names the artifact, the entry, and expected-vs-actual state, and
   distinguishes "missing checkout" from "not a workspace" — no generic failures.
9. Security boundary: resolution reads only within the declared workspace (the hub and declared
   siblings under the shared parent); the pointer's bare-name-only form prevents it from redirecting
   resolution to an arbitrary filesystem location, and the manifest/pointer are trusted committed
   config at the same trust level as existing delivery settings.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — the resolver must be genuinely shared, not copy-pasted:** The epic's payoff ("get it
  right once; every later capability consumes this resolution") rests on a single resolver, but the
  current codebase habit is standalone scripts that duplicate helpers verbatim. Land resolution as
  one importable module (imported directly from its defining module per the no-barrel rule) and make
  the Story 4 read-out its first consumer as proof, not its home. Signal it leaked: any later
  multi-repo stub re-implementing sibling-finding.
- **ADDRESS — remote-identity matching needs one normalization rule:** A git remote appears in
  multiple equivalent forms (SSH vs HTTPS, with or without a trailing `.git`); matching raw strings
  will silently break parity when two checkouts present different spellings. Define one normalization
  (compare host plus path, ignore protocol and the `.git` suffix) and apply it on both the manifest
  and pointer sides. Recommended default: treat "no matching remote" as a named diagnostic, not a
  match.

## Open Clarifications

None. The epic's Assumptions and Out-of-Scope settle the layout (sibling-only), artifact placement
(manifest in hub, pointer per member), the no-mutation rule, the no-generation-tooling stance, and
the single-repo fallback. The two ADDRESS risks carry recommended defaults and do not require a
human to proceed.
