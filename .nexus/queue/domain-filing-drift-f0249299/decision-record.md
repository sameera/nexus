---
title: "Decision Record: Domain Filing and Drift Advisory in the Drain"
epic: "#94"
feature: "Concept Domain Taxonomy"
rating: M
concepts: ["distiller", "distillation-pr", "concept-store"]
date: 2026-07-19
---

# Decision Record: Domain Filing and Drift Advisory in the Drain

## Summary

This epic makes the drain the steward of the concept taxonomy the prior epic shipped. New concepts are filed under a best-fit domain during synthesis using the registry's rubrics as a closed list; when no rubric truly fits, a blocking three-way gate lets the reviewer force the best-fit, coin a subdomain, or coin a domain, and any approved registry change rides the same distillation-PR as the page that motivated it. A separate, non-blocking, deterministic advisory reports taxonomy decay in the PR body from the concept link graph, and one shared detection engine backs both that advisory and a one-time seed mode that drafts a registry for a store that has none.

## Chosen Approach

Filing stays inside the model's synthesis step, mirroring the slug-convergence pattern the drain already uses: synthesis always computes and writes a resolving best-fit `domain:` for every created concept, and separately flags each filing as a clear fit or a forced fit. Because the store validator runs before the drain's checkpoint and rejects any page whose domain does not resolve, always writing a resolving best-fit keeps the validator strict and unchanged; the three-way gate is then a confirm-or-override that fires only for forced fits. Approved new domains/subdomains are authored on the distill branch beside the motivating page, so the registry grows only through the one reviewed write the store already trusts.

The advisory and seed mode share one deterministic detection engine that reads the same concept link graph and filings the atlas is built from. Per-page drift signals (misfile, refinement, staleness) are pure neighbor-counting over that graph — local, stable, self-explanatory. Community detection is used only to propose missing domains and to seed a registry, and its output never becomes anything a tool retrieves through. Two thin drivers wrap the one engine: a drift driver emits PR-body text when a registry exists, and a seed driver emits marked draft files when none does.

## Key Decisions

### Filing is a synthesis judgment against the rubrics, not a separate deterministic classifier

- **Decision:** The best-fit domain for a brand-new concept is decided by the model during synthesis, matched against the registry's rubrics as a closed list.
- **Why:** Deciding which domain a new concept belongs to is semantic matching against prose rubrics, exactly what the model already does for slug convergence. A fresh concept's link neighborhood is thin and often points only at pages created in the same drain, so it carries no reliable signal at filing time.
- **Refuted alternative:** A deterministic post-synthesis classifier that files by link affinity to existing domains. Viable — it's exactly the math the drift advisory uses to *audit* filings later — but it loses for *initial* filing because the rubrics are prose, not machine-checkable predicates, and a just-born concept has no stable link history to classify on. Link affinity is the right tool for auditing an aged filing, the wrong tool for making one.

### Synthesis always writes a resolving best-fit domain; the gate is confirm/override for forced fits only

- **Decision:** Synthesis always writes a resolving `domain:` for every created concept and separately flags each filing as a clear fit or a forced fit. The three-way gate (force / new subdomain / new domain) fires only for forced fits; a clear fit proceeds silently.
- **Why:** The store validator runs before the checkpoint and blocks any unresolved `domain:`. Always writing a resolving best-fit, even a poor one, keeps the validator strict and untouched, while the fit/forced flag drives whether a gate is needed. This is a small scope refinement to Story 1: the gate is a synthesis-driven decision surfaced at the drain's existing checkpoint, not a late pre-PR-only gate — the story's own acceptance criteria already presume a best-fit was computed before the gate offers "file under the named best-fit" as an option.
- **Refuted alternative:** Leave the new concept unfiled and relax the validator to tolerate a "pending filing" state until the checkpoint resolves it. Viable, but it fragments the validator's clean, deterministic, byte-parity-gated contract by introducing a sentinel state into a tool whose strictness is the whole point.

### An approved domain or subdomain rides the same distillation-PR as its motivating page

- **Decision:** A new domain or subdomain approved at the gate is authored on the same distill branch as the motivating page, in the same distillation-PR. Synthesis drafts the new registry entry's title, slug, and rubric from the concept it just filed; the gate itself needs only the reviewer's choice, not free-text input, and the reviewer refines the draft during normal PR review.
- **Why:** The distillation-PR is already the sole authoritative write to the store, so routing vocabulary growth through it means the registry change is reviewed exactly where the page is reviewed and the store is never left referencing an undefined domain. Drafting the rubric text from the concept avoids blocking the drain on free-text input while still giving the reviewer a normal edit-in-review path.
- **Refuted alternative:** Author the registry change as its own separate PR ahead of the page. Rejected: it splits one decision across two reviews and opens a window where the page references a domain the trunk does not yet define.

### Per-page drift signals are deterministic neighbor-counting; community detection is confined to proposing missing domains and seeding

- **Decision:** Misfile, refinement, and staleness signals are computed by counting a page's resolved neighbors by domain. Community detection is used only for new-domain candidates and seed drafts, and its output is never written back onto a page or read by any tool as an index.
- **Why:** This is the decision that keeps the epic conformant with the concept store's grep-native-retrieval discipline, whose invariants forbid community detection as a retrieval mechanism and whose decision log records it as rejected across prior generations for unstable community identity. Neighbor-counting is local and stable under single-edge changes; community detection's instability is real but harmless when confined to reviewed, offline output.
- **Refuted alternative:** Run community detection for the per-page misfile signal too, for a single uniform mechanism. Rejected on the exact failure prior generations hit — a one-edge change would flip a page's community and thus its warning, producing noise the reviewer learns to ignore.

### One shared detection engine, two thin drivers

- **Decision:** The drift advisory and seed mode run identical detection code over the identical link graph. Only their input precondition (registry present vs. absent) and output shape (PR-body section vs. draft files) differ.
- **Why:** Putting all detection in one engine with drivers that carry no detection logic prevents the two call-sites from drifting apart — a threshold tweak or graph-construction fix lands in one place for both.
- **Refuted alternative:** Implement seed mode as its own adoption script that reuses "the same algorithm." Viable and independently shippable, but it guarantees divergence the first time either side is fixed and the other is forgotten — the epic explicitly calls for one engine.

### Community detection uses a deterministic-by-construction algorithm, not a seeded-random one

- **Decision:** Community detection uses a deterministic-by-construction method — greedy modularity-style agglomeration that merges the highest-gain pair each step and breaks every tie by slug order — rather than a standard randomized algorithm.
- **Why:** Byte-identical output on repeat runs over an unchanged store is a hard requirement, held to the same parity gate that governs the atlas generator. A deterministic-by-construction method is adequate at the store's scale.
- **Refuted alternative:** An off-the-shelf Louvain/Leiden or label-propagation implementation. These are the standard, better-quality community detectors, but their canonical forms randomize node visitation and tie-breaking; forcing them to byte-identity requires so much determinization that a deterministic-by-construction method is the simpler honest choice.

### The advisory is a non-blocking text producer; the gate is the only blocking taxonomy decision

- **Decision:** The gate (Story 1) is an interactive decision that halts the drain until the reviewer chooses. The advisory (Story 2) is a deterministic computation whose findings only populate the PR body; it always exits zero and never edits anything.
- **Why:** These are two points in the same drain with deliberately opposite blocking semantics. Keeping them structurally distinct — interactive halt vs. text emission — is what lets one block while the other never can.

## Constraints & Invariants

*Filing:*

1. With a registry present, synthesis writes a resolving `domain:` for every created concept before validation runs; it never writes an undefined domain and never leaves a created page unfiled.
2. Only a create-action delta writes `domain:`; update and retire deltas never add or change it — an existing page's filing is untouched by any update.
3. The three-way gate blocks the drain until resolved for every forced-fit concept and never fires for a clear-fit concept.
4. A new domain/subdomain approved at the gate is authored on the same distill branch as the motivating page, with its title/slug/rubric drafted by synthesis, and the store validator passes on that branch before the PR opens.

*Advisory:*

5. Per-page signals derive only from a page's resolved neighbor links; misfile is judged at domain granularity (a subdomain link counts toward its top-level domain) and refinement at subdomain granularity, and drift confined to sibling subdomains under a page's own domain is never a misfile.
6. Threshold comparisons use integer/exact arithmetic, never floating point; the thresholds (three links, two-thirds affinity, three-member communities, twenty-percent staleness) are named constants tunable without redesign.
7. The advisory always exits zero, never writes a concept page or the registry, and is never a validator or CI gate.
8. When filed-vs-detected disagreement reaches the store-wide threshold, the single staleness alarm replaces the per-page misfile and refinement flags; new-domain candidates, being store-level rather than page-by-page, remain visible.
9. The advisory computes over the same post-synthesis branch state the atlas is regenerated from, so advisory and atlas always agree about the store they describe.

*Detection engine and determinism:*

10. All inputs — pages and their neighbor lists — are canonically ordered by slug; the engine uses no wall-clock and no randomness and resolves every tie by slug order, so repeat runs over an unchanged store are byte-identical, held to the same parity and fingerprint gates as the atlas generator and validator.
11. Community-detection output is never persisted as page metadata or any store-read index; it exists only as reviewed PR text or a marked draft file — no new retrieval topology enters the store.

*Seed mode:*

12. Seed mode reads a store with no registry and writes only its draft outputs; it modifies no concept page, not the registry file, and not the atlas.
13. Seed output is explicitly marked as a draft requiring human curation before commit, and is byte-identical on repeat runs.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — Reopening the thrice-burned community-detection decision:** The concept store's grep-native-retrieval discipline records community detection as rejected across three prior design generations for unsolved community instability. This epic reopens it. The mitigation is the firewall in the detection-confinement decision and its invariant: community output is offline, advisory, human-reviewed, and never persisted as retrieval state, and it never drives per-page warnings. If that firewall is not accepted as sufficient, community detection must be cut and new-domain candidates/seed drafts descoped to link-density heuristics only.
- **ADDRESS — Determinism of community detection under the parity gate:** The portable tooling's byte-identical-output invariant is enforced by a parity check across a fresh build; any iteration-order or floating-point sensitivity in the detector would fail parity intermittently or across platforms. The mitigation rules out dropping in a standard Louvain/Leiden library and constrains the engineer to a deterministic-by-construction method.
