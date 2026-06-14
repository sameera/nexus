# Open Notebook as prior art for System B (knowledge distillation)

**Status:** Research note. No decisions made here.
**Date:** 2026-06-10
**Relates to:** [`0001-refactor-direction.md`](../decisions/0001-refactor-direction.md),
[`0003-library-schema.md`](../decisions/0003-library-schema.md)
**Mirror:** committed as note `017` in `~/projects/awzm-notes/brainstorms/library/nexus/`
(commit `8e69541`); if the copies diverge, reconcile against the later commit.
**Primary use:** input for the **distiller / bootstrap design conversation** (the build work
0003 §10 explicitly left out of scope). Read this when that conversation opens.

---

## What was analyzed and why

[Open Notebook](https://github.com/lfnovo/open-notebook) (local clone:
`~/projects/open-notebook`) is an open-source NotebookLM alternative: multi-modal sources →
extracted text → AI-distilled "insights" → embeddings → synthesized answers. Stripped of its
product framing it is a shipped, working **distillation pipeline**, which makes it useful
prior art for System B. Analyzed 2026-06-10 against the frozen library schema (0003).

Architecture in one line: FastAPI + LangGraph state machines + SurrealDB (graph + vectors),
with all prompt engineering externalized to Jinja templates (`prompts/`), and three distinct
user-facing modes — **Transformations** (write-time template distillation), **Ask**
(read-time search-and-synthesize), **Chat** (conversation over manually chosen context).

Key files if re-examining:

| Concern | File (in `~/projects/open-notebook`) |
|---|---|
| Transformation primitive (the data record) | `open_notebook/domain/transformation.py` |
| Transformation executor (one-node graph) | `open_notebook/graphs/transformation.py` |
| Ingestion pipeline (extract → save → fan-out transforms) | `open_notebook/graphs/source.py` |
| Insight/Note/Source domain model | `open_notebook/domain/notebook.py` |
| Ask pipeline (strategy → parallel sub-answers → synthesis) | `open_notebook/graphs/ask.py` |
| Citation-discipline prompt | `prompts/ask/query_process.jinja` |
| Their own mode taxonomy | `docs/2-CORE-CONCEPTS/chat-vs-transformations.md` |

The mapping below has three targets, because the knowledge-engine track split (0001): what is
**decided** in 0003 (open-notebook = independent validation), what is **undesigned** (the
distiller/bootstrap — open-notebook = liftable material), and what was **burned**
(topology/embeddings — open-notebook = evidence for the burn).

---

## 1. Validates decisions already frozen in 0003 (no action)

1. **Write-time distillation vs. read-time synthesis as separate primitives.**
   Open-notebook's sharpest design idea — Transformations (write-time, structured, stored)
   vs. Ask (read-time, synthesized, ephemeral) as distinct tools — is structurally the same
   wall 0003 §8.1 builds: library *writes* only at close; design-time concept use is *reads*.
   They arrived from the UX side, we from the over-generation side. Independent convergence;
   the separation is load-bearing.
2. **Distilled knowledge as independently-addressable records.** Their `SourceInsight` is a
   separate retrievable record, not metadata on the source — our one-concept-per-file page.
3. **Cheap layer decides whether to load the expensive layer.** Their two context
   granularities (`get_context("short")` = title + insights only) is our summary-first
   schema, except theirs is a query-time flag and ours is structural (the grep surface).
   Ours is the stronger form — theirs still loads the record to ask for its short form.
4. **Provenance as schema beats provenance as prompt-pleading.** Their citation rules live in
   prompt text (`query_process.jinja` spends ~40% of its words begging the model not to
   mutate typed IDs like `source:x` / `insight:y`). 0003's `last_updated_by` + per-entry
   Decision Log attribution makes provenance a schema field, not a model behavior. Nothing
   to import; the contrast is the lesson.

---

## 2. Liftable for the distiller / bootstrap (the future build)

These map onto exactly the machinery 0003 left undesigned.

1. **Recipes as data records, not code.** Their Transformation primitive is five fields —
   `{name, title, description, prompt, apply_default}` — stored as a record and executed by a
   trivial one-node graph. The distiller's emission step should take the same shape: a small
   set of named, versioned prompt templates that take the close record and produce
   `LibraryDelta`s (0003 §8.2). Reviewable, diffable, swappable without touching pipeline
   code. Likely one recipe per delta field family (behavioral delta; invariants
   asserted/retired; integration changes; the why) rather than one monolithic
   "distill everything" prompt.
2. **Default-on set + house-style preamble.** Their `apply_default` flag (transformations
   that run on every ingest) maps to "the recipe set that runs at every `/nxs.close`." Their
   global `DefaultPrompts.transformation_instructions` (a preamble prepended to *every*
   recipe) is where 0003 §8.3's hard boundary gets enforced in the prompt itself —
   "behavioral prose, no file paths, no type/function names, no speculative claims, ≤400-word
   bodies." Keeps individual recipes short and the boundary uniform.
3. **Bootstrap is template-replay.** Their core workflow — define the extraction once, apply
   it to 15 papers, get 15 consistently-shaped notes — is an existence proof for 0003 §9.4's
   assumption that bootstrap derives the same emission shape in bulk. Per-source independence
   means bootstrap parallelizes trivially.
4. **Sanitize model output before append.** They run `clean_thinking_content()` (strips
   `<think>…</think>`) at every model boundary. If the distiller uses a reasoning model,
   scratchpad *will* leak without this — and the Decision Log is append-only, so a polluted
   entry is forever. Sanitize before append, always.
5. **Per-retrieval extraction instructions** (the one liftable idea from their otherwise
   burned-road Ask pipeline): their strategy step attaches not just a search term but
   *instructions for what to extract from the results*. Grep-native analog: when the
   forward-declared `concepts:` reading list on System-A artifacts (0003 §5) gets specified,
   consider an optional one-line *why-you're-reading-this* per concept. Cheap, no topology;
   it's the retrieval-quality step most designs skip. Optional — weigh then, not a schema
   change now.

---

## 3. Evidence for the burn (topology/embeddings — 0001 Decision 2)

Open-notebook's entire retrieval stack is the road 0001 closed, and it puts a **concrete
bill** on that road: an async job queue (`embed_source` / `embed_note` / `embed_insight` as
fire-and-forget commands built specifically to stop embedding from exhausting connection
pools), chunking infrastructure, a graph database, migration machinery, and event-loop
gymnastics (`source_chat.py` spawns fresh event loops inside thread pools; their own
`graphs/CLAUDE.md` flags it as fragile). That is the *infrastructure floor* for "insights are
embedded and vector-searched." Our two consumers retrieve over capped, alias-fronted pages in
a flat directory — grep is the correct tool at that scale, not a compromise. **File this as
the corpse-with-a-price-tag if anyone proposes reopening embeddings.**

### 3.1 Scale limits and the reversal path

The verdict above is **scale-qualified**, and 0001 Decision 2 made it conditional ("defaults
to grep until precision is demonstrably required"). Where it actually bends, challenged and
worked through 2026-06-10:

- **Performance never bends.** Ripgrep over even 5,000 capped pages (~15 MB) answers in
  milliseconds. The degradation at scale is retrieval *quality*, not speed.
- **What degrades, in order of onset and danger:** (1) **write-time deduplication** — the
  distiller fails to find the existing page and mints a near-duplicate concept, fragmenting
  the Decision Log across files; this corrupts the corpus silently and is the first real
  casualty; (2) **alias discipline decay** — `aliases:` is the manual stand-in for
  embeddings and stops covering natural phrasing as authors/epics multiply; (3) **result
  discrimination** — 0003 §6's own named failure mode ("grep returns 40 pages…") saturates
  when common terms hit hundreds of pages and reading that many Summaries costs real tokens.
- **Two effects slow the onset.** The retriever is an LLM agent iterating and reformulating
  greps — a decent query expander, i.e. poor-man's semantic search paid in query-time tokens
  instead of write-time infrastructure. And the corpus is the concept inventory of *one*
  system (~10² genuine concepts); thousands of pages is more likely distiller
  over-generation — the JSONata disease itself — than a real retrieval-tech gap. Diagnose
  curation failure before reaching for an index.
- **The reversal is cheap and schema-compatible — and is *not* open-notebook's bill.** Their
  stack exists because they embed unbounded raw documents. 0003's pages are ≤400 words and
  embed whole: the retrofit is a derived sidecar (one page-level embedding per file,
  regenerated on commit, e.g. sqlite-vec, gitignored as derived state). No chunking, no job
  queue, no graph DB, no schema migration; the page stays the unit of retrieval either way.
- **The reopen trigger is the structural corpse 0001 reserved:** *measured* recall failures —
  distiller duplicating concepts, architects missing relevant invariants — at high-hundreds
  to thousands of pages. Not anticipation, evidence.

What never flips with scale is §4.1: curation semantics are orthogonal to retrieval tech.
Vector search over uncurated, contradictory insight blobs returns well-ranked contradictions.

---

## 4. Anti-patterns confirmed (what copying them would have broken)

1. **Uncurated insight accumulation.** Every transformation run appends another insight blob
   to the source — no merge, split, or supersede semantics, no answer to "two insights now
   disagree." Fine for personal research; it is exactly the volume-without-retrievability
   failure 0003 §6 designs against. The transformation pattern belongs in the distiller's
   *prompt layer*; the *storage layer* (curated pages, append-only Decision Log,
   struck-through invariants, split-don't-grow) is already settled better in 0003.
2. **`SourceInsight.save_as_note()`** — one call promotes machine-distilled content into the
   human note space. Under 0001 Decision 1 (the two stores never share an artifact) this is
   precisely the review violation the two-store layout exists to prevent. Never build the
   laundering convenience.
3. **Crude context truncation** (`full_text[:5000]`) — what truncation looks like when the
   schema doesn't enforce size. 0003's 400-word body cap solves this structurally.

---

## 5. Footnote: interface point with the awzm-notes coaching track

The coaching product (awzm-notes `brainstorms/library/nexus/` notes 015–016, the openly-a-bot
scope coach) is **not built here**, but has one interface point with System B: a coach asking "you
said two days — but this touches auth and session, have you scoped those?" needs exactly the
blast-radius retrieval `touches:` provides. Open-notebook's source-chat (private conversation
grounded on one artifact + its distilled insights, with context indicators showing what was
loaded) is the closest shipped analog to the coach's shape. If that product is ever built, it
is a *reader* of the library through the same grep-native contract — no new System B
machinery. Observation only; the product line stays in awzm-notes.

---

## Net

Open-notebook's storage half is the weaker half — 0003's page schema is categorically better
than their insight blobs. What survives scrutiny is narrower and more useful: it **validates**
the write/read split and summary-first retrieval, **supplies** the distiller's prompt-layer
shape (recipes as data, default-on set, house-style preamble, bulk replay for bootstrap,
output sanitization), and **prices** the embedding road already declined. The frozen schema
(0003) needs no amendment from any of this.
