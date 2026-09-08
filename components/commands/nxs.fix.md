---
name: nxs.fix
description: The lightweight lane. Records why a small change that has already landed mattered, by creating a drainable fix entry under the gitignored .nexus/tmp/ — one GitHub reference in, two files out. Writes nothing to GitHub, cuts no branch, opens no pull request and commits nothing; /nxs.distill drains the entry later, under the razor, which allows one appended decision log entry per existing page and nothing else. A change that needs to alter what a page asserts is a design change and keeps taking /nxs.epic.
category: engineering
model: inherit
tools: Read, Grep, Glob, Bash, Write, Skill
---

# Role

Act as the recorder for a change that has **already landed**. The developer gives you one GitHub
reference. You resolve it, resolve the exact commit range the change occupies, ask why the change
mattered, and write a fix entry the distiller can drain. You write nothing to GitHub, cut no branch,
open no pull request, and commit nothing.

The lane exists because the reason behind a two-line fix was costing four durable artifacts and two
review cycles, so it was not being recorded at all. It buys that cheapness with a hard structural
bound, **the razor**: a fix may append one decision log entry to a page that already exists, and
nothing else. It may not create a page, retire one, or change what a page asserts. A change that
needs to alter what a page asserts is a **design change**, and it keeps taking `/nxs.epic`. The
razor is enforced mechanically at the drain, not here (`/nxs.distill`, invariant 13) — your own
razor check is advisory and fails soft.

# User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` is one **provenance reference**, optionally followed by `--range <base>..<head>`.

# Phase 0/1 — Refuse what the lane does not support, then resolve the reference

Load the **`nxs-landed-reference`** skill and apply its **Section A** (the checkout-role gate) and
**Section B** (reference resolution), substituting `/nxs.fix` for `<lane-command>` in Section A's
refusal message. Both sections are shared with `/nxs.intake` so that a rule fixed in one lane cannot
silently differ in the other.

**Provenance is always the reference the developer named.** A pull request is never substituted for
the issue it closes, and an issue is never substituted for the pull request, even when the range is
taken from that pull request. Only the *qualification* may be added, in Phase 4.

# Phase 2 — Refuse an epic, and refuse a collision

Both refusals guard one silent and expensive failure: a fix entry shadowing an epic's
materialization.

1. **The reference carries the repository's declared epic classification** → **stop and write
   nothing.** Read the classification the same way the resolver does — the declared mode selects
   either a label or an issue type:

    ```bash
    nexus config resolve classification --root "<repo-root>"
    nexus config resolve epic-label --root "<repo-root>"
    nexus config resolve epic-type --root "<repo-root>"
    ```

    Report:

    ```
    #<n> is an epic. An epic's reasoning reaches the concept store through its own lane —
    plan it with /nxs.epic, then /nxs.decision-record, /nxs.analyze, /nxs.close, /nxs.distill.
    ```

2. **`.nexus/tmp/epic-<n>/` already exists for the same number** → **stop and write nothing.** That
   directory is an epic's materialization for this very number, and a fix entry beside it would
   claim the number is two different things. Report the colliding path and name `/nxs.epic` as the
   lane that owns it.

# Phase 3/4 — Resolve the range, or ask, then qualify the reference

Apply the **`nxs-landed-reference`** skill's **Section C** (range resolution) and **Section D**
(qualification), loaded already in Phase 0/1. Section C's ask-path, when it applies, prompts here.
Keep the resolved `{ repo, base, head }` and the Section D qualified reference. Phase 5 uses both.

# Phase 5 — Derive what changed, then ask why

**Derive the description of the change yourself.** What changed can be read from the code, so read
it from the code — exactly as `/nxs.close` already does. Diff the recorded range and summarise the
behaviour that moved:

```bash
git diff --stat <base>..<head>
git diff <base>..<head>
```

**Do not ask the developer to describe the change.** Then ask for exactly **two** things, in one
prompt:

1. **Why the change mattered** — **required.** This single question is the lane's forcing function
   and the whole justification for the lane existing. Do not accept an empty answer, and do not
   answer it for them from the diff: the diff says what moved, never why it was worth moving.
2. **The feature the fix belongs to** — **optional**, and it may be left empty. No phase of the
   drain reads it, so requiring it would only force you to invent a value you cannot verify.

**The advisory razor check.** Before you prompt, map the behaviours you found in the diff onto the
pages that already exist in the concept store. If some map to no existing page, or would change
what an existing page asserts rather than merely append to its history, **print a warning naming
how many**, and say that a decision with no page, or one that changes what a page asserts, is
design work — **already landed** design work, which belongs to `/nxs.intake`, not `/nxs.epic`
(a design change not yet built still belongs to `/nxs.epic`). Then **write the entry anyway.** This
check is **best-effort and fails soft**: failing to warn is never a defect and never blocks
anything. It cannot be load-bearing, because this command writes no pages and can only guess at
what the drain will later synthesise. The load-bearing gate runs at the drain, against the page
writes themselves.

# Phase 6 — Write the entry

Create `.nexus/tmp/fix-<n>/` holding **exactly two files**. The names are deliberate: they assert
nothing about an epic existing or about anything having been closed, and they keep the drain's
discovery rule one line long instead of a parallel code path. `entry_kind: fix` is the field that
carries the truth about what the entry is.

**`.nexus/tmp/fix-<n>/epic.md`** — frontmatter only, **no body**:

```yaml
---
title: "<the referenced issue or pull request's title>"
link: "<the Phase 4 reference — #<n> or <owner>/<repo>#<n>>"
slug: fix-<n>
entry_kind: fix
feature: "<the feature the developer named>"   # omit this key entirely when they left it empty
---
```

Omit `feature` rather than writing a guessed value.

**`.nexus/tmp/fix-<n>/close-record.md`**:

````markdown
# Fix Record: <the referenced title>

## Key Decisions
- **<what changed, in one phrase, derived from the diff>:** <the reason the developer gave>

## Deviation Rationale
- A fix entry has no decision record to deviate from.

<!-- nexus:close-record -->
```yaml
entry_kind: fix
nexus_version: <VERSION>         # the toolkit that wrote this block (`nexus version`); omit if unresolved
date: <YYYY-MM-DD>
analyze: n/a — fix entry (no acceptance criteria)
range:
  - repo: <the recorded range repo identity>
    base: <full 40-hex base>
    head: <full 40-hex head>
```
````

The record carries **no `record` key and no `record_hash` key**, and **no `## Deferred Scope` and no
`## Process Lesson` section**. A fix has no decision record, so the drain reads its reasoning solely
from this close record, which it already accepts. It has no estimate, no decomposition and no
sequencing either, so a process lesson would be exactly the speculative over-generation the razor
exists to cut, and the volume would bury the real lessons.

The `analyze:` value is a **literal string**, never a blank: the state stays greppable and can never
be read as a waiver. `/nxs.analyze` does not run against a fix entry — the gate checks code against
acceptance criteria, success metrics and a decision record's invariants, and a fix entry has none of
the three.

# Phase 7 — Report, and stop

There is **no approval checkpoint.** Under the forcing-function razor, generating and stopping is
one gate and persisting is another; this command writes nothing durable and nothing to GitHub, so a
second gate over a scratch directory would be ceremony that forces no decision. Write **no**
`analyze-receipt.md`.

Report and stop:

```
Fix entry written for <reference>:
  .nexus/tmp/fix-<n>/epic.md
  .nexus/tmp/fix-<n>/close-record.md
Run /nxs.distill to drain it into the concept store.
```

Confirm to yourself before you finish: no issue, no comment, no branch, no pull request, no commit.
