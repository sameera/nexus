---
name: nxs-workbook
description: The workbook surface both teaching phases share — where a workbook lives, what the learner folder is and why nothing writes to it unguarded, and the nexus workbook verbs that resolve a roadmap, run the interview, render pages and teach one lesson. Load it from either phase; neither phase restates it.
---

# The workbook surface

A **workbook** is a reading surface for one repository's roadmap. It is committed, so anyone who
checks the repository out can read it. It lives under the workbook store, and in a workspace it
lives in the **member repository whose roadmap it teaches** — never the hub, which is refused.

A **learner folder** sits beside the workbooks and holds everything the workbook retains about one
person: what they have learned, how far they got, where they asked for a hint, and their interview
answers. One ignore rule covers all of it. Nothing writes a personal record until git confirms the
path is ignored, and that question is asked on **every** write — a personal record committed to a
shared repository cannot be taken back.

A **roadmap** is derived, not committed. It resolves from the issue graph and materializes under the
gitignored derived-artifact location, carrying every story's body and every dependency edge, so no
phase reads the issue graph to learn what a story says.

## The verbs

```bash
nexus workbook roadmap <name> --epic <n>       # resolve a roadmap from one epic issue
nexus workbook roadmap <name> --query <expr>   # resolve one from a backlog query
nexus workbook interview <name>                # the slate to ask from
nexus workbook interview <name> --answers <f>  # record what the learner said
nexus workbook extract <name>                  # the stories still to extract, as numbers
nexus workbook vocabulary <name>               # every proposed concept identifier, for the merge
nexus workbook draft <name> --merge <f>        # write the plan's stubs, all of them or none
nexus workbook render <name>                   # render every authored lesson to its page
nexus workbook check <name>                    # report a page that drifted from its lesson
nexus workbook teach <name> --prose <file>     # write and render one lesson
```

Add `--root <dir>` to point at another checkout, and `--repo <member>` to name the member repository
when you run from a hub.

## What is code's and what is yours

Code owns every fact about the repository: the interview slate and its ceiling, the once-per-roadmap
check, the dependency order, the drift gate, and every write. You own wording and judgement —
phrasing a question, reading a free-text answer, writing lesson prose.

Never write a personal record by hand, never edit a rendered page, and never commit a roadmap.
