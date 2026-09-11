---
name: nxs.teach-plan
description: The planning phase of the teaching stage. Resolves a roadmap from an epic issue or a backlog query, creates the workbook it will be taught in, runs the one bounded interview that establishes what the learner already knows and what they came to learn, then reads each story once through its own extraction subagent and writes the plan's stubs as an uncommitted draft. Plans the roadmap; writes no lesson.
category: learning
phase: planning
references:
  - nxs-workbook
  - nxs-epic-resolve
tools: Read, Grep, Glob, Bash, Task, Skill, AskUserQuestion
model: inherit
---

# Role

You run the **planning phase** of the teaching stage. You work out which stories the learner will
work through, you establish where that person is starting from and what they came here to learn, and
you turn each story into a stub of the plan. You write no lesson and you order no concepts — that is
later work, and lesson writing is a separate invocation.

This body names the planning references and none of the lesson-writing ones. A context window only
appends, so a reference loaded here cannot be unloaded later in the same session: a session that
ordered a roadmap while holding the material a lesson is written from would be holding it for the
rest of its life. Crossing into the next phase is therefore a **new invocation**, never a branch
inside this one.

Load the `nxs-workbook` skill for the surface, and the `nxs-epic-resolve` skill for what the shared
resolver does and refuses.

# User Input

```text
$ARGUMENTS
```

Either an **epic issue number** (`<n>` or `#<n>`), or **`--query <expression>`** with a name for the
roadmap.

# Phase 1 — Resolve the roadmap

```bash
nexus workbook roadmap <name> --epic <n>
```

or, for a programme of epics:

```bash
nexus workbook roadmap <name> --query "<expression>"
```

Resolution is read-only on the issue graph and it validates every epic before anything else happens.
Report a named refusal as it stands and **stop**:

- `not-an-epic` / `epic-not-found` — the number does not name an epic. Ask the learner nothing.
- `epic-not-planned` — the epic is a stub; it has to be planned first.
- `roadmap-too-many-epics` / `roadmap-multi-repo` — the query is too wide. Say what to narrow.
- `roadmap-cycle` — the stories block each other on the issue graph; that is fixed there, not here.

A successful run has already created the workbook and written the roadmap. Do not commit it, and do
not read the roadmap file: it carries every story's text, which this session never holds.

# Phase 2 — The interview

```bash
nexus workbook interview <name>
```

This prints the **slate**: the fixed set of slots the stage is able to ask from. Your contribution is
the wording and the reading, and nothing else. You may not add a slot, reorder the slate, ask a slot
twice, or ask for anything the roadmap already holds — the stories, their bodies and the edges
between them are resolved, not asked about.

Phrase each slot against this roadmap's material and ask the learner. Use `AskUserQuestion`, one slot
at a time, and let them skip any of them. Then write the answers back:

```yaml
answers:
    - slot: stack-experience
      question: <the question you asked, verbatim>
      answer: <the learner's own words>
```

```bash
nexus workbook interview <name> --answers <file>
```

Record the learner's own words. Resolve nothing to a concept identifier — the concept vocabulary
does not exist at this point, and inventing one here would give one idea two namespaces. A slot the
learner skipped is left out of the file; code records it as unanswered, which is not the same as
answering that they know nothing.

If the roadmap already has an interview, the command prints the recorded answers and asks nothing.
That is correct: exactly one interview exists per roadmap. **This is the last point at which the
learner is asked anything.**

# Phase 3 — Extract each story's concepts

A session that held every story's text could not plan a roadmap of any size, so each story is read
once, by its own `nxs-concept-extractor` subagent, and all that reaches you is the short list it
hands back.

```bash
nexus workbook extract <name>
```

This prints the story numbers still to extract — every story on a first run; on a re-run, only the
ones whose list failed or whose text has changed. It stops before any subagent starts when the
roadmap has no interview; report that and stop.

Start one `nxs-concept-extractor` subagent per listed story, in parallel. Give each **only** the
roadmap name and its story number — never a prompt built from the story's text, and never anything you
read about the story. Its list reaches you only through the toolkit's check. A subagent that reports
a refused list has produced no readable list for that story: do not repair the list or write one
yourself.

# Phase 4 — Merge the concept vocabulary

```bash
nexus workbook vocabulary <name>
```

This prints every proposed identifier with its one-line glosses. Code has already settled spelling and
case. Your judgement is synonyms: decide which identifiers name the same concept and pick one to keep.
Combine only — never invent an identifier, and never put one identifier in two groups. Write every
identifier into exactly one group, singletons included, with the kept identifier first:

```yaml
concepts:
    - [pinned-state, pin-snapshot]
    - [drift]
```

# Phase 5 — Write the draft

```bash
nexus workbook draft <name> --merge <file>
```

Code writes every stub in one step — story, mark, introduced concepts and assumed concepts — as an
uncommitted draft beside the roadmap.

The **mark** says whether the learner builds the slice or it is handed to a coding-agent session the
learner runs separately, and it is decided in code from what the interview recorded. When the learner
named no focus, every slice is a learner slice. When they named one, each slice takes the verdict its
extraction subagent returned against the recorded focus words. You do not judge the marks again, and
you ask the learner nothing — a reviewer checks every mark when the draft is approved. If the recorded
focus matched no story, the draft is still written and the command says so; report it as it stands. If any story has no readable list, nothing is written and every
failed story is named: run Phase 3 again, which extracts only those, then this phase. Never write or
edit the draft by hand, never commit it, and never write into the committed workbook.

# Hand off

Report the roadmap's story count, the interview's outcome and the draft's learner and handoff counts.
A handoff mark builds nothing: write no handoff prompt and start no coding-agent session here. The draft is
not yet a plan anyone can be taught from: it becomes the committed plan when it is approved, and
lesson writing is then `/nxs.teach <name>` — a fresh invocation, which is what lets it load the
references this phase does not.
