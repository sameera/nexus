---
title: "Close Record: Domain Filing and Drift Advisory in the Drain"
epic: "#94"
feature: "Concept Domain Taxonomy"
date: 2026-07-20
analyze: ran 2026-07-20 @ 1e368ef
range:
  - repo: github.com/sameera/nexus
    base: 459891962529c31e96404630a9f3a872bb725a05
    head: 1e368ef4eea9ca9337bbdf4c951ae5c6da70ac98
---

# Close Record: Domain Filing and Drift Advisory in the Drain

## Key Decisions

- **Fit-classification ties resolve to "forced," never "clear":** When synthesis is genuinely unsure whether a rubric covers a new concept, it flags a forced fit so the gate fires. The Success Metric requires that a new concept is never silently filed against the reviewer's judgment, and silence is only safe on a confident match. *Refuted:* defaulting ties to "clear" to minimize gate interruptions — rejected because it directly risks the "never silently filed" guarantee.

- **The filing gate ships as a prompt-only edit to `nxs.distill.md`, no application code:** Filing and the three-way taxonomy gate live entirely in the distill command prompt — no new TypeScript module, no spec. The decision record frames filing as a synthesis judgment, not a deterministic classifier, and repo precedent (commit `59dad02`) is a prompt-only gate addition to the same file. *Refuted:* a "prompt conformance" spec that greps the command markdown for required substrings — rejected as brittle test machinery with no repo precedent (passes on paraphrase, fails on harmless reword).

- **Community detection is integer-exact greedy modularity agglomeration, tie-broken by slug:** Merges are compared by `twoM*eAB - sigmaTot(A)*sigmaTot(B)` (no floating point) and every tie breaks by the pair's lexicographically smallest `(minSlug, maxSlug)` tuple. Byte-identical output under the parity/fingerprint gate forbids randomized visitation and float sensitivity. *Refuted:* an off-the-shelf Louvain/Leiden — better quality, but their randomized visitation/tie-breaking can't be held to byte-identity cheaply, so a deterministic-by-construction method is the honest choice.

- **Seed mode emits marked DRAFT files, not stdout:** Seed writes `domains.draft.md` (draft registry in the registry grammar) and `domain-filing-suggestions.draft.md` (per-page `domain:` list) into the resolved docs root — never `domains.md`, the atlas, or any page. A registry draft is a document a maintainer curates and eventually saves as the real registry, not transient text. *Refuted:* stdout-only, mirroring the drift advisory — rejected because the draft is a document to curate, not a PR-body section.

- **Parent grouping fires when cross-community density rivals the *sparser* community:** Two communities are grouped as subdomains under one parent when `dCross >= min(dInternal(A), dInternal(B))`, decided by integer cross-multiplication. The AC's "rivals internal density" is read as "a bridge as dense as the looser cluster's own fabric," and over-grouping in a draft is safe because the human splits. *Refuted:* requiring cross-density to rival *both* internals (`>= max`) — rejected as almost never firing on post-modularity communities, which would make the two-level feature vestigial.

- **Generic `candidate-domain-N` names, member-page evidence, and TODO rubrics:** Seed names domains/subdomains generically, lists each node's detected member pages as evidence, and leaves every filing rubric an explicit `TODO`. A registry-less store yields no deterministic semantic name, and a rubric is prose only a human can author; generic names plus evidence make the "rename and describe me" intent unmistakable and keep the draft honestly not-yet-valid until curated. *Refuted:* deriving a name from a representative member slug — rejected as arbitrary, collision-prone, and falsely suggesting the tool named the domain meaningfully.

- **Seed refuses when a registry already exists; parity asserts on the written files, not stdout:** `runCli` returns non-zero and writes nothing if a `domains.md` is present at the out dir, and the parity spec compares the two written draft files byte-for-byte. Seed's contract is "a store with no registry," so refusing prevents clobbering an authored registry; stdout intentionally echoes the differing absolute out-dir path, so the deterministic surface to assert on is the files. *Refuted:* always exit 0 and overwrite / compare stdout — rejected because overwriting a real registry is destructive and stdout is not the deterministic surface.

## Deviation Rationale

- **CLI self-invoke guards hardened with a basename check (`generate-atlas.ts`, `drift-advisory.ts`):** The Story-2 plan expected `generate-atlas.ts`'s only change to be the `export` keyword on `buildAdjacency` ("behavior identical"). Shipped code also adds `&& path.basename(process.argv[1]).startsWith("generate-atlas")` to its `import.meta.url` guard, and the same to `drift-advisory.ts`. *Why:* importing a module whose top level has a live `import.meta.url` CLI guard makes esbuild inline that guard's whole call graph into the importer's bundle; after bundling both guards share one `import.meta.url`, so the vendored `drift-advisory.mjs` was silently running the atlas generator's `main()` (which `process.exit`s) before its own guard ran. The basename check is the minimal fix — it stays true only when that file is the one actually invoked, in both `tsx` (source) and vendored-bundle form — and it preserves the decision record's verbatim reuse of `buildAdjacency` (Decision 2.2 / Invariant 9). No invariant broken; the record is silent on bundler internals.

- **The staleness alarm also suppresses low-priority sibling notes:** Invariant 8 literally names only "misfile and refinement" flags as replaced by the store-level alarm. Shipped `renderAdvisory` also drops low-priority sibling notes when the alarm fires, keeping only the store-level new-domain candidates. *Why:* AC5 says the alarm fires "in place of page-by-page flags," and a low-priority sibling note is a page-by-page flag; suppressing it resolves the gap between Invariant 8's enumerated list and AC5's stated intent. Consistent with the invariant's purpose (replace per-page noise with one store-level signal), not a relaxation of it.

## Deferred Scope

No scope was deferred. All three stories shipped fully (analyze: 14/14 acceptance criteria met, 0 unmet/contradicted). The epic's Out-of-Scope items (automatic re-filing, blocking CI on drift, running any specific store's migration) are permanent exclusions, not deferrals.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-20-domain-filing-drift.md`
