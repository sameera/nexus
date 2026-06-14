# Nexus

## Living System Memory for Agentic Software Delivery

---

### Vision

Nexus is an agentic software delivery system that maintains an authoritative, always-current model of how a software system works — and uses that model to coordinate AI agents and human stakeholders through the full feature lifecycle. It eliminates the institutional amnesia that compounds with every shipped feature, and it gives product managers, engineers, and AI agents a shared substrate for thinking about the system.

Modern AI-assisted development is bottlenecked not by coding speed but by context. When a model proposes a change to a system it hasn't seen before, the cost of recovering context — reading prior decisions, tracing call graphs, inferring invariants — dwarfs the cost of writing the code. Nexus solves this by capturing intent and decisions at the moment they are made, then making them retrievable for every subsequent agent and every subsequent human.

The result is a bridge of understanding for both technical and non-technical stakeholders: PMs specify requirements clearly because the system tells them what already exists; PM and engineering teams scope deliverable, verifiable iterations because the system surfaces real impact; and coding agents produce architecturally coherent code because they receive precise, bounded context instead of guessing.

---

### The Problem

Software systems shed knowledge faster than they accumulate it. A team's working memory of a codebase lives in three places: the code itself (which captures _what_, not _why_), scattered design documents (often stale), and the senior engineers' heads (which leave when they do).

For AI-assisted teams, this problem is amplified. Coding agents are stateless. Every task starts from zero context. Without a structured way to inject prior decisions, invariants, and subsystem semantics, agents either hallucinate plausible-but-wrong assumptions or demand exhaustive briefing each time — defeating the productivity gains AI assistance was supposed to deliver.

Existing tools don't solve this:

- Code documentation generators produce code-shaped artifacts (call graphs, API surfaces). They explain structure, not intent.
- Wikis and Confluence depend on humans to write and maintain them. They go stale.
- LLM context windows can't hold a real system. Even with retrieval, the retrieved material is rarely the right material.

What's missing is a knowledge layer that is _automatically maintained_ from the work the team is already doing, _structured for retrieval_ by both humans and agents, and _authoritative_ enough that downstream decisions can rely on it.

---

### The Solution

Nexus is built around three ideas.

**Knowledge is concept-shaped, not artifact-shaped.** Useful system knowledge is not organized by epic, sprint, or document type. It is organized by concept: how authentication works, what a Space is, the rules for organization resolution. Nexus's knowledge layer is a set of _concept pages_ — short, dense, grep-friendly markdown files keyed by concept name, with structured frontmatter for cross-references and a single append-only decision log per concept.

**Knowledge is distilled, not authored.** Asking engineers to maintain a wiki fails. Nexus generates concept pages automatically from delivery artifacts using a dedicated distiller agent that runs as part of feature closeout. The decision log on each page only ever grows; old decisions are preserved, never silently rewritten. Humans approve before commit, but humans do not write the first draft.

**Knowledge is git-native.** Concept pages are markdown files in the project repository, diffable in pull requests, reviewable like code, and consistent across branches and worktrees. No databases, no separate service to keep in sync, no vector store. Retrieval is grep, glob, and read.

Around this knowledge core, Nexus provides a delivery harness: a small set of orchestrating commands and dedicated agents that move features from brief to merged code while continuously feeding the knowledge layer.

---

### Architecture

#### The Knowledge Layer

Concept pages live at `docs/system/concepts/<concept-slug>.md`. Each page is bounded to roughly 500 words (excluding the append-only decision log) and follows a fixed schema:

```markdown
---
concept: "org-resolution"
aliases: ["organization lookup", "org matching"]
touches: ["auth", "session", "space-membership"]
last_updated_by: "#42"
---

# Org Resolution

<2-3 sentence summary, optimized for retrieval>

## How It Works

<behavioral description — what the system does, not which files do it>

## Key Invariants

<constraints future developers must preserve>

## Integration Points

<how other subsystems interact with this — references to other concept names>

## Decision Log

<append-only entries, each tagged with the epic that produced it>
```

The `touches` field references other concepts by name, not by file path. Cross-concept navigation is a grep problem: to find everything related to "session", grep frontmatter for `touches:` containing `session`. There is no precomputed index file and therefore no merge conflicts on concurrent workflows.

Agents load directly referenced concepts and surface `touches` as candidates, but do not transitively follow them. A cap of five to seven pages per task keeps token cost bounded and forces the design conversation to stay focused on the concepts the work actually intersects.

#### The Code Intelligence Layer

For structural questions about source code — where is this function called, what does this symbol reference, what's in this file — Nexus delegates to **Serena**, an LSP-based code intelligence tool exposed via MCP. Serena runs in read-only mode with its built-in memory system disabled (concept pages are the canonical memory layer) and is scoped to a small subset of navigation and symbol-resolution tools.

This split is deliberate. Code intelligence and decisional knowledge are different things and should not share a substrate. Code structure is regenerable from source and belongs to a service. Decisions, intent, and invariants are authored knowledge and belong in git. The dependency runs in one direction only: concept pages cite code; the code intelligence layer never overrides what concept pages assert.

#### The Delivery Pipeline

A small set of agents coordinate to move work through the system:

- **`nxs-architect`** — forward-looking design. Reads referenced concept pages, produces concise decision records with diagrams, identifies impacted subsystems and the invariants the work must preserve.
- **`nxs-decomposer`** — breaks designs into deliverable, verifiable iterations. Outputs implementable task specifications sized for a single agent run with explicit acceptance criteria.
- **`nxs-dev`** — implements tasks test-first inside isolated git worktrees. Has scoped access to Serena for code navigation and to the concept pages the task spec names.
- **`nxs-distiller`** — retrospective knowledge synthesis. Runs at epic close. Identifies which concepts were created or modified, drafts updates from delivery artifacts, verifies claims against code, and flags discrepancies for human review rather than silently correcting them.
- **`nxs-analyzer`** — consistency validation across concept pages, catching contradictions or drift between concepts that should agree.

Orchestration is via slash commands invoked from Claude Code. Each command coordinates one or more agents with human checkpoints at critical decision points: epic shape, design approval, task list, and close-time concept updates. Humans handle judgment; agents handle generation; automation handles filing and routing.

---

### Workflows

#### PM Flow

A product manager opens a lightweight brief-authoring surface — an editor with live preview — and writes a feature brief describing the problem, the desired user-observable outcome, success criteria, and explicit scope boundaries. The brief references existing concepts by name in its frontmatter; the editor surfaces matching concept pages as the PM types. The PM submits, the system writes the brief to the repository and creates a corresponding tracking issue.

The PM then opens Claude, runs `/nxs.epic`, and works through epic shaping conversationally. The architect agent loads referenced concepts, flags user stories that violate existing invariants, surfaces missing concept references the PM hadn't considered, and produces an approved epic.

There is no "current behavior" or "technical context" section in the brief. The concept pages provide that context for both the PM during authoring and the architect during epic shaping.

#### Engineering Flow

An engineer picks up an approved epic and runs `/nxs.design` to produce a focused decision record with diagrams of affected subsystems. They run `/nxs.tasks` to decompose into implementable task specifications, then `/nxs.dev` per task to drive test-first implementation in a dedicated worktree. Each task spec carries explicit references to the concept pages the implementing agent should load.

When the epic completes, `/nxs.close` runs `nxs-distiller`, which produces concept page updates from the epic's delivery artifacts. The engineer reviews the proposed updates, the changes are committed alongside the epic's merge, and the knowledge layer advances by one increment.

#### Knowledge Bootstrap

For an existing codebase, a five-stage bootstrap process establishes the initial concept set:

1. **Candidate discovery** — scan source structure and any existing delivery artifacts to propose concept candidates, segregated into confident, cross-cutting, and unnamed buckets for human triage.
2. **Concept-to-file mapping** — use the code intelligence layer to associate each concept with the source modules that implement it.
3. **Draft generation** — synthesize each concept page from available evidence: existing documentation for behavior, call graphs for integration points, decision points extracted chronologically from delivery history.
4. **Code-truth verification** — compile each concept's claims into queries against the code and flag failures for human review. The system does not silently correct; it surfaces discrepancies.
5. **Human checkpoint** — concepts are reviewed in a batch and committed.

After bootstrap, the system maintains itself through the incremental distiller at every epic close.

---

### Technical Foundations

- **TypeScript via `tsx`** for all infrastructure code. Deterministic operations — fuzzy matching, file I/O, MCP plumbing, append-only enforcement, consistency checks — live in TypeScript libraries with test coverage. LLM-shaped work lives in agent prompts.
- **Git as the single source of truth.** Every authoritative artifact is a markdown file versioned in git. Derived artifacts (graph caches, indexes) are gitignored and reconstructed on demand.
- **MCP for tool integration.** Serena and any future code-intelligence backends are integrated via MCP. Agents access capabilities through a uniform tool surface, allowing the underlying tooling to be swapped without rewriting agents.
- **Append-only decision logs, enforced.** A library-level guard rejects any operation that would modify or reorder prior decision log entries. This is a runtime check, not a convention.
- **Worktree-per-epic isolation.** Concurrent epics work in separate worktrees with shared concept pages, eliminating cross-contamination during in-flight development.

---

### What Nexus Is Not

- Not a Jira, Confluence, or ProductBoard replacement. Nexus integrates with existing PM and tracking tools; it does not attempt to own them.
- Not a unified all-in-one platform. The surface area is intentionally narrow.
- Not a status-reporting or standup tool.
- Not a code review tool. Pull requests continue to flow through whatever review system the team already uses.
- Not a generic documentation generator. Nexus produces a specific shape of knowledge (concept pages) from a specific input (delivery artifacts) for a specific consumer (agents and humans making design decisions).

---

### Success Criteria

Nexus is successful when, after three epics have shipped on a project, the architect agent can produce a correct design for a fourth epic that touches subsystems from all three — without reading any prior epics, design records, or close-time reports. The concept pages plus the code intelligence layer alone provide sufficient, accurate context.

This is testable. It is also the explicit goal that every architectural choice serves.

---

### Phased Delivery

**Phase 1 — Core loop.** Concept page schema, the distiller agent, the delivery commands, Serena integration. Single-repo, single-engineer use on a greenfield project where the knowledge layer accumulates from epic one.

**Phase 2 — Bootstrap.** The five-stage bootstrap pipeline, validated against an eval set of ten hand-written gold concept pages before being scaled to a real codebase.

**Phase 3 — PM surface.** The brief authoring UI, conversational epic checkpointing through Claude, read-only concept browser for non-engineer stakeholders.

**Phase 4 — Multi-repo.** Cross-repo concept references for systems split across multiple codebases. Optional read-optimized index service for cross-organizational access, with git remaining the source of truth.

---

### Assumptions Worth Pressure-Testing

A few claims in this proposal are load-bearing and not yet validated. They warrant explicit testing rather than assumption:

1. **That concept pages can be reliably distilled by an agent.** The draft-generation stage of bootstrap and close-time distillation carries the highest execution risk in the entire system. If draft quality is poor, humans end up rewriting from scratch and the value proposition collapses. The eval set of gold pages must precede any scaled rollout of the distiller.

2. **That cross-concept consistency can be enforced cheaply.** Verifying claims across concept pages is linear in concept count and may be expensive to run on every commit. The analyzer's runtime profile must be measured at realistic concept counts (50–100), not at toy-project scale.

3. **That the Serena/concept-page split avoids the "parallel conflicting graphs" antipattern.** The split is justified by the different update cadences and authorship models of each layer, but the one-way dependency (concept pages cite code; code intelligence never overrides concept pages) must be enforced, not assumed. Without that, the two views will diverge over time.

4. **That PMs will accept a separate brief-authoring UI.** If Claude's conversational interface already handles brief authoring well, a dedicated UI may be unnecessary surface area. The UI should be built only after evidence that the chat interface is a measurable bottleneck for PMs specifically.

5. **That the success criterion is achievable at all.** "Architect produces correct design without reading prior epics" is a strong claim. It may be that some classes of design decisions are inherently impossible to capture in concept-page form and require artifact-level history. This should be tested on a real project before assuming the system is sufficient as designed.
