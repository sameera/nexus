---
title: "Filing Preflight"
aliases: ["filing preflight", "batch legality check", "stub parent check", "parent check", "label establishment"]
touches: ["resumable-batch-filing", "backlog-stub", "initiative", "issue-kind-classification", "publishing-config-resolution"]
last_updated_by: "#705"
status: active
verification: verified
---

# Filing Preflight

The filing preflight proves a batch of work items legal, and makes every label it will apply exist, before the batch files any issue. A refusal names the offending item and files none of the batch. A bad work item then costs a corrected file rather than a half-filed repository.

## How It Works

The target folder must resolve inside the run's root. No item marked unplanned may ask for a parent other than an issue declared an initiative. Any other parent refuses the whole batch: an epic, a story, a record, an unmarked issue, or a number that does not resolve.

The parent check reads the parent's kind from GitHub through the shared kind rule. It reads only when an unplanned item names a parent, and only once per distinct parent. A rehearsal makes the same check, so it never previews a batch the real run would refuse.

The legality check runs before publishing configuration is resolved. Only then is every label established, so a repository that has never carried one is prepared before anything exists.

## Key Invariants

1. No issue exists until the batch is proved legal: the folder resolves inside the run's root, and no unplanned item names a parent that is not declared an initiative.
2. Every label the run will apply exists before the first issue; one that can neither be found nor created ends the run having created nothing.
3. A batch in which no unplanned item names a parent makes no read from GitHub for the parent check.
4. A rehearsal applies the same parent check as the real run.

## Integration Points

- [resumable-batch-filing](resumable-batch-filing.md) — the batch this check runs ahead of, split from that page.
- [backlog-stub](backlog-stub.md) — the stub whose parent this check limits to an initiative, so no stub lands under an epic.
- [initiative](initiative.md) — the only parent this check allows a stub.
- [issue-kind-classification](issue-kind-classification.md) — the rule this check reads to decide whether a named parent is an initiative.
- [publishing-config-resolution](publishing-config-resolution.md) — supplies the unplanned label, the initiative marker and every label this check establishes.

## Decision Log

### 2026-10-10 — #705 — split from resumable-batch-filing, and a stub may name an initiative as its parent

This page was split from resumable-batch-filing when that page passed the word cap. It holds what the filer checks and prepares before anything exists, and resumable-batch-filing keeps the ledger and the passes that follow. The epic that forced the split also narrowed the check. It used to refuse any stub that named a parent. It now refuses a stub whose parent is not declared an initiative. An initiative sits above the epic, and close never reads an epic's parent, so a stub under one cannot block a close. The check reads the parent's kind through the same rule the epic resolver uses, so filing and reading cannot disagree about the same issue. A rehearsal makes the same read, because a rehearsal that previews a batch the real run refuses is misleading. Refuted alternative: skip the parent check on a rehearsal, so a rehearsal still contacts nothing. It lost because the old refusal applied to a rehearsal too.
