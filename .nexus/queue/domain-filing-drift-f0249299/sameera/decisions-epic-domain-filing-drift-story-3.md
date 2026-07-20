## 2026-07-20 — Seed mode ships as its own tool reusing the shared engine from `drift-advisory.ts`
- **Choice:** New `libs/portable-tools/src/seed-registry.ts` imports `detectCommunities` + `MIN_COMMUNITY_MEMBERS` from `drift-advisory.ts` and the graph helpers from `generate-atlas.ts`; it contains no detection logic of its own.
- **Why:** Realizes the decision record's "one shared detection engine, two thin drivers" — a threshold or graph-construction fix lands in one place for both the advisory and seeding. Story 2 exported `detectCommunities` explicitly for this.
- **Refuted alternative:** A standalone adoption script that reuses "the same algorithm" by copy — rejected: it guarantees the two sides diverge the first time either is fixed and the other forgotten (the decision record calls this out by name).

## 2026-07-20 — Seed emits marked DRAFT files, not stdout
- **Choice:** Write two files — `domains.draft.md` (draft registry in the registry grammar) and `domain-filing-suggestions.draft.md` (per-page `domain:` list) — into the resolved docs root, never `domains.md`, never the atlas, never a page.
- **Why:** The decision record's Chosen Approach names the seed driver as one that "emits marked draft files when none does" (vs. the drift driver's PR-body text). Files are the artifact a maintainer curates into a real registry (Invariant 12).
- **Refuted alternative:** Stdout-only, mirroring the drift advisory — rejected: a registry draft is a document to curate and eventually save as `domains.md`, not a transient PR-body section.

## 2026-07-20 — Parent grouping: cross density rivals the sparser community's internal density
- **Choice:** Two qualifying communities are grouped under one parent domain (as subdomains) when `dCross >= min(dInternal(A), dInternal(B))`, decided by integer cross-multiplication (no floats — Invariant 10).
- **Why:** The AC asks for "candidate parent groupings where cross-community link density rivals internal density." Comparing to the *sparser* side (the OR) reads "rivals" as "a genuine bridge as dense as the looser cluster's own fabric," and over-grouping in a draft is safe — the human splits.
- **Refuted alternative:** Require cross density to rival *both* internal densities (the stricter AND / `>= max`) — rejected as almost never firing on post-modularity communities, making the two-level feature vestigial.

## 2026-07-20 — Generic candidate names with member-page evidence and TODO rubrics
- **Choice:** Name domains/subdomains `candidate-domain-N` / `subdomain-N`, list each node's detected member pages as evidence, and leave every filing rubric as an explicit `TODO`.
- **Why:** A store with no registry gives no deterministic semantic name, and a rubric is prose only a human can author. Generic names + evidence make the draft's "rename and describe me" intent unmistakable, and the draft is honestly not-yet-valid until curated (AC3).
- **Refuted alternative:** Derive a name from a representative member slug — rejected as arbitrary, collision-prone, and falsely suggesting the tool named the domain meaningfully.

## 2026-07-20 — Reuse MIN_COMMUNITY_MEMBERS; sub-threshold pages are listed "ungrouped"
- **Choice:** Only communities with `>= MIN_COMMUNITY_MEMBERS` (3, the shared constant) become candidate domains; every other page is listed under an "Ungrouped — file by hand" section of the suggestions.
- **Why:** Keeps the shared-engine threshold identical to the drift advisory's new-domain-candidate bar, and avoids a draft where every isolated page is its own one-page domain (unusable noise).
- **Refuted alternative:** Turn every community, including singletons and pairs, into a candidate domain — rejected as producing a draft a maintainer would discard.

## 2026-07-20 — Refuse when a registry already exists; parity compares files, not stdout
- **Choice:** `runCli` returns non-zero and writes nothing when a `domains.md` already exists at the out dir. The parity spec block compares the two written draft files byte-for-byte (not stdout, which carries the differing out-dir path).
- **Why:** Seed mode's contract is "a store with no registry" (Invariant 12); refusing prevents clobbering an authored registry. Stdout intentionally echoes the absolute out path for the operator, so byte-parity must be asserted on the deterministic artifact — the files — exactly as the atlas parity block does.
- **Refuted alternative:** Always exit 0 and overwrite / compare stdout — rejected: overwriting a real registry is destructive, and stdout is not the deterministic surface.
