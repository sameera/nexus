# Backlog: Multi-Repo Workspaces

<!-- Append-only re-triage queue. Writers: /nxs.epic (decomposition stubs),
     /nxs.close (deferred scope). One consumer: the next /nxs.epic.
     Promote a proposed stub with `/nxs.epic <slug>`. -->

## workspace-manifest

- **status:** promoted
- **goal:** A hub-side workspace manifest and member-side hub pointers so any command, run from any member repo or the hub, can resolve the workspace: hub repo, member repos, and their sibling checkouts — with clear errors when a checkout is missing.
- **estimate:** S
- **blocked_by:** none
- **source:** decomposition of "multi-repo workspace support for GIC — hub-and-spoke, migrate-at-close" (2026-07-10)
- **candidate stories:** Workspace manifest schema and hub authoring; Member repo hub pointer; Checkout resolution with missing-checkout errors

## portable-nexus-tools

- **status:** promoted
- **goal:** Package the deterministic Nexus tooling (concept validator, atlas generator, shared mechanical steps) so it runs in a hub repo that has no local node tooling of its own, with parity against the in-repo scripts.
- **estimate:** M
- **blocked_by:** none
- **source:** decomposition of "multi-repo workspace support for GIC — hub-and-spoke, migrate-at-close" (2026-07-10)
- **candidate stories:** Extract tooling into a distributable package; Hub install path; Parity checks against in-repo scripts

## close-entry-migration

- **status:** promoted
- **goal:** /nxs.close migrates the closed queue entry from the code repo to the hub queue — stamping repo plus explicit base/head ranges (one per touched repo) into the close record — and removes the entry from the code repo, so distill's diff derivation and drain atomicity survive the repo split.
- **estimate:** M
- **blocked_by:** [workspace-manifest]
- **source:** decomposition of "multi-repo workspace support for GIC — hub-and-spoke, migrate-at-close" (2026-07-10)
- **candidate stories:** Range stamping in the close record; Hub migration commit; Code-repo entry removal; Multi-repo range recording for cross-repo epics

## distill-multi-repo

- **status:** proposed
- **goal:** /nxs.distill drains the hub queue across the workspace: recomputes each entry's diff from its recorded repo+range in the member checkout, writes repo-qualified code anchors with per-repo source SHAs, defaults to qualified provenance, and reports drain-SLO across all repos.
- **estimate:** M
- **blocked_by:** [portable-nexus-tools, close-entry-migration]
- **source:** decomposition of "multi-repo workspace support for GIC — hub-and-spoke, migrate-at-close" (2026-07-10)
- **candidate stories:** Recorded-range diff derivation in member checkouts; Repo-qualified anchors; Qualified provenance as the multi-repo default; Cross-repo drain-SLO reporting

## engineer-install

- **status:** proposed
- **goal:** One-time, per-engineer setup with zero per-repo effort: a self-gating user-level scratch-capture hook (active only in repos with a .nexus marker, preserving the consent invariant) and an extended update script that stamps the hub pointer when distributing .claude into member repos.
- **estimate:** S
- **blocked_by:** [workspace-manifest]
- **source:** decomposition of "multi-repo workspace support for GIC — hub-and-spoke, migrate-at-close" (2026-07-10)
- **candidate stories:** Self-gating user-level hook; One-time engineer installer; Update-script hub-pointer extension

## github-publishing-config

- **status:** proposed
- **goal:** Externalize GitHub issue-publishing decisions — classification mode (issue-types
  vs labels), Project V2 target (incl. first-class "none"), repo targeting for epics vs
  stories, and label mappings — into one declared `github:` block in
  `.nexus/config/settings.yml`, produced by /nxs.setup at bootstrap and resolved the same way
  by every consumer, replacing today's discovery-by-failure probing. Absent config reproduces
  today's behavior; the one deliberate change is the epic fallback label `enhancement` →
  `epic`, made safe by an ensure-label step so it never strands an issue.
- **estimate:** M
- **blocked_by:** none  <!-- core is single-repo; the workspace-defaults story layers on workspace-manifest -->
- **source:** session brainstorm (2026-07-10) — externalizing GitHub publishing params after
  the epic-filing crash on a personal repo (no org issue-types; broken project
  auto-discovery). The settings.yml reader-pointer fix shipped separately as an immediate bug
  fix; this stub builds the schema on top of it.
- **candidate stories:** Consolidate the config reader into one shared resolver (both scripts
  copy it verbatim today); Classification mode (types | labels | legacy-auto) with epic/story
  type and label mappings, default epic-label `epic`, ensuring the epic label exists before
  applying it (mirroring the story-label upsert) so the new default never fails; Project
  target none | auto | explicit with "none" first-class (no probe, no warning); Resolver
  precedence frontmatter > repo settings > hub defaults > built-in, consumed by both creation
  scripts + /nxs.epic + /nxs.close (fixes /nxs.close ignoring issues-repo today);
  Workspace-wide github defaults in the hub manifest with per-key member inheritance [builds
  on workspace-manifest], and the epic-repo/story-repo targeting rule incl. the
  no-primary-repo case (epic issue → hub); Extend /nxs.setup Phase 4 to seed the `github:`
  block — detect classification mode via the issue-types probe and project linkage via `gh`
  at setup-time (moving the crash-prone runtime probe to where the human is present), confirm
  the project target when ambiguous, and fall back to safe defaults (`mode: labels`,
  `project: none`) when `gh` is unavailable

## workspace-setup-cli

- **status:** proposed
- **goal:** A deterministic, workspace-level `nexus` CLI that owns the structural bootstrap a
  slash command structurally cannot — because `/nxs.setup` runs inside one Claude session cwd'd
  into one repo, while first-run must act *above* any single repo: decide which checkout is the
  hub and which are members (the placement decision the user must make), author the hub manifest,
  stamp each member's hub pointer, and distribute `.claude/` into every repo. The CLI runs with
  no in-repo tooling (shares the `portable-nexus-tools` distributable) so it can bootstrap a repo
  before that repo is scaffolded. `/nxs.setup` is then re-scoped to per-repo *judgment* only —
  stack docs, standards, product-context interview — run inside each repo after the CLI has placed
  it into the workspace, discovering the workspace via the pointer/manifest it now carries.
  Single-repo is untouched: `/nxs.setup` alone self-detects "no workspace" and the CLI is never
  pulled in.
- **estimate:** M
- **blocked_by:** [workspace-manifest, portable-nexus-tools]
- **source:** session brainstorm (2026-07-10) — the multi-repo bootstrap-ordering problem: the
  manifest and pointers are the *output* of setup, but a slash command can only touch its own cwd,
  so the structural/placement half of setup has no repo to run in. Resolution is to split setup
  along Nexus's deterministic-vs-judgment seam (CLI owns structure, `/nxs.setup` owns judgment),
  with Prime as an optional later front-end over the same CLI primitives — not a required
  dependency. Overlaps and should consolidate with `engineer-install` (its "update-script
  hub-pointer extension" and "one-time engineer installer" are the embryo of this CLI) and
  `portable-nexus-tools` (same distributable); triage must decide the split so the pointer-stamping
  and `.claude`-distribution mechanics live in exactly one place.
- **candidate stories:** `nexus workspace init` — declare a workspace (confirm hub/members/parent,
  write manifest, stamp pointers, distribute `.claude/`); Manifest-skeleton generation from the
  discovered sibling layout (proposes hub/members for confirmation — the ergonomic win that
  dissolves the "where to deploy" pain; note this pushes against the manifest epic's current
  "no manifest-generation tooling" assumption, so it may be deferred); `nexus workspace status`
  (the manifest epic's Story 4 read-out, exposed as a CLI verb); `nexus workspace add-repo`
  (member add touching at most the two files the manifest epic promises); Re-scope `/nxs.setup`
  to per-repo judgment with workspace detection (hub vs member) via the pointer/manifest

## cross-repo-range-recording

- **status:** proposed
- **goal:** Extend range stamping (the producer side) to cross-repo epics: record more than one
  `{repo, base, head}` entry in the close record and detect which code repos an epic touched, so
  an epic implemented across multiple member repos carries a range per repo. The range block is
  already list-shaped, so no frontmatter schema change is needed — only touched-repo detection and
  multi-entry stamping.
- **estimate:** M
- **blocked_by:** [distill-multi-repo]
- **source:** deferred from epic Close-Entry Migration to the Hub Queue (#49) (2026-07-15)
