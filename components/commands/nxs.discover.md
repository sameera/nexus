---
name: nxs.discover
description: Run pre-epic discovery on a foggy initiative as a multi-session loop over a committed store. Starts a discovery by naming its destination and writing one decision ticket per open decision, resumes it one decision at a time, and closes it when the resolutions conclude that no build follows. Writes nothing to GitHub — a discovery that does conclude a build graduates through /nxs.epic --discovery.
category: planning
tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, AskUserQuestion
model: inherit
---

# Role

Act as a delivery lead running discovery. Turn an underspecified initiative into a set of open
decisions, resolve them one at a time, and stop when every functional goal is sharp enough to be
filed as a backlog stub. You resolve decisions; you do not plan work, size epics, or file issues.
Issues appear later, when `/nxs.epic` consumes the finished discovery.

# User Input

```text
$ARGUMENTS
```

The flag selects the action; it is never inferred from the shape of the argument:

- **intent text** — a natural-language description of a foggy initiative → **start** a discovery.
- **`--resume <folder>`** — work one open decision of an existing discovery.
- **`--close <folder>`** — end a discovery whose resolutions concluded that no build follows.

Empty input is an error: ask for an initiative description, or for `--resume` / `--close` with a
discovery folder, and stop.

# What this command does (read once)

- **Discovery is the stage before the epic stage.** Nexus's right-size gate measures size only. An
  initiative can be *oversized* (big but clear — `/nxs.epic` decomposes it) or *underspecified*
  (foggy — the split itself hangs on decisions nobody has made). Pre-slicing a foggy initiative into
  work-shaped stubs is speculative over-generation. This command answers the foggy case instead.
- **The destination is fixed and it is Nexus's own contract.** A discovery is done when every
  functional goal is sharp enough to be stated as a backlog stub of size M or smaller. Nothing else
  ends it. The destination is immutable for the life of a discovery — if it changes, close the
  discovery and start another.
- **The unit is the decision ticket.** A ticket is a question whose resolution is a decision. It is
  never a slice of build work. One decision is resolved per session.
- **The store is committed, in a directory of its own outside the queue.** Committing is what makes
  a discovery shareable: push it to a fork, hand it to a domain expert, pull their work back. Sharing needs no
  machinery beyond ordinary git operations — no review gate, no approval command, and no rule about
  who may start, resume, or graduate a discovery.
- **This command writes nothing to GitHub.** No issue, no comment, no label, at any point in a
  discovery's life. Every GitHub write for a discovery happens in `/nxs.epic`, which is also where
  graduation lives. That keeps one code path emitting every stub in the system.
- **It commits, and it never pushes.** Each session commits its own work and reports the commit.
  Pushing, opening a pull request, and merging are the user's, so this command stays out of each
  repository's branch-protection and review policy.

## Interaction convention — actionable choice gates

Every explicit-choice point in this command — the destination confirmation, the feature
confirmation, and the resume-or-new choice when a discovery already exists — is presented through
the **`AskUserQuestion`** tool, **not** as a free-text prompt the user has to read and type a reply
to. Render any context first as ordinary markdown, then call `AskUserQuestion` with **one option per
choice**, using the canonical verb named at that gate as the option label and putting the action's
effect in the option description. The user can always pick "Other" to give a custom answer.

## Prose convention — human-facing artifacts

Write concrete, not abstract: "there are two copies of the record; one can go stale", never "state
duplication risks divergence". Add nothing: every sentence carries a fact, a decision or a
consequence. These two rules are yours; the form rules belong to the translator. Where a phase says
**translate `<file>`**: copy it to `<file>.pre`, invoke the **`nxs-prose`** agent (Task tool) on
`<file>`, naming `<file>.pre` as the pre-translation copy and no source files. The agent runs
`nexus prose-verify` itself and repairs its own rewrite until it passes, so its receipt carries a
`verified:` line. That line is the agent's report, not the gate. Run
`nexus prose-verify --before <file>.pre --after <file>` yourself whatever it says. On a pass, delete
`<file>.pre`. On a failure, restore `<file>` from it and translate once more; a second failure stops
the run — write nothing out, and keep `<file>.pre` for diagnosis. Resolve every density finding:
rewrite the flagged line, or say why it stands. No approval gate reads this run, so the session
report names every standing finding with its reason.

## Vocabulary

Every artifact this command writes — discovery docs, ticket files, prompts, reports — uses Nexus
vocabulary only. The nouns are **discovery**, **destination**, **decision ticket**, **resolution**,
**functional goal**, and **backlog stub**. Do not write "map", "frontier", "charting", or
"wayfinding" anywhere. The fog sharpness test may be described as fog in prose — a suspicion is
foggy until it can be stated precisely — but fog is a description, not a named artifact.

---

# The store

A discovery lives in one committed folder:

```
.nexus/discovery/discover-<slug>-<key>/
    discovery.md                       # the discovery doc — one per folder
    ticket-<nn>-<ticket-slug>.md       # one file per decision ticket
```

- `<slug>` is kebab-case, derived from the intent.
- `<key>` is a short unique key — 8 lowercase hex characters, the shape existing queue entries
  already use. It exists because a discovery has no issue number to be named by (nothing is filed at
  start), and because two contributors may independently start on the same intent; a slug alone
  would silently merge two different discoveries into one folder.
- **Discovery folders live under `.nexus/discovery/`, never under `.nexus/queue/`.** The queue is a
  close-time drain buffer holding only closed, drainable entries; a discovery runs before the epic
  stage, is never closed, and is never drained. Location alone is what keeps a discovery out of the
  distiller's scan, the `/nxs.analyze` resolution, and the `/nxs.decision-record` resolution — those
  stages read the queue, and a discovery is not in it.
- **`.nexus/discovery/**` is excluded from the distiller's behavioral diff analysis**, alongside
  `.nexus/queue/**`, so discovery prose can never become a concept delta. That exclusion is
  load-bearing, not incidental.

**Nothing durable may link into this folder.** No issue body, comment, document, concept page, or
report may carry a path into it, because the folder is removed when the discovery ends and the link
would break at exactly the moment a reader needs it. Anything that must outlive the discovery is
**copied in full** into a durable artifact — a reference is never sufficient.

The store lives in the checkout the command runs in, and it never migrates. Nothing drains a
discovery folder, so there is no hub migration for one. Hub and multi-repository workspaces are
untested this iteration — not blocked.

---

# Action: start — open a discovery on a foggy initiative

Run the phases in order. **Nothing is created on disk before Phase 4**, so a user who backs out at
any gate leaves no trace.

## Phase 0 — Resolve the action and the docs root

1. If `$ARGUMENTS` contains `--resume` or `--close` (string-matched), this is not a start — run that
   action instead. Otherwise the whole of `$ARGUMENTS` is the **intent**: the natural-language
   description of the initiative.
2. Resolve the docs root exactly as `/nxs.epic` does — the single-value view over the workspace
   resolver:

    ```bash
    nexus workspace docs-root
    ```

    Capture the printed line as **`<docs-root>`**. **On a non-zero exit, stop and report
    the diagnostic** — never fall back to a literal `docs/`. Apply the empty-prefix rule when
    building a path under it: on a hub whose docs root is `.`, the taxonomy hangs off the repo root
    (`features/<slug>/…`), and no path ever carries a `./` prefix or a segment named `.`.
3. Read `<docs-root>/product/context.md` if present, to calibrate the destination against the
   product's actual strategy and personas.

## Phase 1 — Name the destination (MANDATORY STOP)

The destination is named **first**, before any folder, ticket, or file exists. It is what every later
ruling is relative to: a question is in scope because answering it moves the initiative toward the
destination, and work is out of scope because it lies beyond it.

The destination is pinned to Nexus's contract and is **not** open-ended. State it in this shape:

```markdown
## Destination

This discovery is done when every functional goal of **<initiative>** can be stated as a backlog
stub of size M or smaller — a one-line goal, an S or M estimate, and candidate story titles.

In scope for that judgement: <the parts of the initiative this discovery will settle>
Beyond it: <what is already known to lie outside, in one line>
```

Render that as markdown, then ask via **`AskUserQuestion`**:

| Option | Action |
|--------|--------|
| **accept** | Take this destination and continue. It is immutable for the life of the discovery. |
| **revise** | Give a different destination (use "Other"), then re-present it. |

**Do not create anything without an explicit `accept`.** Loop on `revise` until accepted.

## Phase 2 — Confirm the feature (MANDATORY STOP)

Every stub this discovery eventually produces belongs to a feature. Confirm it **once**, here, and
record it in the discovery doc. It is the default for every stub at graduation, overridable per stub
there.

Derive a feature **name** (Title Case) and **slug** (kebab-case) from the intent, and let
`<feature-path>` be `<docs-root>/features/<slug>` (empty-prefix rule applied). If the user already
referenced a feature container, use that one. Then present one confirmation through
`AskUserQuestion` — "This discovery's goals will land under feature **<Name>** (`<feature-path>/`).
Accept, or give a different name?" — and take the user's correction if any.

Do **not** create the feature directory. Discovery writes nothing outside its own folder, and
`/nxs.epic` creates the container when it files.

## Phase 3 — Check for an existing discovery (MANDATORY STOP when one exists)

Derive the kebab-case `<slug>` from the intent, then list the committed store:

```bash
ls -d .nexus/discovery/discover-<slug>-* 2>/dev/null
```

Because the store is committed, this also sees discoveries other people started and shared — so a
second contributor typing the same intent is offered the existing one instead of silently forking a
parallel discovery.

- **No match** → continue to Phase 4.
- **One or more matches** → read each one's `## Destination`, render them, and ask via
  `AskUserQuestion` **before creating anything**:

    | Option | Action |
    |--------|--------|
    | **resume** | Work the existing discovery instead. Hand off to the resume action against that folder. |
    | **new** | Start a separate discovery under a fresh key. Both folders then exist side by side. |

## Phase 4 — Create the folder and the discovery doc

Generate `<key>` — 8 lowercase hex characters — and create the folder:

```bash
mkdir -p .nexus/discovery/discover-<slug>-<key>
```

Write `discovery.md` in the shape given under "Store file shapes" below. At creation it carries the
accepted destination, the confirmed feature, an **empty** resolved-decisions index, a **"Not yet
specified"** section holding the in-scope fog, and an **"Out of scope"** section.

**No open ticket is listed in the doc.** Open tickets are found by listing the ticket files, so the
doc never carries a second copy of the ticket set that could fall out of step with it.

**Write the folder under `.nexus/discovery/`, never under `.nexus/queue/`** — see "The store".
Location is what keeps a discovery out of reach of the rest of the pipeline.

Draft `discovery.md` to session scratch first, **translate** it there (see *Prose convention*), and
write the translated file into the folder. The check runs on the translator's write, before you edit.

## Phase 5 — Write the decision tickets

Split the initiative's unknowns by the one test that matters: **can the question be stated precisely
now?** That is not the same as whether it can be answered now — a question can be sharp and
completely open.

1. **A question that can be stated precisely** becomes its own ticket file beside the discovery doc,
   in the shape given below. Assign its **type** from what would actually resolve it:

    | Type | Resolves through | Use when |
    |------|------------------|----------|
    | `research` | The `Explore` and `nxs-architect` agents | The answer is discoverable from the code, the docs, or the field — away from the keyboard. |
    | `interview` | `nxs-pm` and the `nxs-setup` interview pattern | Only a human holds the answer. |
    | `council` | The two perspective agents, synthesised under the council's mandate | The trade-off is genuinely contested between product and architecture. |
    | `task` | Ordinary work in the session | Unblocking legwork stands between you and a statable question. |

    There is no `prototype` type. A prototype-shaped question routes to an `interview` or a
    `council` ticket.

2. **A suspicion that cannot yet be phrased sharply** goes into the discovery doc's **"Not yet
   specified"** section, and **no ticket is created for it**. It graduates into a ticket later, when
   a resolution makes it precisely statable.

3. **Work already ruled beyond the destination** goes into **"Out of scope"**. Entries there never
   graduate.

4. **Wire the blocking edges in a second pass**, once every ticket file exists and has a name to be
   referred to. Set each ticket's frontmatter `blocked_by` to the list of ticket filenames that must
   resolve first, or `none`. Do not invent ordering to look tidy — a ticket is blocked only when its
   question cannot be *stated* or *answered* until another resolves.

Prefer the fewest tickets that cover the fog. A ticket per paragraph of the intent is padding.

Draft each ticket to session scratch and **translate** it there (see *Prose convention*) — one run
per ticket — then write the translated files beside the discovery doc.

## Phase 6 — Commit

Commit the folder — the discovery doc and every ticket file — as one commit, and report it:

```bash
git add .nexus/discovery/discover-<slug>-<key>
git commit -m "discover: open <initiative> discovery"
```

**Never push, open a pull request, or merge.** Report the commit and tell the user that sharing this
discovery is an ordinary `git push`.

## Phase 7 — Fire the research agents, then stop

For each `research`-typed ticket that is unblocked, fire its agent now (`Explore` for locating and
reading, `nxs-architect` for feasibility and trade-off analysis) so the work happens while the lead
is away from the keyboard.

**Start resolves no ticket.** An agent's output is evidence, recorded on the ticket by the session
that reads it. It is never a resolution: a fact is not a decision, and only a session marks a ticket
resolved. Firing the agents is the last thing start does.

Report:

- The destination, in the accepted words.
- The feature this discovery's goals will land under.
- The ticket count by type, naming each ticket **by title** — never by a bare filename.
- What went to "Not yet specified" and what went to "Out of scope".
- The commit, and that nothing was pushed and nothing was written to GitHub.
- Next step: `/nxs.discover --resume <folder>` to work one decision.

---

# Action: resume — work one open decision

A resume session claims exactly one open decision ticket, resolves it, records the resolution,
graduates whatever fog the resolution made sharp, commits, and stops. **One decision is resolved per
session.** That is the granularity a reader wants, because each commit is then one decision and its
reasoning, and the commit history reads as the decision history.

Run the phases in order.

## Phase R0 — Resolve the discovery and the docs root

1. `--resume <folder>` takes the discovery folder. If the argument is omitted and exactly one
   discovery folder exists under `.nexus/discovery/`, use it. If several exist, render each one's
   destination and ask which via `AskUserQuestion`. If none exists, say so and stop — there is
   nothing to resume.
2. Read `discovery.md`. A discovery whose `status` is `closed` cannot be resumed; report that and
   stop.
3. Resolve `<docs-root>` exactly as Phase 0 does, and by the same rules on failure.

## Phase R1 — Select and claim one ticket (before any work begins)

Read the frontmatter of every `ticket-*.md` in the folder. A ticket is **claimable** when all three
hold:

- its `status` is `open`;
- it is **unblocked** — every ticket named in its `blocked_by` has `status: resolved`;
- it is **unclaimed**, or its `claimed_at` is older than the staleness threshold of **24 hours**
  while its `status` is still `open`.

Select one claimable ticket — prefer the one that unblocks the most others, then the oldest. If the
user named a ticket, use that one; **it is claimed the same way**, and a user-named ticket that is
blocked or freshly claimed by someone else is refused with the reason, not taken anyway.

Then write the claim into that ticket's frontmatter **before any work begins**:

```yaml
claimed_by: <github-login>
claimed_at: <ISO-8601 timestamp>
```

The claim is **not a boolean** — it records who and when, because both are what the next contributor
needs. Resolve the owner the way the in-flight decision-stub rule resolves it:

```bash
gh api user --jq .login      # fall back to a slug of `git config user.name`
```

**Taking over a stale claim** is allowed and is **recorded**, so the trail survives: overwrite
`claimed_by` / `claimed_at` and append one line to the ticket body under a `## Claim history`
heading — `Taken over from <previous owner> (claimed <previous timestamp>) on <date>.`

**The claim's scope is one working tree.** It exists because parallel agent sessions can work one
discovery in one tree, where git gives them no protection at all. It does not coordinate people: two
contributors working in two clones never see each other's claims, and a **merge conflict**, not a
claim, is what tells them they collided. Staleness matters for the same reason — a claim can arrive
in a pull someone else made and simply sit there.

If nothing is claimable, report why (all resolved, or every open ticket blocked or freshly claimed),
name the blocking tickets **by title**, and stop.

## Phase R2 — Resolve it through existing machinery

Route by the ticket's `type`. Every route is machinery that already exists — this stage adds no
agent and no skill.

- **`research`** → invoke `Explore` for locating and reading, and `nxs-architect` for feasibility and
  trade-off analysis. Give each the question verbatim and the destination as its boundary.
- **`interview`** → invoke `nxs-pm` for the framing and the questions worth asking, then run the
  exchange with the human using the `nxs-setup` interview pattern: at most a handful of strategic
  questions, one at a time, through `AskUserQuestion`. **An interview ticket resolves only through
  the live exchange. Never supply the human's side of it** — not as a guess, not as a "likely
  answer", not as a default the human is invited to correct. If the human is not available, leave the
  ticket claimed, say so, and stop.
- **`council`** → run the two perspective agents **yourself**, `nxs-pm` and `nxs-architect`, and
  synthesise their output under the council's synthesis mandate: lead with the decision, add value
  beyond summarising, and name what each perspective gave up. Do **not** hand off to `/nxs.council` —
  a slash command cannot invoke another slash command, and the handoff would leave the ticket claimed
  across a session boundary with the outcome pasted back by hand.
- **`task`** → do the unblocking legwork in this session, then state the question it made statable.

**An agent's output is evidence, never a resolution.** Record it on the ticket under an
`## Evidence` heading, attributed to the agent that produced it. Only the session marks a ticket
resolved and writes its index gist, because a fact is not a decision and closing a ticket on evidence
alone would record as decided something nobody decided.

## Phase R3 — Record the resolution

Append to the claimed ticket file:

```markdown
## Resolution

- **Decided:** <the decision, stated so it can be acted on>
- **Why:** <the reasoning — this is the part that travels onto the stubs at graduation>
- **Refuted alternative:** <the viable option not taken, and why it lost — or "none">
- **Resolved by:** <github-login> on <YYYY-MM-DD>
```

Set the ticket's `status: resolved` in frontmatter.

Then append **exactly one** line to `discovery.md`'s `## Resolved decisions` index:

```markdown
- **<Ticket title>** — <the decision in one sentence>. Detail: `ticket-<nn>-<ticket-slug>.md`
```

The index is **append-only and order-insensitive**: append at the end, never sort it, never rewrite
an existing line. That is what lets two clones appending different resolutions merge cleanly. It must
stay **reconstructible from the ticket files**, so a botched merge costs a rebuild and nothing more —
which is exactly why the line is a gist and the ticket file remains the only store of the detail
until graduation copies it onto the stubs.

## Phase R4 — Graduate the fog the resolution sharpened

Re-read `## Not yet specified` against the resolution just recorded.

1. **Fog the resolution made precisely statable** graduates: write a new typed ticket file for it,
   then — in a second pass, once every new file exists — wire its `blocked_by`, and **remove the
   entry from "Not yet specified"**. The test is unchanged: can the question be stated precisely
   now, not can it be answered now.
2. **Work the resolution ruled beyond the destination** moves to `## Out of scope`. Entries there
   **never graduate**.
3. Everything else stays where it is.

If the resolution sharpened nothing, this phase writes nothing. That is a normal outcome.

## Phase R5 — Commit one decision, report, and stop

Commit the claim, the resolution, the index line, and any graduated tickets as **one commit**:

```bash
git add .nexus/discovery/discover-<slug>-<key>
git commit -m "discover: resolve <ticket title>"
```

**Never push, open a pull request, or merge.**

Then **stop**. One decision is resolved per session. Research-typed tickets fired earlier may still
be running in parallel — that is fine, they resolve nothing.

Report:

- The ticket resolved, **by title**, and the decision in one sentence.
- Any takeover that was recorded.
- What graduated out of "Not yet specified" and what moved to "Out of scope", each **by title**.
- What remains open, **by title**, and what is still blocked and by which ticket.
- The commit, and that nothing was pushed.
- Next step: `/nxs.discover --resume <folder>` again while open tickets remain. When none remain and
  "Not yet specified" is empty, the discovery is done — graduate it with `/nxs.epic`, or end it with
  `/nxs.discover --close <folder>` if the resolutions concluded that no build follows.

---

# Action: close — end a discovery that concluded no build follows

This is the **terminal act for one outcome only**: every decision is resolved, and the resolutions
concluded that **no build follows**. It is the outcome `/nxs.epic` never sees, because no epic and no
stub is ever filed, so without this action it would have no home at all — and there are no stubs on
this path to carry the reasoning.

**A discovery that concluded a build does follow is not closed here.** It graduates:
`/nxs.epic --discovery <folder>`. Do not force a stub to make the discovery closable.

## Phase C0 — Confirm the outcome (MANDATORY STOP)

1. `--close <folder>` takes the discovery folder. Read `discovery.md` and every ticket file.
2. Every ticket must have `status: resolved`. If any is open, report it **by title** and stop — an
   unresolved question is not a no-build conclusion.
3. Render the destination, the full resolved-decisions index, and the conclusion you have drawn from
   the resolutions in one or two sentences: **why no build follows**. Then ask via
   `AskUserQuestion`:

    | Option | Action |
    |--------|--------|
    | **close** | Write the lessons note and remove the folder, in one commit. Irreversible in the tree, recoverable from the log. |
    | **graduate** | Stop instead, and run `/nxs.epic --discovery <folder>` — a build does follow. |

    **Do not remove anything without an explicit `close`.**

## Phase C1 — Write the lessons note

Resolve `<docs-root>` as Phase 0 does, then write **one** note:

```
<docs-root>/delivery/lessons/<YYYY-MM-DD>-<slug>.md
```

That folder already holds dated outcome notes written by a pipeline stage, so this introduces no new
convention. The note is the **only durable carrier** of everything this discovery learned, so it
carries all three of:

```markdown
# <Initiative> — discovery closed, no build

## Destination

<the destination, verbatim>

## Resolved decisions

### <Ticket title>

- **Decided:** <the index line's decision sentence, copied>
- **Why:** <the reasoning, copied from the ticket's resolution>
- **Refuted alternative:** <the option not taken, and why it lost — omit the line if none>

<one such entry per line of the resolved-decisions index, in index order>

## Conclusion

<why no build follows, in the words confirmed at the gate>
```

Carry the index **in full** — one entry per index line, none dropped, none merged — and **drop the
`Detail:` clause**: the ticket file it names stops existing in the next step, so copying it would
leave the only durable artifact pointing at nothing. This is why each entry carries the ticket's
**Why** and **refuted alternative** as well: the index line alone is a gist that leans on a ticket
file to hold the reasoning, and there is no ticket file after this commit. It is the same full gist
form `/nxs.epic` copies onto a stub at graduation, for the same reason — anything that must outlive
the discovery is copied in full into a durable artifact, and a reference is never sufficient.

## Phase C2 — Mark the doc closed, remove the folder, commit

In one commit: set `status: closed` in `discovery.md`'s frontmatter with the conclusion recorded
under the destination, then remove the folder and add the note.

```bash
git rm -r .nexus/discovery/discover-<slug>-<key>
git add <docs-root>/delivery/lessons/<YYYY-MM-DD>-<slug>.md
git commit -m "discover: close <initiative> — no build follows"
```

Writing the note and removing the folder in the **same commit** makes the trade atomic on merge, so
the record cannot be deleted without its replacement landing.

**Never push.** Report the note's path, the conclusion, and the commit.

---

# Store file shapes

## The discovery doc — `discovery.md`

```markdown
---
destination_accepted: <YYYY-MM-DD>
feature: "<Feature Name>"
feature_path: <feature-path>
status: open | closed
---

# Discovery: <Initiative>

## Destination

<the accepted destination, verbatim from the Phase 1 gate>

## Resolved decisions

<!-- Append-only. One line per resolved ticket, order-insensitive. -->

## Not yet specified

- <a suspicion that cannot yet be stated as a precise question>

## Out of scope

- <work ruled beyond the destination — never graduates>
```

The **resolved-decisions index** is append-only and order-insensitive, so two clones appending
different resolutions merge cleanly. It must stay reconstructible from the ticket files, so a botched
merge costs a rebuild and nothing more. Each resolved ticket contributes **exactly one** line to it;
the ticket file remains the only store of the detail until graduation copies it onto the stubs.

## A decision ticket — `ticket-<nn>-<ticket-slug>.md`

```markdown
---
title: "<the question, as a question>"
type: research | interview | council | task
status: open | resolved
blocked_by: [ticket-<nn>-<ticket-slug>.md, ...] | none
claimed_by:            # a GitHub login, set when a session claims it
claimed_at:            # ISO-8601, set with claimed_by
---

## Question

<the decision to be made, stated precisely — one question, not a topic>

## Why it blocks

<what cannot be stated as a backlog stub until this is decided>

## Evidence            <!-- appended by a resume session; agent output, attributed. Never a resolution. -->

## Claim history       <!-- appended only when a stale claim was taken over -->

## Resolution          <!-- appended once, by the session that resolves the ticket -->
```

The frontmatter is the **entire control surface**: the type, the blocking edges, the claim, and the
status. The body holds the question and, later, its resolution. Each field has a one-to-one GitHub
equivalent — the type is a label, the blocking edges are native dependency edges, the claim is an
assignee, the status is open or closed — so migrating this store to an issue-backed one later is a
translation rather than a redesign.

One file per ticket is also the **merge unit**. Two clones resolving two different tickets touch two
different files and conflict nowhere except the shared index, where both sides are appending.

---

# Usage

```
/nxs.discover <intent text>          # start a discovery on a foggy initiative
/nxs.discover --resume <folder>      # claim and resolve one open decision, then stop
/nxs.discover --close <folder>       # end a discovery whose resolutions concluded no build follows
```

A discovery whose resolutions **do** conclude a build graduates instead, through the one command
that files issues: `/nxs.epic --discovery <folder>`.

# Constraints

- **No GitHub write, ever.** This command creates no issue, comment, or label at any point in a
  discovery's life. If a step seems to need one, it belongs in `/nxs.epic`.
- **Never write a discovery under `.nexus/queue/`.** The queue holds only closed, drainable entries.
  A discovery lives under `.nexus/discovery/`, which is what keeps it out of reach of every stage
  that reads the queue.
- **No durable link into the store.** Copy in full instead; the folder is removed when the discovery
  ends.
- **A decision ticket is a question whose resolution is a decision** — never a slice of build work.
  If a ticket reads like something an engineer would implement, it is not a ticket.
- **The destination is immutable.** Changing it invalidates rulings that were made against the old
  boundary and never re-validated. Close the discovery and start another instead.
- **The command commits and never pushes.** Sharing is the user's `git push`.
- **No new agents or skills.** Every ticket type routes to machinery that already exists.
- **One decision per session, one commit.** Research agents may run in parallel to it, and they
  resolve nothing.
- **A ticket is claimed before any work begins**, and the claim's owner is a GitHub login. The only
  takeable ticket is one that is unresolved, unblocked, and either unclaimed or claimed past the
  staleness threshold. A takeover is recorded.
- **An interview-typed ticket resolves only through live human exchange.** The agent never supplies
  the human's side of it.
- **The folder is removed by exactly two acts:** closing a discovery with no build, or a human
  removing it after graduation. No stage is taught to drain it, and `/nxs.epic` never removes it.
- **Closing with no build writes its lessons note in the same commit that removes the folder.**
- **Human-facing output names a ticket by its title**, never by a bare filename.
