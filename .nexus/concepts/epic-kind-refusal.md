---
title: "Epic Kind Refusal"
aliases: ["refuse initiative as epic", "refuse feature as epic", "marker test order", "feature tested last", "initiative tested last"]
touches: ["issue-kind-classification"]
last_updated_by: "#998"
status: active
verification: verified
---

# Epic Kind Refusal

A stage that resolves an epic refuses an issue whose declared kind is initiative or feature, and names which one it is. The kind markers are tested in a fixed order. The order keeps a repository whose epic label is also another kind's word from losing its epics.

## How It Works

The design stage's import refuses an issue its repository files as a story or a record. Every stage refuses an initiative or a feature as its epic, by name. The batch filer reads a stub's parent through the same rule.

The initiative marker is tested after the epic, story and record markers, and the feature marker is tested last. So a repository whose epic label is the word initiative still reads epics as epics, and an issue that carries any other marker is never read as a feature.

A feature issue has no parent. Without the refusal, an unmarked parentless issue would resolve as an epic, and a feature handed to a stage would resolve as an epic with no stories. Feature issues will be many, so a mistyped number is likely.

## Key Invariants

1. An unmarked issue is refused as an epic only when it is a sub-issue of something, so a repository that marks no issue at all still resolves its epics.
2. Every stage refuses an initiative or a feature as its epic, and names which kind it is.
3. The epic, story and record markers are tested before the initiative marker, and the initiative marker before the feature marker.
4. An issue that carries another kind's marker is never read as a feature.
5. A feature kind exists only in a repository that opts in to features as issues.

## Integration Points

- [issue-kind-classification](issue-kind-classification.md) — defines each kind and its marker; this page decides which kinds a stage refuses and in what order they are tested.

## Decision Log

### 2026-11-21 — #998 — split from issue-kind-classification

Feature became a declared kind in a repository that opts in to features as issues. It is tested after epic, story, record and initiative, so a repository whose epic or initiative label is the word feature loses no epic and no initiative. Every stage that resolves an epic refuses an issue read as a feature and names it. A feature issue has no parent, so under the unmarked-parentless rule it would otherwise resolve silently as an empty epic. The refusal rules, the test order and the unmarked-parentless rule moved here from issue-kind-classification, which was at its word cap. Refuted alternative: let a feature read as none of these in the epic stages. It needs no change to the resolver or to close, and it lost because a parentless feature then resolves as an empty epic.
