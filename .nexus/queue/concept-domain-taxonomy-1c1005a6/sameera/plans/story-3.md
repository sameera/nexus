# Implementation Plan — STORY-89.03: The atlas renders the domain hierarchy

GitHub issue: **#92**. Epic: #89 (`.nexus/queue/concept-domain-taxonomy-1c1005a6/epic.md`).
Binding authority: `.nexus/queue/concept-domain-taxonomy-1c1005a6/decision-record.md`.
Builds on Story 1 (issue #90, commit `f448932`) and Story 2 (issue #91, commit `483181e`), both
already committed on this branch (`epic/concept-domain-taxonomy`, HEAD `483181e`).

Executor: follow this plan verbatim. Every path, line anchor, and signature below is verified against
the repo at HEAD `483181e`. Do **not** explore or improvise — every fact you need is here.

---

## 1. Goal

Make the concept atlas a pure projection of the domain registry when the registry is present, while
leaving the no-registry output byte-identical to today's generator. "Done" == Story 3's five ACs:

- **AC(a)** — with a registry + filed pages, the atlas renders one H2 per domain and one H3 per
  subdomain **in registry order**, with every active concept listed **exactly once** under its filed
  node.
- **AC(b)** — a domain with both parent-filed pages and subdomains lists the parent-filed pages
  **directly under the H2, before the first H3**.
- **AC(c)** — a subdomain heading shows the subdomain's **own** title (e.g. "Catalog" under
  "Connectors"), the parent heading supplying context.
- **AC(d)** — an unchanged store: generating twice is **byte-identical**, and `--check` passes.
- **AC(e)** — a store **without** a registry: the atlas output is **byte-identical to the pre-change
  generator's output** (fallback preserved — the activation-on-presence backward-compat guarantee,
  and the hardest constraint).

---

## 2. Judgment calls already made — do not re-decide

Each item is lifted from the decision record (DR) or the epic. Treat as fixed instructions.

1. **The atlas is a pure projection of the registry; registry order = display order, no degree
   sorting.** In registry mode the atlas emits nodes strictly in registry order, with pages within a
   node in a fixed deterministic order. *(DR "The atlas renders in registry order; the fallback path
   is untouched"; DR Invariant 8; epic Description "The atlas becomes a pure projection of the
   registry".)*

2. **Activation-on-presence; the registry file is the only switch — no config flag.** Curated
   rendering fires only when the registry (`domains.md`, beside the atlas in the resolved docs root)
   exists. When it does not exist, the atlas takes the existing connected-components clustering path
   **unchanged**. *(DR "Activation-on-presence, with the file as the only switch"; DR "Chosen
   Approach"; DR Invariant 10.)*

3. **The no-registry fallback path is left literally untouched and must be byte-identical to
   pre-change output.** Keep the existing `loadConceptPages → buildClusters → renderAtlas` clustering
   and render path untouched and reached only when the registry is absent. *(DR Invariant 10; DR Risk
   "ADDRESS — the no-registry atlas fallback could silently regress to non-byte-identical output";
   epic AC(e) / Success Metric.)* → The registry branch is a **separate** function
   (`renderRegistryAtlas`) selected by an `fs.existsSync(registryPath())` gate in `runCli`; the
   fallback call `renderAtlas(buildClusters(pages), linkPrefix)` is the exact same expression as
   today, reached only in the `else`. `generateAtlas`/`renderAtlas`/`buildClusters` are **not
   edited** (the header block is duplicated into `renderRegistryAtlas`, not shared — see §6 Step 3).

4. **Parent-filed pages list directly under the domain heading, before the first subdomain heading.**
   *(DR "Parent filing stays legal when subdomains exist"; DR Invariant 8; epic AC(b).)*

5. **Each subdomain heading shows its own title.** The registry parser already exposes each
   subdomain's own `title`; render `### <subdomain.title>`, not the composed path or the parent
   title. *(DR Invariant 8; epic AC(c).)*

6. **Every active page is listed exactly once and never silently dropped; the validator is the gate
   that rejects a misfile.** *(DR Invariant 9.)* → Bucket each page under the node whose full slug
   `path` equals its `domain:`. To honor "never silently dropped," any page whose `domain:` matches
   **no** node path (an unresolved / absent value) is listed under a trailing **`## Unfiled`**
   heading. In a valid store (validator-gated) this section never appears; it exists only so a
   pre-validation drain run cannot drop a page. *(Non-obvious choice — record a decision stub, §6
   Step 8. Refuted alternative: silently drop misfiled pages — violates Invariant 9.)*

7. **Every domain and subdomain heading renders, even when empty.** AC(a)/Invariant 8 say "one H2 per
   domain and one H3 per subdomain in registry order" — the atlas projects the registry's structure,
   so a node with zero filed pages still emits its heading (with no bullets). *(Epic AC(a); DR
   Invariant 8.)*

8. **Within-node page order is slug-ascending.** The DR fixes only "a fixed deterministic order"; the
   engineer's choice here is `a.slug.localeCompare(b.slug)`, matching the fallback's `Standalone`
   sort. *(DR Invariant 8 "pages within a node in a fixed deterministic order." Non-obvious —
   decision stub, §6 Step 8. Refuted alternative: filesystem / insertion order — non-deterministic,
   breaks AC(d) and the parity gate.)*

9. **`--check` resolves the identical location and registry as write mode.** `atlas` is computed once
   (registry-vs-fallback branch) **before** the `if (options.check)` split, exactly as today, so
   check and write can never diverge. *(DR "The atlas renders in registry order…" — "`--check`
   resolves the identical location and registry as write mode"; epic AC(d).)*

10. **The atlas finds the registry by resolving the docs root the same way the validator does.** Use
    `localDocsRoot(process.cwd())` joined with `domains.md` — the exact resolution the validator's
    `registryPath` uses and the same resolver the atlas's `defaultOutPath()` already uses — so all
    three agree on the registry's location. *(DR "The registry lives beside the atlas, and the
    validator resolves the docs root to find it".)* → Do **not** resolve the registry from the `--out`
    path; resolve it from `process.cwd()`. In the real store (no `--out`) these coincide; tests drive
    registry mode via `chdirTmp()` + a `docs/domains.md`, mirroring the existing resolver-derived
    atlas tests. *(Non-obvious — decision stub, §6 Step 8. Refuted alternative: `path.dirname(out)` —
    diverges from the validator when `--out` is explicit.)*

---

## 3. Ground truth (verified paths, signatures, conventions)

### Project & tooling (unchanged from Stories 1 & 2)
- Portable tools: **`libs/portable-tools/src/`**; nx project **`@nexus/portable-tools`**.
- Test: **vitest** (`libs/portable-tools/vitest.config.mts`: `globals: true`, `environment: "node"`,
  `testTimeout: 20000`, coverage provider `v8`, `root: import.meta.dirname`). Specs are
  `src/**/*.spec.ts`.
- Commands: test `npx nx test @nexus/portable-tools`; typecheck `npx nx typecheck @nexus/portable-tools`;
  lint `npx nx lint @nexus/portable-tools`; re-vendor `pnpm nexus:vendor-tools`
  (= `tsx libs/portable-tools/src/vendor-bundle.ts`, `package.json` line 23).
- Source style (match exactly; do **not** run prettier): **4-space indent, double quotes, semicolons,
  trailing commas in multiline literals.** Local ESM imports in `src/*.ts` carry `.js`
  (`./domain-registry.js`); package imports do not. **Spec files import with no extension**
  (`from "./generate-atlas"`). **No barrel files** (CLAUDE.md) — duplicate fixture strings inline, do
  not create a shared fixtures module.

### The atlas — `libs/portable-tools/src/generate-atlas.ts` (the file Story 3 edits)
Verified anchors at HEAD `483181e`:
- **Lines 20-22** — imports: `node:fs`, `node:path`, `import { localDocsRoot } from "@nexus/workspace/resolve";`.
- **Line 31** — `const FALLBACK_DOCS_ROOT = "docs";`.
- **Lines 34-38** — `function defaultOutPath(): string` (`localDocsRoot(process.cwd())` →
  `resolved.ok ? resolved.docsRoot : FALLBACK_DOCS_ROOT` → `path.join(docsRoot, "concepts.md")`).
  **This is the resolution `registryPath()` mirrors.**
- **Lines 45-49** — `export function computeLinkPrefix(outPath: string, conceptsDir: string): string`
  (POSIX relative path from the atlas dir to the concepts dir; `""` → `"./"`, else `"<rel>/"`).
- **Lines 56-61** — `export interface ConceptPage { slug: string; title: string; touches: string[]; hook: string; }`. **Story 3 adds `domain?: string`.**
- **Lines 121-152** — `export function parseFrontmatter(lines): Frontmatter | null` — a scalar
  `domain: connectors` line parses to the string `"connectors"` in `fm.fields`.
- **Lines 171-196** — `export function loadConceptPages(conceptsDir): ConceptPage[]`. The push at
  **lines 188-193** builds each page. Skips non-`.md`, `README.md`, non-files (so an `_archive`
  subdir is skipped), and `status: deprecated`. **Story 3 reads `domain` here.**
- **Lines 240-265** — `export function buildClusters(pages): Cluster[]` (connected components of the
  `touches` graph, each cluster named after its highest-degree member; degree-then-slug sort within a
  cluster; a trailing alphabetical `Standalone` cluster for singletons). **Not edited.**
- **Lines 267-287** — `export function renderAtlas(clusters: Cluster[], linkPrefix: string): string`.
  Header lines to reuse verbatim (lines 269-279): the 3-line `<!-- DERIVED … -->` comment, blank,
  `# Concept Atlas`, blank, `` `Orientation map of the concept store — ${total} active concepts. Each links to its full page` ``,
  `(behavior, invariants, decision history); code locations live in the matching`,
  `` `` `.nexus/anchors/<slug>.md` sidecar.` ``. Per cluster: `lines.push("", `## ${cluster.name}`, "")`
  then bullets `` `- [${page.title}](${linkPrefix}${page.slug}.md) — ${page.hook}` ``. Ends
  `return lines.join("\n") + "\n";`. **Not edited** (Judgment call 3).
- **Lines 289-291** — `export function generateAtlas(conceptsDir, linkPrefix = "../.nexus/concepts/"): string`
  = `renderAtlas(buildClusters(loadConceptPages(conceptsDir)), linkPrefix)`. **Not edited — this is the
  pre-change fallback oracle used by AC(e) and by `bundle.spec.ts:191`.**
- **Lines 293-318** — `export function runCli(argv): number`. Line 294 `parseArgs`, line 295
  `out = options.out ?? defaultOutPath()`, line 296 `loadConceptPages`, line 297
  `computeLinkPrefix`, **line 298** `const atlas = renderAtlas(buildClusters(pages), linkPrefix);`
  (the single line Story 3 replaces with the branch). Lines 300-312 `--check` block (missing → 1;
  byte-compare → 1 on mismatch; else "OK" → 0). Lines 314-316 write path. **The check/write block is
  not edited.**

### The registry parser Story 3 consumes — `libs/portable-tools/src/domain-registry.ts` (do NOT edit)
- **Lines 14-20** — `export interface DomainNode { title: string; slug: string; path: string; rubric: string; subdomains: DomainNode[]; }`.
- **Lines 22-25** — `export interface ParsedRegistry { domains: DomainNode[]; findings: string[]; }`.
- **Line 74** — `export function parseDomainRegistry(content: string): ParsedRegistry`. Total — never
  throws. A domain's `.path` is its leaf `slug`; a subdomain's `.path` is `<parent-leaf>/<own-leaf>`
  (composed). `.domains` preserves registry order and `.subdomains` preserves order. Malformed
  entries (missing slug → `slug === ""`, `path === ""`) still appear in the tree; they are the
  validator's concern. **Standalone module (no imports) — importing it inlines it into the atlas
  bundle.**

### How Story 2 reads a page's `domain:` (reference — the atlas mirrors the read, not the resolution)
- `validate-concepts.ts` line 371: `const domain = fm.fields.get("domain");` then treats
  `typeof domain !== "string" || domain === ""` as absent, and resolves exact-string membership
  against the full-path set. The atlas reads the field the same way in `loadConceptPages`.

### Registry-location resolution — validator vs atlas
- Validator: `registryPath(startDir)` (`validate-concepts.ts` lines 507-511) =
  `localDocsRoot(startDir).ok ? docsRoot : "docs"` joined with `"domains.md"`, called with
  `process.cwd()`. Story 3's atlas `registryPath()` mirrors this exactly (same resolver, same
  fallback literal `"docs"` via `FALLBACK_DOCS_ROOT`, same `domains.md`).
- `localDocsRoot(startDir)` (`libs/workspace/src/resolve.ts` line 140) → in single-repo mode
  `docsRoot === "docs"` (`SINGLE_REPO_DOCS_ROOT`, line ~71). **`resolveWorkspace` (line ~114) keys
  single-repo purely on `startDir` lacking both a workspace manifest and a pointer — it does not walk
  up and does not require `.git`.** Verified: the repo has **no** `workspace.yml` and **no**
  `domains.md` anywhere, so `localDocsRoot(anyDir)` → single-repo `"docs"`, and
  `fs.existsSync("<dir>/docs/domains.md")` is false everywhere today.

### Bundles / parity / fingerprint
- `ENTRY_POINTS` (`build-bundles.ts` lines 10-15) = `generate-atlas`, `validate-concepts`,
  `derive-entry-diff`, `nexus`. **`nexus-cli.ts` does NOT import `generate-atlas.ts`** (verified,
  imports at lines 20-27). The only other source consumer of the atlas is `parity.spec.ts` and
  `bundle.spec.ts` (specs). So importing `domain-registry.ts` into `generate-atlas.ts` changes **only
  the `generate-atlas.mjs` bytes** among the four bundles. `validate-concepts.mjs` already inlines
  `domain-registry.ts` (Story 1) — unchanged. `derive-entry-diff.mjs`, `nexus.mjs`, and
  `claude-components` are unchanged.
- `bundle-fingerprint.json` pins each `<entry>.mjs` (+ `claude-components`) to a sha256. Current
  `generate-atlas.mjs` hash: `28e4ba84…`. `parity.spec.ts` "fingerprint pin › the freshly built
  bundle hash equals the committed pin" (lines 117-123) will **FAIL** for `generate-atlas.mjs` until
  you re-vendor. Expected — §6 Step 6.
- `bundle.spec.ts:191` compares the atlas bundle (run via `node` in a fresh outside tmp dir, cwd has
  no `docs/domains.md`) to `generateAtlas(conceptsDir, computeLinkPrefix(outPath, conceptsDir))`.
  Both stay on the fallback path → still byte-identical. Bundle self-containment tests
  (`bundle.spec.ts` lines 122-148) still pass because `domain-registry.ts` has no non-builtin imports.
- Parity corpus (`libs/portable-tools/corpus/{clean,findings,atlas,base,head}`) has **no** `docs/`
  subtree; parity runs use `cwd = CORPUS`, and `localDocsRoot(CORPUS)` → `CORPUS/docs/domains.md`
  which does **not** exist → every existing atlas/validator corpus run stays on the fallback path.
  Story 3 adds a **new, isolated** `corpus/registry/` subtree that activates registry mode only when
  the atlas is run with `cwd = corpus/registry` (see §6 Step 5); it does not disturb the existing
  cwd-`CORPUS` runs.

### Test patterns to copy (all in `generate-atlas.spec.ts`)
- **Imports** (lines 6-14): currently `buildClusters, generateAtlas, loadConceptPages, parseArgs,
  parseFrontmatter, renderAtlas, runCli` from `"./generate-atlas"`. Story 3 adds
  `computeLinkPrefix, renderRegistryAtlas, registryPath`, plus a new import
  `import { parseDomainRegistry, type ParsedRegistry, type DomainNode } from "./domain-registry";`.
- **`FixtureSpec` + `writeConcept`** (lines 18-69): builds a well-formed concept page (frontmatter +
  `# Title` + lead + the four sections + one Decision Log entry). Story 3 extends both to inject an
  optional `domain:` frontmatter line (see §6 Step 7). `makeTmpDir()` + the `afterEach` cleanup (lines
  27-76) are shared.
- **`chdirTmp()` + cwd-restoring `afterEach`** (lines 395-409, inside
  `describe("runCli — resolver-derived default output (no --out)")`): saves `process.cwd()`, chdirs to
  a fresh tmp, restores in `afterEach`. **Copy this shape** for the registry-mode `runCli` describe.
  `runCli([])` with no `--out` writes to `docs/concepts.md` in the tmp store (line 420 reads it).
- **Determinism assertion** (lines 286-301): `generateAtlas(dir)` twice → `expect(first).toBe(second)`.

---

## 4. Out of scope (do not touch)

- **Story 1 (issue #90) — the registry grammar/parser and structural pass.** `domain-registry.ts` is
  DONE; only *consume* `parseDomainRegistry` / `ParsedRegistry` / `DomainNode`. Do not change the
  grammar, the parser, or the registry-structure findings.
- **Story 2 (issue #91) — per-page `domain:` validation.** `validate-concepts.ts` is DONE. Do NOT edit
  it, do NOT re-implement `domain:` resolution, and do NOT change the Decision-Log exemption. The
  atlas assumes filing is valid because the validator is the gate (DR Invariant 9).
- **The no-registry fallback output.** `generateAtlas`, `renderAtlas`, `buildClusters`, the header
  text, cluster naming, and sort mechanics stay byte-for-byte. The only edits to shared code are:
  (a) an **additive** optional `domain?: string` on `ConceptPage` + reading it in `loadConceptPages`
  (which does **not** change fallback output — `renderAtlas` ignores `domain`), and (b) replacing the
  single `atlas` assignment in `runCli` with the registry-vs-fallback branch.
- **Migrating any real store's pages / regenerating the real atlas.** Do NOT add `docs/domains.md` to
  the repo, do NOT add a `domain:` field to any real concept page, and do NOT regenerate the real
  `docs/concepts.md` (it stays on the fallback path — no registry present).
- **Drain-side filing, the new-domain gate, drift advisories, seed tooling** — the follow-on epic.

---

## 5. Tests first (TFD — write the failing test before the code)

Write these blocks first; each must fail before you write §6. Split across `generate-atlas.spec.ts`
(the AC-driven cases) and `parity.spec.ts` (the DR Invariant-12 registry-mode corpus case).

Add near the top of `generate-atlas.spec.ts` (after the imports), a registry fixture reused verbatim
from `validate-concepts.spec.ts` lines 809-836 (duplicate inline — no shared module):

```
const REGISTRY_WELL_FORMED =
`# Domain Registry

## Connectors
\`connectors\`

Everything about pulling data in from and pushing it out to external systems.

### Catalog
\`catalog\`

The registry of available connector types and their published metadata.

### Runtime
\`runtime\`

How a configured connector executes when a flow runs.

## Sources
\`sources\`

Upstream systems and the shape of the data they provide.

### Catalog
\`catalog\`

The inventory of known source systems.
`;
```

This yields domains `Connectors` (path `connectors`, subdomains `Catalog`→`connectors/catalog`,
`Runtime`→`connectors/runtime`) and `Sources` (path `sources`, subdomain `Catalog`→`sources/catalog`).

A small page-builder for the pure unit tests (a `ConceptPage` with `domain` set):

```
function pg(slug: string, domain: string): ConceptPage {
    return { slug, title: slug[0].toUpperCase() + slug.slice(1), touches: [], hook: `${slug} hook.`, domain };
}
```

### 5A. `describe("renderRegistryAtlas (STORY-89.03)")` — pure, no filesystem

Parse once: `const registry: ParsedRegistry = parseDomainRegistry(REGISTRY_WELL_FORMED);`
Link prefix: `const PREFIX = "../.nexus/concepts/";`
A helper to pull headings: `const headings = (s: string) => s.split("\n").filter((l) => /^#{2,3} /.test(l));`
(`# Concept Atlas` is H1 and is excluded; H2/H3 only.)

1. **AC(a) — one H2 per domain, one H3 per subdomain, in registry order; every page once.**
   pages = `[pg("alpha","connectors"), pg("beta","connectors/catalog"), pg("gamma","connectors/runtime"), pg("delta","sources"), pg("epsilon","sources/catalog")]`.
   `const out = renderRegistryAtlas(registry, pages, PREFIX);`
   - `expect(headings(out)).toEqual(["## Connectors", "### Catalog", "### Runtime", "## Sources", "### Catalog"]);`
     (pins registry order, H2/H3 levels, and AC(c) own-titles in one assertion).
   - `expect(out).toContain("5 active concepts");` (header total = page count).
   - Each page appears exactly once: for each slug, `expect(out.match(new RegExp(`${slug}\\.md`, "g"))).toHaveLength(1);` — or assert `out.split("\n").filter((l) => l.startsWith("- "))` has length 5.
   - `expect(out).toContain("- [Alpha](../.nexus/concepts/alpha.md) — alpha hook.");` (bullet format identical to fallback).

2. **AC(b) — parent-filed pages under the H2, before the first H3.**
   Same pages. `alpha` files at `connectors` (parent, which has subdomains).
   `const i = (s: string) => out.indexOf(s);`
   - `expect(i("alpha.md")).toBeGreaterThan(i("## Connectors"));`
   - `expect(i("alpha.md")).toBeLessThan(i("### Catalog"));`

3. **AC(c) — subdomain shows its own title, not the parent or the composed path.**
   - `expect(out).toContain("### Catalog");`
   - `expect(out).not.toContain("### connectors/catalog");`
   - `expect(out).not.toContain("### Connectors/Catalog");`

4. **AC(d) at the render level — deterministic (pure).**
   `expect(renderRegistryAtlas(registry, pages, PREFIX)).toBe(renderRegistryAtlas(registry, pages, PREFIX));`

5. **Every node heading renders even when empty (AC(a)/Invariant 8).**
   pages = `[pg("alpha","connectors")]` only.
   - `expect(headings(out)).toEqual(["## Connectors", "### Catalog", "### Runtime", "## Sources", "### Catalog"]);`
   - `expect(out).toContain("1 active concepts");`

6. **Never silently dropped — unresolved / absent domain → trailing `## Unfiled` (Invariant 9).**
   pages = `[pg("alpha","connectors"), pg("ghost","nope/not-real"), { slug: "nodom", title: "Nodom", touches: [], hook: "nodom hook." }]`
   (the third page has **no** `domain`).
   - `expect(out).toContain("## Unfiled");`
   - `expect(out.indexOf("## Unfiled")).toBeGreaterThan(out.indexOf("## Sources"));` (trailing).
   - `expect(out).toContain("ghost.md");` and `expect(out).toContain("nodom.md");` (neither dropped).
   - `expect(out).toContain("3 active concepts");`

7. **Within-node order is slug-ascending (determinism).**
   pages = `[pg("zeta","connectors/catalog"), pg("alpha","connectors/catalog")]`.
   - `expect(out.indexOf("alpha.md")).toBeLessThan(out.indexOf("zeta.md"));`

### 5B. `describe("registryPath (STORY-89.03)")`

8. **Resolves `docs/domains.md` in single-repo mode.**
   `expect(registryPath()).toBe(path.join("docs", "domains.md"));`
   (Runs at the default cwd; the repo resolves single-repo. This mirrors the validator's Story-1
   `registryPath` test.)

### 5C. `describe("runCli — registry mode (STORY-89.03)")` — chdirTmp + cwd-restore afterEach

Copy the `chdirTmp()` helper + restoring `afterEach` from lines 395-409. Each test: `chdirTmp()`,
`fs.mkdirSync(".nexus/concepts", { recursive: true })`, write concept pages with `writeConcept`
(now accepting `domain`), write the registry, then `runCli([])` (no `--out` → writes
`docs/concepts.md`). Read `docs/concepts.md`.

9. **AC(a) end-to-end — registry present + filed pages.**
   Write `docs/domains.md` = `REGISTRY_WELL_FORMED`. Pages: `alpha` (`domain: connectors`), `beta`
   (`domain: connectors/catalog`), `gamma` (`domain: sources`).
   - `expect(runCli([])).toBe(0);`
   - atlas = read `docs/concepts.md`. `expect(atlas).toContain("## Connectors");`
     `expect(atlas).toContain("### Catalog");` `expect(atlas).toContain("## Sources");`
   - `expect(atlas).not.toContain("## Standalone");` (took the registry branch, not clustering).

10. **AC(d) — generate twice byte-identical + `--check` passes.**
    Same store as test 9. `runCli([]); const a = read();  runCli([]); const b = read();`
    - `expect(a).toBe(b);`
    - `expect(runCli(["--check"])).toBe(0);`

11. **AC(e) — no registry → byte-identical to the pre-change generator.**
    `chdirTmp()`, create `.nexus/concepts/` with a mix of pages (give some a `domain:` and some none —
    it must not matter), and do **NOT** create `docs/domains.md`. Use pages that produce a non-trivial
    fallback shape, e.g. `hub`↔`leaf` (touches each other) + a `solo` singleton.
    - `expect(runCli([])).toBe(0);`
    - `const actual = fs.readFileSync(path.join("docs", "concepts.md"), "utf8");`
    - Oracle = the untouched pre-change render path:
      `const expected = generateAtlas(".nexus/concepts", computeLinkPrefix(path.join("docs", "concepts.md"), ".nexus/concepts"));`
      (runCli uses these exact relative args internally: conceptsDir default `.nexus/concepts`,
      out `docs/concepts.md`.)
    - `expect(actual).toBe(expected);` — this **is** byte-identity to pre-change output, because
      `generateAtlas` is the pre-change code path, left untouched (Judgment call 3).
    - Structural guard: `expect(actual).toContain("## Standalone");` and
      `expect(actual).not.toContain("## Connectors");` (fallback headings, no registry headings).

12. **Presence gate flips both ways.**
    Same store as test 9 (registry present) → assert `## Connectors` present. Then
    `fs.rmSync(path.join("docs", "domains.md"));` and `runCli([])` again → re-read; assert
    `## Connectors` **absent** and a fallback heading present (`## Standalone` or a degree-named
    cluster). Proves the `else` branch is reached on registry removal.

### 5D. `parity.spec.ts` — registry-mode atlas corpus case (DR Invariant 12)

Add a new `describe` after the existing `describe("atlas parity over the corpus …")` (ends line 228).
It runs the atlas **source** vs the fresh **bundle** with `cwd = corpus/registry` (so
`localDocsRoot` finds `corpus/registry/docs/domains.md`) and asserts byte-identity + registry-mode
headings. Reuse `CORPUS`, `ATLAS_SRC`, `writeBundle`, `runSource`, `runBundle`, `makeTmpDir`,
`diffAtlasBytes`, `formatDivergences` (all already in scope).

13. **Source and bundle render byte-identical registry-mode atlas output.**
```
describe("atlas parity — registry mode (epic #89, Invariant 12)", () => {
    it("source and bundle render byte-identical curated atlas output", () => {
        const registryRoot: string = path.join(CORPUS, "registry");
        const conceptsDir: string = path.join(registryRoot, "concepts");
        const sourceOut: string = path.join(makeTmpDir("parity-reg-src-"), "concepts.md");
        const bundleOut: string = path.join(makeTmpDir("parity-reg-bun-"), "concepts.md");
        const bundlePath: string = writeBundle("generate-atlas");

        runSource(ATLAS_SRC, ["--concepts-dir", conceptsDir, "--out", sourceOut], registryRoot);
        runBundle(bundlePath, ["--concepts-dir", conceptsDir, "--out", bundleOut], registryRoot);

        const sourceAtlas: string = fs.readFileSync(sourceOut, "utf8");
        const bundleAtlas: string = fs.readFileSync(bundleOut, "utf8");
        const divergence = diffAtlasBytes("generate-atlas", "registry", sourceAtlas, bundleAtlas);
        expect(divergence, divergence ? formatDivergences([divergence]) : undefined).toBeNull();

        // Guard: curated headings (registry projection), not link-density clusters.
        expect(sourceAtlas).toContain("## Connectors");
        expect(sourceAtlas).toContain("### Catalog");
        expect(sourceAtlas).not.toContain("## Standalone");
    });
});
```
(The existing `corpus/atlas` parity test at lines 208-228 already covers the **no-registry**
source-vs-bundle byte-identity — cwd `CORPUS` has no `docs/domains.md`.)

> TFD: assert on headings / substrings / index ordering / byte-equality — never pin exact full
> message strings.

---

## 6. Steps

### Step 1 — write the §5A / §5B / §5C spec blocks in `generate-atlas.spec.ts`
Add the imports (§3 "Test patterns"), the `REGISTRY_WELL_FORMED` const, the `pg` helper, and the three
describes. Run `npx nx test @nexus/portable-tools`; the new blocks must fail (`renderRegistryAtlas`,
`registryPath`, and the `domain` field do not exist yet).

### Step 2 — edit `generate-atlas.ts` imports and constants

**Edit 2.1 — import the parser.** Find (line 22):
```
import { localDocsRoot } from "@nexus/workspace/resolve";
```
Replace with:
```
import { localDocsRoot } from "@nexus/workspace/resolve";
import { parseDomainRegistry, type ParsedRegistry } from "./domain-registry.js";
```

**Edit 2.2 — registry filename constant + `registryPath()`.** Find (lines 30-38):
```
/** The docs root to fall back to when resolution fails outright (mirrors the single-repo default). */
const FALLBACK_DOCS_ROOT = "docs";

/** The resolved-docs-root default output path, used whenever no explicit `--out` is given. */
function defaultOutPath(): string {
    const resolved = localDocsRoot(process.cwd());
    const docsRoot = resolved.ok ? resolved.docsRoot : FALLBACK_DOCS_ROOT;
    return path.join(docsRoot, "concepts.md");
}
```
Replace with:
```
/** The docs root to fall back to when resolution fails outright (mirrors the single-repo default). */
const FALLBACK_DOCS_ROOT = "docs";

/** The registry filename, beside the atlas in the resolved docs root (epic #89, STORY-89.03). */
const REGISTRY_FILENAME = "domains.md";

/** The resolved-docs-root default output path, used whenever no explicit `--out` is given. */
function defaultOutPath(): string {
    const resolved = localDocsRoot(process.cwd());
    const docsRoot = resolved.ok ? resolved.docsRoot : FALLBACK_DOCS_ROOT;
    return path.join(docsRoot, "concepts.md");
}

/**
 * The domain registry lives beside the atlas in the resolved docs root (epic #89, STORY-89.03).
 * Resolve it the same way `defaultOutPath` resolves the atlas and the validator resolves the
 * registry (`localDocsRoot(process.cwd())`), so all three agree on the file's location. Registry
 * presence is the sole switch into curated rendering — there is no config flag.
 */
export function registryPath(): string {
    const resolved = localDocsRoot(process.cwd());
    const docsRoot = resolved.ok ? resolved.docsRoot : FALLBACK_DOCS_ROOT;
    return path.join(docsRoot, REGISTRY_FILENAME);
}
```

### Step 3 — add the `domain` field and read it (additive; fallback output unchanged)

**Edit 3.1 — extend `ConceptPage`.** Find (lines 56-61):
```
export interface ConceptPage {
    slug: string;
    title: string;
    touches: string[];
    hook: string;
}
```
Replace with:
```
export interface ConceptPage {
    slug: string;
    title: string;
    touches: string[];
    hook: string;
    domain?: string;
}
```
(Optional so existing inline `ConceptPage` literals in the spec still typecheck; `renderAtlas`/
`buildClusters` ignore it, so fallback output is unchanged.)

**Edit 3.2 — read `domain` in `loadConceptPages`.** Find (lines 186-193):
```
        const title: string | string[] | undefined = fm.fields.get("title");
        const touches: string | string[] | undefined = fm.fields.get("touches");
        pages.push({
            slug: path.basename(entry.name, ".md"),
            title: typeof title === "string" ? title : "",
            touches: Array.isArray(touches) ? touches : [],
            hook: extractHookLine(lines.slice(fm.bodyStart)),
        });
```
Replace with:
```
        const title: string | string[] | undefined = fm.fields.get("title");
        const touches: string | string[] | undefined = fm.fields.get("touches");
        const domain: string | string[] | undefined = fm.fields.get("domain");
        pages.push({
            slug: path.basename(entry.name, ".md"),
            title: typeof title === "string" ? title : "",
            touches: Array.isArray(touches) ? touches : [],
            hook: extractHookLine(lines.slice(fm.bodyStart)),
            domain: typeof domain === "string" ? domain : "",
        });
```

### Step 4 — add `renderRegistryAtlas` (new function; header duplicated, fallback untouched)

Insert **immediately after** `renderAtlas` (after line 287, its closing `}`) and **before**
`generateAtlas` (line 289):

```
/**
 * Curated-atlas renderer (epic #89, STORY-89.03): a pure projection of the registry. Emits the same
 * header the fallback renderer emits, then one H2 per domain and one H3 per subdomain in registry
 * order (order is display order — no degree sorting). A page is listed under the node whose full slug
 * path equals its `domain:`; parent-filed pages appear directly under the domain heading, before the
 * first subdomain (decision record — parent filing). Pages within a node are ordered by slug for
 * determinism. No active page is dropped: any page whose `domain:` matches no node is listed under a
 * trailing "Unfiled" heading (Invariant 9 — the validator, not the atlas, is the gate that rejects a
 * misfile).
 *
 * The header block is duplicated from renderAtlas rather than shared, so the fallback render path
 * stays byte-for-byte untouched (decision-record Risk ADDRESS — no-registry byte-identity).
 */
export function renderRegistryAtlas(registry: ParsedRegistry, pages: ConceptPage[], linkPrefix: string): string {
    const total: number = pages.length;
    const lines: string[] = [
        "<!-- DERIVED — generated from .nexus/concepts/ frontmatter by the concept-atlas generator.",
        "     Regenerated by /nxs.distill on every drain. Never hand-edit — regenerate it",
        "     through the atlas generator instead. -->",
        "",
        "# Concept Atlas",
        "",
        `Orientation map of the concept store — ${total} active concepts. Each links to its full page`,
        "(behavior, invariants, decision history); code locations live in the matching",
        "`.nexus/anchors/<slug>.md` sidecar.",
    ];

    const bySlug = (a: ConceptPage, b: ConceptPage): number => a.slug.localeCompare(b.slug);
    const filedUnder = (nodePath: string): ConceptPage[] =>
        pages.filter((p: ConceptPage) => (p.domain ?? "") === nodePath).sort(bySlug);
    const renderBullets = (bucket: ConceptPage[]): void => {
        for (const page of bucket) {
            lines.push(`- [${page.title}](${linkPrefix}${page.slug}.md) — ${page.hook}`);
        }
    };

    const known: Set<string> = new Set();
    for (const domain of registry.domains) {
        known.add(domain.path);
        lines.push("", `## ${domain.title}`, "");
        renderBullets(filedUnder(domain.path));
        for (const sub of domain.subdomains) {
            known.add(sub.path);
            lines.push("", `### ${sub.title}`, "");
            renderBullets(filedUnder(sub.path));
        }
    }

    const unfiled: ConceptPage[] = pages.filter((p: ConceptPage) => !known.has(p.domain ?? "")).sort(bySlug);
    if (unfiled.length > 0) {
        lines.push("", "## Unfiled", "");
        renderBullets(unfiled);
    }

    return lines.join("\n") + "\n";
}
```

### Step 5 — branch `runCli` on registry presence (fallback expression unchanged)

Find (lines 293-298):
```
export function runCli(argv: string[]): number {
    const options: CliOptions = parseArgs(argv);
    const out: string = options.out ?? defaultOutPath();
    const pages: ConceptPage[] = loadConceptPages(options.conceptsDir);
    const linkPrefix: string = computeLinkPrefix(out, options.conceptsDir);
    const atlas: string = renderAtlas(buildClusters(pages), linkPrefix);
```
Replace with:
```
export function runCli(argv: string[]): number {
    const options: CliOptions = parseArgs(argv);
    const out: string = options.out ?? defaultOutPath();
    const pages: ConceptPage[] = loadConceptPages(options.conceptsDir);
    const linkPrefix: string = computeLinkPrefix(out, options.conceptsDir);

    // Registry presence is the only switch (epic #89, STORY-89.03; decision record —
    // activation-on-presence, no config flag). With a registry, render the curated hierarchy;
    // without one, fall through to the untouched connected-components clustering, byte-identical to
    // the pre-change generator. `atlas` is computed once here, before the check/write split, so
    // `--check` resolves the identical location and registry as write mode.
    const regPath: string = registryPath();
    const atlas: string = fs.existsSync(regPath)
        ? renderRegistryAtlas(parseDomainRegistry(fs.readFileSync(regPath, "utf8")), pages, linkPrefix)
        : renderAtlas(buildClusters(pages), linkPrefix);
```
Leave the `if (options.check) { … }` block and the write tail (lines 300-317) unchanged.

Run `npx nx test @nexus/portable-tools`. The §5A-5C blocks must now pass; the whole existing suite
stays green **except** `parity.spec.ts` "fingerprint pin" for `generate-atlas.mjs` (expected — Step 6).
The §5D block also still fails until Step 5b adds the corpus subtree.

### Step 5b — add the isolated registry corpus subtree + write §5D

Create these files (exact bytes):

`libs/portable-tools/corpus/registry/docs/domains.md`:
```
# Domain Registry

## Connectors
`connectors`

Everything about pulling data in from and pushing it out to external systems.

### Catalog
`catalog`

The registry of available connector types and their published metadata.

### Runtime
`runtime`

How a configured connector executes when a flow runs.

## Sources
`sources`

Upstream systems and the shape of the data they provide.
```

`libs/portable-tools/corpus/registry/concepts/alpha.md`:
```
---
title: "Alpha"
aliases: []
touches: []
last_updated_by: "bootstrap"
status: active
verification: verified
domain: connectors
---

# Alpha

Alpha pulls data in from an external system.

## How It Works

Body prose.

## Key Invariants

1. Something holds.

## Integration Points

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
```

`libs/portable-tools/corpus/registry/concepts/beta.md` — identical shape with
`title: "Beta"`, `domain: connectors/catalog`, `# Beta`, lead `Beta lists known connector types.`

`libs/portable-tools/corpus/registry/concepts/gamma.md` — identical shape with
`title: "Gamma"`, `domain: sources`, `# Gamma`, lead `Gamma describes an upstream source system.`

Then add the §5D `describe` block to `parity.spec.ts` after line 228. Run the tests: §5D must pass
(source and bundle both render `## Connectors` / `### Catalog`, byte-identical), fingerprint pin still
failing until Step 6.

### Step 6 — re-vendor the fingerprint pin
`generate-atlas.ts` now inlines `domain-registry.ts`, so `generate-atlas.mjs`'s bytes change. Run
`pnpm nexus:vendor-tools` (no `--tools-dir` — it rewrites `libs/portable-tools/bundle-fingerprint.json`
in place). Re-run `npx nx test @nexus/portable-tools`; parity must now be fully green. Also run
`npx nx typecheck @nexus/portable-tools` and `npx nx lint @nexus/portable-tools`. Confirm the pin diff
changes **only** the `generate-atlas.mjs` hash (`validate-concepts.mjs`, `derive-entry-diff.mjs`,
`nexus.mjs`, `claude-components` unchanged). Stage the regenerated pin.

### Step 7 — extend the spec's `writeConcept` to accept a `domain` (support §5C)
In `generate-atlas.spec.ts`, add `domain?: string;` to `FixtureSpec` (lines 18-23), and inject the
line into the frontmatter template. Find (lines 38-45):
```
    const content = `---
title: "${spec.title}"
aliases: []
touches: ${touchesYaml}
last_updated_by: "bootstrap"
status: ${status}
verification: verified
---
```
Replace with (compute `const domainLine: string = spec.domain !== undefined ? `\ndomain: ${spec.domain}` : "";` above `const content`):
```
    const domainLine: string = spec.domain !== undefined ? `\ndomain: ${spec.domain}` : "";
    const content = `---
title: "${spec.title}"
aliases: []
touches: ${touchesYaml}
last_updated_by: "bootstrap"
status: ${status}
verification: verified${domainLine}
---
```
(Existing callers omit `domain` → no line added → byte-identical frontmatter, so all pre-existing
atlas tests are unaffected.) Do Step 7 before/with Step 1 as needed so §5C can set page domains.

### Step 8 — append decision stubs (append-only)
Append to `.nexus/queue/concept-domain-taxonomy-1c1005a6/sameera/decisions-epic-concept-domain-taxonomy.md`
(the file already holds Stories 1 & 2 stubs — append, do not overwrite), CLAUDE.md stub format:
- **Atlas resolves the registry via `localDocsRoot(process.cwd())`, mirroring the validator** — Choice:
  the atlas finds `domains.md` from the resolved docs root, not from `path.dirname(--out)`, so it and
  the validator agree on the location. Refuted: resolve beside the `--out` path (diverges from the
  validator when `--out` is explicit).
- **Header block duplicated into `renderRegistryAtlas`, not shared** — Choice: copy the 9 header lines
  rather than extract a shared helper, keeping the fallback `renderAtlas` byte-for-byte untouched.
  Refuted: extract an `atlasHeader()` helper (would edit the fallback render path the DR Risk says to
  leave untouched).
- **Unresolved / unfiled pages land under a trailing `## Unfiled` heading** — Choice: honor Invariant
  9 "never silently dropped" with a catch-all that appears only when a page's `domain:` matches no
  node. Refuted: silently drop misfiled pages (violates Invariant 9).
- **Within-node page order = slug ascending; registry-mode parity lives in an isolated
  `corpus/registry/` subtree** — Choice: deterministic slug order within a node; the parity corpus
  activates registry mode only via `cwd = corpus/registry`, leaving every existing `cwd = CORPUS` run
  on the fallback path. Refuted: filesystem/insertion order (non-deterministic); adding
  `corpus/docs/domains.md` (would activate the registry for every existing corpus run).

### Step 9 — commit
Message exactly: `feat(#92): The atlas renders the domain hierarchy`.
(Already on `epic/concept-domain-taxonomy`; if the workflow uses a per-story branch, branch off it
before committing — otherwise commit here.)

---

## 7. Done checklist

- [ ] `npx nx test @nexus/portable-tools` fully green — the new §5A-5D blocks, the whole existing
      suite (including the resolver-derived atlas tests, `bundle.spec.ts`, and `parity.spec.ts` source-
      vs-bundle + fingerprint pin).
- [ ] `npx nx typecheck @nexus/portable-tools` and `npx nx lint @nexus/portable-tools` pass.
- [ ] **Re-vendor obligation (DR Invariant 11):** `generate-atlas.ts` now inlines `domain-registry.ts`,
      so `generate-atlas.mjs`'s bytes change and its fingerprint no longer matches the committed pin.
      Ran `pnpm nexus:vendor-tools` and committed the regenerated
      `libs/portable-tools/bundle-fingerprint.json` in this same PR. **Only the `generate-atlas.mjs`
      hash changes**; `validate-concepts.mjs`, `derive-entry-diff.mjs`, `nexus.mjs`, and
      `claude-components` are unchanged.
- [ ] **`.claude/**` trigger does NOT apply:** Story 3 edits only `libs/portable-tools/src/**`,
      `libs/portable-tools/corpus/registry/**`, and `bundle-fingerprint.json` — no `.claude/**` file is
      touched. The re-vendor is driven purely by the changed bundle source (the CLAUDE.md `.claude/**`
      rule is a separate trigger and is not the driver here).
- [ ] **Fallback preserved (AC(e) / DR Risk ADDRESS):** the no-registry `runCli` output equals the
      untouched `generateAtlas` oracle byte-for-byte (§5C test 11); `generateAtlas`, `renderAtlas`,
      `buildClusters`, and the header text are unedited; no `docs/domains.md` was added to the repo
      and the real `docs/concepts.md` was not regenerated.
- [ ] Application source at **≥95% coverage** — `renderRegistryAtlas` (parent-filed, subdomain, empty
      node, unfiled catch-all, slug sort), `registryPath`, the `domain` read in `loadConceptPages`, and
      both sides of the `runCli` presence gate are exercised by §5. Coverage is a signal, not a target
      to game.
- [ ] Decision stubs appended to
      `.nexus/queue/concept-domain-taxonomy-1c1005a6/sameera/decisions-epic-concept-domain-taxonomy.md`
      (§6 Step 8; append-only — Stories 1 & 2 stubs remain).
- [ ] Scope guards held: `domain-registry.ts` and `validate-concepts.ts` untouched; the fallback
      render path untouched; no `domain:` added to any real concept page; the registry corpus lives
      only under `corpus/registry/`, never `corpus/docs/`.
- [ ] Commit message exactly: `feat(#92): The atlas renders the domain hierarchy`.
