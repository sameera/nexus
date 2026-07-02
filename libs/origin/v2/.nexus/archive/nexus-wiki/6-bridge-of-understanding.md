# 6. Bridge of understanding (and what stays in `docs/`)

## Original question

Nexus should serve both technical and non-technical stakeholders. PMs need to know what the system can do, what's being built, and what shipped. Engineers need to know how the system works, what constraints exist, and what decisions were made. Leadership needs to know progress, risks, and outcomes. Currently Nexus serves engineers through documentation. How does it serve PMs and leadership? Is the knowledge graph the answer for all three, or do different stakeholders need different views?

## Summary judgment

"Bridge of understanding" is not a single artifact for everyone — it is a layered model where each artifact serves one stakeholder primarily and composes via the graph for the others. Most of what's needed is already decided in Q1–Q5: the concept inventory serves PMs, decision records and standards serve engineers, the graph is the shared substrate. The strategic gap that opens once you accept the model: **artifact decay splits into two distinct classes**. Realized artifacts (epics, stories, tasks, AC) describe a future state and rot the moment that state is real — re-reading shipped AC tells you a frozen snapshot of intent that the code may have legitimately drifted from. Historical artifacts (decision records, concept decision logs, changelog, standards) describe past judgment and remain true as a record of *why* even as the system evolves. The pivot must rebuild `docs/` around the durable layers and treat iteration directories as transient workspaces that distill into durable layers at `/nxs.close` and then disappear. Decision records become immutable and append-only — drift detection produces amendments, not edits, and mid-flight reversals are classified by magnitude before any code changes shape. The "leadership view" needs no new artifact: an iteration-level outcome pass at `/nxs.close` ties the iteration's `why now` to what shipped, anchored in the existing changelog.

## Decisions

### D1. Bridge of understanding is a layered model, not a single artifact

Each Nexus artifact serves one stakeholder primarily; the graph composes them for everyone else. No single document tries to satisfy all three audiences at once — that path produces mediocre artifacts for each.

| Stakeholder | Primary artifact | Question it answers |
|---|---|---|
| PM | Concept inventory | What does this system *mean* to talk about? |
| PM (per-cycle) | Iteration scope (`why now`) | What are we committing to this quarter, and why now? |
| PM (per-capability) | `epic.md` (AC) | What does "done" mean for this capability? |
| Engineer | Decision record | Why did we choose this approach over alternatives? |
| Engineer | Standards | What do we always do? |
| Engineer | Task index | What's the gotcha-laden path through this work? |
| Engineer + PM | Graph | What is the system, right now? |
| Leadership | Iteration outcome (D10) | Did we deliver what the iteration committed to? |

**Why:** treating "bridge" as a single artifact replays the 16-section HLD trap — comprehensive, audience-confused, expensive to maintain. The pivot already split audiences across separate artifacts; this decision names the model so it stops being implicit.

**How to apply:** every artifact has a primary reader. If a proposal would broaden an artifact to serve a second audience, prefer adding a projection (link, derived view, rollup) over expanding the artifact itself.

### D2. Artifact decay splits into realized vs historical

Two distinct decay curves, two distinct retention rules:

| Class | What it describes | Decay curve |
|---|---|---|
| **Realized** | A future state to be built (epic, story, task, AC) | Once realized, the artifact is redundant with the realization. Reading it tells you what we agreed at the time, not what is true now. |
| **Historical** | Past judgment at a point in time (decision record, concept decision log, changelog, standards) | Does not rot into wrongness — remains true as a record of *why*, even as the system moves on. |

**Why:** Q1–Q5 implicitly treated all `docs/` files as if they had the same durability. They don't. Conflating the two classes either fossilises rot (keeping realized artifacts forever) or destroys judgment (overwriting historical artifacts to match present reality).

**How to apply:** any artifact added to the pipeline gets classified. Realized artifacts have a defined endpoint at which they distill and disappear. Historical artifacts have no endpoint — they live forever, append-only.

### D3. `docs/` divides into durable and transient

Concrete layout consequence of D2:

**Durable** (lives forever, indexed, browsable):
- `docs/concepts/` — curated vocabulary with per-concept decision log
- `docs/decisions/` — decision records, dated, immutable
- `docs/changelog/` — what shipped, by iteration
- `docs/system/standards/` and `docs/system/stack.md`

**Transient** (forcing-function workspace, deleted at iteration close):
- `docs/iterations/<id>/` — iteration scope, epic files, story files, task index, QA artifacts

**Why:** the durable layer is what a reader six months from now actually wants. The transient layer is what the team needs to do the work but stops paying its rent the moment shipping completes.

**How to apply:** new artifacts added to the pipeline land in the right layer by classification. Durable artifacts are git-permanent and indexable. Transient artifacts are workspace-only and have a distillation path.

### D4. Iteration directories are workspaces, deleted at `/nxs.close`

`docs/iterations/<id>/` is created at `/nxs.iteration` and removed at `/nxs.close` after a distillation pass. Git history retains the originals for forensics; working tree stays clean.

**Why:** epic and story files are realized artifacts. Their content is a *commitment* about a future state; once shipped, the system itself (graph + tests + concept invariants) is the authoritative source of "what we delivered." Keeping the original files in the working tree invites re-reading frozen intent as if it were current truth.

**How to apply:** `/nxs.close` runs distillation before deletion (D11). `/nxs.iteration --abandon` runs deletion without distillation (decision records still survive, since they live in the durable layer per D6). The iteration directory is never preserved indefinitely in working tree.

### D5. Decision records are immutable and append-only

The body of a decision record is written once at `/nxs.decide` and never edited. Subsequent updates land as appended `## Amendment <date>` sections.

**Why:** the property that makes decision records durable is that they capture *what was judged at decision time* — not *what is true now*. The graph already gives you what is now. If decision records become mutable, they collapse into realized artifacts that rot the same way epic and story files do, and six months later the question "why did we choose this?" returns only the current rationalisation, not the original reasoning.

**How to apply:** every Nexus command that touches a decision record either creates a new one or appends an amendment. Editing the body is a code-review reject. Tooling should make append the easy path and edit the awkward one.

### D6. Decision records live in `docs/decisions/<iteration-id>-<slug>.md` from creation

`/nxs.decide` writes directly to `docs/decisions/`, never into the iteration folder. The iteration folder may carry a pointer (or list the path in `iteration.md` frontmatter), but the canonical artifact lives in the durable layer from minute one.

Naming collisions (two epics in one iteration touching the same slug) are disambiguated by a numeric suffix: `<iteration-id>-<slug>.md`, `<iteration-id>-<slug>-2.md`, `<iteration-id>-<slug>-3.md`. The first record gets no suffix; subsequent collisions get `-2`, `-3`, … in creation order. Suffixes are assigned at write time and never reshuffled.

**Why:** if the decision record lived in the iteration folder and moved at close, the move would either break references or require renaming logic. Writing directly to the durable home means iteration directory deletion at `/nxs.close` is safe — nothing durable lives there to migrate. The numeric-suffix rule keeps the collision case mechanical (no human-authored slug churn) and stable (filenames never change after creation, preserving D5's immutability property at the path level).

**How to apply:** decision-record paths in concept pages, changelog entries, and task indexes always point at `docs/decisions/<file>.md`. `/nxs.decide` checks for an existing file at the candidate path and bumps the suffix until it finds a free one. The iteration folder structure is purely a workspace convenience and is never the source of truth.

### D7. Drift detection at `/nxs.close` produces amendments, not updates

This revises Q2 D11. The `nxs-analyzer` agent at `/nxs.close` does not edit the decision record body when implementation diverged. It appends an `## Amendment <date>` block describing what diverged, why, and what the current shape is.

**Why:** consistent with D5. The analyzer is a reconciliation pass, not a revisionist one. Reading the document chronologically tells the full story: original judgment, then divergences. That is organisational memory.

**How to apply:** `nxs-analyzer`'s drift-detection prompt is rewritten to author amendments rather than diff-and-update.

### D8. Mid-flight reversals are explicit new judgments, classified by magnitude

When an engineer realises during implementation that the decision is wrong, the rule is **judgment lands before code**. Three classes:

| Class | Trigger | Engineer action |
|---|---|---|
| **Tactical** | Approach changes within the same architectural shape (lib X doesn't fit the constraint we just discovered, switching to Y) | Author a short amendment to the existing decision record. Resume coding. |
| **Architectural** | Approach changes shape (decided sync, must be async; decided one service, must split) | Halt. Re-run `/nxs.decide`. New decision record supersedes the original via `supersedes:` frontmatter. Original body unchanged. |
| **PM-layer** | The AC, the concept boundary, or the capability itself is wrong | Halt. Escalate to PM. AC re-authored via `/nxs.epic`; concept changes via `/nxs.concept`. Then `/nxs.decide` runs again. |

**Why:** if the engineer codes the reversal first and lets `/nxs.close` handle it as drift, real architectural authority transfers silently to the analyzer agent — which can only describe divergence, not deliberate. That is exactly the AI-generated tech debt pattern Nexus exists to prevent.

**How to apply:** `CLAUDE.md` calls out the classify-before-coding discipline. Code review challenges PRs that diverge from their decision record without an amendment trail. The engineer's first act on noticing divergence is to *classify* — that moment of classification is itself the forcing function.

### D9. Decision-record chains use `supersedes:` frontmatter

When a new decision record (architectural or PM-layer reversal per D8) replaces a previous one, the new record gains `supersedes: docs/decisions/<previous>.md` in frontmatter. The previous record is unchanged — it does not gain a `superseded_by:` field, since that would mutate it (violating D5).

**Why:** the chain is forward-only. Readers walking from a current decision back through history follow `supersedes:` links. Readers walking forward from an old decision discover supersession through `git log` or a derived index — not by mutating the old record.

**How to apply:** decision-record frontmatter schema gains an optional `supersedes:` list. Convention: latest record is the live one; earlier records remain visible as history.

### D10. Iteration-level outcome pass at `/nxs.close` (closes the leadership gap)

`/nxs.close` emits one outcome paragraph per iteration tying the iteration's `why now` to what shipped: which capabilities landed, which concept-state transitions occurred, what was deferred. This lands in the changelog, not as a new artifact.

**Why:** Q4 D10 already engineers `/nxs.close` to do drift detection per iteration. Outcome capture is the natural sibling — same pass, broader question. Leadership gets its view by reading iteration changelog entries plus the GH Objective rollup; no leadership-only artifact is needed.

**How to apply:** `nxs-analyzer` drafts the outcome paragraph using iteration scope + graph delta + concept-state transitions; PM approves it via changeset-approval (Q2 D14) before it lands in the changelog.

### D11. `/nxs.close` runs a distillation pass before deleting the iteration directory

The distillation pass is the bridge between transient and durable layers:

1. For each concept touched in the iteration, append a one-line entry to that concept's decision log: `#142 — added nested-org resolution; see decisions/2026-q2-nested-orgs.md`.
2. Run drift check across decision records (D7); author amendments where divergence is detected.
3. Author the iteration-level outcome paragraph (D10); PM approves; append to changelog.
4. Delete `docs/iterations/<id>/`.

**Why:** distillation is what gives realized artifacts post-ship value. Without it, the residue (concept ↔ decision links, drift amendments, outcome record) is lost when the iteration directory is removed.

**How to apply:** `/nxs.close` enforces the order — distillation must succeed before deletion. If any step fails, the iteration directory is preserved and the user gets an actionable error.

### D12. AC's durable form is tests + concept invariants, not the AC text

Once shipped, acceptance criteria text is redundant with the executable contract: automated tests verify the conditions, and concept-page invariants describe the user-facing rules. Re-reading the original AC after shipping tells you what we *agreed*, not what is *enforced*.

**Why:** preserves D2's classification — AC is realized, not historical. Tests are the durable form because they remain true and executable; AC text frozen six months ago is interesting history at best, misleading at worst.

**How to apply:** post-ship, the answer to "what does this system guarantee?" is the graph (for shape), the tests (for behaviour), and the concept page (for vocabulary and invariants). The original AC text is reachable via `git log` if anyone needs it.

### D13. Abandoned iterations preserve decision records and concept-page changes

When an iteration is abandoned mid-flight (`/nxs.iteration --abandon`), the iteration directory is deleted but decision records (in `docs/decisions/`) survive. Concept-page changes that already landed via approved changesets also survive.

**Why:** falls out of D6 — decision records never lived in the iteration folder, so abandonment doesn't reach them. The bonus: "we considered nested-orgs in Q2 2026, here's what we decided, here's why we didn't ship" becomes durable organisational memory rather than a closed Jira ticket and a deleted branch.

**How to apply:** `/nxs.iteration --abandon` is the explicit abandonment command. It deletes the iteration directory, optionally appends an "abandoned" amendment to relevant decision records, and exits. Concept-page approved changes are never reverted automatically — abandonment is a project-state decision, not a curation rollback.

### D14. `epic.md` and `story.md` are transient forcing functions, not durable records

They live in the iteration folder while in-flight (capability statement, AC sliced by story, ceiling check, concept refs at the epic level; AC slice + decision-record link + task-index link at the story level). They distill at close per D11 and are deleted with the iteration directory.

**Why:** classification under D2 — both are realized. The capability statement is redundant with the concept page once shipped; the AC is redundant with tests + invariants; the story slicing is a work-management artifact with no post-ship value.

**How to apply:** `/nxs.epic` continues to author `epic.md`; story authoring writes `story.md` per story. Neither is preserved beyond `/nxs.close`. The forcing-function role of articulating capability and AC at the umbrella level is preserved during the work; only the artifact retention changes.

## Patterns and guardrails

### The distillation pattern

Any transient artifact that is being deleted at `/nxs.close` must first surface its residue into the durable layer. Concrete contract:

- Concept-relevant content → concept decision log
- Architectural content → decision-record amendment (if drift) or no-op (if alignment)
- Outcome content → changelog iteration entry
- QA content → already in test suite (executable form); QA report archived under changelog if a structured artifact exists

If a piece of transient content has no durable home, that is a signal it had no post-ship value to begin with — and the question is whether it should have been authored at all.

### The classify-before-coding discipline

Engineer noticing divergence from a decision record:

1. Notice the conflict.
2. Stop coding.
3. Classify (tactical / architectural / PM-layer per D8).
4. Act (amend / re-decide / escalate).
5. Resume.

Step 2 is the load-bearing one. Everything downstream is mechanical. `CLAUDE.md` should call this out at implementation-time guidance.

### Forensics fallback

`git log -- <path>` is the audit trail for any deleted transient artifact. The working tree stays clean; the history retains everything. Forensics is rare; the cost-benefit of cluttering working tree with frozen-intent files to serve a once-a-quarter audit is wrong.

## Action items

### Decision-record home and lifecycle
- [ ] Define `docs/decisions/<iteration-id>-<slug>.md` as the canonical home.
- [ ] Update `/nxs.decide` to write directly there from creation; never inside iteration folders.
- [ ] Add `supersedes:` (optional) to decision-record frontmatter schema.
- [ ] Update `nxs-analyzer` drift-detection prompt to author `## Amendment <date>` blocks rather than edit the body.
- [ ] Update Q2 D11 cross-references to reflect amendment-not-update semantics (this doc supersedes that aspect).

### Iteration directory lifecycle
- [ ] `/nxs.iteration` creates `docs/iterations/<id>/` as transient workspace.
- [ ] Add `/nxs.iteration --abandon` for explicit abandonment (deletes directory, preserves durable records).
- [ ] `/nxs.close` runs the distillation pass (D11) before deletion: concept decision-log entries, drift amendments, outcome paragraph, then directory removal.
- [ ] Distillation must succeed before deletion; partial failure preserves the directory and surfaces an actionable error.

### Mid-flight reversal
- [ ] Add the classify-before-coding discipline to bootstrapped `CLAUDE.md`.
- [ ] Document the three classes (tactical / architectural / PM-layer) and their actions in user-facing docs.
- [ ] Code-review checklist: PRs diverging from a decision record without an amendment trail are challenge-worthy.
- [ ] Watch for `/nxs.reconsider` helper need empirically — do not pre-build.

### Iteration outcome capture
- [ ] `nxs-analyzer` gains an outcome-drafting prompt: ties iteration scope `why now` to graph delta + concept-state transitions + closed Objective.
- [ ] PM approves the outcome paragraph via changeset-approval (Q2 D14) before it lands in the changelog.
- [ ] Outcome paragraph format defined (concise: what landed, what didn't, what concept transitions occurred).

### Epic and story file shape
- [ ] `epic.md` retains capability + AC umbrella + ceiling check + `touches_concepts`. Lives in iteration folder. Transient.
- [ ] `story.md` retains story-level AC slice + decision-record link + task-index link. Lives in story folder. Transient.
- [ ] Both deleted at `/nxs.close` along with the iteration directory.
- [ ] Distillation extracts AC residue to tests (already happens via `/nxs.qa --mode design`); no separate AC archive.

### Durable layer scaffolding
- [ ] Define `docs/changelog/` structure: per-iteration entries, append-only, indexed chronologically.
- [ ] Concept-page schema gains a `## Decision Log` section template for distillation entries.
- [ ] `/nxs.init` ensures `docs/concepts/`, `docs/decisions/`, `docs/changelog/`, `docs/system/standards/` exist.

## Open questions

- **`docs/decisions/` index.** Pure file system today (chronological filenames are enough). Whether a slim index by concept-touched or by quarter earns its keep depends on volume — defer until empirical pain emerges.
- **Outcome paragraph authorship.** `nxs-analyzer` drafts, PM approves — but the PM may reasonably want to author this themselves when the strategic narrative matters. Optional override (PM writes from scratch, analyzer provides draft as input) is probably the right shape; specify during implementation.
- **Gradual-awareness reversal.** D8 assumes the engineer notices a discrete moment of divergence. In practice, awareness builds over hours of coding. Tooling can remind; it can't substitute for noticing. Review-time enforcement (PR-diverges-from-decision pattern) is the leading indicator. Watch empirically.
- **Standards distillation.** Standards are durable (D3) and hand-curated (Q5 D7), but iterations may produce evidence that an existing standard needs revision (e.g., the decision record amends a standard's exception list). Whether `/nxs.close` should surface standards-revision candidates is unaddressed; defer until the case appears.
- **Cross-iteration concept narrative.** Concept-state transitions captured per-iteration in the changelog; the cross-quarter view (how `org-resolution` evolved over the year) is derivable but not surfaced. Whether a generated concept-history view earns its keep is a Q7-territory question.
