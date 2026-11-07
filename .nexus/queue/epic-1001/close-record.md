---
title: "Close Record: A Member Repository Uses the Hub's Settings"
epic: "#1001"
feature: "Multi-Repo Workspaces"
date: 2026-11-07
nexus_version: 0.128.0
analyze: ran 2026-11-07 @ d4cfbd74cdcf6f318b9b2e803c5a5a048a7c34f9
record: "#1003"
record_hash: f6f8e141a6908bb917f36444549ed9b1473a4c7ac78ba293a4273227bb6e5b8f
range:
  - repo: sameera/nexus
    pr: 1004
    base: b6dbb672408c52c031570034ff980dafebc7b908
    head: f91770e91920771cfae4e61230efc0cffbb32c85
story_ranges:
  - story: "#1002"
    ranges:
      - { repo: sameera/nexus, pr: 1004, base: b6dbb672408c52c031570034ff980dafebc7b908, head: f91770e91920771cfae4e61230efc0cffbb32c85 }
landed_check:
  - story: "#1002"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1004, result: unchanged }
---

# Close Record: A Member Repository Uses the Hub's Settings

## Key Decisions

- **D1 — The hub layer also reads the hub's own settings, inside the publishing resolver (#1003).** The hub layer reads the hub's own settings as well as the workspace-wide defaults, and it does so inside the one publishing resolver. **Why:** Teams already configure the hub's own settings: setup seeds them, and the hub's own filing reads them. Reading them in the one publishing resolver gives the change to every consumer at once: epic filing, story filing, the decision-record markers, the epic resolver's record check and the worktree base. No consumer gets a reader of its own. The workspace lookup finds the hub but still reads no settings. **Refuted alternative:** Merge the manifest allowlist into the key catalogue and tell teams to declare workspace values only in the manifest. That keeps one source and needs no second file read, and #178 called it the better end state. It loses because the hub's own filing still reads the hub's own settings, so teams would keep the same value in two files in the hub. That is the copy-and-drift problem this epic removes.
- **D2 — The hub's own setting wins over the workspace-wide default (#1003).** When the hub declares a key in both its own settings and its workspace-wide defaults, the hub's own setting wins. **Why:** With this order, a member that leaves a key unset gets exactly what the hub checkout gets. With the epic's order, the hub and a member disagree on every key declared in both places. Two cases matter. First, the record marker: a record filed from a member carries one label, and close, running in the hub, reads a different one and treats the record as a story. That breaks the issue-sourced-planning page's rule that the filing side and the reading side cannot disagree. Second, the project: the hub and its members file into different projects, which is the failure this epic sets out to fix. Both cases are likely, because setup seeds classification and project into the hub's own settings. **Refuted alternative:** The epic's assumption, where the workspace-wide default wins in a member. It gives the manifest a clear meaning, "this is for the workspace", and lets the hub keep values only the hub uses. It loses on the disagreement between filing and reading described above.
- **D3 — Only publishing keys come from the hub, and the test command never does (#1003).** The hub layer carries publishing keys only. It never carries the test command or the hub's cross-reference docs location. **Why:** The test command describes one code repository. An unattended build in a member would otherwise be held to the hub's test suite, and nothing would flag it. The cross-reference docs location also sits in the hub's settings file, and it names the hub's own docs, so it must never reach a member. This matches the epic's Out of Scope list. **Refuted alternative:** Inherit the test command too, so a workspace whose repositories all use the same tooling sets it once. It loses because a wrong inherited test command is silent and harmful, while a missing one costs one line per member.
- **D4 — Write-back never writes a hub-supplied value into the member's settings file (#1003).** Neither the filers' first-run record nor setup's seeding writes a key into a member's settings file when the hub layer supplied that key. **Why:** Today the epic filer's first run writes the classification it used into the member's file when the file lacks it, even when the value came from the hub. When project discovery runs because the hub declared discovery, it writes the discovered project too. Setup run in a member probes the member and seeds classification and project. Each of these freezes a copy that hides later hub changes, which breaks the epic's first success metric. Skipping keys the hub layer supplied still respects the rule that write-back fills only absent keys. **Refuted alternative:** Keep the current write-back, which only adds keys. It is simpler, and the frozen value equals the hub's value at the moment it is written. It loses because the next change on the hub never reaches that member, and nothing reports it.
- **D5 — Close is unchanged and runs only from the hub (#1003).** `nexus close` does not change. It keeps refusing to run in a member checkout and resolves settings from the hub checkout. **Why:** Close has refused to run in a member checkout since #215. In the hub, the hub's own settings are already its repo settings, so close already uses the values D2 makes members inherit. **Refuted alternative:** none
- **D6 — Each hub source fails on its own, silently, and never changes the exit code (#1003).** If the workspace cannot be resolved, both hub sources add nothing. If the hub checkout is present but its settings file cannot be read, only the hub's own settings drop out and the workspace-wide defaults still apply. No warning is printed and the exit code does not change. **Why:** This keeps the hub layer best-effort, as the publishing-config-resolution page's invariant 3 requires, and gives story #1002's fourth acceptance criterion its exit-code behaviour. Filing stages in a member already stop with a named error when the workspace cannot be resolved, because the docs-root read-out fails first (#81). So the silent fallback reaches only direct resolve calls and the rare unreadable-file case. **Refuted alternative:** Print a warning when the hub's settings cannot be read. That would make the cause visible. It loses because a stage resolves many keys per run and would repeat the warning, and workspace status already reports a missing hub.
- **writeGithubBlock itself drops any key readHubDefaults supplies, so setup's write-github and both filers' write-back skip it through one check** (a decision stub the verdict on sameera/nexus#1004 confirmed). **Why:** One writer serves both write-back paths; filtering there means no producer can bypass the check **Refuted alternative:** Filter separately in writeBackDecisions and in runConfigWriteGithub
- **A repoSpecific flag on the catalogue's test-command row; the hub layer drops every flagged key** (a decision stub the verdict on sameera/nexus#1004 confirmed). **Why:** Keeps the catalogue the single schema declaration **Refuted alternative:** A hard-coded testCommand exclusion inside hub.ts

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
