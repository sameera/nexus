---
title: "Close Record: Existing Features and Epics Move onto Feature Issues"
epic: "#999"
feature: "Issue-Sourced Planning"
date: 2026-11-22
nexus_version: 1.1.0
analyze: ran 2026-11-22 @ 640ed278b1d87b1c8f09cf8a055d8b4dc84e55b5
record: "#1049"
record_hash: 742576fa936553f41f70725e9184b9160c7bfcf77dcaf402018cbec76b41c853
range:
  - repo: sameera/nexus
    pr: 1050
    base: 1992fb62225d474f6d484ed013395f1c65330093
    head: 245684fa5a94b92fb1ce9bc676b7c653d816a04e
story_ranges:
  - story: "#1046"
    ranges:
      - { repo: sameera/nexus, pr: 1050, base: 1992fb62225d474f6d484ed013395f1c65330093, head: 245684fa5a94b92fb1ce9bc676b7c653d816a04e }
  - story: "#1047"
    ranges:
      - { repo: sameera/nexus, pr: 1050, base: 1992fb62225d474f6d484ed013395f1c65330093, head: 245684fa5a94b92fb1ce9bc676b7c653d816a04e }
  - story: "#1048"
    ranges:
      - { repo: sameera/nexus, pr: 1050, base: 1992fb62225d474f6d484ed013395f1c65330093, head: 245684fa5a94b92fb1ce9bc676b7c653d816a04e }
landed_check:
  - story: "#1046"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1050, result: unchanged }
  - story: "#1047"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1050, result: unchanged }
  - story: "#1048"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1050, result: unchanged }
---

# Close Record: Existing Features and Epics Move onto Feature Issues

## Key Decisions

- **D1 — A plain command with a plan by default (#1049).** The migration is a `nexus` command that the lead runs. It uses no model and asks no questions. By default it prints the migration plan and writes nothing. An explicit apply flag carries the plan out. **Why:** #1000 is only safe once every existing feature and epic is on a feature issue. So the migration must be complete and repeatable, not something that happens when an issue is next touched. A plan the lead can read first makes the bulk edits to closed epics visible before they happen. **Refuted alternative:** Migrate a feature lazily, the next time `/nxs.epic` plans an epic for it. That needs no new command, but closed epics and dormant features are never touched again, so #1000 would go ahead with features still unmigrated.
- **D2 — Find feature issues by their folder record (#1049).** The run finds a feature issue by its folder record. It reads the filing ledger first, then a listing of every feature issue in both states. Two or more matches stop that folder and are reported, and the run continues with the other folders. **Why:** The filing ledger is local, so a run from another clone or after a cleanup still needs the listing. #998 writes the same folder record on new feature issues, so features filed by either epic are found the same way. A listing does not depend on the search index, which can miss an issue filed moments earlier. **Refuted alternative:** Match on the issue title. That needs no hidden record, but a renamed feature or an edited title would cause a second filing.
- **D3 — Name and statement only (#1049).** The feature issue's title is the feature's name from its README. Its body is the one-line capability statement from the README, or from the features index when the README has none, followed by the folder record. A folder with no statement in either place is reported and gets no issue. **Why:** #1046 asks for the feature's name and one-line capability statement. Using the same shape as #998's feature issues gives #1000 one kind of feature issue to read. Filing an issue without a statement would fail the criterion. **Refuted alternative:** Copy the whole README into the issue. That gives a fuller issue, but the copy goes stale when an epic is added, and it puts a second epic list beside the related issues.
- **D4 — The issue's own body decides its feature (#1049).** An epic or stub belongs to the feature its own body records. A README's epic list is used only for an issue that records no feature. When the two disagree, the issue's own body wins and the disagreement is reported. An issue that no source places is reported and is never guessed. Initiatives and feature issues are left out by their declared kind. Every state is covered. **Why:** The issue is the source of truth, as the issue-sourced-planning page's invariant 1 says. A README is a derived index that can be stale, but for older hand-filed epics it is the only record of their feature. A guess would write a wrong feature onto a closed epic that nobody reads again. **Refuted alternative:** Use only the README epic lists. That is one simple source, but READMEs list no stubs, and they miss any epic whose README entry was never written.
- **D5 — Write the feature issue number into the body, then link (#1049).** An epic names its feature issue through the feature reference field in its hidden block, and a stub through its Meta line. The migration adds only that field or line, and leaves the rest of the body byte-identical. An epic with no hidden block gets one that carries only the feature reference. The body is read back after the write, and the related link is added through #998's shared link step. The migration never changes an issue's state, parent, labels or type. **Why:** This is how #998 names the feature on new epics, so the whole backlog reads one way, as the epic asks. The resolver returns the field directly. GitHub allows body edits and related links on closed issues without reopening them. **Refuted alternative:** Record the feature only as the related link. That avoids editing approved and closed epics, but the resolver does not return the related link, so every reader, close included, would need a second query to find an epic's feature.
- **D6 — Keep the feature folders (#1049).** Feature folders are kept. Neither this epic nor the initiative deletes, moves or edits them, and the migration only reads them. `/nxs.epic` keeps updating the README until #1000 stops it. After that, each README is a historical index, and #1000 adds one line to it pointing to the feature issue. The folder stays as the home of longer feature notes. **Why:** The initiative's goal is that filing writes nothing to the tree, not that the tree is emptied. Docs, concept pages, `/nxs.hld`'s asset paths and older issue bodies link to these folders, and deleting them would break those links. Keeping them can be undone later; deleting them cannot. The lead chose to have #1000 add the pointer line, so this migration stays read-only on the tree. **Refuted alternative:** Delete each folder once its feature issue exists. That leaves one source and nothing to go stale, but it breaks the links and loses notes the feature issue does not carry.
- **D7 — Feature issues stay open (#1049).** The migration files feature issues open. It never closes or reopens an existing feature issue, whatever its state, and its lookup reads both states. **Why:** A feature is a lasting capability that keeps gaining epics, so it has no done state. GitHub's default views hide closed issues, so a closed feature would disappear from where a lead looks. #998 already files feature issues open. Feature issues are left out of the epic and stub queries by their declared kind, so an open one is not counted as work. **Refuted alternative:** File feature issues closed, so that open keeps meaning outstanding work and triage views stay clean. That loses because features would vanish from default views, every reader would need a query across both states, and it would contradict how #998 files.
- **D8 — Close names the feature issue on the stubs it files (#1049).** Close keeps writing nothing under any feature's path. When the epic being closed names a feature issue, every stub close files names the same feature issue in its Meta section and is linked to it as related through the shared link step. The folder path line stays as well. When the repository has not opted in, or the epic names no feature issue, close's stubs are unchanged. A failed related link prints a warning and never fails the close. **Why:** Close does not write under a feature's path today, so #1048's first criterion already holds. The only place close still names a feature by its path is the stubs it files. Without this change, every close after the migration would add stubs that do not name their feature issue, and #1000's query would miss them. The lead accepted this as #1048's scope. **Refuted alternative:** Leave close alone and re-run the migration from time to time to catch new stubs. That changes nothing in close, but completeness then depends on a habit, and between runs #1000 would undercount a feature's open stubs.
- **D9 — Refuse outside an opted-in repository (#1049).** The run refuses before reading anything unless the repository has opted in to features as issues and its feature marker resolves. Both are read only through the shared publishing settings and the shared kind rule. When the repository classifies by type and declares no feature type, the run stops and says so. It never falls back to a label. **Why:** The epic assumes the migration runs only in an opted-in repository. The publishing-config-resolution page's invariant 1 and the issue-kind-classification page's invariants 5 and 6 require reading these settings in one place and never guessing a marker. **Refuted alternative:** none
- **D10 — A retired label marks a feature no longer in use (#1049).** A retired-feature label marks a feature that is no longer in use. Its name is read through the shared publishing settings, as a new setting with a default. A lead applies it by hand, and the feature issue stays open. The migration's lookup still finds a feature issue that carries the label, and the migration never adds or removes it. **Why:** Feature issues stay open (D7), so closing one cannot mean retired. A label keeps a retired feature visible and filterable without breaking the lookup. The lead chose to define it in this epic. **Refuted alternative:** Let a lead close a retired feature's issue by hand, with no new convention. That needs nothing new, but it reuses the closed state, which D7 gives no meaning, so readers could not tell a retired feature from a mistake.
- **Serializer adds epic: from the issue title when a meta block lacks it** (a decision stub the verdict on sameera/nexus#1050 confirmed). **Why:** R2: only read-back change must be the feature issue number **Refuted alternative:** Write epic: into the added block
- **nexus feature-issue migrate [--apply] with injected MigrationGh** (a decision stub the verdict on sameera/nexus#1050 confirmed). **Why:** Reuses #998's lookup, work item and guarded filer **Refuted alternative:** A new top-level nexus migrate-features verb
- **Close hands each stub feature_issue so create-story's feature pass links it** (a decision stub the verdict on sameera/nexus#1050 confirmed). **Why:** Reuses #998's shared, warn-only link step **Refuted alternative:** A separate link call from close after filing
- **Read-back check through extractMeta + serializeEpic** (a decision stub the verdict on sameera/nexus#1050 confirmed). **Why:** Resolver's rule lives in those pure functions; no extra GitHub read **Refuted alternative:** Calling resolveEpic against GitHub per issue

## Deviation Rationale

- **Departs from record #1049 G3 — sameera/nexus#1050 DV4.** Body edits on existing epics and stubs go through a new shared step, writeFeatureReference in feature-link.ts, not through the guarded filing step or the shared link step G3 names. The step checks the body is unchanged, edits only the body, and reads it back. **Why:** D5 requires a guarded update to existing issue bodies. The migration preserves resolved epic content, skips bodies that already carry the correct reference, rechecks the current body before editing, and verifies the body afterward. This satisfies G3’s intent. Record writeFeatureReference as the third permitted write path. **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1050#issuecomment-7074079777)

## Waived Stories

none

## Deferred Scope

none
