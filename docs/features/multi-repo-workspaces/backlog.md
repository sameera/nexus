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

- **status:** promoted
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

- **status:** promoted
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

## manifest-skeleton-autopropose

- **status:** proposed
- **goal:** `nexus workspace init` *proposes* which discovered sibling is the hub and which are members (a confirmable skeleton) rather than only listing them for manual designation — the ergonomic win that dissolves the "where to deploy" decision.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic Nexus Setup CLI (#60) (2026-07-16)

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

## migrate-existing-hub-docs

- **status:** proposed
- **goal:** Migrate an already-committed hub's docs into the new layout — relocate an existing
  `docs/concepts.md` (and any other hub docs) from `docs/` to the resolved hub-root docs location,
  so hubs created before Parameterized Docs Root pick up the root layout without a manual move.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic Parameterized Docs Root (#74) (2026-07-18)

## nxs-pm-decisions-path-sweep

- **status:** promoted
- **goal:** Route the residual `docs/decisions/` literals in the nxs-pm agent (lines 47, 588)
  through the resolved docs root, closing the last literal-`docs/` prefix left after the taxonomy
  surfaces (features/product/system/delivery) moved. Outside this epic's taxonomy, so it was not a
  bypass here — a follow-on sweep so the `decisions/` surface tracks the root like the rest.
- **estimate:** S
- **blocked_by:** none
- **source:** deferred from epic Planning Surfaces Follow the Docs Root (#81) (2026-07-19)

## hub-born-queue

- **status:** superseded
- **superseded_by:** #114 issue-sourced-planning (2026-07-21) — epic #109 was abandoned before any
  implementation. Hub-born committed the entry at *planning* and delivered it onto hub main via a
  reviewed queue PR; #114 makes GitHub issues the source of truth, commits nothing at planning, and
  the committed entry is born at *close*. Carried into #114: issue-first filing with the issue number
  as the sole resolution key, and hub-resident story issues. Dissolved: the queue-PR delivery and the
  artifact-presence / close-record-presence drain filter (no planned entry ever exists to scan).
- **goal:** In a workspace, `/nxs.epic` plans in the hub: the epic issue is filed first, the queue
  folder is named `<issue#>-<slug>`, and the entry lands on hub main — so the queue entry is born
  beside the concept store and entry state is artifact-presence (planned → closed). The hub drain's
  scan filter keys on close-record presence so planned entries are never drainable and never
  hard-error a drain pass. Promotion must decide: how the entry reaches hub main (digest-gated
  direct commit vs a queue PR — avoid double-gating the same approval), and where story issues live
  (hub with cross-repo closing keywords from member PRs, vs member with cross-repo sub-issue links).
- **estimate:** M
- **blocked_by:** none
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** Issue-first epic filing names the entry folder; Entry lands on hub main at approval; Drain scan skips entries without a close record; Story issues filed with the chosen cross-repo linkage

## hub-design-gate

- **status:** superseded
- **superseded_by:** [hld-subissue-record] (2026-07-21) — the decision record becomes an `hld`
  sub-issue of the epic; with no committed record file there is no hub PR to review, so this stub's
  mechanism dissolves. Its "analyze flags entry drift after design" story survives as the body-hash
  staleness check in the superseding stub.
- **goal:** `/nxs.hld` runs against the hub queue entry from an engineer's hub checkout, stamps the
  entry commit SHA it read, and the derived decision-record.md lands in the hub entry via a
  lead-reviewed hub PR — the pre-implementation design gate. One canonical copy of the record; it is
  never woven into PR bodies.
- **estimate:** S
- **blocked_by:** [hub-born-queue]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** hld resolves the hub entry and stamps the read SHA; Decision record lands via lead-reviewed hub PR; Analyze flags entry drift after design

## nxs-pr-command

- **status:** proposed
- **goal:** A new engineer-facing `nxs.pr` command — the only Nexus command an engineer must run —
  raises the story PR: derives a deviation block from the branch's scratch stubs, stamps story/epic
  IDs and the derived-from SHA into a machine-readable block in the PR body, and deletes the scratch
  from the branch tip before opening the PR, so nothing ever needs cleanup on member main. Skipping
  or absence is explicit in the block, never silent.
- **estimate:** M
- **blocked_by:** [hub-born-queue]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** Deviation block derived from branch scratch; Machine-readable block with story/epic IDs and derived-from SHA; Scratch removed from the branch tip before PR open; Explicit skip and absence paths

## story-analyze-hub

- **status:** proposed
- **note (2026-07-21):** #114 (issue-sourced-planning) makes the committed queue entry born at
  *close*, so there is no planning-time hub entry for a per-story `analyze-record.<story-id>.md` to
  land in before close. The PR-review verdict is unaffected; the committed-record home must be
  reconsidered at promotion (aggregate at born-at-close, or carry it in the PR-review machine block).
- **goal:** `/nxs.analyze` runs per story from the hub against a member PR: pr-worktree is
  parameterized by member repo (the member-unsupported gate is deleted), conformance checks the
  story's ACs and the decision record's invariants at the PR head, the verdict posts as a PR review,
  and `analyze-record.<story-id>.md` (story ID, PR number, analyzed head SHA, verdict) is committed
  into the hub entry. A PR without the nxs.pr block hard-fails with a named diagnostic.
- **estimate:** M
- **blocked_by:** [hub-born-queue, nxs-pr-command]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** pr-worktree targets a declared member repo; Per-story conformance against ACs and record invariants; analyze-record file committed to the hub entry; Hard fail on a missing nxs.pr block

## epic-analyze-receipt

- **status:** proposed
- **goal:** `/nxs.close` requires an epic-level analyze-receipt.md: when story-level analyze records
  exist, an aggregate pass over their combined ranges derives it (verifying each record's SHA
  currency against that story PR's merged head — cross-story invariants and success metrics are only
  assessable over the aggregate); with no story records, full-epic analyze runs as today.
- **estimate:** S
- **blocked_by:** [story-analyze-hub]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** Aggregate receipt from current story records; Per-story SHA-currency verification; Full-epic fallback when no story records exist

## hub-close-multi-pr

- **status:** proposed
- **goal:** `/nxs.close` closes a hub-born epic over N story PRs: gates on stories closed, story PRs
  merged, and a current epic receipt (per-story waivers for storyless work); stamps one
  merge-anchored `{repo, base, head}` per story PR into the close record's list-shaped range (the
  same shape that later serves cross-repo epics); mines deviation blocks from the merged PR bodies;
  and writes the close artifacts on the distill branch.
- **estimate:** M
- **blocked_by:** [epic-analyze-receipt]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20) — absorbs the producer-side seam of `cross-repo-range-recording` (per-story multi-entry stamping lands here; that stub's touched-repo detection remains its own scope)
- **candidate stories:** Close gates on merged story PRs and a current receipt; Merge-anchored range list, one entry per story PR; Deviation mining from merged PR bodies; Storyless-story waivers; Close artifacts on the distill branch

## multi-range-distill

- **status:** proposed
- **goal:** `/nxs.distill` drains an entry whose range is a list: the diff is the aggregation of the
  per-PR merge-anchored diffs (never one spanning base...head, which would swallow interleaved
  epics), with repo-qualified anchors, provenance, and drain-SLO reporting working across N ranges
  per repo.
- **estimate:** M
- **blocked_by:** [hub-close-multi-pr]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** Per-PR diff aggregation from the range list; Anchors and provenance over N ranges; Drain-SLO reporting for multi-range entries

## entry-abandonment

- **status:** superseded
- **superseded_by:** #114 issue-sourced-planning (2026-07-21) — with nothing committed at planning,
  there is no planning-time entry to delete: abandoning is just closing the epic issue (and its hld
  sub-issue) with a reason, and "abandoned epics never distill" is automatic (no close record → the
  epic never enters the queue). Both candidate stories collapse to a trivial documented step; no
  epic warranted.
- **goal:** An explicit abandonment path for hub-born entries: abandoning a planned or designed epic
  deletes the hub queue entry and closes the epic issue with a stated reason, so the hub queue never
  accumulates zombies the drain must skip forever — the branch-dies-so-the-entry-dies mechanism of
  the ride-the-feature-branch model does not exist for hub-born entries.
- **estimate:** S
- **blocked_by:** [hub-born-queue]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** Abandon deletes the entry and closes the issue; Abandoned entries never distill

## legacy-flow-retirement

- **status:** proposed
- **goal:** Retire the member close-and-migrate path once the hub-born flow is proven: remove the
  member-mode close choreography, delete the close-migration helper (skill + lib), and relocate any
  in-flight member-queue entries into the hub as a one-time cutover — after which the distillation-PR
  merge is the only cleanup anywhere in the system.
- **estimate:** S
- **blocked_by:** [hub-close-multi-pr, multi-range-distill]
- **source:** decomposition of "Refactor multi-repo workspaces around PR-driven delivery (hub-born queue)" (2026-07-20)
- **candidate stories:** Remove the member close-and-migrate path; Delete the close-migration helper; One-time relocation of in-flight member entries

## hld-subissue-record

- **status:** proposed
- **goal:** The decision record becomes an `hld`-typed/labeled **sub-issue of the epic** instead of a
  queued `decision-record.md` — one copy, born durable, approval as a native GitHub act. `/nxs.hld`
  files the sub-issue (body = the record), stamps `hld: "#n"` into `epic.md` frontmatter, and swaps
  the epic's labels `needs design` → `in progress`; **closing the sub-issue is design approval** (the
  issue timeline gives who/when for free). An open hld blocks everything downstream: `/nxs.analyze`
  hard-blocks on it, and `/nxs.close` blocks on **any** open sub-issue regardless of type. A canonical
  hash of the approved body is stamped into the analyze receipt (`hld_hash`, beside `head`) and the
  close record + close comment, making "design changed after analysis" a second staleness axis beside
  the code SHA. The body is frozen at approval; a revision reopens the issue, lands as a dated
  comment, updates the body, and re-closes — so every approved state is reconstructible from the
  comment trail. `/nxs.distill` fetches the *why* from the hld issue body (hash-verified) instead of
  reading an entry file. No hld sub-issue is legal (simple/non-technical epic): `/nxs.epic` applies
  `needs design` only when its complexity rollup warrants a design, and `/nxs.hld` gets an explicit
  "no design needed" outcome that strips the label without filing. Scope is pipeline-wide
  (single-repo first, workspace-agnostic); rewrites the committed-queue artifact list and the
  distiller input invariant; the close comment's deviation rationale cites `#<hld>` as its baseline.
- **estimate:** M
- **blocked_by:** none  <!-- the `hld` type/label and `needs design` mappings should fold into
  github-publishing-config's `github:` block when both land -->
- **source:** session design discussion (2026-07-21) — decision-record durability: the queued file
  drains away leaving no durable copy and no addressable provenance target; a sub-issue is
  addressable by the existing issue-ref provenance form and makes approval auditable. Supersedes
  [hub-design-gate]: the sub-issue lives on the hub epic automatically, so the record needs no file,
  no lead-reviewed hub PR, and no branch-protection choreography. (Update 2026-07-21: #109 was
  abandoned; its successor #114 removes the committed planning-time `epic.md` entirely, so this
  stub's `hld: "#n"` linkage must live on the epic issue — the source of truth — not a frontmatter
  stamp in a materialized file. Reconcile at promotion.)
- **candidate stories:** hld files the sub-issue + label lifecycle (incl. approve-now at the hld
  checkpoint and the no-design-needed outcome); analyze hard-block + `hld_hash` stamping (receipt
  and PR-review machine block); close blocks untyped, cites `#<hld>` as deviation baseline, stamps
  the hash durably; distill fetches and hash-verifies the *why*; revision flow
  (reopen/comment/re-close); concept + invariant updates (committed-queue, distiller)

## pipeline-gh-cli

- **status:** proposed
- **goal:** Extract the deterministic GitHub transaction layer of `/nxs.epic` and `/nxs.hld` into the
  `nexus` CLI (same distributable as `workspace-setup-cli` / `portable-nexus-tools`), so the slash
  commands own judgment only (prose + human gates) and every state transition is one idempotent verb:
  `nexus epic file` (epic issue idempotent on `link`, story sub-issues + blocked_by wiring, labels
  incl. `needs design`, entry naming, queue PR in hub-born mode) and
  `nexus hld file|approve|revise|status|hash|gate`. `hld hash` is the **single canonical hash
  implementation** every stamp (analyze/close/distill) calls — three stages computing their own
  sha256 in bash will drift on canonicalization. `hld gate` is an exit-code preflight (same pattern
  as `pr_worktree.ts preflight`) callable from CI as a required check, making "open hld blocks
  downstream" enforceable outside a Claude session. Consolidates the `nxs-gh-create-epic` /
  `nxs-gh-create-story` scripts and shares the one github-config resolver.
- **estimate:** M
- **blocked_by:** [hld-subissue-record]  <!-- the hld verbs presuppose the sub-issue record; the
  `nexus epic file` verb could split out earlier if needed -->
- **source:** session design discussion (2026-07-21) — extending the deterministic-vs-judgment seam
  [workspace-setup-cli] established to the planning stages. Triage must consolidate with
  [workspace-setup-cli] and [github-publishing-config] so the gh mechanics and the config resolver
  live in exactly one place.
- **candidate stories:** `nexus epic file` transaction (idempotent, workspace-aware); the `nexus hld`
  verb set with the canonical hash; `hld gate` as a CI-callable preflight; consolidate the gh-create
  scripts onto the shared config resolver; re-scope `/nxs.epic` and `/nxs.hld` to judgment + verb
  calls
