---
title: "Feature Listing"
aliases: ["feature listing", "list features", "feature-issue listing", "feature mode", "github.features", "features from a query", "retired feature signal"]
touches: ["issue-sourced-planning", "feature-issue-migration", "issue-kind-classification", "publishing-config-resolution"]
last_updated_by: "#1000"
status: active
verification: verified
---

# Feature Listing

Feature listing answers three questions from GitHub issues: which features exist, which epics a feature has, and which open stubs it has. Planning and the advisory agents ask it instead of reading the docs tree. In a repository that opted in, filing an epic then writes nothing to the tree.

## How It Works

A repository records features in one of three ways: in the docs tree, as issues marked by the Feature issue type, or as issues marked by a label. The tree is the default. The older switch for features as issues still works when the new setting is absent.

The listing checks that setting first. When features are in the tree, it says so and makes no GitHub call, and the readers then use the tree. Under the type mode it refuses when no feature type is named.

Otherwise it lists every feature issue that carries the marker and records its feature, open or closed. A feature's epics and stubs are the epic-marked issues whose body names the feature issue number. An unplanned label marks a stub. Epics are listed in both states, and only open stubs are listed.

A listing GitHub does not fully answer prints nothing. A new feature issue is filed, then closed, before its epic is filed. The retired-feature label is the only sign that a feature is no longer used.

## Key Invariants

1. When features are in the tree, the listing makes no GitHub call, and the readers use the tree as before.
2. A feature issue is listed only when it carries the feature marker and records its feature, whatever its state.
3. Epic and stub membership comes from the feature issue number in each body, never from related links.
4. A listing GitHub does not fully answer fails and prints nothing partial.
5. The type mode never falls back to a label, and a run that would file a new feature issue stops before approval when the type is missing.
6. An opted-in run files epics and stubs without writing a feature folder, a README or an index row.
7. Only the retired-feature label marks a retired feature; state means nothing and no stage sets the label.

## Integration Points

- [issue-sourced-planning](issue-sourced-planning.md) — the epic stage and both advisory agents read features through this listing instead of the tree.
- [feature-issue-migration](feature-issue-migration.md) — files its new feature issues closed, and lists existing ones through the same marker.
- [issue-kind-classification](issue-kind-classification.md) — the feature marker is read from the feature setting, not the classification mode.
- [publishing-config-resolution](publishing-config-resolution.md) — resolves the feature setting and the feature type name.

## Decision Log

### 2026-11-23 — #1000 — Planning reads features from one listing, and filing writes nothing to the tree

Every filing changed the repository, because the epic stage wrote a feature README and an index row, while the epic itself lived on GitHub. The listing lives in the existing feature-issue command because that command already holds the opt-in reading, the marker and the issue reader. It lists only issues that record their feature, because the Feature type and the feature label are widely used for feature requests. Membership comes from the body reference, because a related link can fail with only a warning and drop an epic silently. The issue listing is used rather than search, because search lags behind an issue filed moments earlier. Under the type mode a missing type stops the run before approval, because a feature filed with the wrong marker is missing from the next listing and would be filed again. Refuted alternative: use GitHub search for the feature list. It is one call with no paging. It lost because the search index lags and caps its results.
