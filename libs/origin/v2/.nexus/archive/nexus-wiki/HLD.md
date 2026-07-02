# HLD: Nexus Wiki (Concept Graph)

Source spec: [`wiki-architecture.md`](./wiki-architecture.md). All section references (`§N`) point at that file. The spec is authoritative; this HLD records implementation choices, file paths, ordering, and per-phase reusable prompts.

> **Save target**: `docs/features/nexus-wiki/HLD.md`
> **Companion**: each phase below (A–F) is a standalone prompt — paste a phase block into a fresh Claude Code session to execute it.

---

## 1. Context

Nexus has no agent-readable shared memory between epics. Each new epic re-derives subsystem behavior from PIRs and HLDs that decay over months. The wiki adds a curated, grep-retrievable concept graph at `docs/system/concepts/` that:

- The architect / decomposer / dev / pm agents read at the start of every run.
- The new `nxs-distiller` agent updates on every epic close (via `/nxs.close`).
- A one-time `/nxs.bootstrap-concepts` command seeds from existing briefs and HLDs.

The change must be additive: a repo without `docs/system/concepts/` continues to function unchanged.

## 2. Decisions

| Decision | Choice |
|----------|--------|
| Script language | **TypeScript** via `tsx` (matches `wiki-architecture.md` §2.2; diverges from existing Python skills) |
| Targets | **`claude/.claude/` only** — Gemini mirror deferred |
| Scope | **Full** — all companion commands, archival, conflict-suggested, split-suggested, `--refresh` |
| Implementation route | **Direct** — not run through `/nxs.epic` → `/nxs.hld` → `/nxs.tasks` |
| Toolchain location | One `package.json` at `claude/.claude/skills/nxs-bootstrap-concepts/`. No repo-root `package.json`. |
| Invocation pattern | `cd claude/.claude/skills/nxs-bootstrap-concepts && npx tsx scripts/<name>.ts` |
| Gate | Every change checks for `docs/system/concepts/`; if absent, log and no-op (§9.2) |

## 3. File Inventory

### New files

| Path | Spec section |
|------|--------------|
| `claude/.claude/agents/nxs-distiller.md` | §3.1 |
| `claude/.claude/commands/nxs.bootstrap-concepts.md` | §2.12, §10.5, §10.6 |
| `claude/.claude/commands/nxs.distill-epic.md` | §4.6, §10.12 |
| `claude/.claude/commands/nxs.list-concepts.md` | §6.3 |
| `claude/.claude/commands/nxs.merge-concepts.md` | §10.6 |
| `claude/.claude/skills/nxs-bootstrap-concepts/SKILL.md` | §2.2 |
| `claude/.claude/skills/nxs-bootstrap-concepts/package.json` | toolchain |
| `claude/.claude/skills/nxs-bootstrap-concepts/tsconfig.json` | toolchain |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/scan-sources.ts` | §2.4 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/extract-candidates.ts` | §2.5 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/cluster-candidates.ts` | §2.5 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/render-checkpoint.ts` | §2.5 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/plan-generation.ts` | §2.6 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/plan-verification.ts` | §2.7 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/update-index.ts` | §2.8, §7.1 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/lib/frontmatter.ts` | §2.2 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/lib/concept-schema.ts` | §3.1 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/lib/grep.ts` | §2.7 |
| `claude/.claude/skills/nxs-bootstrap-concepts/scripts/lib/path-utils.ts` | §2.2 |
| `claude/.claude/skills/nxs-distiller/SKILL.md` | §8 |
| `claude/.claude/skills/nxs-distiller/scripts/update-index.ts` | §8 |
| `claude/.claude/skills/nxs-distiller/scripts/plan-code-surface.ts` | §8 |

### Edited files

| Path | Spec section |
|------|--------------|
| `claude/.claude/agents/nxs-architect.md` | §5.6 |
| `claude/.claude/agents/nxs-decomposer.md` | §5.6 |
| `claude/.claude/agents/nxs-dev.md` | §5.6 |
| `claude/.claude/agents/nxs-pm.md` | §5.6 |
| `claude/.claude/agents/nxs-analyzer.md` | §10.4, §10.7 |
| `claude/.claude/commands/nxs.close.md` | §4 |
| `claude/.claude/commands/nxs.epic.md` | §6.2 |
| Brief template (locate during Phase E) | §6.1 |
| `.gitignore` | toolchain |

---

## 4. Phase-by-Phase Implementation Prompts

Each phase below is self-contained. Copy a `### Prompt` block into a fresh Claude Code session at the repo root. Phases must run in order — each assumes the prior phase has landed.

### Phase A — Distiller agent + helper libs (no behavior change)

**Goal**: agent file exists, lib code compiles, `update-index.ts` runs against an empty `docs/system/concepts/` and emits a valid (empty) index. No agent prompts changed yet, no commands modified. Repo behavior identical to today.

**Prompt**:

````
You're implementing Phase A of the Nexus Wiki HLD.

References:
- HLD: docs/features/nexus-wiki/HLD.md (sections 1–3, this Phase A block, and Section 5)
- Spec: docs/features/nexus-wiki/wiki-architecture.md (§2.2, §2.8, §3.1, §7.1)

Tasks:

1. Create claude/.claude/agents/nxs-distiller.md verbatim from spec §3.1.
   - Match the frontmatter style of claude/.claude/agents/nxs-analyzer.md exactly:
     name, description, category: engineering, tools, model.
   - tools: Read, Grep, Glob, Write, Edit, Bash
   - model: sonnet

2. Create claude/.claude/skills/nxs-bootstrap-concepts/ with:
   - package.json declaring tsx + typescript + gray-matter as devDependencies; node >= 20
   - tsconfig.json: module: "esnext", moduleResolution: "bundler",
     target: "es2022", strict: true, esModuleInterop: true
   - SKILL.md describing the skill's purpose and the invocation pattern
     (cd into the skill dir, then `npx tsx scripts/<name>.ts`)
   - scripts/lib/frontmatter.ts — read/write YAML frontmatter via gray-matter
   - scripts/lib/concept-schema.ts — TS types matching spec §3.1 schema +
     a hand-rolled validator. Validate: ≤500 words excluding frontmatter and
     Decision Log section, frontmatter required fields present, all `touches:`
     entries are valid concept names.
   - scripts/lib/grep.ts — wrapper around ripgrep via child_process.spawnSync,
     fall back to `git grep` if `rg` is not on PATH.
   - scripts/lib/path-utils.ts — repo-relative path helpers (resolve from CWD
     up to nearest .git directory).
   - scripts/update-index.ts — implement spec §2.8 + §7.1. Idempotent: re-running
     with no concept changes produces a byte-identical file. Emit a warning
     (not error) when a page exceeds 500 words.

3. Create claude/.claude/skills/nxs-distiller/ with:
   - SKILL.md
   - scripts/update-index.ts — re-export from
     ../../nxs-bootstrap-concepts/scripts/update-index.ts
   - scripts/plan-code-surface.ts — extract spec §2.7's
     "Identifying the code surface for a concept" heuristic into a reusable
     function. Pure: given concept metadata, return a ranked file list.
   - scripts/lib/ re-exports from the bootstrap lib (just import-and-export).

4. Add to .gitignore at the repo root:
       claude/.claude/skills/nxs-bootstrap-concepts/node_modules/
       .tmp/bootstrap/

5. Verify:
   - Run: cd claude/.claude/skills/nxs-bootstrap-concepts && npm install
   - Run: npx tsc --noEmit  → must compile clean under strict: true
   - Run: mkdir -p docs/system/concepts && npx tsx scripts/update-index.ts
     → must produce a valid empty docs/system/concepts/README.md
     (or the canonical index header from §7.1 with "Total concepts: 0")
   - Re-run update-index.ts → file must be byte-identical (idempotency)
   - rm -rf docs/system/concepts (cleanup before commit)

Do NOT modify any existing agent or command file in this phase. Do NOT add any
gate logic to existing commands yet. Phase A is pure addition.
````

---

### Phase B — Bootstrap command + remaining scripts

**Goal**: a user can run `/nxs.bootstrap-concepts` end-to-end on a real repo. Agents still don't read concepts. Wiki is dormant.

**Prompt**:

````
You're implementing Phase B of the Nexus Wiki HLD. Phase A must be merged first.

References:
- HLD: docs/features/nexus-wiki/HLD.md (sections 1–3, this Phase B block, Section 5)
- Spec: docs/features/nexus-wiki/wiki-architecture.md (§2 in full, §10.5, §10.6)

Tasks:

1. Create claude/.claude/skills/nxs-bootstrap-concepts/scripts/scan-sources.ts
   per spec §2.4:
   - Walk docs/features/**/README.md and docs/features/**/*hld.md
   - Derive chronOrder from `git log --diff-filter=A --format=%cI -- <path>`
     with frontmatter `created` field as fallback, lexical path as final fallback
   - Support flags: --scope <path> filter (§9.3), --check-empty (§2.11)
   - Emit JSON to stdout matching the SourceDoc type in spec §2.4
   - Exit 2 if --check-empty and docs/system/concepts/ is non-empty; 0 otherwise

2. Create scripts/extract-candidates.ts per spec §2.5:
   - Input: --doc <path> --index-summary <path-to-running-index-summary.json>
   - Output to stdout: a JSON envelope ready for the distiller in discovery mode
     (the agent prompt body — the script does NOT call the agent)
   - Includes: doc path, doc content (full), running index summary, candidate_cap
   - The orchestrating command file (Step 7 below) reads this and constructs the
     actual agent invocation.

3. Create scripts/cluster-candidates.ts per spec §2.5 "Clustering":
   - Input: glob .tmp/bootstrap/candidates/*.json (one envelope per source doc)
   - Apply merge rules from §2.5 verbatim
   - Emit .tmp/bootstrap/concepts.draft.json

4. Create scripts/render-checkpoint.ts per spec §2.5 "Human checkpoint":
   - One-shot script (NOT interactive — the command file owns the user loop)
   - Input: --draft .tmp/bootstrap/concepts.draft.json
            [--apply '<edit-list-as-json>']
   - Edit operations supported: merge a b, split <name> into x,y,
     drop <name>, rename <old> -> <new>
   - Without --apply, prints the table from §2.5 to stdout for the user
   - With --apply, mutates the draft and rewrites concepts.draft.json
   - The command file calls this in a loop until the user replies bare 'continue'

5. Create scripts/plan-generation.ts per spec §2.6:
   - Input: --concept <name> from concepts.draft.json
   - Builds the per-concept input bundle (full source docs deduped by path,
     running index summary, clustered metadata)
   - Output to stdout: a JSON envelope ready for the distiller in authoring mode

6. Create scripts/plan-verification.ts per spec §2.7:
   - Input: --concept <name> --draft-path <path>
   - Builds the ≤10-file code surface using the heuristic from §2.7 by calling
     into ../../nxs-distiller/scripts/plan-code-surface.ts (Phase A artefact)
   - Emit JSON: {code_surface: [...], low_coverage: bool}
   - low_coverage = true when code_surface < 3 files

7. Create claude/.claude/commands/nxs.bootstrap-concepts.md as the orchestrator.
   Match the structure of claude/.claude/commands/nxs.tasks.md: frontmatter
   `description:` only, then `# Role`, `# Context`, `# Input Resolution`,
   `# Workflow` (numbered steps), `# Constraints`, `# Error Handling`,
   `# Execution`. Walk spec §2.12:
   1. Refusal check (--force handling per §2.11): use scan-sources.ts --check-empty
   2. Phase 0: scan-sources.ts → list of sources
   3. Phase 1 loop: for each source doc:
      a. extract-candidates.ts → JSON envelope
      b. invoke nxs-distiller in discovery mode with that envelope
      c. write the agent's response to .tmp/bootstrap/candidates/<doc-slug>.json
      Then: cluster-candidates.ts
      Then: render-checkpoint.ts loop until user replies 'continue'
   4. Phase 2 loop: for each approved concept:
      a. plan-generation.ts → JSON envelope
      b. invoke nxs-distiller in authoring mode
      c. write returned markdown to docs/system/concepts/<canonical-name>.md
   5. Phase 3 loop: for each draft:
      a. plan-verification.ts → code surface JSON
      b. invoke nxs-distiller in verification mode
      c. overwrite the draft with the verified page
   6. Run update-index.ts
   7. Final user-confirmation checkpoint, then `git add docs/system/concepts/`
      and propose a commit (do not commit without confirmation).

   Resumability (§10.5): Step 0 of the workflow checks .tmp/bootstrap/ and offers
   "resume from last completed phase" before doing anything else.

   Failure handling: §2.10 table.

   Initial step: ensure deps installed
       if [ ! -d claude/.claude/skills/nxs-bootstrap-concepts/node_modules ]; then
         npm install --prefix claude/.claude/skills/nxs-bootstrap-concepts
       fi

8. Verify:
   - Pick a small subdir under docs/features/ as scope.
   - Run: /nxs.bootstrap-concepts --scope docs/features/<small-feature>/
   - Walk through Phase 1 checkpoint, accept defaults, watch Phases 2–3 complete.
   - Confirm docs/system/concepts/ has at least one .md plus README.md.
   - Confirm all generated pages pass schema validation (size cap, required fields,
     touches resolve).
   - Kill mid-Phase-2; re-run; confirm resume prompt appears.
   - rm -rf docs/system/concepts && rm -rf .tmp/bootstrap (clean up)

Do NOT modify any existing agent or command in this phase except adding
nxs.bootstrap-concepts.md as a new command. Phase B is still pure addition.
````

---

### Phase C — `/nxs.close` distill integration + `/nxs.distill-epic`

**Goal**: `/nxs.close` produces concept-graph diffs in the same atomic commit as the PIR. `/nxs.distill-epic` exists as a retry / back-fill path.

**Prompt**:

````
You're implementing Phase C of the Nexus Wiki HLD. Phases A and B must be merged.

References:
- HLD: docs/features/nexus-wiki/HLD.md (this Phase C block, Section 5)
- Spec: docs/features/nexus-wiki/wiki-architecture.md (§4 in full, §10.12)

Tasks:

1. Edit claude/.claude/commands/nxs.close.md per spec §4.
   - Insert new `## 4.5 Distill Concepts (Plan)` between current
     `## 4. Update Epic's Related Documents Section` and `## 5. Confirmation
     Checkpoint`. Body from §4.2.
     Gate: if `docs/system/concepts/` does not exist, log
     "No concept graph present — skipping distillation. Run
     /nxs.bootstrap-concepts to seed." and skip 4.5 + new 6.
   - Edit `## 5. Confirmation Checkpoint`: append the Concept Actions block
     (§4.3); add reply options `c` (review concept-action plan in detail) and
     `s` (close but skip distill).
   - Insert new `## 6. Apply Concept Changes` (skipped on `s`) per §4.4.
     Re-invoke nxs-distiller in distill mode with execute: true; then
     run update-index.ts (the bootstrap version, re-exported under
     claude/.claude/skills/nxs-distiller/scripts/update-index.ts);
     then `git add docs/system/concepts/` (do not commit yet).
   - Renumber existing 6 → 7 (Post PIR comment + close issue),
     7 → 8 (Delete tasks/), 8 → 9 (Report).
   - Add new `## 9. Commit Documentation` (becomes the new last step before
     report) per §4.5: a single atomic commit covering PIR + epic update +
     concepts/. This is **new behavior** — today's nxs.close commits nothing.
     Move the report to be `## 10. Report Completion`.
   - Update `# Execution` summary at the bottom to reflect new step numbers.
   - Update `# Error Handling` per §4.7.

2. Create claude/.claude/commands/nxs.distill-epic.md per spec §4.6.
   - Input: $ARGUMENTS = <issue-number> | <PIR-path>
   - Resolve to the epic directory and PIR path.
   - Steps mirror nxs.close 4.5 + 6 + 9 — does NOT touch the GitHub issue
     (no `gh issue close`) and does NOT delete tasks/.
   - Add flag: --refresh <concept-name> per §10.12. When set, skip the PIR-driven
     distill plan and instead re-run verification mode against current code for
     just that one concept page (uses plan-verification.ts + plan-code-surface.ts).

3. Verify:
   - Take a recently closed epic with a known PIR.md and a small
     docs/system/concepts/ (from Phase B verification).
   - Run /nxs.distill-epic <issue> — confirm action plan surfaces and atomic
     commit lands with PIR + concepts in one commit.
   - Run /nxs.distill-epic <issue> --refresh <concept-name> — confirm only that
     one page changes.
   - Run /nxs.close on a fresh fixture epic (no concepts/ directory present)
     — confirm gate triggers and behavior is identical to today.
   - Run /nxs.close with concepts/ present and reply `s` — confirm distill
     skipped, PIR + epic still commit, message printed about
     /nxs.distill-epic back-fill.

After Phase C, the wiki is functionally live for any repo that has run bootstrap.
````

---

### Phase D — Agent prompt diffs (concept loading protocol)

**Goal**: the architect, decomposer, dev, and pm agents read concepts at the start of every run when present. Behavior unchanged when `docs/system/concepts/` is absent.

**Prompt**:

````
You're implementing Phase D of the Nexus Wiki HLD. Phases A–C must be merged.

References:
- HLD: docs/features/nexus-wiki/HLD.md (this Phase D block, Section 5)
- Spec: docs/features/nexus-wiki/wiki-architecture.md (§5 in full, §5.6 for diffs)

The shared "Step 0: Load Concepts" body from §5.1 is identical across agents.
Use it verbatim each time — do not paraphrase. This makes future maintenance
a single find/replace.

Tasks:

1. Edit claude/.claude/agents/nxs-architect.md per §5.6:
   - Insert new `### Step 2.5: Load Concepts (if present)` between current
     Step 2 (Architectural Context Analysis) and Step 3 (Standards & Conformance
     Pass). Body identical to §5.1.
   - In the `### Standards Conformance` block, add a bullet:
     "Recommendation honors all loaded concept Key Invariants"
   - In `### Direct Mode (Default)` and `### LLD Elaboration Mode`, prepend
     "Load concepts (§ Step 2.5) before any analysis or elaboration."
   - LLD-elaboration specific: §5.2 says concepts referenced in HLD frontmatter
     are loaded once at start of an /nxs.tasks run and reused across all tasks
     of that epic — note this explicitly in the LLD Elaboration Mode section.
   - Apply Invariant Conflict Protocol per §5.4.

2. Edit claude/.claude/agents/nxs-decomposer.md per §5.6:
   - Insert new subsection `### 0. Load Concept Constraints` at the top of
     `## Scope Validation (MANDATORY)`. Body from §5.1 + the validation rule
     from §5.2.
   - Find the existing scope_validation JSON output schema; add field
     `invariant_conflicts: []` matching shape from §5.2.
   - Apply Invariant Conflict Protocol per §5.4.

3. Edit claude/.claude/agents/nxs-dev.md per §5.6:
   - Insert `## 4. Concept Loading` in `# Pre-Flight Checks` after
     `## 3. Stack Familiarization`. Body from §5.1 + the dev-specific
     bullets from §5.2 (call out concepts in plan; reference invariants in
     test names; raise §5.4 BEFORE writing code).
   - In `## Phase 1: Understand & Plan`, add bullet:
     "Identify which loaded concepts cover this work; list them in the plan"
   - Apply Invariant Conflict Protocol per §5.4 — dev stops and waits for
     human, does NOT pretend to fix it (§10.9).

4. Edit claude/.claude/agents/nxs-pm.md per §5.6:
   - In `## Always Read (Both Modes)`, add bullet:
     "Concept index at docs/system/concepts/README.md (if present)"
   - Add new `## Concept Loading` subsection. Body from §5.1.
   - For council mode (§5.2): note that concepts load only when the question
     references existing system behavior — strategic answers should not load
     8 pages.

5. Verify:
   - Walk through each edited agent file and confirm the gate is present
     ("If docs/system/concepts/README.md does NOT exist, skip this step
     entirely.") so a repo without concepts behaves unchanged.
   - Optional: run /nxs.hld against an existing epic with no concepts present
     — output should be identical to pre-Phase-D behavior.
   - Optional: hand-create a small docs/system/concepts/ with one page,
     run /nxs.hld against an epic — confirm the architect transcript reads
     docs/system/concepts/<name>.md.

Do NOT modify nxs-analyzer.md in this phase. Phase F adds analyzer findings.
````

---

### Phase E — `/nxs.epic` modifications + brief template + `/nxs.list-concepts`

**Goal**: PMs writing new briefs use the slim template; epic generation gates against invariants.

**Prompt**:

````
You're implementing Phase E of the Nexus Wiki HLD. Phases A–D must be merged.

References:
- HLD: docs/features/nexus-wiki/HLD.md (this Phase E block, Section 5)
- Spec: docs/features/nexus-wiki/wiki-architecture.md (§6 in full)

Tasks:

1. Edit claude/.claude/commands/nxs.epic.md per §6.2.
   The file's `## Outline` section drives the workflow. Locate the brief-
   validation step and the story-decomposition step before editing.
   - Insert `### 1.5 Load Concepts` after brief validation, before right-sizing.
     Body from §6.2's Step 1.5 spec. Includes the missing-concept resolution
     prompt with three options (replace / accept-as-new / remove).
     Wrap the entire step in a check: if docs/system/concepts/ does not exist,
     log "no concept graph found, skipping concept loading" and continue.
   - Insert `### 6.5 Story-Invariant Validation` after story decomposition.
     Body from §6.2's Step 6.5 spec. Conflicts surface as Open Questions in
     the epic doc — NOT auto-resolved.
   - Edit the epic-doc template inside the command file (around the
     `# Epic: [Epic Title]` block in the Outline section): add `concepts:`
     to the YAML frontmatter, copied from the brief plus any new concepts
     surfaced during right-sizing.

2. Update the brief template per §6.1.
   First, locate the canonical brief template — likely candidates:
     - common/docs/features/template.md
     - claude/.claude/commands/nxs.product-context.md (may reference)
     - somewhere referenced by claude/.claude/commands/nxs.epic.md as
       "Feature README format"
   Use grep with these heuristics to find it:
     rg 'feature: "<Feature Name>"' --files-with-matches
     rg 'Current Behavior' docs/features/ -l
   Replace the template body with the §6.1 form: Problem / Desired Outcome /
   Success Criteria / Scope Boundaries / Open Questions. Frontmatter adds
   `concepts:` and `created:` fields. Remove "Current Behavior" and
   "Technical Context" sections (these duplicate code).

3. Create claude/.claude/commands/nxs.list-concepts.md per §6.3.
   Small helper — no agent invocation needed.
   - Read docs/system/concepts/README.md (if present)
   - If a brief is open in editor context, read it and rank concepts by:
     1) name/alias hits in brief content (highest)
     2) `touches:` overlap with brief content
   - Output: top 15 ranked. If no brief in context, output the index sorted
     alphabetically.
   - Gate: if docs/system/concepts/ doesn't exist, print "No concept graph
     found. Run /nxs.bootstrap-concepts to seed." and exit.

4. Verify:
   - Without concepts/ present: run /nxs.epic against a fixture brief
     — Step 1.5 logs skip-message; Step 6.5 logs skip-message; behavior
     unchanged from pre-Phase-E.
   - With concepts/ present and a brief listing a non-existent concept:
     run /nxs.epic — confirm Step 1.5 surfaces the three-option prompt.
   - With concepts/ present and a known invariant, hand-craft a story that
     contradicts it: run /nxs.epic — confirm Step 6.5 surfaces the conflict
     as an Open Question in the generated epic doc.
   - /nxs.list-concepts with an open brief — confirm ranked output makes sense.
````

---

### Phase F — Companion commands and analyzer findings (full-scope completion)

**Goal**: full architecture surface implemented including merge, archive, conflict-suggested, split-suggested workflow, and analyzer staleness/drift findings.

**Prompt**:

````
You're implementing Phase F (final) of the Nexus Wiki HLD. Phases A–E merged.

References:
- HLD: docs/features/nexus-wiki/HLD.md (this Phase F block, Section 5)
- Spec: docs/features/nexus-wiki/wiki-architecture.md (§7.6, §10.1, §10.4,
  §10.6, §10.7)

Tasks:

1. Add `merge` mode to claude/.claude/agents/nxs-distiller.md.
   Extend the `## Operating Modes` list and `## Workflow` section per §10.6
   (Merge): inputs are two concept page paths; output is one combined page
   with chronologically merged Decision Log; preserve aliases (union); archive
   inputs.

2. Create claude/.claude/commands/nxs.merge-concepts.md per §10.6.
   - Input: $ARGUMENTS = "<a> <b> [--into <name>]"
   - Reads both pages, invokes distiller in merge mode
   - On success: writes the merged page, moves both inputs to
     docs/system/concepts/_archive/<name>.md with `archived_in: "manual-merge"`
     frontmatter, runs update-index.ts, scans all other concept pages and
     updates `touches:` references from the old names to the new name.
   - Final commit confirmation before writing.

3. Add `archive` action to distiller distill mode per §7.6.
   - Edit nxs-distiller.md: in distill Pass A, when PIR's Future Considerations
     or Implementation Notes flag subsystem removal, propose `action: "archive"`.
   - Edit nxs.close.md (Phase C artefact) Step 5 checkpoint: surface archive
     actions ("archive <name>: subsystem removed in #<issue>"). On user
     approval, Pass B moves the page to docs/system/concepts/_archive/<name>.md
     with frontmatter `archived_in: "#<issue>"`, body preserved.
   - Edit update-index.ts (Phase A artefact): exclude _archive/ from main
     table; emit "## Archived concepts" footer with links, alphabetized.

4. Add `conflict-suggested` action per §10.1.
   - Edit nxs-distiller.md distill Pass A: compare changed surface against
     `touches:` of every concept; if two concepts overlap on the same files,
     surface `{action: "conflict-suggested", concepts: [a, b], rationale: "..."}`.
   - Surface in close checkpoint as informational; user resolves manually
     (typically by running /nxs.merge-concepts or splitting `touches:` to be
     more specific).

5. Add `split-suggested` workflow per §10.6 (Split).
   - Distiller already proposes split-suggested when an update would push
     a page past 500 words (Phase C Step 1's Pass A behavior — verify it).
   - Edit close checkpoint to render split-suggested as the §10.6 prompt:
     show the concept name, current word count, and the proposed split names.
     User replies yes / no / custom.
   - On `yes`: distiller writes both new pages, moves the original to
     _archive/, scans all other pages and updates `touches:` references
     from the old name to the appropriate new name (best-effort — flag
     ambiguous references for human review).

6. Edit claude/.claude/agents/nxs-analyzer.md per §10.4 + §10.7:
   - Add `staleness-suspected` finding: cross-check a concept page's
     Key Invariants against code-level invariants discoverable by grep
     (assertion patterns, validation regexes). If a page invariant has no
     code support and the page was last edited manually
     (`last_updated_by` does not match `#\d+|bootstrap`), surface this as
     a finding. Informational only — no automation acts on it.
   - Add `index-drift` finding: if any page's frontmatter `concept:` field
     doesn't match the index entry, flag it. Suggest fix:
     `cd claude/.claude/skills/nxs-distiller && npx tsx scripts/update-index.ts`

7. Verify (end-to-end smoke test for the whole feature):
   - Empty-repo gate: with no docs/system/concepts/ present, run /nxs.epic
     and /nxs.close against a fixture epic. Behavior identical to pre-wiki.
   - Bootstrap a small subtree:
       /nxs.bootstrap-concepts --scope docs/features/<small-feature>/
     Validate the index, the schema validation passes for every page,
     update-index.ts is idempotent.
   - Resumability: kill bootstrap mid-Phase-2, re-run, confirm resume prompt.
   - Distill round-trip: take a closed epic, run /nxs.distill-epic <issue>,
     confirm action plan surfaces and atomic commit lands with PIR + concepts.
   - Invariant conflict surface: hand-craft a story contradicting a known
     invariant, run /nxs.epic — Step 6.5 raises Open Question.
   - Agent integration: run /nxs.hld against an epic listing concepts —
     confirm architect transcript reads docs/system/concepts/<name>.md.
   - Merge: /nxs.merge-concepts a b --into c — confirm both archived,
     touches references updated across the graph.
   - Split: hand-grow a page past 500 words, run /nxs.distill-epic, accept
     split — confirm two pages created, original archived.
   - Revert: git rm -r docs/system/concepts/ && commit. Run any pipeline
     command — gate triggers, behavior reverts to pre-wiki.
   - Compile clean: cd claude/.claude/skills/nxs-bootstrap-concepts &&
     npx tsc --noEmit (zero errors under strict: true).

After Phase F, the full architecture per wiki-architecture.md is implemented.
````

---

## 5. Open Implementation Questions

Resolve while coding; not blockers:

1. **Brief template location** (§6.1, Phase E Step 2). Probably `common/docs/features/template.md`. Grep during Phase E to confirm.
2. **Index format edge cases** (§7.1, Phase A): when `archived_in` frontmatter is present, exclude from main table but include in the alphabetized footer (Phase F formalizes this).
3. **`render-checkpoint.ts` interactivity** (§2.5, Phase B): TS scripts can't trivially do interactive stdin loops. Decision: render-checkpoint.ts is one-shot — given a draft + an edit list as JSON, apply edits and emit new draft. The command file owns the loop and re-invokes the script after each user reply. Matches §2.2's "scripts handle deterministic I/O, agent invocations stay in the command file."
4. **Distiller execute mode** (§3.1, Phase C): distill mode does Pass A as plan-only, then Pass B with `execute: true`. The agent does both passes itself with `Write`/`Edit` tools — no shell.
5. **Word-count validator** (§3.1, Phase A): strip frontmatter and Decision Log section before counting. Simple whitespace tokenizer.

## 6. Out of Scope

- Mirroring to `gemini/.gemini/` — separate follow-up.
- User-facing documentation in `user-docs/` — defer; command files self-document.
- Tests for the TS scripts — verification is the smoke tests in Phase F.
- Migration of existing repos' briefs to the new template — §9.5 says existing briefs continue to work via grep fallback.
