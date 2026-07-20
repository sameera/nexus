# Implementation Plan — STORY-94.02: A drift advisory surfaces taxonomy decay in the distillation-PR

GitHub issue: **#96**. Epic: #94 (`.nexus/queue/domain-filing-drift-f0249299/epic.md`).
Binding authority: `.nexus/queue/domain-filing-drift-f0249299/decision-record.md`.
Current branch: `epic/domain-filing-drift-story-2` (already checked out — commit directly here).

Executor: follow this plan verbatim. Every path, line anchor, signature, and command below is
verified against the merged repo at HEAD (`34aab75`, with Story 1's `ad27aae` already landed). Do
**not** re-explore — every fact you need is here. Read the whole plan, especially §2, before
touching any file. §2 explains the one big shape difference from Story 1: **Story 1 was a
prompt-only edit; Story 2 is real application source** — a new deterministic tool held to the same
parity/fingerprint gate as the atlas generator and validator, wired into the prompt at the end.

---

## 1. Goal

Ship a deterministic, thresholded, non-blocking **drift advisory** that computes taxonomy decay
from the concept link graph and writes it into the distillation-PR body. "Done" == Story 2's seven
ACs:

- **AC1** — a page with ≥3 resolved links, ≥2/3 landing under one *other* domain's subtree → a
  **cross-domain misfile** flag naming the page and both domains.
- **AC2** — a page whose drift is only toward *sibling subdomains under its own domain* → **at most
  a low-priority note, never a misfile flag** (misfile is judged at domain granularity).
- **AC3** — a *parent-filed* page with ≥2/3 of its links into one subdomain → a **refinement hint**
  naming that subdomain.
- **AC4** — a detected link community of ≥3 pages with *no majority domain* → a **new-domain
  candidate** listing those pages.
- **AC5** — filed-vs-detected disagreement affecting ≥20% of the store's pages → a **single
  store-level staleness alarm** that *replaces* the per-page flags (new-domain candidates survive).
- **AC6** — a store with no signal above thresholds → the section is **empty or omitted**.
- **AC7** — an unchanged store run twice → **byte-identical** output, and the step **exits zero**
  whether or not findings exist (advisory-only — never a CI gate, never a page/registry edit).

The advisory runs only when a domain registry exists (mirrors Story 1's filing gate). This repo has
**no** `docs/domains.md` today (verified, §3), so a real `/nxs.distill` run stays unaffected until a
registry is authored — the tool is inert and the prompt skips the step, exactly like the taxonomy
gate.

---

## 2. Judgment calls already made — do not re-decide

### 2.0 — This story IS application source (a new deterministic tool), unlike Story 1 (read first)

Story 1's plan argued (correctly, for *filing*) that domain choice is a synthesis judgment, so it
shipped as a prompt edit with no TypeScript. **Story 2 is the opposite.** The decision record makes
the advisory a deterministic computation: *"a deterministic drift advisory … runs with the drain's
other deterministic steps,"* *"Threshold comparisons use integer/exact arithmetic, never floating
point,"* and Invariant 10 — *"the engine uses no wall-clock and no randomness and resolves every tie
by slug order, so repeat runs over an unchanged store are byte-identical, held to the same parity
and fingerprint gates as the atlas generator and validator."* That is unambiguously code, held to
the SAME gate as `generate-atlas.ts` / `validate-concepts.ts`. So this story adds a new tool
`libs/portable-tools/src/drift-advisory.ts` (+ its spec), registers it as a bundle entry point,
re-vendors the fingerprint pin, and the prompt merely *invokes* it and pastes its stdout into the
PR body. **CLAUDE.md's TFD + 95%-coverage mandate fully applies to `drift-advisory.ts`.**

### 2.1 — The advisory is a stdout-only text producer; it NEVER writes a file

Invariant 7: the advisory *"always exits zero, never writes a concept page or the registry, and is
never a validator or CI gate."* The tool prints markdown to **stdout** and returns **0
unconditionally** (even on internal weirdness — there is no error path that exits non-zero). The
prompt captures that stdout and injects it into the PR body. Nothing the advisory produces is ever
`git add`ed. Do not have it write to `docs/`, the registry, or any page.

### 2.2 — Reuse the atlas's exact graph construction (Invariant 9 — advisory and atlas agree)

Invariant 9: the advisory *"computes over the same post-synthesis branch state the atlas is
regenerated from, so advisory and atlas always agree about the store they describe."* The strongest
way to guarantee that is to build the link graph with the *same code* the atlas uses. So:
`drift-advisory.ts` imports `loadConceptPages`, `ConceptPage`, and `buildAdjacency` from
`generate-atlas.ts`. `loadConceptPages` and `ConceptPage` are **already exported**; `buildAdjacency`
is currently module-private — Step 2 exports it (a one-word edit, no behavior change).
**Refuted alternative:** duplicating the ~12-line adjacency builder inside `drift-advisory.ts` to
keep the file standalone — rejected because Invariant 9 wants literal agreement, and re-vendor
already covers the resulting `generate-atlas.mjs` hash bump. (Record this as a decision stub, §6.)

### 2.3 — Per-page signals are pure neighbor-counting; community detection is used ONLY for AC4

Decision record ("Per-page drift signals are deterministic neighbor-counting; community detection is
confined to proposing missing domains and seeding"): misfile (AC1), the sibling note (AC2), and the
refinement hint (AC3) are computed by **counting a page's resolved neighbors by domain** — local,
stable, self-explanatory. **Community detection is used only for the new-domain candidate (AC4).**
Never use community detection for a per-page warning — that is the exact churn the "thrice-burned"
risk forbids.

### 2.4 — Misfile is judged at DOMAIN granularity; refinement at SUBDOMAIN granularity

Invariant 5. A neighbor link into a subdomain counts toward its **top-level domain** for the misfile
test. So a page filed under `connectors/catalog` whose links pile into `connectors/runtime` has its
majority *domain* = `connectors` = its own domain → **not a misfile** (that is AC2's sibling case,
at most a low-priority note). The refinement test (AC3) is the one that looks at subdomain
granularity, and only for **parent-filed** pages (filed at a top-level domain path, no `/`).

### 2.5 — Every threshold is an exported named constant compared with integer/exact arithmetic

Invariant 6. Constants live in `drift-advisory.ts`, tunable without redesign:
`MIN_LINKS = 3`, `AFFINITY_NUM = 2`, `AFFINITY_DEN = 3`, `MIN_COMMUNITY_MEMBERS = 3`,
`STALENESS_NUM = 1`, `STALENESS_DEN = 5` (20%). Every comparison is integer:
- 2/3 affinity of `count` out of `total`: `AFFINITY_DEN * count >= AFFINITY_NUM * total`
  (i.e. `3 * count >= 2 * total`).
- 20% staleness of `affected` out of `total`: `STALENESS_DEN * affected >= STALENESS_NUM * total`
  wait — write it as `affected * STALENESS_DEN >= total * STALENESS_NUM` → `affected * 5 >= total`
  (≥20%). **No floating point anywhere**, including community detection (§2.7).

### 2.6 — Community detection: deterministic-by-construction greedy modularity, integer ΔQ

Decision record ("Community detection uses a deterministic-by-construction algorithm"): greedy
modularity-style agglomeration, merge the highest-gain pair each step, break every tie by slug
order. Do **not** drop in Louvain/Leiden/label-propagation. §5 T4 and §6 pin the exact integer
formulation (the CNM merge gain, cleared of its denominator so the comparison is integer-exact) —
implement that, not a floating-point modularity.

### 2.7 — The staleness alarm replaces ALL per-page sections, not just misfile+refinement

Invariant 8 names "misfile and refinement flags"; it is silent on the AC2 low-priority note. AC5
says the alarm fires *"in place of page-by-page flags."* Resolution: **when the alarm fires,
`renderAdvisory` suppresses every per-page section — misfiles, refinement hints, AND low-priority
notes — and keeps only the new-domain candidates** (store-level, per Invariant 8). This is an
interpretive gap in the decision record, not a conflict; record it as a decision stub (§6). The
staleness numerator is the **misfile count** (filed-vs-detected disagreement = a page whose links
concentrate ≥2/3 under an *other* domain); denominator is total active pages.

### 2.8 — The advisory runs once, store-level, over the final branch state (after the taxonomy gate)

It is NOT a per-entry Phase 5 step. It reads the whole store and must see any registry entry /
re-file that Phase 6.2's taxonomy gate just landed. So it runs once at the **top of Phase 6.3**,
after Phase 6.2, before the checkpoint renders — feeding both the checkpoint's one-line summary and
the Phase 7 PR body. It always runs when a registry exists, even when zero forced fits made 6.1/6.2
no-ops.

### 2.9 — Below-threshold output is the empty string (the section is then omitted)

AC6. When there are no findings and no alarm, `renderAdvisory` returns `""` (empty string), the CLI
prints nothing, exit 0. The prompt then omits the PR-body advisory section (or prints "clean"). This
makes AC6 and AC7 (byte-identical, exit 0) trivially hold on a quiet store.

---

## 3. Ground truth (verified paths, anchors, signatures, commands)

### Files this story CREATES
- `libs/portable-tools/src/drift-advisory.ts` — the detection engine + drift driver + CLI.
- `libs/portable-tools/src/drift-advisory.spec.ts` — its unit spec (TFD, 95% coverage).
- `libs/portable-tools/corpus/drift/docs/domains.md` — parity-corpus registry fixture.
- `libs/portable-tools/corpus/drift/concepts/*.md` — parity-corpus concept fixtures.

### Files this story EDITS
- `libs/portable-tools/src/generate-atlas.ts` — export `buildAdjacency` (Step 2). Verified anchors:
  - `ConceptPage` interface at **lines 72-78**: `{ slug, title, touches: string[], hook, domain? }`.
  - `loadConceptPages(conceptsDir: string): ConceptPage[]` at **line 188** (already `export`ed) —
    returns active pages with `.slug`, `.touches`, `.domain` (`""` when absent), `.title`, `.hook`.
  - `function buildAdjacency(pages: ConceptPage[]): Map<string, Set<string>>` at **line 217** —
    currently NOT exported. Builds an **undirected, deduped** graph: every active page is a node
    (isolated pages get an empty set); an edge is added iff `touched !== page.slug && slugs.has(touched)`
    (self-links and dangling touches dropped), mirrored on both endpoints. **This is the exact graph
    the advisory counts over.** Change `function buildAdjacency` → `export function buildAdjacency`.
  - `export function registryPath(): string` at **line 50** — `path.join(localDocsRoot(cwd).ok ?
    docsRoot : "docs", "domains.md")`. Reuse this for the advisory's default registry location.
- `libs/portable-tools/src/build-bundles.ts` — `ENTRY_POINTS` at **lines 10-15**. Add
  `"drift-advisory": "drift-advisory.ts",`. (This is the ONLY registration needed: `parity.spec.ts`,
  `build-bundles.spec.ts`, and `vendor-bundle.spec.ts` all derive their expectations from
  `Object.keys(ENTRY_POINTS)` dynamically — verified — so no hardcoded list needs touching.)
- `libs/portable-tools/src/parity.spec.ts` — add one `describe` block: source-vs-bundle byte-parity
  over `corpus/drift` (Step 5, mirrors the existing "atlas parity — registry mode" block at
  **lines 230-251**).
- `package.json` — `scripts` at **lines 19-24**. Add
  `"nexus:drift-advisory": "tsx libs/portable-tools/src/drift-advisory.ts",`.
- `.claude/commands/nxs.distill.md` — wire the step + PR body (Step 6). Verified anchors quoted in
  Step 6. `tools:` frontmatter already lists `Bash` (line 5) — no change needed.
- `libs/portable-tools/bundle-fingerprint.json` — regenerated by re-vendor (Step 7), NOT hand-edited.
  Current keys: `generate-atlas.mjs`, `validate-concepts.mjs`, `derive-entry-diff.mjs`, `nexus.mjs`,
  `claude-components`. After re-vendor it gains `drift-advisory.mjs` and its `generate-atlas.mjs`
  hash changes (from the export edit).

### Files this story MUST NOT touch (Story 1 done, Story 3 turf, or already-correct)
- `validate-concepts.ts` — the validator is untouched. The advisory never validates.
- `domain-registry.ts` — reuse `parseDomainRegistry(content) → { domains: DomainNode[], findings }`.
  `DomainNode = { title, slug, path, rubric, subdomains: DomainNode[] }` (**lines 14-20**). A
  subdomain's `.path` is `<parent-slug>/<own-slug>` (e.g. `connectors/catalog`); a domain's `.path`
  is its own slug. Do not edit this file.
- `nxs.distill.md` Phases 0-5, 6.1, 6.2, 7's non-advisory content — leave as Story 1 left them.

### Existing dependencies to reuse (import directly — CLAUDE.md forbids barrels)
- From `./generate-atlas.js`: `loadConceptPages`, `buildAdjacency` (after Step 2), `registryPath`,
  type `ConceptPage`.
- From `./domain-registry.js`: `parseDomainRegistry`, types `ParsedRegistry`, `DomainNode`.
- Node builtins `node:fs`, `node:path` for the CLI (`--concepts-dir`, `--registry` args); `argv`
  parsing follows `generate-atlas.ts`'s `parseArgs` shape (**lines 85-98**).

### Registry + concept shapes (from the live corpus, verified)
- Registry grammar (`corpus/registry/docs/domains.md`): `## Domain` + backticked slug + rubric;
  `### Subdomain` nested under it. `parseDomainRegistry` returns the tree; use each node's `.path`.
- Concept frontmatter carries `domain:` as a full path string, e.g. `domain: connectors`,
  `domain: connectors/catalog`, `domain: sources` (see `corpus/registry/concepts/{alpha,beta,gamma}.md`).
  `loadConceptPages` surfaces it as `page.domain` (`""` when the page has none).

### Test runner + baseline (verified at plan time)
- Full suite: `npx nx test @nexus/portable-tools` → **295 tests, 16 files, all green** (baseline).
  After this story: the count grows by the new `drift-advisory.spec.ts` tests plus the new parity
  block; every pre-existing test must still pass.
- Coverage (vitest v8, configured in `vitest.config.mts`): `npx nx test @nexus/portable-tools -- --coverage`.
- Bundle + pin: `pnpm nexus:vendor-tools` rewrites `bundle-fingerprint.json` in place (no
  `--tools-dir` → pin only, no artifact copy — verified in `vendor-bundle.ts` lines 105-112).
- Determinism gate mechanics (`parity.spec.ts`): `beforeAll` builds a fresh bundle per
  `ENTRY_POINTS` entry and hashes it into `freshFingerprint[`${name}.mjs`]`; the "fingerprint pin"
  test asserts `freshFingerprint == committed pin`. Adding `drift-advisory` to `ENTRY_POINTS`
  therefore **requires** the re-vendor, or that test fails naming `drift-advisory.mjs: no pin entry`.

### Decision-record clauses this plan cites
Invariants 5 (per-page granularity), 6 (integer thresholds, named constants), 7 (exits zero, never
writes, never a gate), 8 (alarm replaces per-page flags; candidates survive), 9 (same state as the
atlas), 10 (canonical slug ordering, no wall-clock/randomness, same parity+fingerprint gate), 11
(community output never persisted). Key Decisions: "neighbor-counting vs community detection",
"one shared engine, two thin drivers", "deterministic-by-construction algorithm", "advisory is a
non-blocking text producer".

---

## 4. Out of scope (do not touch / do not build)

- **Story 1 (issue #95) — filing + the taxonomy gate.** Already merged (`ad27aae`). Do not change
  Phase 2's registry survey, Phase 3's `domain`/`domain_fit`/draft synthesis, Phase 6.1/6.2, or the
  validator's `domain:` check. The advisory *reads* the `domain:` those wrote; it never sets one.
- **Story 3 (issue #97) — seed mode.** Do **not** implement a seed driver, a draft-registry
  emitter, per-page filing suggestions, or a no-registry adoption path. Specifically: **create no
  `seed`/`seed-registry` CLI, no `--seed` flag, no draft-file writer, no "candidate parent
  groupings" output.** Story 3 will *import* the reusable detection functions this story exports
  (`detectCommunities`, and the shared graph helpers) and add its own thin driver — so **export
  `detectCommunities` from `drift-advisory.ts`** for Story 3 to reuse, but ship no seed behavior
  here. Do not modify `docs/` or create `docs/domains.md`.
- **Community detection as a per-page signal or a persisted index** (Invariant 11) — never. Its
  output is only the AC4 candidate text in the PR body. Never write it onto a page or into any file.
- **Blocking / CI semantics.** The advisory never exits non-zero, never gates, never edits. Do not
  add it to any validator path or make any drain step depend on its exit code.
- **`validate-concepts.ts`, `domain-registry.ts`** — no edits. The only production file edited
  outside the new tool is `generate-atlas.ts` (one `export` keyword, Step 2) and `build-bundles.ts`
  (one `ENTRY_POINTS` line).

---

## 5. Tests first (TFD) — `libs/portable-tools/src/drift-advisory.spec.ts`

Write this spec FIRST and watch it fail RED (the module doesn't exist yet), then implement §6 until
GREEN. Runner: `npx nx test @nexus/portable-tools`. Follow the repo's spec conventions
(`generate-atlas.spec.ts`): a local `writeConcept`/`makeTmpDir` helper OR test the pure functions
directly against in-memory `ConceptPage[]` + a `parseDomainRegistry(fixtureString)` result. Assert
on **structural markers and named slugs/domains**, not full sentences (CLAUDE.md: don't assert exact
strings unless the text is the requirement). One shared registry fixture (mirror
`REGISTRY_WELL_FORMED` from `generate-atlas.spec.ts` lines 35-62: domains `connectors` {`catalog`,
`runtime`} and `sources` {`catalog`}).

Test the exported pure functions `computeAdvisory(pages, registry)` and `renderAdvisory(findings)`
and `detectCommunities(adjacency)` and `runCli(argv)`.

**T1 — AC1: cross-domain misfile.** A page `p` filed `domain: sources`, with `touches` (reciprocated
so adjacency is symmetric) to 3 pages all filed under `connectors`/its subdomains (e.g.
`connectors`, `connectors/catalog`, `connectors/runtime`). Assert `computeAdvisory` returns exactly
one misfile whose `slug === "p"`, `filedDomain` top-level `sources`, `otherDomain === "connectors"`,
`count === 3`, `total === 3`; and `renderAdvisory` output contains `### Cross-domain misfiles`,
`` `p` ``, `sources`, `connectors`. Guard the threshold: with only 2 of 3 links under `connectors`
(1 under `sources`), assert **no** misfile (2/3 exactly meets `3*2 >= 2*3`=`6>=6` → IS a misfile, so
use 1-of-2-other or 1-of-3 to get the negative). Add a boundary case: exactly `3*count >= 2*total`
holds at the 2/3 line (e.g. 2 of 3) → flagged; just under (e.g. 1 of 3, or 3 of 5) → not.

**T2 — AC2: sibling-subdomain drift is at most a low-priority note, never a misfile.** A page filed
`domain: connectors/catalog` whose 3 links all land under `connectors/runtime` (sibling subdomain,
same top-level `connectors`). Assert `computeAdvisory` returns **zero misfiles** and a low-priority
note for that page naming subdomain `connectors/runtime`; `renderAdvisory` output contains
`### Low-priority notes` and NOT `### Cross-domain misfiles`.

**T3 — AC3: refinement hint for a parent-filed page.** A page filed `domain: connectors`
(parent-filed, no `/`) with ≥3 links, ≥2/3 into `connectors/catalog`. Assert one refinement naming
`slug` and subdomain `connectors/catalog`; `renderAdvisory` contains `### Refinement hints` and
`connectors/catalog`. Guard: a *subdomain-filed* page (`connectors/catalog`) with the same link
pattern yields **no** refinement (refinement is parent-filed only) — it is the T2 note path instead.

**T4 — AC4: new-domain candidate from a ≥3-page community with no majority domain.** Build an
adjacency where 3+ pages are densely interlinked but split across domains so no single top-level
domain holds a majority (e.g. members filed `sources`, `connectors`, `connectors` — 2 of 3 is a
majority, so use `sources`, `connectors`, `<a third domain>` or 3 distinct domains among 3 members,
or a 4-member community 2/2). Assert `detectCommunities(adjacency)` groups them into one community,
and `computeAdvisory` emits one candidate listing those member slugs in slug order;
`renderAdvisory` contains `### New-domain candidates` and each slug. Add a determinism assertion:
`detectCommunities` returns identical arrays on repeated calls, and a community of exactly 2 (below
`MIN_COMMUNITY_MEMBERS`) yields **no** candidate. Also assert a 3-member community that DOES have a
majority domain (e.g. all 3 under `connectors`) yields **no** candidate.

**T5 — AC5: ≥20% store-level staleness alarm replaces per-page flags.** Build a store where the
misfile count is ≥20% of total active pages (e.g. 5 pages, 1 clear misfile → `1*5 >= 5` → fires; or
tune to make several misfiles). Assert `computeAdvisory` sets `staleness` non-null with
`affected`/`total` correct, and `renderAdvisory` contains `### Store-level staleness alarm`, mentions
`re-filing`, and does **NOT** contain `### Cross-domain misfiles` / `### Refinement hints` /
`### Low-priority notes` (they are replaced). If the same store also has a new-domain candidate,
assert `### New-domain candidates` **still appears** (candidates survive the alarm — Invariant 8).
Boundary: just under 20% (`affected*5 < total`) → no alarm, per-page flags present.

**T6 — AC6: below every threshold → empty/omitted.** A clean store (every page's links agree with
its filing, no qualifying community). Assert `computeAdvisory` returns all-empty findings + null
staleness, and `renderAdvisory(findings) === ""` (empty string). Assert `runCli` over such a store
prints nothing and returns 0.

**T7 — AC7: byte-identical twice + exits zero regardless.** (a) `renderAdvisory(computeAdvisory(...))`
called twice on the same inputs returns the identical string (findings AND clean cases). (b)
`runCli(["--concepts-dir", dir, "--registry", regPath])` returns **0** both when findings exist and
when they don't, and writing its stdout to a buffer twice yields identical bytes. (c) `runCli` with a
registry path that does not exist (no registry) returns **0** and prints an empty advisory
(self-guard, §2.9). Assert the CLI never throws and never returns non-zero. (Capture stdout by
spying on `console.log`, or by having `runCli` accept an injected writer — match whatever
`generate-atlas.spec.ts`'s `runCli` tests do: they call `runCli` and read the written file; here
read captured stdout.)

**T8 — engine unit coverage (for 95%).** Direct tests of `detectCommunities` on: an empty graph
(no nodes → `[]`), all-isolated nodes (each its own singleton, none ≥3), a single fully-connected
triangle (one community of 3), and a tie-break case (two equal-gain merges resolve by slug order —
assert the deterministic grouping). Test `topLevelDomain("a/b") === "a"`, `topLevelDomain("a") === "a"`,
`topLevelDomain("") === ""`. These pin the integer-ΔQ merge and the determinism the parity gate
enforces.

The **parity** byte-identity check (source-vs-bundle) is added to `parity.spec.ts` in Step 5, not
here.

---

## 6. Steps

### Step 1 — write the failing spec (§5) → confirm RED
Create `libs/portable-tools/src/drift-advisory.spec.ts` with T1-T8. `npx nx test @nexus/portable-tools`
must fail on the missing module. This is your TFD checkpoint.

### Step 2 — export `buildAdjacency` from `generate-atlas.ts`
Find (line 217):
```
function buildAdjacency(pages: ConceptPage[]): Map<string, Set<string>> {
```
Replace:
```
export function buildAdjacency(pages: ConceptPage[]): Map<string, Set<string>> {
```
No other change to that file. (Behavior identical → the atlas parity byte-identity tests still pass;
only the bundle bytes change, covered by re-vendor in Step 7.)

### Step 3 — create `libs/portable-tools/src/drift-advisory.ts`

Structure (implement to satisfy §5; signatures and algorithm are binding):

```
/**
 * Deterministic taxonomy drift advisory (epic #94, STORY-94.02). Reads the same concept link graph
 * and filings the atlas is built from, and reports taxonomy decay as PR-body markdown: cross-domain
 * misfiles, refinement hints, low-priority sibling notes, new-domain candidates, and a store-level
 * staleness alarm. Advisory only — always exits 0, never writes a page or the registry, never a CI
 * gate (decision-record Invariant 7). Deterministic by construction: slug-ordered, integer/exact
 * arithmetic, no wall-clock, no randomness (Invariants 6, 10) — held to the same parity + fingerprint
 * gate as the atlas generator and validator.
 *
 * The detection engine here is shared: STORY-94.03 (seed mode) imports detectCommunities and the
 * graph helpers and adds its own thin driver. This file ships NO seed behavior.
 */
import * as fs from "node:fs";
import { buildAdjacency, loadConceptPages, registryPath, type ConceptPage } from "./generate-atlas.js";
import { parseDomainRegistry, type ParsedRegistry } from "./domain-registry.js";

export const MIN_LINKS = 3;
export const AFFINITY_NUM = 2;            // 2/3 affinity
export const AFFINITY_DEN = 3;
export const MIN_COMMUNITY_MEMBERS = 3;
export const STALENESS_NUM = 1;           // 1/5 == 20%
export const STALENESS_DEN = 5;

export function topLevelDomain(domainPath: string): string { /* split("/")[0] */ }

// --- shared engine ---------------------------------------------------------
// detectCommunities: deterministic-by-construction greedy modularity agglomeration over the
// undirected adjacency. Merge the pair with the highest INTEGER gain each step; tie-break by slug.
export function detectCommunities(adjacency: Map<string, Set<string>>): string[][] { ... }

// --- findings --------------------------------------------------------------
export interface Misfile { slug: string; filedDomain: string; otherDomain: string; count: number; total: number; }
export interface Refinement { slug: string; domain: string; subdomain: string; count: number; total: number; }
export interface SiblingNote { slug: string; domain: string; subdomain: string; count: number; total: number; }
export interface Candidate { members: string[]; }
export interface Staleness { affected: number; total: number; }
export interface AdvisoryFindings {
    misfiles: Misfile[]; refinements: Refinement[]; siblingNotes: SiblingNote[];
    candidates: Candidate[]; staleness: Staleness | null;
}

export function computeAdvisory(pages: ConceptPage[], registry: ParsedRegistry): AdvisoryFindings { ... }
export function renderAdvisory(findings: AdvisoryFindings): string { ... }

// --- CLI -------------------------------------------------------------------
export function parseArgs(argv: string[]): { conceptsDir: string; registry?: string } { ... }
export function runCli(argv: string[]): number { ... }
```

**`detectCommunities` — integer-exact greedy modularity (implement exactly this):**
- Nodes = the adjacency keys (every active page, incl. isolated ones). `deg(n) = adjacency.get(n).size`.
- `twoM = Σ deg(n)` over all nodes (`= 2 * edgeCount`). If `twoM === 0` → return each node as its own
  singleton `[[n1],[n2],...]` in slug order (no merges possible).
- Communities start one-per-node. Track each community's member list (kept slug-sorted) and
  `sigmaTot = Σ deg(member)`.
- Repeat: over every unordered pair of DISTINCT communities `(A,B)` that have ≥1 edge between them,
  let `eAB` = number of edges between A and B (for each node u in the smaller community, count
  neighbors v with v in the other community). Compute the **integer merge key**
  `key = twoM * eAB - sigmaTot(A) * sigmaTot(B)` (this is the CNM modularity gain ΔQ cleared of its
  positive denominator `(2m)^2/(2m^2)`, so sign and ordering are preserved with pure integers). Pick
  the pair with the **maximum key**; break ties by the pair's `(minSlug, maxSlug)` where each
  community's representative is its lexicographically smallest member — choose the lexicographically
  smallest such tuple. If the best `key <= 0`, **stop** (no beneficial merge). Otherwise merge A and
  B (union members, add sigmaTot) and repeat.
- Return communities as slug-sorted member arrays, ordered by (descending size, then first-member
  slug). No floating point, no Math.random, no Date. Small store scale — O(iterations × pairs) is fine.

**`computeAdvisory`:**
1. Build `adjacency = buildAdjacency(pages)`. Build `bySlug: Map<slug, ConceptPage>`.
2. Build `domainOfSlug(slug)` → that page's `domain` (`""` if none); `topLevelDomain(...)` for the
   domain-granularity bucket.
3. **Per-page** loop over pages in slug order; for page `p` with neighbors `N = adjacency.get(p.slug)`,
   `total = N.size`; skip if `total < MIN_LINKS`.
   - `byDomain`: Map top-level-domain → count over neighbors' `topLevelDomain(neighbor.domain)`.
   - `bySub`: Map full subdomain-path → count over neighbors whose domain path contains `/`.
   - `Dp = topLevelDomain(p.domain)`; `Sp = p.domain.includes("/") ? p.domain : null`.
   - **Misfile (AC1):** among domains `!= Dp`, pick `Dother` = max count (tie → slug order). If
     `AFFINITY_DEN * count(Dother) >= AFFINITY_NUM * total` → push Misfile{slug, filedDomain: p.domain,
     otherDomain: Dother, count: count(Dother), total}. (Continue to next page — a misfiled page gets
     no refinement/note.)
   - Else if `Sp === null` (**parent-filed → Refinement AC3**): among subdomains under `Dp` in `bySub`,
     pick `S` = max count (tie → slug). If it exists and `AFFINITY_DEN * count(S) >= AFFINITY_NUM * total`
     → push Refinement{slug, domain: Dp, subdomain: S, count, total}.
   - Else (`Sp !== null`, **subdomain-filed → sibling note AC2**): among subdomains under `Dp` in
     `bySub` **excluding `Sp`**, pick `Sstar` = max count (tie → slug). If it exists and
     `AFFINITY_DEN * count(Sstar) >= AFFINITY_NUM * total` → push SiblingNote{slug, domain: Dp,
     subdomain: Sstar, count, total}.
4. **Candidates (AC4):** `for community of detectCommunities(adjacency)` with
   `community.length >= MIN_COMMUNITY_MEMBERS`: let `total = community.length`; count members by
   `topLevelDomain(domain)`; a domain is a **majority** iff `2 * count(d) > total`. If **no** domain
   is a majority → push Candidate{members: community} (already slug-sorted). Order candidates by
   (descending size, first-member slug).
5. **Staleness (AC5):** `affected = misfiles.length`; `total = pages.length`. If
   `affected > 0 && affected * STALENESS_DEN >= total * STALENESS_NUM` → set
   `staleness = { affected, total }`, else `null`. (`renderAdvisory` does the replacement.)

**`renderAdvisory(findings)`:**
- If `misfiles`, `refinements`, `siblingNotes`, `candidates` all empty AND `staleness === null` →
  return `""`.
- Else build lines starting `["## Taxonomy Drift Advisory", ""]`.
- If `staleness !== null`: emit `### Store-level staleness alarm` + one line stating disagreement
  affects `affected`/`total` pages (≥20%) and recommending a deliberate **re-filing** pass; **do NOT**
  emit the misfiles / refinements / siblingNotes sections.
- Else emit, in this order, each non-empty section with its `###` heading and slug-ordered bullets:
  `### Cross-domain misfiles` (name `` `slug` ``, its filed domain, the other domain, `count/total`),
  `### Refinement hints` (name `` `slug` ``, the `subdomain`, `count/total`),
  `### Low-priority notes` (name `` `slug` ``, the sibling `subdomain`).
- **Always** (survives the alarm): if `candidates` non-empty, emit `### New-domain candidates`, one
  bullet per candidate listing its members as `` `slug` ``, comma-separated.
- Return `lines.join("\n").replace(/\s+$/, "") + "\n"`.

**`runCli(argv)`:** parse `--concepts-dir` (default `.nexus/concepts`) and `--registry` (default
`registryPath()`). If the registry file does not exist → print nothing (empty advisory), return 0.
Else `parseDomainRegistry(fs.readFileSync(registry,"utf8"))`, `loadConceptPages(conceptsDir)`,
`renderAdvisory(computeAdvisory(pages, parsed))`; if the rendered string is non-empty, `console.log`
it (without an extra trailing blank — the string already ends in one `\n`; use `process.stdout.write`
or `console.log(text.replace(/\n$/,""))` to avoid a double newline — pick one and pin it in T7).
**Return 0 unconditionally.** Add the standard `main()` + `if (import.meta.url === ...) main()` guard
that calls `process.exit(runCli(process.argv.slice(2)))` — matching `generate-atlas.ts` lines 405-411
(note: exit code is always 0 here).

### Step 4 — register the bundle entry point
In `libs/portable-tools/src/build-bundles.ts`, Find:
```
export const ENTRY_POINTS: Record<string, string> = {
    "generate-atlas": "generate-atlas.ts",
    "validate-concepts": "validate-concepts.ts",
    "derive-entry-diff": "derive-entry-diff.ts",
    "nexus": "nexus-cli.ts",
};
```
Replace (add the drift-advisory line):
```
export const ENTRY_POINTS: Record<string, string> = {
    "generate-atlas": "generate-atlas.ts",
    "validate-concepts": "validate-concepts.ts",
    "derive-entry-diff": "derive-entry-diff.ts",
    "drift-advisory": "drift-advisory.ts",
    "nexus": "nexus-cli.ts",
};
```

### Step 5 — parity corpus + parity spec block
1. Create `libs/portable-tools/corpus/drift/docs/domains.md` — the well-formed registry (domains
   `connectors` {`catalog`, `runtime`}, `sources`), same grammar as `corpus/registry/docs/domains.md`.
2. Create `libs/portable-tools/corpus/drift/concepts/*.md` — a handful of active concept pages (full
   valid frontmatter like `corpus/registry/concepts/alpha.md`: `title`, `aliases`, `touches`,
   `last_updated_by`, `status: active`, `verification`, `domain`) arranged so the advisory emits at
   least one **stable** finding — e.g. one cross-domain misfile (a `sources`-filed page whose 3
   `touches` all point at `connectors` pages, reciprocated). Keep it small and deterministic.
3. In `parity.spec.ts`, add a `describe("drift-advisory parity over the corpus …")` block mirroring
   the atlas registry-mode block (**lines 230-251**): set `const DRIFT_SRC = path.join(SRC_DIR,
   "drift-advisory.ts")` and `const driftRoot = path.join(CORPUS, "drift")`; run
   `runSource(DRIFT_SRC, ["--concepts-dir", "concepts", "--registry", "docs/domains.md"], driftRoot)`
   and `runBundle(writeBundle("drift-advisory"), [same args], driftRoot)`; assert both `status === 0`
   and `diffRunResults("drift-advisory","drift",source,bundle) === []` (byte-identical stdout).
   Guard the corpus with `expect(source.stdout).toContain("### Cross-domain misfiles")`.
   (`writeBundle`/`runSource`/`runBundle`/`diffRunResults` already exist in `parity.spec.ts`.)

### Step 6 — wire the advisory into `.claude/commands/nxs.distill.md`
Six anchored Find/Replace edits. Quoted blocks match HEAD exactly.

**Edit 6a — Role "Mechanics" bullet (announce the advisory as a deterministic step).** Find:
```
- **Mechanics (deterministic, never improvised):** the C11 reciprocity fan-out, the R1 anchors
  refresh, and the validator (`libs/portable-tools/src/validate-concepts.ts`). A validation failure **blocks the
  PR** — you fix the pages and re-validate; you never ship a failing page.
```
Replace:
```
- **Mechanics (deterministic, never improvised):** the C11 reciprocity fan-out, the R1 anchors
  refresh, the validator (`libs/portable-tools/src/validate-concepts.ts`), and — when a domain
  registry exists (epic #94, STORY-94.02) — the drift advisory (Phase 6.3). A validation failure
  **blocks the PR** — you fix the pages and re-validate; you never ship a failing page. The drift
  advisory is the opposite: it never blocks, never edits, always exits zero — it only writes text
  into the PR body.
```

**Edit 6b — insert the drift-advisory compute step at the top of Phase 6.3.** Find:
```
## Phase 6.3 — Final checkpoint

**STOP AND WAIT.** Render the delta digest as markdown first:
```
Replace:
```
## Phase 6.3 — Final checkpoint

**Drift advisory (epic #94, STORY-94.02) — deterministic, non-blocking, store-level; gated on
registry presence.** When Phase 2 found a registry, now that every entry is applied and any Phase
6.2 taxonomy change has landed (so the branch holds the final store state the atlas was regenerated
from), run the advisory **once** over the whole store, using the Phase 5.3-selected invocation:

- Single-repo: `pnpm nexus:drift-advisory`
- Hub: `node .nexus/tools/drift-advisory.mjs`

Capture its stdout — advisory markdown, possibly empty. It **never edits a page or the registry and
always exits zero**; a non-zero exit or any file write is a bug, never a drain block, and nothing it
prints is ever `git add`ed. Record the captured markdown for the digest line below and the Phase 7
PR body. **If Phase 2 found no registry, skip this step entirely** (byte-for-byte today's behavior).

**STOP AND WAIT.** Render the delta digest as markdown first:
```

**Edit 6c — add a digest line for the advisory.** Find (inside the 6.3 CHECKPOINT block):
```
Anchors refreshed: <slugs>
Atlas: regenerated (<resolved-atlas-path>)
Validator: PASS (<N> page(s))
```
Replace:
```
Anchors refreshed: <slugs>
Atlas: regenerated (<resolved-atlas-path>)
Validator: PASS (<N> page(s))
Drift advisory: <n finding(s) — misfiles/refinements/candidates, or a staleness alarm | clean — no drift above thresholds | not run — no registry> (advisory only, never blocks)
```

**Edit 6d — Phase 7 PR body: add the advisory section.** Find:
```
## Anchors refreshed (derived, never hand-edited)
- `.nexus/anchors/<slug>.md` @ <source_sha — single-repo scalar, or one `<repo>@<sha>` per repo in hub mode>
```
Replace:
```
## Taxonomy drift advisory (epic #94, STORY-94.02 — advisory only, never blocks)
<Paste the Phase 6.3 captured advisory markdown verbatim here. If it was empty, write
"Clean — no drift above thresholds." If Phase 2 found no registry, omit this section.>

## Anchors refreshed (derived, never hand-edited)
- `.nexus/anchors/<slug>.md` @ <source_sha — single-repo scalar, or one `<repo>@<sha>` per repo in hub mode>
```

**Edit 6e — Phase 8 completion report line.** Find:
```
Reciprocal edits:  <n>  (<slugs>)
Anchors refreshed: <n>
Validator:         PASS
```
Replace:
```
Reciprocal edits:  <n>  (<slugs>)
Anchors refreshed: <n>
Validator:         PASS
Drift advisory:    <n finding(s), or "clean", or "not run — no registry"> (advisory only — never blocked this drain)
```

**Edit 6f — Constraints section: add the advisory bullet.** Find:
```
- **Domain filing (epic #94, STORY-94.01) is gated on registry presence.** A registry present at
  Phase 2 makes every `create` delta write a resolving `domain:` before Phase 5's validator ever
  runs; the Phase 6.1 taxonomy gate blocks only a `forced` fit and never fires for a `clear` one;
  an approved new domain/subdomain is authored on this same distill branch and re-validated
  before Phase 7 opens the PR. No registry present → completely inert, byte-for-byte today's
  behavior.
```
Replace:
```
- **Domain filing (epic #94, STORY-94.01) is gated on registry presence.** A registry present at
  Phase 2 makes every `create` delta write a resolving `domain:` before Phase 5's validator ever
  runs; the Phase 6.1 taxonomy gate blocks only a `forced` fit and never fires for a `clear` one;
  an approved new domain/subdomain is authored on this same distill branch and re-validated
  before Phase 7 opens the PR. No registry present → completely inert, byte-for-byte today's
  behavior.
- **The drift advisory (epic #94, STORY-94.02) is advisory only.** When a registry exists, Phase 6.3
  runs it once over the final branch state and pastes its findings into the PR body. It is
  deterministic (slug-ordered, integer thresholds, byte-identical on an unchanged store), always
  exits zero, and **never edits a page or the registry, never gates the drain, and is never
  committed**. No registry present → it is not run.
```

### Step 7 — re-vendor the fingerprint pin
Run `pnpm nexus:vendor-tools`. This rebuilds every bundle and rewrites
`libs/portable-tools/bundle-fingerprint.json`, which now gains a `drift-advisory.mjs` entry and an
updated `generate-atlas.mjs` hash (from Step 2's export). Also re-vendors `claude-components` (the
`nxs.distill.md` edit — Story 1 already established this file is inside the managed `.claude/`
subtree, so its edit changes the `claude-components` hash too). Stage the regenerated pin.
Then `npx nx test @nexus/portable-tools` — `parity.spec.ts`'s "fingerprint pin" test must be green
(it will otherwise name `drift-advisory.mjs: no pin entry` or a STALE `generate-atlas.mjs`/
`claude-components`).

### Step 8 — full suite + coverage
`npx nx test @nexus/portable-tools` — all pre-existing 295 tests still green, plus the new
`drift-advisory.spec.ts` and the new parity block. `npx nx test @nexus/portable-tools -- --coverage`
— `drift-advisory.ts` at ≥95% (add T8 engine cases for any uncovered branch; don't add
internal-only tests to game the number — every branch should be reachable through the ACs).

### Step 9 — decision stubs
Append to
`.nexus/queue/domain-filing-drift-f0249299/sameera/decisions-epic-domain-filing-drift-story-2.md`
(create it; `<username>` resolves to `sameera` — verified `gh api user --jq .login`), CLAUDE.md stub
format, at least:
- **Story 2 ships as a new deterministic tool, not a prompt edit** — Choice: implement the advisory
  as `drift-advisory.ts` under the parity+fingerprint gate; the prompt only invokes it. Why: the
  decision record makes the advisory deterministic, integer-exact, byte-identical, "held to the same
  parity and fingerprint gates as the atlas generator" — that is code, not judgment. Refuted
  alternative: express the advisory as prompt instructions like Story 1's filing gate — rejected
  because a model can't guarantee byte-identical, integer-exact output across runs.
- **Reuse the atlas's `buildAdjacency` instead of duplicating it** — Choice: export `buildAdjacency`
  from `generate-atlas.ts` and import it. Why: Invariant 9 wants the advisory and atlas to agree on
  the store's graph; sharing the constructor guarantees it. Refuted alternative: a standalone copy
  inside `drift-advisory.ts` — rejected as a divergence risk the invariant explicitly guards against.
- **Staleness alarm suppresses low-priority notes too** — Choice: when the alarm fires,
  `renderAdvisory` drops misfiles, refinements, AND low-priority notes, keeping only new-domain
  candidates. Why: AC5 says "in place of page-by-page flags"; a note is a page-by-page flag.
  Invariant 8 names only misfile+refinement, so this resolves the gap. Refuted alternative: keep the
  notes visible under the alarm — rejected as contradicting "in place of page-by-page flags".
- **Integer-exact CNM merge gain for community detection** — Choice: compare merges by
  `twoM*eAB - sigmaTot(A)*sigmaTot(B)`, tie-break by slug. Why: byte-identity under the parity gate
  forbids floating point (decision-record ADDRESS risk). Refuted alternative: an off-the-shelf
  Louvain/Leiden — rejected: their randomized visitation can't be held to byte-identity cheaply.

### Step 10 — commit
Stage: `libs/portable-tools/src/drift-advisory.ts`, `drift-advisory.spec.ts`, `generate-atlas.ts`,
`build-bundles.ts`, `parity.spec.ts`, the `corpus/drift/**` fixtures, `package.json`,
`.claude/commands/nxs.distill.md`, `libs/portable-tools/bundle-fingerprint.json`, and the decision
stub. Commit message exactly:
`feat(#96): A drift advisory surfaces taxonomy decay in the distillation-PR`
(end with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer per CLAUDE.md/Bash
git rules).

---

## 7. Done checklist

- [ ] `drift-advisory.ts` implements `computeAdvisory`, `renderAdvisory`, `detectCommunities`,
      `runCli`, the six named constants, and `topLevelDomain`; exits 0 unconditionally; never writes
      a file. All seven ACs traced by `drift-advisory.spec.ts` (T1-T7) + engine units (T8).
- [ ] Per-page signals are neighbor-counting only; community detection is used ONLY for AC4
      candidates and its output is never persisted (Invariant 11). Every threshold is a named
      constant compared with integer arithmetic — no floating point anywhere, including the merge gain.
- [ ] `generate-atlas.ts`: `buildAdjacency` exported (only change); atlas behavior byte-identical.
- [ ] `build-bundles.ts`: `drift-advisory` added to `ENTRY_POINTS`. `package.json`:
      `nexus:drift-advisory` script added.
- [ ] `parity.spec.ts`: drift source-vs-bundle byte-parity block added; `corpus/drift/**` fixture
      created and produces a stable finding.
- [ ] `.claude/commands/nxs.distill.md`: Edits 6a-6f applied — advisory runs once at Phase 6.3 over
      the final branch state, gated on registry presence, output pasted into the Phase 7 PR body;
      never committed, never blocks.
- [ ] **Re-vendor obligation applies** (this story edits `.claude/**` AND adds a bundle): ran
      `pnpm nexus:vendor-tools`; `bundle-fingerprint.json` gains `drift-advisory.mjs`, updates
      `generate-atlas.mjs` and `claude-components`, and is committed. `parity.spec.ts` fingerprint-pin
      test green.
- [ ] `npx nx test @nexus/portable-tools` — all pre-existing 295 tests still green + new tests pass.
      `drift-advisory.ts` at ≥95% coverage.
- [ ] Scope guards held: no seed mode / seed CLI / draft-registry emitter (Story 3); `detectCommunities`
      exported for Story 3 reuse; `validate-concepts.ts` and `domain-registry.ts` untouched; no
      `docs/domains.md` created; community output never written to any page or file.
- [ ] Decision stubs appended (Step 9). Commit message exactly
      `feat(#96): A drift advisory surfaces taxonomy decay in the distillation-PR`.
