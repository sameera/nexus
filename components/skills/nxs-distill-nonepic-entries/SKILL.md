---
name: nxs-distill-nonepic-entries
description: The non-epic entry-kind contract of /nxs.distill. Read it only when that stage has resolved a discovered entry's recorded kind as fix or intake.
---

# nxs-distill-nonepic-entries

`/nxs.distill` resolves each discovered entry's recorded kind at entry discovery, before any phase
acts on it. This file is what it reads when a discovered entry's kind is **`fix`** or **`intake`**,
and nothing else reads it. A queue whose entries are all epics never reads it.

One contract covers both kinds, because the four axes they differ on are defined once, across all
three kinds, in the base stage's entry-kind table. Splitting fix from intake would either duplicate
that table or break it apart, and would save nothing on the ordinary path: an all-epic queue reads
neither under either shape.

Every rule below is keyed to the base stage's own phase numbering and overrides the base stage at
that number. The base stage's phase order and numbering are unchanged, and a phase this file does
not name runs exactly as the base stage states it. Each drained entry is treated by its own kind's
rules, and no kind drained in the same run alters another kind's drain, per the base stage's
cross-kind rule.

Nothing here writes to GitHub, the concept store, the queue or a branch on its own. Branch creation,
the checkpoint stop and the pull-request opening stay in the base stage.

## Entry discovery — the two non-epic rows of the entry-kind table

The axes are the base stage's. These are the rows for the kinds it does not state:

| Kind | *Why* verified against | Delta vocabulary | Validation mode | Committed removal target |
|---|---|---|---|---|
| `fix` | `close-record.md` alone | one `## Decision Log Entry` appended to a page that already exists, and nothing else | `--append-only-log` | none, and an absent target is the expected shape rather than a missing one |
| `intake` | the pull request body, digest-verified against the `pr_digest` stamped at intake | full, exactly as `epic` | none added | the ephemeral-entry rule above, unchanged |

## Phase 0.1 — verify an intake entry's pull request body

When the entry-kind table names the pull request body as this entry's *why* source, verify that
instead (record #504, invariant 14). Re-fetch the body and re-hash it, through the same digest
program, over the reference recorded in the entry's `epic.md` `link`:

```bash
nexus record-digest --issue <n> ${REPO:+--repo $REPO}
```

- **Digest matches the entry's stamped `pr_digest`** → the pull request still says what was
  recorded. Use the entry's `close-record.md` as its ***why* file**.
- **Digest differs, or the pull request cannot be fetched** → **hard-error this entry and write
  nothing for it.** There is no drain-side waiver, on the same terms the record-hash mismatch
  admits none: this stage writes permanently into the store, so a waived mismatch would file
  reasoning the pull request no longer states. Never substitute a local copy of the body. Report:

    ```
    Drain blocked for <entry>: <qualified reference> no longer matches the body recorded at intake.
      stamped at intake: <hash from epic.md pr_digest>
      current body:      <recomputed hash, or "unfetchable">
    Nothing was written for this entry.
    Recover by re-running /nxs.intake <qualified reference> and re-approving its gate, then
    re-run /nxs.distill.
    ```

## Phase 3 — the bounded vocabulary has no page to create

**Under the bounded vocabulary, a rationale that maps to no existing page is a named per-entry hard
block: `no-existing-page`.** Report it, write nothing for that entry, and leave the entry
directory in place for a later run. This is the razor working, not a gap in it: a decision with no
page is a decision that needs a page. Name the remedy by whether the change is still to be built or
has already shipped: work not yet built is design work for **`/nxs.epic`**; a change that has
already landed and needs to alter what a page asserts is landed design work for **`/nxs.intake`**.
An entry whose row gives the full vocabulary can create the page itself, so this block never fires
for one.

## Phase 5.5 — add the validation mode this entry's kind carries

Add the validation mode the entry-kind table gives this entry's kind. For the `--append-only-log`
mode, the razor's essential half:

```bash
nexus validate-concepts --append-only-log --base HEAD "<changed-page-path>" ...
```

The flag is **added to** the invocation, never substituted for it: every existing check above
still runs against the same pages, and the mode runs alongside them. Name only the entry's changed
**concept pages**, never the regenerated anchor sidecars, which a fix run may legitimately rewrite.

Entries are applied, validated and committed one at a time (Phase 5, Step 2), so each is validated by
its own invocation carrying its own kind's mode and no other's. That per-entry ordering is essential
here and must not be batched as an optimisation: batching would make the razor compare against the
wrong base.

**The refusal message matters as much as the exit code.** When the mode blocks, report it naming the
fix entry, naming the page, and saying what it means:

```
<fix local-id> (<provenance ref>) — <slug> changed outside the entry it gained.
That alters what the page asserts rather than adding to its history, which makes it a design
change, not a fix. Plan it with /nxs.epic if it is not yet built, or record it with
/nxs.intake since this change has already shipped. No distillation-PR is opened.
```

A developer who hits this needs to learn what kind of change they made, not just that a command
exited non-zero.

**Before draining an entry whose kind carries a validation mode, establish that the validator you
will run enforces it** (record #271, invariant 13). One installed toolkit exists per account and it
lags when it is not updated. An older one still fails closed, but it misnames its own cause, and the
obvious repair for that diagnostic is exactly the silent pass the razor exists to prevent. So
confirm the mode is declared before you rely on it:

```bash
nexus --help | grep -q -- --append-only-log && echo mode-available || echo mode-unavailable
```

**mode-unavailable → refuse that entry**, and attribute the failure to the install, never to a
missing file: report that the installed toolkit predates the append-only mode and that the
remedy is to update the install. An undrained fix can be recovered; a fix merged without the razor
cannot, because the log entry cannot be unwritten.

## Phase 6 — the two run-summary values these kinds add

| Value | Rendered as | Omission rule |
|---|---|---|
| `fix_entries` | per fix entry: the page it changes and the heading it appends | the block is absent when no fix entry drained this run |
| `intake_entries` | per intake entry: every page created, every page whose assertions changed, every invariant retired | the block is absent when no intake entry drained this run |

The checkpoint renders them between the delta digest and the taxonomy line:

```
Fix entries — the page each one changes and the entry it appends:
- <fix local-id> (<provenance ref>) → <slug> — log: "<the appended entry's heading>"

Intake entries — every page created, every page whose assertions change, and every invariant
retired:
- <intake local-id> (<provenance ref>) — created: <slugs, or none> — assertions changed: <slugs,
  or none> — invariants retired: <slugs, or none>
```

## Phase 7 — flag an intake entry's deltas in the PR body

Add one bullet to a delta's section in the PR body, for a delta an intake entry produced:

```markdown
- **From an intake entry:** <ref> — flagged so a reviewer can see it apart from an epic's write
```
