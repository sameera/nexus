---
name: nxs-long-run
description: The run folder and checklist /nxs.analyze and /nxs.distill keep, so a run whose context was summarized picks up where it was, and the readers, evidence check and final table of a run over many items. Only those two stages load it, once they know their items.
---

# nxs-long-run

The one home of how `/nxs.analyze` and `/nxs.distill` keep a run's state on disk. Each loads it once
it knows its items: the stories an analyze run covers, or the entries a distill run drains. The
stage names its subject, its items and where each result goes. A context summary can drop what the
conversation held, but not a file at a path the stage derives from its own text.

## 1. The run folder

- **Where.** `.nexus/tmp/runs/<stage>-<subject>/` in the checkout the run started in, never in a
  worktree it opens. `<subject>` uses only letters, digits, `.`, `_` and `-`. Below, `<run>` is this
  folder. `.nexus/tmp/` is ignored, so nothing in it is committed.
- **Never a queue entry.** It sits one level below `.nexus/tmp/`, as the planning run folder does.
  Distill finds ephemeral entries only directly under `.nexus/tmp/`, so it never reads a run folder
  as one.
- **Fresh every run.** Opening the folder replaces it: `rm -rf "<run>" && mkdir -p "<run>"`. A new
  run never reads what an earlier run left, its checklist included. This is not a destructive act to
  stop for.
- **What it holds.** The stage's working files, the checklist and each item's result. Never a copy
  of an input the stage derives again, such as an entry's diff.

## 2. The checklist

Write `<run>/checklist.md` when the folder opens: a header naming the stage, its arguments and the
starting commit, one line per item, and one line for the run's final external write.

```
# <stage> <arguments>
start: <full 40-hex commit the run started from>
- [ ] <item>
- [ ] final: <the write>
```

- The final external write is publishing analyze's review or opening the distillation pull request.
  A local analyze run has none, so it has no final line.
- **Tick a line only after the item's result is saved in the run folder.** Add the outcome when it
  is not the usual one, such as `blocked: <class>`.
- **Append a line for an item found during the run,** above the final line. Never rewrite or drop a
  line.
- **Tick the final line right after the write succeeds,** with its URL.

## 3. After a context summary

It is the same run: do not replace the folder after a context summary. Read `<run>/checklist.md`
again first.

- **Skip every ticked line** and read its result from the run folder. Never judge a ticked item
  again: no second verdict, no second delta.
- **An unticked item whose result is already saved** is ticked, not worked again.
- **Never make the final external write twice.** If its line is unticked, first check whether the
  write already landed: a verdict for this run's head on the pull request, or an open pull request
  from the run's branch. If it did, tick the line instead of writing.
- **Build the report from the saved files, not from the conversation.**

## 4. Readers

- **More than one item:** give each its own general-purpose reader (`Task`), all launched in one
  message so they run in parallel. This holds on every run, repeated analyze rounds included.
- **One item:** no reader. Read it yourself, citing in the evidence form.
- **The reader brief.** Copy it into each reader's prompt, after the item and what to return:

  ```
  Read only. Write nothing: no file, no commit, no GitHub write.
  Cite every claim in the evidence form: a location plus a short quote from it. A location is a
  file and line, a diff hunk, or a decision ID in the record.
  Mark a claim you cannot support unconfirmed, and say where you looked.
  ```

- **Every gate and judgment stays with the stage.** A reader reports what it read. You decide
  severity, IDs, departures, guarantees, deltas, page prose, the checkpoint and what to publish.

## 5. The evidence check

Before accepting a report, confirm each quote appears at its cited location. Where one does not,
read that location yourself, once. If the claim still does not hold, mark it unconfirmed, or the
whole item when nothing in it holds. Never send a report back to its reader. Save the accepted
result in the run folder; only then may the item's line be ticked, where the stage says.

## 6. The final table

Build one table, under Found, from the saved results in the run folder: one row per item, its
verdict and its evidence. The stage names the columns.

## 7. Finishing the run

- **At the finish line, remove the run folder** (`rm -rf "<run>"`) after its last read and before
  printing the completion report, so the report stays the run's last output. A finished run leaves
  no file behind.
- **A run that stops early leaves the folder** for the lead to inspect. The next run replaces it.
