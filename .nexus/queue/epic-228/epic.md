---
feature: "Pre-Epic Discovery"
feature_path: docs/features/pre-epic-discovery
epic: "Pre-epic discovery: /nxs.discover and the fog referral gate"
slug: pre-epic-discovery
created: 2026-08-03
type: enhancement
complexity: M
complexity_drivers: [three-action command document, cross-command stub-contract reuse, gist handoff across three commands]
concepts: []
link: "#228"
record: "#235"
record_state: closed
---

# Epic: Pre-epic discovery: /nxs.discover and the fog referral gate

## Description

Nexus's right-sizing gate measures size only. An XL or XXL intent decomposes immediately into
functional-goal stubs with candidate stories, which assumes the split is already knowable. For a
genuinely underspecified initiative the split itself hangs on unresolved decisions, so pre-slicing
is speculative over-generation, the exact failure mode Nexus guards against. Today Nexus conflates
*oversized* with *underspecified* and answers both with work-shaped stubs. No decision artifact can
exist before an epic does, because `/nxs.decision-record` requires a planned epic.

This epic adds a pre-epic discovery stage. `/nxs.discover` runs discovery as a multi-session loop
over a committed store. The store is a directory of its own outside the queue,
`.nexus/discovery/discover-<slug>-<key>/`, holding a **discovery doc** plus one **decision-ticket
file** per open decision. Ticket type and blocking edges are carried in ticket frontmatter. The
store sits outside `.nexus/queue/`, which is the directory every stage scans for drainable entries,
so no stage that scans the queue sees a discovery, and the distiller's range helper excludes the
discovery directory so in-flight reasoning never reaches concept-delta synthesis. Committing the
store is what makes a discovery shareable: a lead can push it to a fork
and hand it to a domain expert, and the loop needs no machinery beyond ordinary git operations.

Each session claims one open, unblocked ticket, resolves it through existing machinery, appends the
resolution to the ticket file, appends one gist line to the discovery doc's index, and commits. A
ticket is a question whose resolution is a decision, never a slice of build work. Coarser suspicions
stay in a "Not yet specified" section until a resolution makes them precisely statable. Work ruled
beyond the destination lands in "Out of scope" and never graduates. The loop ends when every
functional goal is sharp enough to state as a backlog stub of size M or smaller.

`/nxs.discover` never writes to GitHub. Graduation is a new entry mode on `/nxs.epic` that reads a
finished discovery folder. That mode skips the sharpness gate, because discovery is what the gate
refers people to, and then runs the existing right-size gate unchanged. A result larger than size M
files the stub batch the decomposition path already files, one stub per functional goal. A result of
size M or smaller is planned directly as one epic with its stories. Discovery therefore adds no
second issue-creating surface.

The ticket files are removed when the discovery folder is removed, so the resolved decisions travel
with the stubs. Each stub carries the decisions it hangs on in full gist form, written from the same
text into the stub body and into a comment carrying a hidden marker. Promotion rewrites the stub
body, so the marked comment is the copy that survives. `/nxs.decision-record` then reads the marked
comments off the epic issue and treats them as an input to the record it writes. The reasoning
discovery produced reaches the design stage instead of stopping at the backlog.

A discovery whose resolutions conclude that no build follows ends through the `/nxs.discover` close
action, which writes a dated lessons note and removes the folder in one commit.

`/nxs.epic` also gains a thin referral gate inside its right-size phase. If the intent's functional
goals cannot be stated sharply, it stops and recommends `/nxs.discover`, with an explicit override
that falls through to the existing sizing path. The existing oversized path stays for the
big-but-clear case. The pipeline becomes
`setup → (discover when foggy) → epic → decision-record → analyze → close → distill`.

## Success Metrics

- A foggy initiative can be driven from first intent to promotable backlog stub issues without any
  GitHub issue of any kind being filed during discovery. Issues appear only when `/nxs.epic`
  consumes the finished discovery.
- Every stub filed from a discovery is accepted unchanged by `/nxs.epic <issue-number>` promotion,
  with the same labels, classification, and body meta as a decomposition stub, because the same
  emission path files both.
- Each resolved decision is reachable from the discovery doc in one hop: a one-line gist naming the
  ticket file that holds the detail.
- The reasoning reaches the design stage. After a discovery-filed stub is promoted,
  `/nxs.decision-record` run against that epic names the decisions the discovery resolved.
- `/nxs.epic` given an underspecified intent stops and recommends `/nxs.discover` instead of filing
  work-shaped stubs. Given a big-but-clear intent it still offers the oversized split.

## Personas

Per `docs/product/context.md`. The acting persona throughout is the delivery lead (or PM) driving
the Nexus pipeline. Decision tickets may pull in domain humans through interview-typed tickets.

## User Stories

### Story #229: Start discovery from a foggy initiative

**As a** delivery lead, **I want** `/nxs.discover` to open discovery on a large, foggy initiative — naming the destination first, then creating a committed discovery folder with its decision tickets — **so that** unresolved decisions become tracked work instead of speculative work-shaped stubs.

## Acceptance Criteria

- [ ] **Given** intent text describing a foggy initiative, **when** `/nxs.discover` is invoked with it, **then** the start action runs. Resuming and closing are explicit named actions, so passing intent text is what selects start.
- [ ] **Given** a foggy initiative description, **when** start runs, **then** it names the destination first — pinned to Nexus's contract, that discovery is done when every functional goal is sharp enough to be a backlog stub of size M or smaller — and confirms it with the user (house `AskUserQuestion` convention) before creating anything.
- [ ] **Given** a confirmed destination, **when** start continues, **then** it confirms the initiative's feature (same one-prompt convention) and records it in the discovery doc. That feature is the default for every stub at graduation, overridable per stub.
- [ ] **Given** the slug derived from the intent already names a discovery folder in the committed store, **then** start offers a choice before creating anything: resume that discovery, or start a new one under a fresh key. Because the store is committed, this check also sees discoveries other people started and shared.
- [ ] **Given** a confirmed destination, **when** the discovery folder is created at `.nexus/discovery/discover-<slug>-<key>/`, **then** the folder holds the discovery doc and nothing a queue-scanning stage can act on. Living outside `.nexus/queue/` is what keeps the folder invisible to the distiller's scan and to the analyze and decision-record resolutions. (Amended 2026-08-09: this criterion originally placed the folder at `.nexus/queue/discover-<slug>-<key>/` and relied on the absence of an `epic.md` to hide it. Decision record #235, approved 2026-08-08, reverses that placement and refutes it by name; location is the stronger mechanism.)
- [ ] **Given** the discovery doc, **then** it carries the destination, the feature, an empty resolved-decisions index, a "Not yet specified" section holding the in-scope fog, and an "Out of scope" section. No open ticket is listed in the doc; open tickets are found by listing the ticket files.
- [ ] **Given** open decisions that can be stated precisely now, **when** tickets are created, **then** each becomes its own ticket file beside the discovery doc, typed research, interview, council, or task in its frontmatter. Blocking edges are wired as frontmatter `blocked_by` in a second pass.
- [ ] **Given** a suspicion that cannot yet be phrased sharply, **then** it is written to "Not yet specified" and no ticket is created for it. The test is whether the question can be stated precisely now, not whether it can be answered now.
- [ ] **Given** the folder is created, **then** start commits it and reports the commit. It never pushes, opens a pull request, or merges.
- [ ] **Given** research-typed tickets, **when** start finishes, **then** it fires their research agents and stops. Start resolves no ticket itself.
- [ ] **Given** any artifact this command writes — discovery docs, ticket files, prompts — **then** it uses Nexus vocabulary only. No "map", "frontier", "charting", or "wayfinding". The fog sharpness test may survive in prose.

## Notes

Adapted from the wayfinder skill's "chart" mode, re-grounded in Nexus vocabulary and pinned to the backlog-stub destination contract. A ticket is a question whose resolution is a decision, never a slice of build.

The store is committed because discovery is the stage most likely to need more than one person, and committing makes the whole loop shareable with tooling the team already has. It lives in a directory of its own, outside the queue, and two properties of that placement are load-bearing: a folder outside `.nexus/queue/` is invisible to every stage that consumes the queue, and the distiller's range helper excludes `.nexus/discovery/` alongside the queue, so discovery prose can never become a concept delta. No label, classification, or GitHub issue is created at any point in this story.

### Story #230: Work discovery one decision at a time

**As a** delivery lead, **I want** a resume session to claim and resolve exactly one open decision ticket, record the resolution, commit it, and graduate newly sharp fog, **so that** discovery advances decision by decision across sessions without parallel sessions colliding.

## Acceptance Criteria

- [ ] **Given** a discovery folder, **when** the resume action runs without a named ticket, **then** it selects one decision ticket that is open, unblocked, and claimable, and claims it before any work begins. A user-named ticket is claimed the same way.
- [ ] **Given** a claim, **then** the ticket's frontmatter records who claimed it and when. The owner is the claimant's GitHub login, resolved the way the in-flight decision-stub rule resolves it, falling back to a slug of the git user name. The claim is not a boolean.
- [ ] **Given** a ticket that is unresolved and whose claim is older than the staleness threshold, **then** it may be taken over, and the takeover is recorded. The claim's scope is one working tree: two contributors working in two clones never see each other's claims, and a merge conflict is what tells them they collided.
- [ ] **Given** the ticket's type, **when** it is resolved, **then** resolution routes to existing machinery only: research to the Explore and nxs-architect agents (away from the keyboard), interview to nxs-pm and the nxs-setup interview pattern (human in the loop), contested trade-offs to a council-typed ticket, and unblocking legwork to a task-typed ticket.
- [ ] **Given** a council-typed ticket, **then** the session runs the two perspective agents itself and synthesises their output under the council's synthesis mandate. It does not hand off to `/nxs.council`, because a slash command cannot invoke another slash command and the ticket must not sit claimed across a session boundary.
- [ ] **Given** an interview-typed ticket, **then** it resolves only through the live exchange. The agent never answers for the human.
- [ ] **Given** an agent's research output, **then** it is recorded on the ticket as evidence and is never a resolution. Only the session marks a ticket resolved and writes its index gist, because a fact is not a decision.
- [ ] **Given** a resolution, **then** it is appended to the ticket file as a resolution section, the ticket's status moves to resolved, and exactly one gist line naming the ticket is appended to the discovery doc's resolved-decisions index. The ticket file remains the only store of the detail until graduation copies it onto the stubs.
- [ ] **Given** the resolved-decisions index, **then** it is append-only and order-insensitive, so two clones appending different resolutions merge cleanly, and it stays reconstructible from the ticket files, so a botched merge costs only a rebuild.
- [ ] **Given** fog made precisely statable by the resolution, **then** it graduates into new typed ticket files — created, then blocking wired — and is removed from "Not yet specified". Work the resolution rules beyond the destination moves to "Out of scope" and never graduates.
- [ ] **Given** one decision ticket resolved, **then** the session commits its claim, its resolution, and its index line as one commit, reports the commit, and stops. One decision is resolved per session. Research-typed tickets may run in parallel to it, and they resolve nothing. The command never pushes.
- [ ] **Given** any human-facing output, **then** tickets are referred to by title, never by a bare filename.

## Notes

Extends #229. One commit per resolved decision is the granularity a reader wants, because each commit is one decision and its reasoning, so the commit history reads as the decision history. Pushing is left to the user, which keeps the command out of each repository's branch protection and review policy.

Parallel sessions on the same machine may work the same discovery, sharing one working tree, and git gives them no protection at all. The claim is what keeps them off each other's tickets. Separate clones are a different story: git handles them, and one file per ticket is what makes those merges clean.

### Story #231: End a discovery — graduate through /nxs.epic, or close with no build

**As a** delivery lead, **I want** a finished discovery to graduate through `/nxs.epic` into planned work — or to close with no build when the resolutions concluded that none follows — **so that** the initiative lands in the one cross-feature backlog, through the one path that files stubs, and the "why" travels with it.

## Acceptance Criteria

- [ ] **Given** a discovery folder with no open decision tickets and an empty "Not yet specified" section, **when** `/nxs.epic` is run in its discovery entry mode against that folder, **then** it treats the discovery doc as its intent, skips the sharpness gate, and runs the existing right-size gate unchanged. The sharpness gate is skipped because discovery is the thing that gate refers people to.
- [ ] **Given** a right-size result larger than size M, **then** one backlog stub issue per functional goal is filed through the existing decomposition emission path, under the same contract that path already uses: epic classification plus the resolved unplanned label, body meta carrying feature, estimate, candidate stories, and source, and `blocked_by` wired between the batch. Every stub is size M or smaller. The feature defaults to the one recorded in the discovery doc, overridable per stub.
- [ ] **Given** a right-size result of size M or smaller, **then** the discovery is planned directly as one epic with its stories, and no stub is filed.
- [ ] **Given** each stub being filed, **then** the resolved decisions that stub hangs on are copied onto it in full gist form — the decision plus its reasoning, copied from the ticket files — twice in the same act and from the same text: once in the stub body, once as a comment. Each gist names its originating ticket by title only. Neither copy is ever edited again.
- [ ] **Given** the gist comment, **then** it carries a hidden marker in the form the pipeline already uses to anchor a machine-findable comment on an issue. Writing that comment is the only addition the discovery entry mode makes to the existing emission path, because that path files issues and writes no comments.
- [ ] **Given** any label, classification, or query used while filing, **then** it is asked for from the shared publishing resolver (`delivery_config.py`) and never written out by hand. The report ends with the cross-feature backlog query obtained the same way.
- [ ] **Given** the filing is done, **then** the report names the discovery folder as consumed and states that it can be removed. `/nxs.epic` does not delete the folder and commits nothing, because committing nothing at planning is its existing contract. Removal is a plain commit made by a human.
- [ ] **Given** a discovery-filed stub, **when** it is promoted with `/nxs.epic <issue-number>`, **then** promotion proceeds with no manual edits to the stub. Promotion is otherwise unchanged: it rewrites the body on the issue the stub was filed under, and it neither reads nor moves the gist comment.
- [ ] **Given** every decision resolved and the resolutions concluding that no build follows, **when** the `/nxs.discover` close action runs, **then** the discovery doc is marked closed with that conclusion, a dated note is written to `docs/delivery/lessons/` carrying the destination, the resolved-decisions index in full, and the no-build conclusion, and the folder is removed in the same commit. No stub is forced.

## Notes

Extends #230. Discovery creates no GitHub issue, comment, or label at any point in its life; every GitHub write for a discovery happens in `/nxs.epic`. That is what keeps one code path emitting every stub in the system, which is what makes "a discovery-produced stub is accepted unchanged by promotion" true by construction instead of by a third copy of the stub contract.

The gist is written twice because the two copies do different jobs. The body copy is the one promotion consumes, since promotion seeds its draft from the stub's body. The comment copy is the one that survives, since promotion replaces that body wholesale. The duplication cannot drift, because neither copy is ever updated. The marker is what turns the surviving copy into an input rather than an archive: promotion keeps the issue it was given, so the comment written here is still on the epic issue when `/nxs.decision-record` runs against it (#240).

The no-build outcome is the one outcome `/nxs.epic` never sees, and there are no stubs on that path to carry the reasoning, so the lessons note is its only durable carrier. Writing the note and removing the folder in one commit makes the trade atomic on merge.

### Story #232: Fog referral gate in /nxs.epic

**As a** delivery lead, **I want** `/nxs.epic` to stop when an intent's functional goals cannot be stated sharply and refer me to `/nxs.discover`, **so that** underspecified initiatives are no longer answered with work-shaped stubs.

## Acceptance Criteria

- [ ] **Given** an intent, **when** `/nxs.epic` reaches its right-size phase, **then** the sharpness test runs before sizing. The test is the stub shape itself: can each functional goal be stated as a one-line goal, with a small estimate, and with candidate story titles? If decomposition cannot produce that shape, the intent is underspecified rather than merely oversized.
- [ ] **Given** an intent whose functional goals cannot be stated sharply, **then** `/nxs.epic` stops before sizing (house MANDATORY-STOP and `AskUserQuestion` convention) and presents `/nxs.discover` as the recommended path, filing nothing.
- [ ] **Given** that stop, **then** an explicit override is offered that falls through to the existing sizing path. Nothing is filed before the lead makes a choice. The sharpness call is a judgement the lead owns, so a false positive stays recoverable.
- [ ] **Given** an oversized but clearly specified intent, **then** the existing L, XL, and XXL path is unchanged and the split-to-stubs offer still fires.
- [ ] **Given** a sharp, right-sized intent, **then** the gate adds no new interaction and planning proceeds as today.
- [ ] **Given** an entry mode other than intent — a stub being promoted by issue number, or a discovery being consumed — **then** the gate does not fire. A promoted stub was already discovered, and a consumed discovery is the output of the very thing the gate refers people to, so firing there would deadlock work discovery itself produced.

## Notes

The gate distinguishes *underspecified* (foggy, refer to discovery) from *oversized* (big but clear, existing decomposition path). It lives inside the right-size phase rather than as a phase of its own: that shape is already the output the decomposition step must produce, so the test adds no new machinery, and living inside the sizing phase inherits the skip-in-promotion rule for free.

This story and #231 are the two changes this epic makes to `/nxs.epic`. Neither adds a phase.

### Story #233: Pipeline docs name the discovery stage

**As a** Nexus user reading the docs, **I want** the pipeline documentation to name the discovery stage and when it applies, **so that** I know to run `/nxs.discover` before `/nxs.epic` for a foggy initiative.

## Acceptance Criteria

- [ ] **Given** the repository docs, **when** they describe the pipeline, **then** `README.md`, `how-to-nexus.md`, and the project `CLAUDE.md` all show `setup → (discover when foggy) → epic → decision-record → analyze → close → distill`.
- [ ] **Given** the discovery stage's doc entry, **then** it states the stage's durable contract: discovery is a multi-session loop, its unit is the decision ticket, its output is functional goals that `/nxs.epic` files, and a discovery can be shared by ordinary git operations. The collaboration property is part of the contract, because a reader needs it in order to know they can hand a discovery to someone else.
- [ ] **Given** the same doc entry, **then** where the store physically lives is stated in a single sentence per document, and that sentence is explicitly marked as first-iteration. The contract outlives the storage choice, so confining the storage sentence keeps a later migration to an issue-backed store a one-line documentation edit.
- [ ] **Given** the docs, **then** they distinguish *oversized* (big but clear, `/nxs.epic`'s decomposition path) from *underspecified* (foggy, `/nxs.discover`).
- [ ] **Given** the docs, **then** they state that discovery writes nothing to GitHub, and that the issues appear when `/nxs.epic` consumes the finished discovery.

### Story #240: /nxs.decision-record reads the discovery gists

**As a** delivery lead, **I want** `/nxs.decision-record` to read the marked discovery gists off the epic issue, **so that** the record is designed on top of the decisions the discovery already settled instead of re-deriving them.

## Acceptance Criteria

- [ ] **Given** an epic issue carrying comments with the discovery marker, **when** `/nxs.decision-record` runs against that epic, **then** before it analyses it fetches the epic issue's comments and keeps the ones carrying that marker. Their gists become an authoritative input to the analysis, alongside the epic and its stories.
- [ ] **Given** those gists, **then** they do not replace the analysis. The command still designs the epic, and it still checks that every story is covered.
- [ ] **Given** a gist that states a decision without its reasoning, **then** it becomes an open clarification for the human, exactly as an unexplained decision in a design document imported with `--from` does today.
- [ ] **Given** an epic issue with no marked comment, **then** the command behaves as it does today, with no new prompt and no empty section.
- [ ] **Given** the marked comments, **then** the command never edits or removes them.
- [ ] **Given** the full path — graduate a real discovery, promote one of the stubs it produced, then run `/nxs.decision-record` against the resulting epic — **then** the record names the decisions the discovery resolved.

## Notes

Extends #231, which writes the marked comment. This read is the only change this epic makes to `/nxs.decision-record`.

A discovery gist and a design document are different things, which is why the gists do not go through the existing `--from` import mode. Import mode treats its document as the design and replaces the from-scratch analysis with a derivation from it. A gist decides what to build and at what scope. It settles almost nothing about how the epic is built, and it carries no invariants, which is the part of a record the conformance gate later checks against. Feeding gists through import mode would skip the design work on the grounds that the scope work was already done.

Only marked comments are read. An epic issue accumulates ordinary discussion, and feeding all of it to the architect degrades the input. Capturing an out-of-band decision comment in the general case is worth solving on its own terms and is out of scope here.

The failure this story guards against is silent: a read that never runs produces a record that simply does not mention what the discovery decided, and nothing reports the omission. The last acceptance criterion is the walkthrough that catches it, and it is required at the analyze pass.

## Assumptions

- Discovery state is committed. It lives in `.nexus/discovery/discover-<slug>-<key>/`, a directory
  of its own outside the queue, which holds the discovery doc and one file per ticket. Living
  outside `.nexus/queue/` is what puts a discovery out of reach of every stage that scans the
  queue, and the distiller's range helper excludes the directory as well. The unique key exists because a discovery
  has no issue number to be named by, and because two contributors may independently start on the
  same intent. `/nxs.discover` commits each session and never pushes.
- Sharing a discovery is an ordinary git push and pull. This epic adds no discovery review gate, no
  approval command, and no rule about who may start, resume, or graduate a discovery.
- Ticket type (research, interview, council, or task), blocking edges, the claim, and the status are
  frontmatter fields on the ticket file. Each has a one-to-one GitHub equivalent, so migrating the
  store to an issue-backed one later is a translation rather than a redesign. Wayfinder's
  "prototype" ticket type has no Nexus machinery and is dropped; prototype-shaped questions route to
  interview or council tickets.
- `/nxs.discover` selects its action by explicit flag, matching the command surface's rule. Passing
  intent text starts a discovery. Resuming and closing are named actions taking the discovery folder.
- The stubs' feature is confirmed once at start and recorded in the discovery doc, with a per-stub
  override at graduation.
- Discovery resolves the docs root and the target issues repository exactly as `/nxs.epic` does. The
  store lives in the checkout the command runs in and never migrates, because nothing ever drains a
  discovery folder. Graduation files into the resolved epic repository. Hub and multi-repository
  workspaces are untested this iteration, not blocked.

## Out of Scope

- New agents or skills. Every ticket type routes to existing machinery.
- Prototype tooling.
- Changes to `/nxs.analyze` and `/nxs.close` behavior. `/nxs.decision-record` gains
  exactly one change, a read of the marked gist comments, and nothing else. (Amended 2026-08-09:
  this line originally excluded `/nxs.distill` as well. Decision record #235 puts the distiller's
  exclusion of `.nexus/discovery` inside this decision, so that change is in scope. See the
  amendment below.)
- Changes to promotion. It rewrites the stub's body on the issue the stub was filed under, and it
  neither reads nor moves the gist comment.
- Automation of the human side of interview-typed tickets.
- Removal of the discovery folder by `/nxs.epic`. The folder is removed by a human commit after
  graduation, or by the no-build close.
- An issue-backed discovery store. That migration is its own epic if the committed store falls short.

## Open Questions

## Amendments

- 2026-08-09 — The discovery store moved from `.nexus/queue/discover-<slug>-<key>/` to
  `.nexus/discovery/discover-<slug>-<key>/`. Decision record #235, approved 2026-08-08 and therefore
  later than this body, reverses the in-queue placement and refutes it by name. A discovery is now
  kept out of the queue-scanning stages by where it lives rather than by the absence of an
  `epic.md`, which is the stronger of the two mechanisms. This body and story #229 were amended to
  match the approved record and the implementation.
- 2026-08-09 — `/nxs.distill` behavior moved from "Out of Scope" into this epic. Decision record
  #235, approved 2026-08-08 and therefore later than this body, says in invariant 2 that keeping a
  discovery out of the distiller's behavioral diff is part of this decision and not a later step.
  The shipped work is that exclusion plus the close-time empty-diff gate, which reads the same
  diff and has to stay in step with it. The line above was amended so a later reader sees planned
  scope rather than drift.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #229 | none |
| #230 | #229 |
| #231 | #230 |
| #232 | #229 |
| #233 | #231, #232 |
| #240 | none |
