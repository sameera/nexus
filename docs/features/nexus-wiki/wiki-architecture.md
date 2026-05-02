## 1. System Overview

Nexus Wiki is a concept-graph layer that sits beside the existing `docs/` tree and accretes automatically as features ship. It has four cooperating components and changes the shape of three existing ones.

### 1.1 Components

| #   | Component                                             | Type                                                            | Trigger                                        |
| --- | ----------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `/nxs.bootstrap-concepts`                             | New command + TS scripts                                        | One-time, on adopting Wiki in an existing repo |
| 2   | `nxs-distiller` agent + integration into `/nxs.close` | New agent + edits to existing command                           | Every epic close                               |
| 3   | Agent integration (concept loading protocol)          | Edits to `nxs-architect`, `nxs-decomposer`, `nxs-dev`, `nxs-pm` | Every architect/decomposer/dev/PM invocation   |
| 4   | Feature brief integration                             | New brief template + edits to `/nxs.epic`                       | Every new epic                                 |

All four share one storage substrate: `docs/system/concepts/`. All retrieval is `Read | Grep | Glob` over markdown.

### 1.2 Data flow at steady state

```
PM writes brief (with `concepts:` frontmatter)
   │
   ▼
/nxs.epic ── reads concept index + listed concepts ──► validates user stories vs. invariants
   │
   ▼
/nxs.hld ── architect reads concepts ──► HLD respects invariants
   │
   ▼
/nxs.tasks ── decomposer reads concepts ──► tasks respect invariants
   │
   ▼
/nxs.dev ── dev reads concepts ──► implementation respects behavioral contracts
   │
   ▼
/nxs.close ── PIR generated ──► nxs-distiller authors/updates concept pages ──► commit
```

### 1.3 Authority order (when sources disagree)

1. **Source code** — the truth of what the system actually does.
2. **Concept page** — the curated, agent-readable contract.
3. **PIR / HLD / brief** — point-in-time artefacts, drift over months.

Distill closes the gap from (3) → (2). Verification closes the gap from (2) → (1). Bootstrap does both at once.

### 1.4 What this is not

- **Not RAG.** No embeddings, no vector store, no chunker. Grep over titled files.
- **Not a doc site.** Concept pages are agent retrieval targets sized for ≤500 words, not human reading sessions.
- **Not a gate.** Concept pages enhance agents but the pipeline runs without them. Adoption is incremental (§9).

---

## 2. Bootstrap Command Architecture

`/nxs.bootstrap-concepts` is the one-time, repo-scoped command that derives an initial concept graph from existing feature briefs and HLDs.

### 2.1 Why a multi-script command, not a single agent invocation

A single agent invocation cannot hold every brief and HLD in a repo with 50–100 features in one context. We use the same pattern that `/nxs.tasks` uses for per-task LLD generation: **command file orchestrates, TS scripts handle deterministic I/O, agent invocations handle the cognitive work, one document at a time.**

### 2.2 File layout

```
.claude/
├── commands/
│   └── nxs.bootstrap-concepts.md         # orchestration command
└── skills/
    └── nxs-bootstrap-concepts/
        └── scripts/
            ├── scan-sources.ts            # phase 0: enumerate briefs + HLDs
            ├── extract-candidates.ts      # phase 1: per-doc candidate parsing
            ├── cluster-candidates.ts      # phase 1: dedup/merge clustering
            ├── render-checkpoint.ts       # phase 1: human review surface
            ├── plan-generation.ts         # phase 2: build per-concept input bundles
            ├── plan-verification.ts       # phase 3: build per-concept code surface
            ├── update-index.ts            # phase 3: write/update concepts/README.md
            └── lib/
                ├── frontmatter.ts         # YAML read/write helpers
                ├── concept-schema.ts      # types + validators
                ├── grep.ts                # ripgrep wrapper
                └── path-utils.ts          # repo-relative paths
```

All scripts execute via `tsx`. Each emits structured JSON to stdout for the command to consume. None of them call agents directly — agent invocations stay in the command file.

### 2.3 Three phases

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 0: SCAN  (scripted)                                           │
│   scan-sources.ts → list of briefs + HLDs in chronological order    │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────┐
│ PHASE 1: DISCOVERY  (per-doc agent invocation, then scripted merge) │
│   for each source doc:                                              │
│     extract-candidates → invoke nxs-distiller (discovery mode)      │
│   cluster-candidates.ts → dedup + merge                             │
│   ──── HUMAN CHECKPOINT (boundary review) ────                      │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────┐
│ PHASE 2: GENERATION  (per-concept agent invocation)                 │
│   for each approved concept:                                        │
│     plan-generation → invoke nxs-distiller (authoring mode)         │
│     write draft concept page                                        │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────┐
│ PHASE 3: VERIFICATION  (per-concept agent invocation)               │
│   for each draft concept:                                           │
│     plan-verification → identify code surface                       │
│     invoke nxs-distiller (verification mode)                        │
│     overwrite draft with verified page                              │
│   update-index.ts → write concepts/README.md                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 Phase 0 — Scan

`scan-sources.ts` produces the work list:

```ts
type SourceDoc = {
    path: string; // repo-relative path
    type: "brief" | "hld";
    feature: string; // from frontmatter or directory
    epic?: string; // for HLDs
    issue?: string; // GitHub issue, if linked
    chronOrder: number; // earliest = 0; ties broken by path
    bytes: number;
};
```

Chronological order is derived in this priority:

1. `git log --diff-filter=A --format=%cI -- <path>` — file-creation time.
2. Frontmatter `created` field if present.
3. Lexical path order (deterministic fallback).

This order is **load-bearing in Phase 2**: when two source docs disagree on the same concept, the _later_ doc wins (subsystems evolve).

### 2.5 Phase 1 — Discovery

#### Per-doc extraction

For each source doc, the command invokes the distiller (discovery mode) with **only that one document plus the running concept index** as context. The distiller returns a JSON envelope:

```json
{
    "doc": "docs/features/tagging/README.md",
    "candidates": [
        {
            "canonical_name": "tagging",
            "aliases": ["tag system", "tags"],
            "summary": "Lets users attach short labels to blocks for retrieval and filtering.",
            "evidence": [
                "Quote 1 from the doc that establishes this concept",
                "Quote 2 ..."
            ],
            "touches": ["blocks", "search"]
        }
    ]
}
```

Token budget per invocation:

| Bucket                    | Tokens   | Notes                                            |
| ------------------------- | -------- | ------------------------------------------------ |
| System prompt (distiller) | ~2.5K    | Static                                           |
| One source doc            | ≤6K      | Briefs ~1–2K, HLDs ~3–8K; if larger, chunk by H2 |
| Running index summary     | ≤1K      | Just names + summaries, not full pages           |
| Output                    | ≤2K      | Bounded by candidate cap (≤10/doc)               |
| **Total per call**        | **~12K** | Well under any model's context                   |

For a repo with 100 source docs, this is 100 sequential calls. The command file emits a progress line per doc and persists the JSON envelopes to `.tmp/bootstrap/candidates/<doc-slug>.json` so the run is **resumable** — see §10.5.

#### Clustering

`cluster-candidates.ts` reads every envelope and merges candidates that refer to the same concept:

```
Two candidates A and B are the same concept if:
  - A.canonical_name == B.canonical_name (case/whitespace-insensitive), OR
  - A.canonical_name appears in B.aliases (or vice versa), OR
  - A.aliases ∩ B.aliases ≠ ∅

The merged record:
  - canonical_name = the most-cited name (tie → shortest)
  - aliases = union of all names ∪ aliases minus the canonical
  - touches = union
  - source_docs = union (with chronOrder preserved)
  - evidence = top-3 quotes per source (truncate the long tail)
```

Output: `.tmp/bootstrap/concepts.draft.json`.

#### Human checkpoint (boundary review)

The command renders a concise table to the user — **not the full envelopes** — and stops:

```
CHECKPOINT: Concept Boundary Review

Discovered N candidate concepts from M source documents.

| # | Concept | Aliases | Touches | Sources | Action |
|---|---------|---------|---------|---------|--------|
| 1 | tagging | tag system, tags | blocks, search | 4 docs | keep |
| 2 | tag-inheritance | inherited tags | tagging, blocks | 1 doc  | keep |
| 3 | search | full-text search | blocks, tagging | 2 docs | keep |
...

Suggested edits (none required):
  - merge <a> <b>            : combine two candidates
  - split <name> into x, y    : split one candidate
  - drop <name>               : remove (noise / not a concept)
  - rename <old> -> <new>     : change canonical name

Reply 'continue' to accept, or list edits one per line followed by 'continue'.
```

Edits are applied by the command (via in-memory mutation of the JSON), the table is re-rendered, and the loop repeats until the user replies a bare `continue`.

### 2.6 Phase 2 — Generation

For each approved concept, the command:

1. Calls `plan-generation.ts` to assemble the **per-concept input bundle**:
    - The full text of the source docs that mention this concept (deduplicated by path).
    - The running concept index (names + summaries only, for cross-linking).
    - The concept's clustered metadata (aliases, touches, evidence).

2. Invokes `nxs-distiller` in **authoring mode** with that bundle.

3. Writes the returned markdown to `docs/system/concepts/<canonical-name>.md`.

Conflict resolution between source docs is delegated to the distiller, but the input bundle annotates each source with its `chronOrder` and the agent's prompt enforces _"later doc wins on conflicting behavioral statements; record the earlier statement in the Decision Log only if it explains the change"_.

Token budget per concept: input bundle is bounded at ~15K (typically 2–4 source docs at a few thousand tokens each, plus the index summary). Output is bounded at 700 words by the schema. A repo with 80 concepts produces 80 sequential calls.

### 2.7 Phase 3 — Verification

Drafts derived from product documents will be wrong about implementation details — they describe intent, not behavior. Phase 3 reads code and corrects each draft.

#### Identifying the code surface for a concept

`plan-verification.ts` builds a small (≤10 file) **code surface** per concept:

```
Source A — file paths in the source docs:
    grep '`[^`]+\.(ts|tsx|sql|py)`' across the concept's source documents
    keep paths that exist in the repo

Source B — name + alias greps over code:
    rg --files-with-matches "<canonical-name>|<alias-1>|<alias-2>" \
       -t ts -t tsx -t sql -t py -t md \
       -g '!docs/**' -g '!**/*.test.*'

Source C — touches → directory hints:
    each "touches" entry is a concept that may already have a code surface
    follow links to fold a small number of related files in

Result = top 10 files ranked by:
    1) inclusion in Source A (cited by humans is highest signal)
    2) match count from Source B
    3) brevity (prefer entry-point files over giant aggregates)
```

If the resulting set has fewer than 3 files, the concept is flagged as **"low code coverage"** and the verification call adds a frontmatter field `verification: low-coverage` so future maintainers know the page leans on documented intent more than confirmed behavior.

#### Verification call

The distiller is re-invoked in **verification mode** with:

- The draft concept page.
- The code surface (each file read in full, capped at ~30K tokens combined; if a file is huge the agent reads only the symbols matching the concept name).
- A short directive: _"Where the draft says X but the code shows Y, rewrite to reflect Y. Where you correct a behavioral claim, append a Decision Log entry titled 'Bootstrap correction (verification)'."_

Output: the final concept page, written over the draft.

### 2.8 Index update

After all concepts are verified, `update-index.ts` writes `docs/system/concepts/README.md` from scratch. It reads every `*.md` in the directory, extracts frontmatter, and emits the table format defined in §7.1. The script is **idempotent**: running it again with no concept changes produces a byte-identical file.

### 2.9 Token budget summary (100 source docs, 80 concepts)

| Phase            | Calls   | Approx tokens/call | Total tokens |
| ---------------- | ------- | ------------------ | ------------ |
| 1 — discovery    | 100     | 12K                | 1.2M         |
| 2 — generation   | 80      | 18K                | 1.4M         |
| 3 — verification | 80      | 25K                | 2.0M         |
| **Total**        | **260** | —                  | **~4.6M**    |

This is large but bounded, sequential, resumable, and costs the user nothing once the index is built. By contrast, the steady-state cost per epic close is ~3–6 calls (§3, §4).

### 2.10 Failure modes

| Failure                                                        | Detection                              | Recovery                                                                                   |
| -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Source doc is too large for one call                           | `bytes > 24K` in scan output           | Chunk by H2 sections, run one call per section, merge candidates                           |
| Source doc has no extractable concepts (e.g. an outdated stub) | empty `candidates[]`                   | Log to `.tmp/bootstrap/empty-docs.log`, continue                                           |
| Two concepts collide on canonical name during clustering       | duplicate key in cluster output        | Append a discriminator (`<name>-2`), surface in checkpoint for human rename                |
| Phase 1 or Phase 2 hits a transient agent error                | non-zero exit / unparseable JSON       | Persist the error envelope, the command file retries with backoff up to 3× before stopping |
| User aborts mid-run                                            | resumable artifacts on disk            | Re-running the command resumes from the last completed phase boundary                      |
| Concept page exceeds 500 words                                 | `update-index.ts` validates word count | Emit warning; surfaces in next bootstrap or distill                                        |
| `docs/system/concepts/` already non-empty                      | command's first action                 | Refuse without `--force`; print the path and exit 1                                        |

### 2.11 Refusal / `--force`

```bash
tsx ./.claude/skills/nxs-bootstrap-concepts/scripts/scan-sources.ts --check-empty
# exits 0 if concepts/ is empty or absent; 2 if non-empty
```

The command file checks this as its first step. If `--force` is set, the existing `docs/system/concepts/` is moved to `docs/system/concepts.bak.<timestamp>/` (not deleted) and bootstrap proceeds. The user is told the backup path so they can recover hand-curated content.

### 2.12 Command file (`/nxs.bootstrap-concepts.md`) outline

The command file follows the existing `/nxs.tasks` pattern (see `nxs.tasks.md`). The complete spec is in §10.6; the high-level shape:

```
1. Refusal check (--force handling)
2. Phase 0: scan-sources.ts
3. Phase 1 loop:
     for each source doc → invoke nxs-distiller (discovery) → store JSON
     cluster-candidates.ts
     render-checkpoint.ts → STOP for user input
4. Phase 2 loop:
     for each approved concept → invoke nxs-distiller (authoring) → write draft
5. Phase 3 loop:
     for each draft → plan-verification.ts → invoke nxs-distiller (verification) → overwrite
6. update-index.ts
7. Commit (after one final user confirmation, since this is a large diff)
```

---

## 3. The `nxs-distiller` Agent

The distiller is a single agent operating in three modes depending on its invoker. One agent with three modes (rather than three agents) keeps the cognitive model coherent — the work is always _"reduce these source materials into a structured concept page"_; the inputs and the destructive scope vary.

The complete agent file follows. It is written to match the format of `nxs-analyzer.md` and `nxs-architect.md`.

### 3.1 Agent file: `.claude/agents/nxs-distiller.md`

````markdown
---
name: nxs-distiller
description: Retrospective knowledge synthesizer. Produces and updates concept pages in docs/system/concepts/ from PIRs, HLDs, briefs, and source code. Invoke for: bootstrap concept generation, post-epic concept distillation, surgical concept-page updates.
category: engineering
tools: Read, Grep, Glob, Write, Edit, Bash
model: sonnet
---

# Role

You are a Knowledge Distiller specializing in retrospective synthesis. You convert design artefacts (briefs, HLDs, PIRs) and source code into terse, retrieval-optimized concept pages that other agents will use as their primary context for downstream work.

You are NOT an architect — you do not propose, redesign, or critique. You record what _is_ (or, in authoring mode, what the documents and code together imply _is_). When sources disagree, you record the disagreement; you do not decide who is right unless explicit precedence rules apply.

## Operating Modes

You operate in one of three modes. The invoker tells you which mode in the first line of the prompt: `MODE: discovery | authoring | verification | distill`.

- **discovery**: emit candidate concepts from a single source document
- **authoring**: produce a draft concept page from a bundle of source documents
- **verification**: correct a draft concept page against the source code
- **distill**: post-epic incremental update — read PIR/HLD and decide create/update/no-op per concept

Output schemas differ by mode (§ Output Contracts). All other principles are shared.

## Concept Page Schema

Every concept page you write or update has this exact structure:

```markdown
---
concept: "<canonical-name>"
aliases: ["<alias 1>", "<alias 2>"]
touches: ["<concept-1>", "<concept-2>"]
last_updated_by: "<#issue-number or 'bootstrap'>"
verification: ok | low-coverage | drift # optional
---

# <Display Name>

<2–3 sentence summary — this IS the retrieval target. Lead with the most distinctive sentence. Avoid filler like "this concept describes...". Write it as if it will be returned alone in a grep result.>

## How It Works

<Behavioral description, ≤180 words. WHAT the system does. Avoid file paths, type names, and function names unless they are the canonical user-facing identifier (e.g., a public CLI command). Prefer noun phrases for entities, verb phrases for behaviors. Bullet lists allowed; long prose discouraged.>

## Key Invariants

<≤7 numbered invariants. Each invariant is a single sentence stating a constraint that must hold. Invariants are AUTHORITATIVE — downstream agents will treat them as hard constraints. Be conservative: only list invariants that you can cite from PIR Key Decisions, HLD constraints, or code (not just brief intent).>

## Integration Points

<Bulleted list of other concepts this one interacts with, each with one sentence on the nature of the interaction. Use markdown links to other concept pages: `[<name>](<name>.md)`. The set must equal the `touches:` frontmatter.>

## Decision Log

<Append-only chronological log. Each entry: `### <YYYY-MM-DD> — <#issue> — <Title>` followed by 1–3 sentences. Do not edit prior entries. Do not delete prior entries.>
```
````

**Hard size cap**: 500 words excluding frontmatter and Decision Log. If you exceed it, the page is wrong — split into two concepts or cut prose.

## Input Contracts

### Discovery Mode

| Field                   | Description                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| `MODE`                  | `discovery`                                                            |
| `source_doc_path`       | Single brief or HLD path                                               |
| `running_index_summary` | Names + summaries of concepts already discovered in this bootstrap run |
| `candidate_cap`         | Max candidates to return (default 10)                                  |

### Authoring Mode

| Field                            | Description                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `MODE`                           | `authoring`                                                                   |
| `concept_name`                   | Canonical name                                                                |
| `aliases`, `touches`, `evidence` | From clustered candidate                                                      |
| `source_bundle`                  | Array of `{path, chronOrder, content}` for source docs in chronological order |
| `running_index_summary`          | For cross-linking                                                             |

### Verification Mode

| Field          | Description                                     |
| -------------- | ----------------------------------------------- |
| `MODE`         | `verification`                                  |
| `draft_path`   | Path to the draft concept page                  |
| `code_surface` | Array of `{path, content}` for ≤10 source files |
| `low_coverage` | Boolean — true if code_surface has <3 files     |

### Distill Mode

| Field                 | Description                      |
| --------------------- | -------------------------------- |
| `MODE`                | `distill`                        |
| `pir_path`            | Path to PIR.md (just generated)  |
| `hld_path`            | Path to \*hld.md                 |
| `epic_path`           | Path to \*epic.md                |
| `issue_number`        | Epic issue number                |
| `existing_index_path` | `docs/system/concepts/README.md` |
| `concepts_dir`        | `docs/system/concepts/`          |

## Output Contracts

### Discovery Mode

Return strict JSON only — no preamble:

```json
{
    "candidates": [
        {
            "canonical_name": "kebab-case-name",
            "aliases": ["alias 1", "alias 2"],
            "summary": "≤2 sentences",
            "evidence": ["quote 1 from the doc", "quote 2 from the doc"],
            "touches": ["other-concept-1"]
        }
    ]
}
```

Stop emitting candidates at the cap. Quotes must be verbatim from `source_doc_path`.

### Authoring Mode

Return only the concept page markdown (frontmatter + body). No preamble, no postamble. Caller writes it to disk verbatim.

### Verification Mode

Return only the corrected concept page markdown. If the draft was already accurate, return it unchanged. If you made corrections, append exactly one Decision Log entry titled `Bootstrap correction (verification)` summarizing what you changed.

### Distill Mode

Return strict JSON:

```json
{
    "actions": [
        {
            "action": "create",
            "concept": "concept-name",
            "page_path": "docs/system/concepts/concept-name.md",
            "rationale": "≤1 sentence on why this is a new concept"
        },
        {
            "action": "update",
            "concept": "existing-concept",
            "page_path": "docs/system/concepts/existing-concept.md",
            "fields_changed": [
                "how_it_works",
                "key_invariants",
                "decision_log"
            ],
            "rationale": "≤1 sentence"
        },
        {
            "action": "noop",
            "concept": "incidentally-touched",
            "rationale": "≤1 sentence — touched but no behavioral change"
        },
        {
            "action": "split-suggested",
            "concept": "growing-concept",
            "rationale": "Page exceeds 500 words; suggested split: <a>, <b>",
            "human_review_required": true
        }
    ]
}
```

You do this in two passes (§ Distill Workflow): first emit `actions` as a _plan_, then on user approval, perform the writes. Emitting `human_review_required: true` on any action surfaces it in the close checkpoint.

## Workflow

### Discovery Mode

1. Read `source_doc_path` in full.
2. Identify named subsystems, behaviors, data structures, and rules described in the doc that look like concepts (not implementation details).
3. For each, decide a single canonical name (kebab-case, ≤3 words). Prefer the doc's own term; only invent if the doc is implicit.
4. Cross-check `running_index_summary` — if your candidate matches an existing concept by name or alias, emit it with the existing canonical name (this enables cross-document deduplication).
5. Cap candidates at `candidate_cap`. Pick the most central; do not emit incidental references.
6. Each `evidence` quote must be verbatim and ≤30 words.

### Authoring Mode

1. Read every entry in `source_bundle`. Sort by `chronOrder` ascending.
2. Build the page section by section:
    - **Summary**: one synthesized sentence covering the concept across all sources, plus one sentence on its scope/role in the system.
    - **How It Works**: walk the latest source first; if earlier sources describe behavior the latest source contradicts, prefer the latest. If they only differ in detail, merge.
    - **Key Invariants**: only emit constraints with explicit textual support — phrases like "must", "always", "never", or "Key Decision" headers.
    - **Integration Points**: from `touches`. For each, one sentence describing the interaction; link to `<other>.md`.
    - **Decision Log**: one initial entry — `### <today> — bootstrap — Initial draft`.
3. Validate against the schema (size cap, required sections).

### Verification Mode

1. Read `draft_path` and every file in `code_surface`.
2. For each behavioral claim in the draft's _How It Works_ and each _Key Invariant_:
    - If the code clearly contradicts it → rewrite the claim to match the code.
    - If the code clearly supports it → leave it.
    - If the code is silent or ambiguous → leave the draft claim AND set `verification: low-coverage` if `low_coverage` is true.
3. If you rewrite anything, append one Decision Log entry summarizing the corrections (≤3 bullets).
4. If `low_coverage` is true and you found no contradictions, still set `verification: low-coverage`.
5. Output the corrected page.

### Distill Workflow

This mode runs as part of `/nxs.close`, between PIR generation and issue closure.

#### Pass A — Plan (read-only)

1. Read PIR, HLD, epic, and `existing_index_path`.
2. Build the **changed surface**: from PIR's _Files Changed_ section, the directories and modules touched by this epic.
3. For each entry in the index, decide:
    - **No-op** if the changed surface does not overlap the concept's typical files (use `touches` and prior page's _How It Works_ phrasing for hints — note this is heuristic).
    - **Update** if the changed surface overlaps AND the PIR's _Key Decisions_ or _Implementation Notes_ describe a behavioral change.
    - **Update (decision-log only)** if the surface overlaps but the changes are mechanical (refactors, perf, no behavior change). The decision log gets one entry; _How It Works_ and _Key Invariants_ are unchanged.
4. From PIR's _Key Decisions_ and _Files Changed_, identify any **new** subsystem boundaries that don't match an existing concept → propose `create`.
5. If an existing concept's update would push it past 500 words, propose `split-suggested` instead of `update`.
6. Return the action plan. Do NOT write any files yet.

#### Pass B — Execute (after user approval)

For each action:

- **create**: read the relevant subset of source files (use the same code-surface heuristic as bootstrap verification); author and write the page. Frontmatter `last_updated_by` = `"#<issue-number>"`.
- **update (with body changes)**: read the existing page. Read code in the changed surface. Produce a surgical diff:
    - _Summary_: rewrite if the concept's central behavior changed; otherwise leave.
    - _How It Works_: edit only the affected paragraphs.
    - _Key Invariants_: add new ones; never silently delete an existing one — if an invariant is now false, mark it `~~struck through~~` and add a Decision Log entry titled `Invariant retired (#<issue>)`.
    - _Integration Points_: union (add new touches; do not remove unless an integration was actually severed).
    - _Decision Log_: append one entry titled `### <YYYY-MM-DD> — #<issue> — <epic title>`. Body: 1–3 sentences synthesizing the _Key Decisions_ relevant to this concept.
    - Update `last_updated_by` to `"#<issue-number>"`.
    - Update `touches` frontmatter to match Integration Points.
- **update (decision-log only)**: append a single Decision Log entry. Touch nothing else except `last_updated_by`.
- **noop**: do nothing.
- **split-suggested**: do nothing automatically; the action surfaces in the close checkpoint and the user decides.

After all writes, call `update-index.ts` (the invoker handles this — you don't shell out to it).

## Operating Principles

### Author for retrieval, not reading

Every word of a concept page is fighting for context-window space. Write so that the _Summary_ alone is enough for an agent to decide whether to load the rest. Avoid:

- Marketing prose ("powerful", "flexible", "robust")
- Restating the concept name ("The org-resolution concept resolves orgs...")
- Describing what other concepts do — link to them instead
- Implementation tutorials

### Treat invariants like contracts

A _Key Invariant_ is something downstream agents will refuse to violate. False or speculative invariants poison every future epic. Be ruthlessly conservative: if a constraint isn't stated in a Key Decisions table or written into code as an assertion/check, don't emit it.

### Decision log is forever

Never edit, reorder, or delete prior Decision Log entries. Future readers reconstruct the _why_ from this log. If a decision was reversed, append a new entry stating the reversal.

### Surgical updates

In distill (update) mode, change exactly the prose that needs to change. Do not rewrite paragraphs for "style". Do not normalize terminology unless the new epic explicitly renamed something. Diff hygiene is a feature: a clean PR diff is what makes a concept page reviewable.

### Refuse to bloat

If you cannot fit the concept in 500 words, the concept is too broad. In _authoring_ mode, return the page anyway, but emit `verification: drift` in frontmatter and add a Decision Log entry flagging the size. In _distill (update)_ mode, emit `split-suggested`.

### Trust code over docs

In verification mode, the code is the truth. In distill mode, the PIR is _more_ trusted than the HLD (HLDs describe intent at design time; PIRs describe outcome). When PIR and HLD disagree, prefer the PIR.

### No code in concept pages

Concept pages contain no code blocks longer than a single inline span. Implementation details belong in `docs/system/standards/` or in source comments — not here.

## Communication Style

You return artefacts, not commentary. In authoring/verification mode you return only the markdown page. In discovery/distill mode you return only the JSON envelope. The invoking command relays summaries to the user; you do not write to the user directly.

```

### 3.2 Why this agent and not the architect

The distiller is intentionally narrow. The architect's job is forward-looking design under uncertainty: it considers alternatives, weighs trade-offs, pushes back on assumptions. The distiller's job is **retrospective compression**: what *did* happen, in 500 words, indexed for grep. The two cognitive modes interfere with each other — an architect-as-distiller will smuggle in design opinions; a distiller-as-architect will under-design.

Equally important: the distiller is the only agent that **writes to `docs/system/concepts/`**. Keeping write access narrow means we can audit who changed what, and a misbehaving architect can't drift the concept graph.

---

## 4. Modifications to `/nxs.close`

The wiki step is mandatory and non-skippable. It runs between PIR generation and the destructive operations (issue close, tasks/ deletion). If distill fails, the close aborts before destruction — the PIR is preserved and the user can re-run.

### 4.1 Workflow diff

Today:

```

1. Validate epic state
2. Load task files
3. Generate PIR
4. Update epic's Related Documents section
5. CHECKPOINT (y/n/r)
6. Post PIR comment + close GitHub issue
7. Delete tasks/ subfolder
8. Report completion

```

After:

```

1. Validate epic state
2. Load task files
3. Generate PIR
4. Update epic's Related Documents section
   4.5 ── DISTILL CONCEPTS (NEW) ────────────────────────────
   4.5.a Invoke nxs-distiller in distill mode (Pass A — plan only)
   4.5.b Render distill plan in the existing checkpoint
5. CHECKPOINT (y/n/r) — now also lists concept actions
6. (post-confirm) Distiller Pass B — write/update concept pages
   update-index.ts
   git add docs/system/concepts/
7. Post PIR comment + close GitHub issue
8. Delete tasks/ subfolder
9. Report completion (now includes "concept pages updated")

```

### 4.2 Step 4.5 — Distill (Pass A: plan)

Inserted between current Step 4 ("Update Epic's Related Documents Section") and current Step 5 ("Confirmation Checkpoint").

```

## 4.5 Distill Concepts (Plan)

Invoke the `nxs-distiller` agent in distill mode:

    Invoke: nxs-distiller
    Mode: distill
    Inputs:
      - pir_path: {epic-directory}/PIR.md
      - hld_path: {epic-directory}/{issue}-hld.md
      - epic_path: {epic-directory}/{issue}-epic.md
      - issue_number: {issue}
      - existing_index_path: docs/system/concepts/README.md
      - concepts_dir: docs/system/concepts/

The distiller returns an action plan (JSON, see § Output Contracts).

If `docs/system/concepts/` does not exist, log:
"No concept graph present — skipping distillation. Run /nxs.bootstrap-concepts to seed."
and continue without distillation.

Store the action plan for the next step.

```

### 4.3 Step 5 — Modified checkpoint

The existing checkpoint surface gains a Concept Actions block:

```

CHECKPOINT: Epic Closure

I'm about to close epic "{Epic Title}" (#{issue-number}).

Actions to be performed:

1. PIR.md generated at `{epic-directory}/PIR.md`
2. `*epic.md` updated with PIR link in Related Documents
3. Apply N concept-graph changes:
   create org-resolution (new concept from this epic)
   update tagging (behavior + decision log)
   update search (decision log only)
   noop blocks (touched, no behavior change)
   SUGGEST permissions → split (page would exceed 500w; needs review)
4. Post PIR comment on GitHub issue #{issue-number}
5. Close GitHub issue #{issue-number}
6. Delete `{epic-directory}/tasks/` folder ({N} files)

Files to be deleted:
{...}

Reply:
y - close the epic and apply concept changes
n - abort
r - review PIR.md, then re-confirm
c - review concept-action plan in detail, then re-confirm
s - close the epic but SKIP concept changes

```

`s` is intentional: it lets a user ship a hot-fix epic without engaging the wiki when the distill plan looks wrong. The user can later run `/nxs.distill-epic <issue>` to retry just the wiki step (§4.6).

`SUGGEST` actions are surfaced but not automatically applied — they require a human to author the split (§10.3).

### 4.4 Step 6 — Distill Pass B + commit

After `y` or `s`:

```

## 6. Apply Concept Changes (skipped if user replied `s`)

For each non-noop, non-SUGGEST action in the plan:

1. Re-invoke nxs-distiller in distill mode with the stored plan and `execute: true`
   (the agent performs the writes per § Distill Workflow Pass B)

2. Run update-index.ts:

    tsx ./.claude/skills/nxs-distiller/scripts/update-index.ts

3. Stage concept changes:

    git add docs/system/concepts/

The concept changes are NOT committed yet — they go into the same commit as
PIR + epic update at the end of Step 9.

```

### 4.5 Step 9 — Single commit

Today, `/nxs.close` does not commit anything itself (PIR/epic are pushed via `gh issue comment`, not git). After this change, we commit PIR + epic + concepts atomically:

```

## 9. Commit Documentation

git add {epic-directory}/PIR.md {epic-directory}/{issue}-epic.md
[ git add docs/system/concepts/ if distill ran ]

git commit -m "docs: close epic #{issue} — {epic title}

- PIR generated
- Concept changes: {summary line, e.g. 'create org-resolution; update tagging, search'}"

```

This guarantees the concept graph and the PIR that produced it land in the same commit — so a future reader can `git log docs/system/concepts/<concept>.md` and reach the originating epic in one hop.

### 4.6 New companion command: `/nxs.distill-epic`

For the `s` exit and for back-filling concepts on a closed epic:

```

/nxs.distill-epic <issue-number-or-PIR-path>

````

Same workflow as `/nxs.close` Steps 4.5–6 + a commit, without touching the GitHub issue or the tasks folder. This lets users iteratively curate the concept graph without paying the close cost.

### 4.7 Failure handling

| Failure point | Behavior |
|---------------|----------|
| Distiller Pass A errors | Abort close before checkpoint. PIR is preserved on disk. Print the error and a "re-run" hint. |
| Distiller Pass B errors midway | The atomic commit in Step 9 has not happened yet. Reset staged concepts (`git restore --staged docs/system/concepts/`), restore concept files from HEAD (`git checkout -- docs/system/concepts/`), abort. Issue stays open. |
| `update-index.ts` errors | Treat as Pass B failure. |
| User replies `s` | Skip 4.5/6 and proceed to issue close. PIR and epic still commit. Print: "Concept distillation skipped. Run /nxs.distill-epic #{issue} to back-fill." |

---

## 5. Agent Integration (Concept Loading Protocol)

Each consuming agent gains a single new step at the start of its workflow: **Load Concepts**. The step is identical in shape across agents but feeds different downstream work.

### 5.1 The shared load step

Inserted as the first step after each agent's existing context-gathering phase (`Standards & Conformance` for the architect; standards loading for nxs-dev; etc.).

```markdown
## Step 0: Load Concepts (if present)

If `docs/system/concepts/README.md` exists:

1. Read `docs/system/concepts/README.md` — this is the concept index, ≤200 lines.

2. Identify relevant concepts using this priority order:

   a. **Explicit list**: If the input artefact (feature brief / epic / HLD / task)
      has a `concepts:` field in frontmatter, treat that list as authoritative.

   b. **Grep fallback**: Otherwise, grep the input artefact for each concept's
      name and aliases:

          rg -l '<name>|<alias-1>|<alias-2>' <input-artefact>

      Treat any match as relevant. Cap at 8 concepts; if more match, prefer
      those that appear in the artefact's title or H1 sections.

3. Read each relevant concept page in full.

4. Treat **Key Invariants** as authoritative constraints for this run. If your
   downstream output would violate an invariant, you MUST either:

   - Reframe the output to honor the invariant, OR
   - Surface a "concept invariant conflict" entry to the user (§ Invariant
     Conflict Protocol below) — do not silently override.

If `docs/system/concepts/README.md` does NOT exist, skip this step entirely.
The wiki is optional infrastructure; agents must work without it.
````

### 5.2 Per-agent specifics

#### nxs-architect

Load concepts **before** Step 3 (`Standards & Conformance Pass`). Treat invariants as part of the standards conformance check — i.e., a recommendation that violates an invariant is a conformance failure.

In **LLD-elaboration mode** (invoked from `/nxs.tasks`): the concepts referenced in the HLD's `concepts:` frontmatter are loaded once at the start and reused across all tasks of that epic — they don't reload per task.

#### nxs-decomposer

Load concepts as **Step 0** of the existing _Scope Validation_ phase. Add a new check to the scope-validation rules:

> 5. **Concept invariants honored**: For each task, verify that its scope does not require violating a Key Invariant of any loaded concept. If it would, flag in `scope_validation.invariant_conflicts[]` and let the orchestrating command escalate.

Add the field:

```json
"scope_validation": {
    "out_of_scope_violations": [],
    "terminology_deviations": [...],
    "constraint_violations": [],
    "invariant_conflicts": [
        {"task_sequence": 3, "concept": "org-resolution", "invariant_index": 2, "summary": "..."}
    ]
}
```

The orchestrating `/nxs.tasks` command then surfaces these in the Review Checkpoint (Step 7) at severity HIGH.

#### nxs-dev

Load concepts after Pre-Flight Check `2. Standards Loading`. The dev agent has the strongest concept duty: behavioral implementations live in code, and the dev is the agent most likely to silently violate an invariant by writing the wrong test.

Specifically:

- During _Phase 1: Understand & Plan_, list which concepts cover the work and call them out in the implementation plan.
- During _Phase 2: Implement_, when writing tests, prefer test names that reference the invariant being protected (e.g. `it("preserves org-resolution invariant 2: lookups are case-insensitive")`).
- If the implementation plan would require violating an invariant, raise the _Invariant Conflict Protocol_ (§5.4) **before** writing any code.

#### nxs-pm

In **standalone mode**, load concepts after `Always Read` (alongside `docs/product/context.md`). PMs use concepts to:

- Avoid restating mechanics already captured ("see [tagging](./tagging.md) for current behavior").
- Discover constraints that should bound the brief (e.g., "the org-resolution concept's invariants imply X — does this brief contradict that?").

In **council mode**, load only when the question references existing system behavior. Council answers should not load 8 concept pages just to give a strategic perspective.

### 5.3 How agents pick relevant concepts

The two-tier strategy (explicit `concepts:` field → grep fallback) keeps the common case cheap and the uncommon case correct.

| Input artefact | Source of relevance                                                                           |
| -------------- | --------------------------------------------------------------------------------------------- |
| Feature brief  | `concepts:` frontmatter (PM curates)                                                          |
| Epic           | `concepts:` inherited from brief; epic command propagates                                     |
| HLD            | `concepts:` inherited from epic; architect may add concepts encountered while writing the HLD |
| Task           | inherited from HLD's `concepts:`                                                              |

PMs can omit the `concepts:` field; the grep fallback still catches the common cases. But the more concepts are surfaced explicitly, the cheaper retrieval gets.

### 5.4 Invariant Conflict Protocol

When an agent's intended output would violate a concept's Key Invariant, it must surface a conflict entry rather than silently overriding. The shape (in any agent's user-visible output):

```
⚠️ CONCEPT INVARIANT CONFLICT

Concept: org-resolution
Invariant 2: "Org IDs are 32-character lowercase hex without hyphens."

Proposed change would: accept hyphenated UUIDs in the create-org endpoint.

This invariant was set in: #87 (PIR.md, 2026-02-14)

Resolution required (one of):
   1. Reframe the change to honor the invariant
   2. Mark this as a deliberate architectural change → /nxs.distill-epic will
      record an "Invariant retired" entry in the concept's Decision Log
   3. Drop this requirement
```

The agent does **not** edit the concept page itself — that is reserved for the distiller during epic close. The conflict is recorded in the relevant artefact (HLD risk section, task review, or PR description) and the human resolves it.

### 5.5 Stale or inaccurate concept pages

If an agent reads a concept page and observes evidence (from code or recent PIRs) that the page is stale, it appends a `staleness:` entry to its output but does **not** edit the page. Pages are only mutated by the distiller. Persistent staleness is detected by `nxs-analyzer` (§10.4) and surfaced as a finding.

### 5.6 Existing-agent prompt diffs

Concrete additions, by agent file:

#### nxs-architect.md

Insert a new `### Step 2.5: Load Concepts (if present)` after Step 2 (Architectural Context Analysis) and before Step 3. Body identical to §5.1.

In `### Standards Conformance` block, add:

> - Recommendation honors all loaded concept Key Invariants

In `### Direct Mode (Default)` and `### LLD Elaboration Mode` workflow sections, prepend:

> Load concepts (§ Step 2.5) before any analysis or elaboration.

#### nxs-decomposer.md

Insert a new subsection in `## Scope Validation (MANDATORY)` titled `### 0. Load Concept Constraints` containing the Step 0 body and the new validation rule.

Update the JSON output schema to include `invariant_conflicts: []`.

#### nxs-dev.md

Insert `## 4. Concept Loading` in `# Pre-Flight Checks` after `## 3. Stack Familiarization`. Body identical to §5.1 plus the dev-specific bullets in §5.2.

In `## Phase 1: Understand & Plan`, add bullet 4: "Identify which loaded concepts cover this work; list them in the plan".

#### nxs-pm.md

In `## Always Read (Both Modes)`, add bullet 3: "Concept index at `docs/system/concepts/README.md` (if present)". Add a `## Concept Loading` subsection identical to §5.1.

---

## 6. Feature Brief Integration

### 6.1 Updated brief template

Today's briefs typically include "Current Behavior" and "Technical Context" sections that re-state things already captured in code. Those sections are **removed**. The brief becomes:

```markdown
---
feature: "<Feature Name>"
created: <YYYY-MM-DD>
concepts: ["existing-concept-1", "existing-concept-2"]
---

# Feature Brief: <Feature Name>

## Problem

<What user pain are we solving? 2–4 sentences. Concrete, observable.>

## Desired Outcome

<What does success look like for the user? Not the spec — the outcome.>

## Success Criteria

<Bulleted, measurable. Each item is independently verifiable.>

- ...
- ...

## Scope Boundaries

<What this feature includes; what it explicitly does not.>

**In scope:**

- ...

**Out of scope:**

- ...

## Open Questions

<Up to 3 [NEEDS CLARIFICATION] items the PM has not yet decided.>
```

`concepts:` is the most important new field. PMs populate it by reading `docs/system/concepts/README.md` and listing every concept the brief depends on or extends. The list is _forward-declarative_: it describes **the agents' reading list**, not what the brief is about.

### 6.2 `/nxs.epic` modifications

Today's `/nxs.epic` workflow (paraphrased):

1. Locate Feature README + validate
2. Right-Size assessment via nxs-decomposer
3. Generate epic folder name
4. Create epic dir
5. Handle external plan files
6. Parse capability description
7. Write Epic doc
8. Story decomposition
9. Quality validation
10. Handle clarifications
11. Confirmation checkpoint
12. Create GitHub issue
13. Commit
14. Report

Inserted modifications:

#### Step 1.5 — Load Concepts (new)

After validating the brief, before right-sizing:

```
1.5 Load Concepts

a. Read brief frontmatter `concepts:` list.
b. Validate each listed concept exists in docs/system/concepts/README.md.
   - If a listed concept does NOT exist, surface to user:

         CONCEPT NOT FOUND: '<name>'
         The brief references a concept that does not exist in
         docs/system/concepts/.
         Options:
            1) The concept is already covered under a different name —
               replace the brief's `concepts:` entry. Suggested matches:
                  - <fuzzy-match-1>
                  - <fuzzy-match-2>
            2) This is a NEW concept that this epic will create. The brief
               is fine; the concept will be authored by /nxs.close after
               implementation.
            3) Remove the entry from the brief.

         Reply with 1 (replace), 2 (accept), or 3 (remove).

c. Read each existing concept page in full.
d. Make the loaded concepts available to subsequent steps.
```

Step 1.5 is `--no-wiki`-skippable (see Migration, §9). If the wiki is absent, log "no concept graph found, skipping concept loading" and continue.

#### Step 6.5 — Story-Invariant Validation (new)

After story decomposition (Step 8 in the existing flow, but conceptually after stories are drafted in Step 6):

```
6.5 Story-Invariant Validation

For each generated User Story, check it against every Key Invariant of every
loaded concept. Use grep + semantic comparison:

    For each story.acceptance_criteria entry:
        For each concept.invariants entry:
            Does the criterion describe behavior that contradicts the invariant?

If any contradiction is found, surface as Open Question:

    OPEN QUESTION (concept invariant conflict)
    Story: "<story title>"
    Acceptance criterion: "<criterion>"
    Conflicts with concept '<concept>' Key Invariant <N>:
        "<invariant text>"

    Options for the brief author:
       (a) Adjust the story to honor the invariant
       (b) Mark this as a deliberate change — the invariant will be retired
           when the epic closes
       (c) Drop the story

The conflict is recorded as an Open Question in the epic doc, NOT auto-resolved.
```

This is the gate the user wanted: stories that would silently violate an invariant get caught at brief-to-epic time, when the cheapest correction is possible.

#### Step 7 — Epic doc inherits `concepts:`

Add `concepts:` to the epic frontmatter, copied from the brief plus any new concepts hinted at by the right-sizing analysis.

```yaml
---
feature: "..."
epic: "..."
concepts: ["org-resolution", "tagging"]
...
---
```

### 6.3 PM concept-discovery flow

PMs do not memorize the concept catalog. They use one of:

1. **`/nxs.list-concepts`** — a tiny new helper command that prints the concept index and a relevance ranking against an open brief:
    ```
    /nxs.list-concepts
    Reads:
      - docs/system/concepts/README.md
      - the open brief (if any) from editor context
    Output: top-15 concepts ranked by name/alias hits in the brief, plus any concept
    whose `touches:` overlaps the brief's content.
    ```
2. **At brief-write time**: open `docs/system/concepts/README.md` directly. Index is one screen.

The PM does not have to be exhaustive in the `concepts:` field — `/nxs.epic` Step 1.5 + Step 6.5 catches missing references via the grep fallback (§5.3) and via story-invariant validation that does not require the concept to be listed.

---

## 7. Concept Page Lifecycle

A concept page has four lifecycle states:

```
        ┌────────────┐
        │  proposed  │  (brief lists `concepts:` referring to a name not yet on disk)
        └─────┬──────┘
              │
              ▼ /nxs.close  →  distiller plan: "create"
        ┌────────────┐
        │   active   │
        └─────┬──────┘
              │
              ├─── /nxs.close (touches subsystem) ───►  surgical update
              │
              ├─── /nxs.close (mechanical change) ───►  decision-log entry only
              │
              ├─── invariant retired ───►  invariant struck through, log entry
              │
              ▼ /nxs.close  →  distiller plan: "split-suggested" (after >500w)
        ┌────────────┐
        │   split    │  ← human action; see §10.3
        └─────┬──────┘
              │
              ▼ subsystem deprecated/removed
        ┌────────────┐
        │ deprecated │  ← concept page is moved to docs/system/concepts/_archive/
        └────────────┘                       and removed from the index
```

### 7.1 Index format (canonical)

`docs/system/concepts/README.md`:

```markdown
# Concept Index

This index is generated by `update-index.ts`. Do not hand-edit — your changes
will be overwritten on the next /nxs.close. Edit the individual concept pages
instead; the index is rebuilt from their frontmatter.

| Concept                             | Aliases                           | Touches        | Last Updated |
| ----------------------------------- | --------------------------------- | -------------- | ------------ |
| [org-resolution](org-resolution.md) | organization lookup, org matching | auth, session  | #42          |
| [tagging](tagging.md)               | tag system, tags                  | blocks, search | #87          |

...

**Total concepts:** N
**Last regenerated:** YYYY-MM-DD by /nxs.close
```

The index is alphabetically sorted by `concept`. The `Last Updated` column links to the GitHub issue (e.g., `[#42](https://github.com/<org>/<repo>/issues/42)`) — this is the concept's "git blame at the page level".

### 7.2 Birth via bootstrap

§2.6–2.7. Frontmatter on a bootstrap-born page:

```yaml
---
concept: "org-resolution"
aliases: ["organization lookup", "org matching"]
touches: ["auth", "session"]
last_updated_by: "bootstrap"
verification: ok # or low-coverage / drift
---
```

Decision Log seed entry: `### YYYY-MM-DD — bootstrap — Initial draft`.

### 7.3 Birth via distill (`create` action)

A concept can also be born during epic close — when an epic introduces a wholly new subsystem. The page is authored from the PIR + HLD + new code surface (same heuristic as bootstrap verification), and `last_updated_by` is `"#<issue>"`.

### 7.4 Update via distill

§3.1 _Distill Workflow Pass B_. Surgical, append-only on the Decision Log.

### 7.5 Manual edits

Hand-curating concept pages is allowed and expected — the concept graph is shared property. Hand edits are detected by the distiller via `last_updated_by`:

- If `last_updated_by` does not match the form `#\d+|bootstrap`, treat it as a hand edit (e.g., `last_updated_by: "manual"` or `last_updated_by: "@sameera"`).
- The distiller still performs surgical updates; it does not revert hand edits. Hand edits to _Decision Log_ entries are forbidden by convention but not enforced — append-only is documented in the page header (a hidden HTML comment included by `update-index.ts` on first generation).

### 7.6 Death — archival

When a subsystem is removed:

1. The closing epic's PIR notes the deprecation in _Future Considerations_ and _Implementation Notes_.
2. The distiller proposes action `archive` (a fifth action type beyond create/update/noop/split-suggested):

    ```json
    {
        "action": "archive",
        "concept": "old-thing",
        "rationale": "subsystem removed in #112"
    }
    ```

3. On user approval at the close checkpoint, the page is moved to `docs/system/concepts/_archive/<concept>.md`. A small frontmatter field `archived_in: "#112"` is added; the body is preserved.
4. `update-index.ts` excludes `_archive/` from the main index but emits a small "Archived concepts" footer with links.

The archive is searchable but agents do not load archived pages by default. They surface only when an agent greps the archive directory explicitly (rare).

---

## 8. File System Layout

Complete view of new and modified artefacts:

```
docs/
├── product/
│   └── context.md                              [unchanged]
├── features/
│   ├── README.md
│   └── <feature>/
│       ├── README.md                           [TEMPLATE CHANGED — §6.1]
│       └── <issue>-<epic-name>/
│           ├── <issue>-epic.md                 [frontmatter adds `concepts:` — §6.2]
│           ├── <issue>-hld.md                  [frontmatter adds `concepts:` — §6.2]
│           ├── PIR.md                          [no schema change]
│           └── tasks/                          [unchanged; deleted at close]
│
├── system/
│   ├── README.md                               [unchanged; concept index linked from here]
│   ├── stack.md
│   ├── standards/                              [unchanged]
│   └── concepts/                               [NEW DIRECTORY]
│       ├── README.md                           [NEW — generated index]
│       ├── <concept-1>.md                      [NEW]
│       ├── <concept-2>.md                      [NEW]
│       └── _archive/                           [NEW — deprecated concepts]
│           └── <old-concept>.md
│
└── decisions/                                  [unchanged]

.claude/
├── agents/
│   ├── nxs-analyzer.md                         [no change required for v1]
│   ├── nxs-architect.md                        [PROMPT DIFFS — §5.6]
│   ├── nxs-decomposer.md                       [PROMPT DIFFS — §5.6]
│   ├── nxs-dev.md                              [PROMPT DIFFS — §5.6]
│   ├── nxs-pm.md                               [PROMPT DIFFS — §5.6]
│   └── nxs-distiller.md                        [NEW — §3.1]
│
├── commands/
│   ├── nxs.bootstrap-concepts.md               [NEW — §10.6]
│   ├── nxs.close.md                            [WORKFLOW DIFFS — §4]
│   ├── nxs.distill-epic.md                     [NEW — §4.6]
│   ├── nxs.epic.md                             [WORKFLOW DIFFS — §6.2]
│   ├── nxs.list-concepts.md                    [NEW small helper — §6.3]
│   └── (others)                                [unchanged]
│
└── skills/
    ├── nxs-bootstrap-concepts/                 [NEW]
    │   └── scripts/
    │       ├── scan-sources.ts
    │       ├── extract-candidates.ts
    │       ├── cluster-candidates.ts
    │       ├── render-checkpoint.ts
    │       ├── plan-generation.ts
    │       ├── plan-verification.ts
    │       ├── update-index.ts                 (shared with distiller — §10.7)
    │       └── lib/
    │           ├── frontmatter.ts
    │           ├── concept-schema.ts
    │           ├── grep.ts
    │           └── path-utils.ts
    └── nxs-distiller/                          [NEW]
        └── scripts/
            ├── update-index.ts                 (re-export of the bootstrap one)
            ├── plan-code-surface.ts            (shared logic with bootstrap verification)
            └── lib/                            (re-export from bootstrap)
```

---

## 9. Migration Path

The wiki must be additive. A repo without `docs/system/concepts/` continues to function unchanged. The migration is monotonic — once you run bootstrap, you cannot un-run it without reverting commits, but every step before bootstrap is a no-op for non-wiki users.

### 9.1 Stage 0 — Pre-adoption (today)

Nothing is installed. The pipeline runs as it does today.

### 9.2 Stage 1 — Install agent + commands (no concepts yet)

Add the new files (§8). Update existing agents and `/nxs.close`, `/nxs.epic`. **Crucially, every change is gated on the existence of `docs/system/concepts/`**:

```
if [ -f docs/system/concepts/README.md ]; then
   # load concepts
else
   # no-op, log "no concept graph found"
fi
```

After Stage 1 the pipeline behaves identically to today, but the machinery is in place.

### 9.3 Stage 2 — Bootstrap a single feature subtree

Recommended: don't bootstrap the whole repo on day one. Pick one well-documented feature subtree and run:

```
/nxs.bootstrap-concepts --scope docs/features/<feature>/
```

(`--scope` is a Phase-0 filter on `scan-sources.ts`.) This produces 5–15 concept pages on a known surface. The team reviews them, hand-edits where needed, and lives with them for one or two epic cycles to validate the agent integration.

### 9.4 Stage 3 — Bootstrap the rest

After the team is happy with the seed, run `/nxs.bootstrap-concepts` (no scope) to cover the remaining features. This is the expensive run (~$20–60 in API costs for a large repo).

### 9.5 Stage 4 — Brief-template flip

Update `docs/features/README.md` (or the brief template repo) to the new template (§6.1). Existing briefs continue to work — `/nxs.epic` does not require `concepts:` in the frontmatter, it just runs the grep fallback.

### 9.6 Stage 5 — Steady state

`/nxs.close` distill is mandatory for new epics (§4). The concept graph accretes. PMs start populating `concepts:` proactively. After ~10 epic cycles, the graph reaches the success criterion (§ original prompt: an architect can write a correct HLD from the concept pages alone).

### 9.7 Reverting

If the wiki experiment fails:

```
git rm -r docs/system/concepts/
git commit -m "revert: remove concept graph"
```

That's the entire revert. Agents instantly return to no-concept mode (the gate from Stage 1). Brief authors keep the slim template if they prefer; or revert that too.

---

## 10. Edge Cases and Failure Modes

### 10.1 Conflicting concepts

Two different epics, closed independently, both believe they own a concept. Detection: the distiller's _Pass A_ compares the changed surface against `touches:` of every concept. If two concepts each claim ownership of the same files via `touches:`, it surfaces a `conflict-suggested` action:

```
{"action": "conflict-suggested", "concepts": ["a", "b"], "rationale": "both touch <files>; consider merging or clarifying boundaries"}
```

The user resolves manually. The most common resolution is renaming `touches:` to be more specific (e.g., `auth-session` vs. `auth-permissions`).

### 10.2 Distill on an epic that touches no concepts

Pass A returns an action plan with all `noop` or an empty list. The checkpoint shows:

```
3. Apply 0 concept-graph changes (this epic touched no tracked concepts)
```

`/nxs.close` proceeds with destruction normally. No commit to `docs/system/concepts/`. This is the common case for pure-bug-fix epics or copy/UI tweaks.

### 10.3 Bootstrap discovers overlapping concepts

The clustering step (§2.5) handles name/alias overlap. _Semantic_ overlap (e.g., "tag system" and "labeling" being the same thing despite no string overlap) is caught at the human checkpoint. The user replies `merge tag-system labeling` and the clustering re-runs.

If the user misses an overlap and two near-duplicate concepts ship, the next `/nxs.close` distillation will surface a `conflict-suggested` action (§10.1) the first time both concepts get touched together.

### 10.4 Concept page is manually edited

Allowed. The distiller respects manual edits (§7.5). Risk: a manual edit invalidates the agent integration's trust. Detection (run by `nxs-analyzer`):

> Cross-check the page's _Key Invariants_ against any code-level invariants discoverable by grep (e.g., assertion patterns, validation regexes). If a page invariant has no code support and the page was last edited manually, surface a `staleness-suspected` finding.

This finding is informational; no automation acts on it.

### 10.5 Bootstrap interrupted mid-run

All phases persist intermediate JSON to `.tmp/bootstrap/`. The command file checks for those artefacts on entry and offers to resume:

```
Detected partial bootstrap state in .tmp/bootstrap/.
Last completed phase: PHASE 1 — discovery + clustering.
Next step: PHASE 2 — generation for 73 approved concepts.

Resume from PHASE 2? (y/n/restart)
```

The `.tmp/bootstrap/` directory is gitignored. On a successful run, it is deleted at the end (so a re-run is interpreted as "start over", consistent with the bootstrap refusal in §2.11).

### 10.6 Concepts that should be split or merged

**Split** is suggested by the distiller (action `split-suggested`) when an update would push a page over 500 words. The user's options:

```
The 'permissions' concept has grown to 612 words. Distiller suggests split:

   Split A: permissions-model        — the data model + storage
   Split B: permissions-evaluation   — the runtime check logic

Reply:
   yes        - perform the split (distiller writes both pages, archives original)
   no         - leave as one large page (will keep flagging)
   custom     - propose your own split
```

If the user replies `yes`, the distiller writes the two new pages, moves the original to `_archive/permissions.md`, and updates `touches:` references across all other pages from `permissions` to either `permissions-model` or `permissions-evaluation` (best-effort — flagged for review if ambiguous).

**Merge** is initiated by the user, via a manual command:

```
/nxs.merge-concepts <a> <b> [--into <name>]
```

This invokes the distiller (mode: `merge`) which reads both pages, produces a single combined page (Decision Log = chronological merge of both), archives the inputs, and updates the index.

### 10.7 Index drift

If `docs/system/concepts/README.md` ever disagrees with the frontmatter of the concept pages (e.g., someone hand-edited a page without re-running the index), the inconsistency is harmless — agents read the index _and_ then the page. To re-sync:

```
tsx ./.claude/skills/nxs-distiller/scripts/update-index.ts
```

This script is idempotent and side-effect-free except writing the index. It's safe to run any time.

`nxs-analyzer` adds an index-drift check: if any page's frontmatter `concept:` field doesn't match the index entry, flag it.

### 10.8 A brief references a concept that doesn't exist

Handled by `/nxs.epic` Step 1.5 (§6.2). Three options surfaced; one of them is "this is a new concept the epic will create" — that's the ordinary case for green-field work and requires no special handling.

### 10.9 An invariant conflict surfaces during `nxs-dev`

The dev agent stops, prints the conflict surface (§5.4), and waits for human input. The agent does NOT pretend to fix it. This is the most expensive failure to suppress because the human's resolution might be "the invariant is no longer true" — which means the concept page is wrong, not the implementation. The dev's surfaced conflict is the only point in the pipeline where this contradiction can be detected before it ships.

### 10.10 Many concepts, slow agent invocations

If load-concepts in `nxs-architect` ever loads more than 8 concepts, performance degrades. The grep fallback caps at 8 (§5.1). The explicit `concepts:` list, populated by humans, has no cap by convention but agents truncate to the 12 most-frequently-grepped if exceeded — and surface the truncation:

```
12 concepts listed in HLD frontmatter; loaded all 12. If this is a recurring
HLD pattern, consider splitting the epic — wide concept fan-out usually means
the epic spans multiple subsystems.
```

### 10.11 The `concepts/` directory is committed but the brief flip is not

Agents work fine. Briefs missing `concepts:` use the grep fallback. The migration is order-independent past Stage 1.

### 10.12 An old concept page predates the current behavior (drift after a refactor)

The next `/nxs.close` for an epic that touches that subsystem will overwrite the stale prose (Pass B's _update_). Until then, the page is wrong but flagged: any `nxs-analyzer` invariant-vs-code comparison or any `staleness:` annotation by a downstream agent is a signal. To force a re-derive without waiting for an epic:

```
/nxs.distill-epic --refresh <concept-name>
```

(This is a small additional verb on the same command — re-runs verification on a single concept against current code, without an epic context.)

---

## 11. Acceptance Criteria for the Implementation

For the implementing engineer's reference. The system is "done" when:

1. `/nxs.bootstrap-concepts` produces a concept graph from a 50+ feature repo without manual intervention beyond Phase 1 boundary review.
2. `/nxs.close` for an epic touching three subsystems produces ≤3 concept-page diffs in one commit, with a Decision Log entry per touched concept.
3. The architect agent, given an HLD writing prompt for a fourth epic, requests _only_ `docs/system/concepts/README.md` + the concept pages it lists — and not any prior epic's PIR or HLD — and produces a correct HLD. (This is the original prompt's success criterion.)
4. Reverting the wiki commits leaves the pipeline functioning identically to its pre-wiki behavior.
5. Every concept page passes a schema validator: ≤500 words excluding Decision Log, frontmatter present, all `touches:` resolve to existing concept files.

---

## 12. Open Questions Deferred to Implementation

These are not blockers; they are calibration knobs the implementing engineer should expect to tune in the first month of use:

1. **Candidate cap during discovery.** Set at 10/doc; may need to be 6–8 if briefs are short, or 15 for very long HLDs.
2. **Concept-page word cap.** Set at 500; the right number is whatever 80% of pages naturally hit. If they all crowd 500 the cap is too low.
3. **Concepts-per-epic load cap.** Set at 8 (grep fallback) and 12 (explicit). Watch the architect's load times — if it's mostly waiting on concept reads, cut the caps.
4. **Whether to ship the small companion commands** (`/nxs.list-concepts`, `/nxs.merge-concepts`, `--refresh` flag) in v1 or wait for demand. Recommend: ship `/nxs.distill-epic` (cheap, high-value as the failure-recovery path) and defer the others.
5. **Whether `nxs-analyzer` should grow concept-coverage checks** (e.g., "this epic should probably touch the `tagging` concept based on its HLD"). Recommend: defer; the cost of a missed concept touch is at most a stale page that the next epic catches.
