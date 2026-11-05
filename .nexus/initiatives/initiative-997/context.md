# Split

| # | Functional goal | Est. | Candidate stories |
|---|---|---|---|
| 1 | A feature is a GitHub issue that carries the repository's feature marker, and a new epic names it | M | The repository declares a feature label or feature issue type; Planning files a new feature as an issue; An epic's and a stub's meta block names its feature issue; Every stage refuses a feature issue as an epic or a story |
| 2 | Existing features and epics move onto feature issues | M | Each feature folder becomes a feature issue; Each epic's and stub's meta block names its feature issue; Close stops writing to the feature path |
| 3 | Planning reads features from a query, and filing writes nothing to the tree | M | `nexus` lists features, and a feature's epics and open stubs; `/nxs.epic`, `nxs-pm` and `nxs-architect` read features from that command; `/nxs.epic` filing writes no feature README |

# Objective

A feature is a GitHub issue that epics reference, so planning finds features by query and writes nothing to the repository when it files an epic.

# Execution order

1. Feature issue and marker. New features are issues and new epics reference them. The README is still written.
2. Migration. Every existing feature and epic is on a feature issue.
3. Query and readers. Planning reads features from the query and files without writing to the tree. The objective is reached.

# Why this split

Goal 2 migrates onto the marker that goal 1 defines. Goal 3 can stop reading the tree only after every existing feature has an issue. Otherwise, an unmigrated feature would vanish from planning.

# Deferred

nothing.

# Context summary

Features become marked GitHub issues that epics reference from their meta block, never as sub-issues, because the initiative holds the native parent slot. Three goals deliver this in order: marker, migration, then query and readers. The decision record settles three questions: whether feature issues are closed or open, what happens to the feature folders, and the close-time writes.
