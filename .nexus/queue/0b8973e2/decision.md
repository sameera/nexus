---
title: "Decision: Generated concept atlas at docs/concepts.md; no doc-site tooling"
kind: decision
date: 2026-07-04
concepts: [two-store-split, concept-store, grep-native-retrieval, distiller]
---

# Decision: Generated concept atlas at docs/concepts.md; no doc-site tooling

## Question

Now that two real distillations exist: how does a human acquire knowledge about the
specifics of the system, token-efficiently and long-term? Are concept pages and anchors
human-consumable, or does the store need separate human-facing documentation tooling?

## Decision

Concept pages and anchors **are** the human documentation — the first two distillations
demonstrate it. What is missing is orientation, not readability. Therefore:

- Add one derived orientation artifact: a **generated atlas at `docs/concepts.md`** — one
  line per active concept (title + first sentence of its summary), grouped into clusters
  derived mechanically from the `touches:` graph. Produced by a script over frontmatter;
  zero LLM tokens, ever. Whole-file generated, carrying the same
  `DERIVED — never hand-edit` header the anchor sidecars use.
- The **distiller regenerates the atlas in every drain PR** (same pattern as anchor
  refresh); the **validator gates sync** (atlas lines ↔ active concept pages).
- `.nexus/concepts/README.md` narrows to the agent-facing store contract (rules, retrieval
  table, provenance note); the human entry point is the atlas.
- **No doc-site tooling** (Docusaurus/MkDocs/Starlight or similar).
- `/nxs.explain`, when built, ships **without the no-arg ramp-up tour** — the atlas covers
  orientation statically. Explain keeps only the interactive uses: free-term resolution,
  guided code walks via anchors, cross-concept questions.

## Rationale

- **Producer ≠ consumer.** The two-store split places artifacts by consumer, never by
  content type. The atlas is machine-written but purely human-consumed — agents are served
  by grep-native retrieval and never need it. By the split's own rule it belongs on the
  human surface. The `docs/` boundary was previously read as "hand-maintained only"; the
  actual rule is "permanent human artifacts." Ownership is declared in-file by the DERIVED
  header, not by folder.
- **`docs/` placement is itself signal.** Every drain PR diffs `docs/concepts.md`, so a
  regular consumer of `docs/` sees new concepts arrive without visiting a dot-directory.
- **The index rejection re-tested.** 0003 §7 rejected a generated index as a per-close
  conflict magnet that duplicates listing. Both reasons are dead for this artifact: the
  distillation-PR is a single serialized producer (no concurrent writers), and 0011 F1.2
  already conceded the human-who-cannot-grep needs an entry point that listing does not
  provide.
- **Pay tokens at write time, never at read time.** The distiller drain is already paid and
  amortizes over every future reader; anchors proved the pattern. The planned no-arg
  explain tour re-synthesizes a near-static product (~15–25k tokens per run, per person);
  the atlas replaces it at zero marginal cost. The newcomer's default path — atlas → two or
  three concept pages → anchor sidecar → code — costs no tokens at all.

## Contract (what implementation must honor)

1. `docs/concepts.md` is whole-file generated with a DERIVED header; no hand-edits; the
   generator is the only writer.
2. Generator script lives in `utils/` beside `validate-concepts.ts`; test-first, per
   project standards.
3. `/nxs.distill` runs the generator in every drain PR; the validator fails when the atlas
   is out of sync with the active pages.
4. Clusters come mechanically from the `touches:` graph — no new frontmatter fields, no
   LLM judgment in the generator.
5. `/nxs.explain`'s contract is narrowed at design time; nothing to change until it is
   built.

## Refuted alternatives

- **Doc-site generator (Docusaurus, MkDocs, Starlight).** A build, a dependency, and a
  styling surface for zero new information — the pages already render with navigable links
  in GitHub and every IDE. If a rendered view ever earns its keep, its home is a read-only
  knowledge pane in Prime (backlog material), not a third-party site.
- **On-demand tour via `/nxs.explain`.** Pays synthesis tokens on every read for output
  that barely changes between drains; wrong side of the write-time/read-time line.
- **Atlas inside `.nexus/concepts/README.md`.** Invisible to a `docs/` browser — nobody
  ramping up opens a dot-directory; and the consumer-decides rule places a human-only
  artifact on the human surface.
- **Hand-maintained `docs/concepts.md`.** Rots by the second drain; derived state must be
  machine-owned or the DERIVED discipline collapses.
