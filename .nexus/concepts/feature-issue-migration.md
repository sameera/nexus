---
title: "Feature Issue Migration"
aliases: ["feature issue migration", "migrate features to issues", "feature-issue migrate", "feature issue reference", "retired feature label", "feature folder record"]
touches: ["issue-sourced-planning", "backlog-stub", "publishing-config-resolution", "issue-kind-classification", "feature-listing"]
last_updated_by: "#1000"
status: active
verification: verified
---

# Feature Issue Migration

Feature issue migration moves every feature that existed before features became GitHub issues onto a feature issue. It files one feature issue per feature folder, and it writes that issue's number into every existing epic and stub of the feature. A second run files and changes nothing.

## How It Works

The lead runs a plain command that uses no model and asks no questions. By default it prints the plan and writes nothing; an apply flag carries the plan out. The command refuses before reading anything unless the repository has opted in to features as issues and its feature marker resolves. It finds a feature's issue by a hidden folder record in the issue body, read first from the local filing ledger and then from a listing of feature issues in both states. A new feature issue carries the feature's name and its one-line capability statement, and is filed closed. An epic or stub belongs to the feature its own body records; a README's epic list is used only when the body records none. The run adds only the feature reference to each body, reads the body back, and adds a related link. Close also names the epic's feature issue on every stub it files. Feature folders are kept. The apply run adds one pointer line to each README, naming its feature issue, once.

## Key Invariants

1. Each feature folder has at most one feature issue; two matching issues stop that folder and are reported.
2. A run writes nothing without the apply flag, and a repeated run files and changes nothing.
3. An issue's own recorded feature wins over a README; an issue no source places is reported and never guessed.
4. The migration changes only the feature reference in a body and never an issue's parent, labels or type; it closes only the feature issues it files.
5. Feature issues are filed closed, so state means nothing. The retired-feature label, never added or removed by the migration, is the only retired signal.
6. A folder with no capability statement gets no feature issue and is reported.
7. A failed related link warns and never fails the close or the run.

## Integration Points

- [issue-sourced-planning](issue-sourced-planning.md) — the resolver reads the feature reference this migration writes into an epic's hidden block.
- [backlog-stub](backlog-stub.md) — each existing stub, and each stub close files, names its feature issue in its Meta section.
- [publishing-config-resolution](publishing-config-resolution.md) — supplies the opt-in, the feature marker and the retired-feature label name.
- [issue-kind-classification](issue-kind-classification.md) — the declared kind rule that finds feature issues and leaves initiatives and feature issues out of the epic set.
- [feature-listing](feature-listing.md) — the listing finds the feature issues this migration files, in both states, through the same marker.

## Decision Log

### 2026-11-22 — #999 — Existing features and epics move onto feature issues

A feature became an issue only for features planned after #998, so every older feature was still a folder, and planning that reads only issues would lose it. The migration is a command the lead runs, with a printed plan by default, because closed epics and dormant features are never touched again and lazy migration would leave them behind. A feature issue is found by a hidden folder record, not its title, so a renamed feature is not filed twice. The issue's own body decides its feature because the issue is the source of truth and a README can be stale. Body edits go through a guarded step that rechecks the body before editing and reads it back, which the lead accepted in place of the filing and link steps the record named. Refuted alternative: record the feature only as a related link, which avoids editing closed epics, but the resolver does not return related links, so every reader would need a second query.

### 2026-11-23 — #1000 — New feature issues are filed closed, and each README gets a pointer line

Open feature issues raised the open-issue count with no end. The earlier objection to closing them no longer holds, because features now have their own listing that reads both states. So state means nothing for a feature, and the retired-feature label is the only retired signal. The migration files new feature issues closed through the same close step the epic stage uses. Its apply run adds one pointer line to each README, so a reader who arrives from an old link sees where the epic list moved. The plan run still writes nothing. Refuted alternative: have the lead add one sentence by hand to each repository's features index. It keeps the migration read-only on the tree. It lost because a reader who lands on one README from an old link never sees the index. Mechanical reciprocity: the new feature-listing page lists the issues this page files.
