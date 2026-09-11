---
title: "Range-Entry Diff Derivation"
aliases: ["range reader", "entry diff derivation", "per-entry change set", "range list reader"]
touches: ["distiller", "close-entry-migration", "code-anchors", "pipeline-store-exclusion", "workspace-resolution"]
last_updated_by: "#214"
status: active
verification: verified
---

# Range-Entry Diff Derivation

Range-entry diff derivation turns the range list a close stamped into the change sets a drain reads. Its unit is the range entry, not the repository, so an epic that shipped as several pull requests yields one change set per pull request, in the order they landed. One reader serves a single repository and a workspace hub alike.

## How It Works

Each stamped range names a repository, a start revision, an end revision, and the pull request it came from. The reader resolves every entry to a checkout — through the workspace manifest in a hub, or against the current checkout's own identity where there is no workspace — and confirms both revisions are present before emitting anything. Within a repository it sorts entries by ancestry of their end revisions, because each is a trunk commit; two ends it cannot order stop the whole entry rather than being guessed at. Each change set is then computed in its own repository's checkout, over its own start and end alone. One unresolvable entry leaves its queue entry undrained while the rest of the run drains, and a failure belonging to a repository, such as an absent checkout, is reported once rather than once per entry naming it.

## Key Invariants

1. The unit is the range entry: one headed change set per stamped entry, and a repository may appear in more than one, though an identical repeat stays a malformed stamp.
2. A repository's entries are ordered by ancestry of their end revisions; ends that cannot be ordered stop the entry, and no order is guessed.
3. No change set is ever computed from one entry's start to another entry's end.
4. Each change set is computed in the checkout of the repository its own entry names, with every pipeline store withheld.
5. Every entry resolves before any change set is emitted; a failure leaves that queue entry undrained with its files untouched, and the rest of the run drains.
6. A repository-level failure is reported once per repository; an entry-level failure names the repository, the start and the end.
7. An entry's pull request is the number it stamps; the reader resolves none itself, reaches no network, and writes nothing.

## Integration Points

- [distiller](distiller.md) — the stage that reads these change sets and decides what they mean.
- [close-entry-migration](close-entry-migration.md) — stamps, in every mode, the range list this reads.
- [code-anchors](code-anchors.md) — take their pull request and their stamped revision from the order this reader resolves.
- [pipeline-store-exclusion](pipeline-store-exclusion.md) — the single definition of the stores withheld from every change set.
- [workspace-resolution](workspace-resolution.md) — resolves each named repository to its checkout in a hub.

## Decision Log

### 2026-09-10 — #214 — The unit of a range is the entry, not the repository

Every question this change opens is a question about order: which change is current for a file, which pull request an anchor names, which revision stamps a sidecar. Reading order off the stamp would make the answer depend on how the close happened to iterate its story list, which is not a fact about the code; ancestry is, it costs nothing to compute, and a human can check it. Single-repository mode was folded onto the same reader in the same release, because keeping a second reader would leave two copies of a rule that had already drifted once, in the path that runs most often — and the single-repository epic that shipped as several pull requests is the case this exists for. Refuted alternative: emit one change set per repository, computed at that repository's newest end revision. It needs no ordering rule and gives one coherent final state per file, but for any file another epic also touched between the two merges, that change set carries the other epic's change too, and the drain would then rewrite pages this epic never touched.
