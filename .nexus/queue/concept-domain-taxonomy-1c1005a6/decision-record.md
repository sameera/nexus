---
title: "Decision Record: Domain Taxonomy for the Concept Store"
epic: #89
feature: "Concept Domain Taxonomy"
rating: M
concepts: ["concept-store", "portable-tooling"]
date: 2026-07-19
---

# Decision Record: Domain Taxonomy for the Concept Store

## Summary

Replace the atlas's derived, link-density headings with a curated two-level taxonomy authored in a `domains.md` registry that lives beside the atlas. A single shared parser turns that registry into an ordered tree consumed by both the validator and the atlas generator; the validator gains registry-structure and per-page `domain:` findings, and the atlas becomes a pure projection of the registry. Every new rule is gated on the registry's presence, so a store without a registry stays byte-identical to today.

## Chosen Approach

One registry grammar and one parser feed both tools. The validator layers a store-level pass on top of its existing per-file checks: whenever the registry is present it parses and structurally validates it once per run, then resolves each page's `domain:` against it. The atlas, when the registry is present, renders headings strictly in registry order and files each active page under its resolved node; when the registry is absent, it takes the existing connected-components clustering path unchanged. Presence of the registry file is the only activation switch — there is no config flag. The parity corpus and the vendored portable bundles grow with the source in the same PRs.

## Key Decisions

### One shared registry parser, used by both tools

- **Decision:** the registry grammar gets a single parser that both the atlas generator and the validator call.
- **Why:** the two tools must agree exactly on what the registry means, and at drain they run at different times — the atlas regenerates before the validator runs — so each must parse independently. A shared parser makes their agreement structural rather than hoped-for, and it adds no runtime dependency at the portable-runtime boundary because the build inlines the module into each bundle.
- **Refuted alternative:** duplicate the parser in each tool, matching the trivial frontmatter reader each tool already duplicates today. Viable, and it keeps each bundle's dependency graph flat, but the existing duplication is a one-line reader where drift is cheap and obvious; the registry is a two-level tree with slug-path identity, ordering, and rubrics, where two copies is a real correctness hazard — the whole design rests on both tools trusting one grammar.

### Registry validation is a store-level pass, gated on presence, not on the file list

- **Decision:** when the registry is present, the validator parses and validates it once per invocation and resolves every page under scrutiny against it — regardless of whether the registry file itself appears in the argument list.
- **Why:** the drain calls the validator with only the changed page paths. If registry checks only fired when the registry itself was an argument, a malformed registry would never be caught at drain, and a changed page's `domain:` would have no registry to resolve against. Registry integrity is inherently a store-level concern, unlike every per-file check the validator does today.
- **Refuted alternative:** validate the registry only when it is passed as a file argument, keeping the validator strictly per-file. Simpler and consistent with the current architecture, but it leaves the drain gate blind to registry malformations and breaks `domain:` resolution — the exact cases Stories 1 and 2 require.

### Activation-on-presence, with the file as the only switch

- **Decision:** every new rule — registry structure, the `domain:` requirement, curated atlas rendering — fires only when the registry file exists; there is no config flag.
- **Why:** the file's presence is the opt-in. Existing consumers stay green until they author a registry, which matches the epic's "stores without a registry are untouched" and defers migration to the follow-on epic.
- **Refuted alternative:** a config flag / opt-in switch. Viable, but it creates a second source of truth that can disagree with reality — flag on with no file, or the reverse; presence-activation is self-consistent and needs no new config surface.

### The registry lives beside the atlas, and the validator resolves the docs root to find it

- **Decision:** the registry sits in the resolved docs root next to the atlas, per the epic; the validator resolves the docs root the same way the atlas already does, so both agree on which file is the registry, and it is never validated as a concept page.
- **Why:** it is authored human-surface state co-located with the derived atlas it drives, and resolving it identically in both tools guarantees they never disagree about the registry's location.
- **Refuted alternative:** place the registry beside the concept pages in the machine store. Viable — it keeps the validator's dependency surface minimal (no docs-root resolution) and keeps the registry inside the machine store. It loses against the epic's explicit "beside the atlas" wording and would require both the page loader and the validator's page scan to add a skip rule so the registry isn't mistaken for a page.

### Parent filing stays legal when subdomains exist

- **Decision:** a page may file at a parent domain path even when that domain has subdomains; the atlas lists such pages directly under the domain heading, before the first subdomain heading.
- **Why:** it makes refining a domain incremental — add a child, move the pages that fit — instead of forcing a store-wide re-file each time a subdomain is created.
- **Refuted alternative:** require leaf filing whenever a domain has subdomains. It yields a tidier "every page at a leaf" tree, but it makes adding one subdomain a breaking change that invalidates every parent-filed page in the same PR — the store-wide re-file the epic exists to avoid.

### Two-level hard cap

- **Decision:** the grammar and validator cap nesting at domain plus subdomain; a third level is a finding naming the offending entry.
- **Why:** two levels orient a reader; deeper nesting reintroduces the maintenance and ambiguity the curated taxonomy is meant to remove, and the atlas has only domain and subdomain headings to render into. It is an explicit scope boundary.
- **Refuted alternative:** arbitrary-depth nesting. More expressive, but complexity without demonstrated need and no rendering target beyond two levels.

### Full slug-path is the identity; leaf slugs may repeat

- **Decision:** an entry's identity is its full slash-form path; duplicate full paths are a finding, but the same leaf slug may appear under different parents.
- **Why:** `domain:` references and the atlas render the full path, so uniqueness must be on the path — otherwise a natural sub-category name like "catalog" could not exist under two different domains.
- **Refuted alternative:** globally-unique leaf slugs. Simpler references, but it forbids the same sub-category name under two parents and makes the path form the epic specifies ambiguous. (Domain slugs are a namespace distinct from the existing one-slug-one-page page constraint, so there is no collision between the two.)

### The Decision Log exemption is scoped to domain-only changes

- **Decision:** the drain-time "exactly one new Decision Log entry" rule is skipped only when base and head are identical after normalizing out the `domain:` field; any other difference re-arms the rule, and the append-only prior-entries check always holds.
- **Why:** re-filing is orientation metadata, not knowledge, so it carries no "why" worth logging; forcing an entry per re-file would pollute the immutable history and make the follow-on bulk seed impossibly chatty.
- **Refuted alternative:** exempt any frontmatter-only change from the one-entry rule. Simpler — compare bodies only — but other frontmatter such as status, provenance, and the `touches` links is knowledge- or provenance-bearing and legitimately should carry an entry; the exemption must be scoped to exactly the orientation field.

### The atlas renders in registry order; the fallback path is untouched

- **Decision:** in registry mode the atlas emits nodes in registry order (order is display order, no degree sorting), with pages within a node in a fixed deterministic order; the no-registry path is the existing clustering code, gated on registry absence, and `--check` resolves the identical location and registry as write mode.
- **Why:** registry order is the human-controlled, stable ordering that ends the link-density accident, while the untouched fallback preserves byte-identity and the existing parity and `--check` guarantees.
- **Refuted alternative:** none viable — any non-deterministic ordering breaks the parity gate outright.

## Constraints & Invariants

**Registry grammar / parser**

1. The grammar is one heading per domain and one sub-heading per subdomain, each followed by a slug line and a one-paragraph filing rubric; the parser returns the ordered tree of title, full slug path, and rubric per entry, in registry order.
2. Slug paths are slash-form and the full path is the entry's identity; domain slugs form a namespace separate from page slugs.
3. The parse is total — it never throws on a malformed registry — because the atlas parses it at drain before the validator has run.

**Validator**

4. New findings (a third nesting level, a duplicate slug path, an entry missing its title/slug/rubric, and a page whose `domain:` is absent or unresolvable) use the existing finding shape and block the PR exactly as current findings do.
5. All registry and `domain:` rules fire only when the registry is present; with no registry, the validator's findings and exit codes are byte-for-byte the pre-change behavior.
6. The registry is validated by its own grammar and never as a concept page — no Decision Log or concept-page content rules apply to it.
7. A page filed at a parent path that has subdomains resolves and passes; the Decision Log exemption fires only for a change whose sole difference is the `domain:` field.

**Atlas**

8. In registry mode the atlas renders one heading per domain and one sub-heading per subdomain in registry order, each subdomain heading showing its own title, parent-filed pages listed under the domain heading before the first subdomain, and pages within a node in a fixed deterministic order.
9. Every active page is listed exactly once and never silently dropped; the validator is the gate that rejects a misfile.
10. The no-registry path is the existing clustering code unchanged and byte-identical to pre-change output; the derived-atlas header, active-concept count, determinism across runs, and `--check` semantics are all preserved.

**Portable bundles / parity**

11. The shared parser is inlined into both the validator and atlas bundles by the build, so any story that changes inlined source re-vendors in the same PR to keep the fingerprint pin green on every commit.
12. The parity corpus grows a well-formed registry plus one fixture per malformation, a registry-mode atlas case, and a preserved no-registry atlas case asserting byte-identity to pre-change output.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — the Decision Log exemption loosens the append-only integrity gate:** an over-broad "domain-only change" test could let real knowledge changes escape the one-entry requirement. Scope the exemption to the case where base and head are byte-identical after removing the `domain:` line, and cover it with three fixtures — a domain-only change (exempt, passes), a domain-plus-body change (not exempt, must carry an entry), and a body-only change (unchanged behavior).
- **ADDRESS — the no-registry atlas fallback could silently regress to non-byte-identical output:** a success metric and the parity gate both depend on unchanged bytes for stores that have not adopted, so a careless refactor of the shared rendering path could perturb them and break every existing consumer's next `--check`. Keep the existing clustering and render path untouched and reached only when the registry is absent, and keep a no-registry parity corpus case asserting byte-identity to the pre-change output.

## Open Clarifications

_None._ The epic is fully specified on every human-only decision — registry location, the two-level cap, slug-path identity, parent filing, activation-on-presence, and the re-filing exemption are all stated. The registry's exact surface syntax is an engineer's call within the Story 1 acceptance criteria.
