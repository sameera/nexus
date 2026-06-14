# 1. Is the pivot right?

Does the heavy documentation pipeline still serve a purpose that the knowledge graph can't replace? Are there scenarios where the 16-section HLD catches problems that a concise decision document plus knowledge graph would miss? What's the actual failure rate of the current pipeline vs. a lighter approach?

## Answer

**Partially — but the framing in the brief misidentifies what the heavy pipeline is for.**

The brief says the documentation exists to (a) feed agents enough context to generate good code, and (b) create retrievable context for future work. If both are true, then yes — Graphify makes most of it redundant. Models reason fine from concise input, and a live graph beats stale prose for retrieval.

But that's not actually why the 16-section HLD exists. It exists as **a forcing function for human judgment** — the stated core philosophy ("generation is cheap, judgment is not"). The sections that ask "what's the security posture," "what's the risk assessment," "what are the trade-offs" aren't there because the dev agent needs them to write code. They're there because *somebody has to think about them before code gets written*, and the template is the only thing reliably making that happen. Same for the right-sizing gate, the user-stories-with-acceptance-criteria epic, and the consistency analyzer.

So the pivot question splits in two:

**Drop without much debate** — the parts that are pure context-reconstruction:

- Per-task LLDs that mostly re-describe existing code
- HLD sections enumerating "current system state" / "affected components"
- PIRs as standalone prose (graph deltas are genuinely better here)
- Auto-generated boilerplate that nobody reads

**Keep, but maybe reshape** — the parts that force a decision moment:

- Epic + acceptance criteria (PM judgment about *what we want*, which the graph can never tell you)
- Right-sizing gate (forces a no/decompose decision before commitment)
- HLD sections for trade-offs, risks, security, data model decisions (architect judgment about *how*)
- Cross-functional checkpoints (council, QA design)

The graph captures **what is**. The pipeline must still capture **what we intend** and **why we chose this over alternatives** — that doesn't live in code or in the graph derived from it.

**My recommended frame for Q1:** Don't ask "is the pipeline too heavy?" Ask "for each artifact, is it a forcing function for a decision a human must make, or is it agent scaffolding?" Cut the scaffolding aggressively. Keep the forcing functions, but they can probably be 1/3 the current size, because the graph removes the burden of *describing context* — leaving only the actual decision.

**The risk of the pivot as written:** if you uniformly lighten everything because "models are better now," you remove the friction that prevents AI-generated tech debt — which was the original point of Nexus.
