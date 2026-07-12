# Backlog: Prime Workspace Instrumentation

<!-- Append-only re-triage queue. Writers: /nxs.epic (decomposition stubs),
     /nxs.close (deferred scope). One consumer: the next /nxs.epic.
     Promote a proposed stub with `/nxs.epic <slug>`.
     Cross-feature blockers reference stubs in
     docs/features/multi-repo-workspaces/backlog.md. -->

## workspace-state-provider

- **status:** proposed
- **goal:** Prime's server derives workspace state read-only from the manifest and member checkouts — epics in flight with stage inferred from queue-entry contents, hub queue entries with ages — with no Prime-side state store; derive on read, always.
- **estimate:** M
- **blocked_by:** [workspace-manifest]
- **source:** decomposition of "Prime instruments the multi-repo workspace (session brainstorm)" (2026-07-10)
- **candidate stories:** Workspace state derivation from checkouts; Stage inference from entry contents; Refresh/watch behavior

## rail-on-real-state

- **status:** proposed
- **goal:** The pipeline rail is driven by real derived workspace state instead of local mock stage state — retiring the rail's mock-state invariant — showing per-epic stage segments across the workspace.
- **estimate:** M
- **blocked_by:** [workspace-state-provider]
- **source:** decomposition of "Prime instruments the multi-repo workspace (session brainstorm)" (2026-07-10)
- **candidate stories:** Rail data binding to derived state; Per-epic stage segments; Artifact preview wiring

## hub-queue-drain-view

- **status:** proposed
- **goal:** A hub-queue view showing pending drains with ages and drain-SLO flags, plus a drain affordance that types /nxs.distill into the command input — surfacing SLO breaches passively instead of only at distill time.
- **estimate:** S
- **blocked_by:** [workspace-state-provider]
- **source:** decomposition of "Prime instruments the multi-repo workspace (session brainstorm)" (2026-07-10)
- **candidate stories:** Pending-drain queue view; Drain-SLO flagging; Drain-to-command-input affordance

## gate-event-mirroring

- **status:** proposed
- **goal:** Checkpoint gates firing inside terminal Claude sessions emit local gate events via a distributed hook; the gate tray mirrors them and focuses the owning session — answering stays in the terminal, the tray directs attention.
- **estimate:** M
- **blocked_by:** [engineer-install, workspace-state-provider]
- **source:** decomposition of "Prime instruments the multi-repo workspace (session brainstorm)" (2026-07-10)
- **candidate stories:** Gate-event emitting hook; Gate tray mirroring; Session focus on gate selection

## checkpoint-drawer-review

- **status:** proposed
- **goal:** At close and distill checkpoints, the artifact peek drawer renders the review material — the close record, the distill delta digest beside the pages it patches — so the human decides at the gate with the evidence in view.
- **estimate:** S
- **blocked_by:** [workspace-state-provider]
- **source:** decomposition of "Prime instruments the multi-repo workspace (session brainstorm)" (2026-07-10)
- **candidate stories:** Delta-digest rendering in the drawer; Checkpoint detection; Close-record rendering

## multi-session-workspaces

- **status:** proposed
- **goal:** One Prime window hosts multiple Claude Code sessions, each cwd'd into a different member repo (or the hub), so cross-repo epics don't require multiple terminal windows.
- **estimate:** M
- **blocked_by:** none
- **source:** decomposition of "Prime instruments the multi-repo workspace (session brainstorm)" (2026-07-10)
- **candidate stories:** Per-repo session spawning; Session switcher
