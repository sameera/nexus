# Implementation Plan — STORY-89.01: A domain registry defines the taxonomy

GitHub issue: **#90**. Epic: #89 (`.nexus/queue/concept-domain-taxonomy-1c1005a6/epic.md`).
Binding authority: `.nexus/queue/concept-domain-taxonomy-1c1005a6/decision-record.md`.

Executor: follow this plan verbatim. All paths, line anchors, and signatures below are verified
against the repo at HEAD `20a9889`. Do **not** explore or improvise — every fact you need is here.

---

## 1. Goal

Ship the domain-registry grammar, a single shared parser for it, and the validator surface that
rejects a malformed registry — activated only when the registry file is present. "Done" ==
Story 1's four ACs:

- **AC1** — parsing a well-formed registry (domains, optional subdomains; each entry has a display
  title, a slug, and a filing rubric) returns the ordered tree: title, full slug path, and rubric
  for every entry, in registry order.
- **AC2** — a registry that nests a third level fails validation with a finding naming the entry.
- **AC3** — a duplicate slug path, or an entry missing its title / slug / rubric, fails validation
  with a finding naming the entry.
- **AC4** — over the fixture suite (one well-formed registry + one fixture per malformation) the
  validator exits zero on the well-formed fixture and non-zero on every malformed one.

Plus the invariant that a store with **no** registry raises zero domain findings and behaves
byte-for-byte as before (decision-record Invariant 5; epic Success Metric 2).

---

## 2. Judgment calls already made — do not re-decide

Each item is lifted from the decision record (DR) or the epic. Treat as fixed instructions.

1. **One shared parser, its own module, inlined into the bundle.** The grammar gets a single
   parser both tools call; it is a standalone source module that esbuild inlines into each bundle
   (no runtime dependency at the portable boundary). *(DR "One shared registry parser, used by both
   tools"; DR Invariant 11.)* → New file `domain-registry.ts`; the validator imports it. The atlas
   consumes it later in **Story 3** — do not wire the atlas here.

2. **Registry validation is a store-level pass, gated on presence, not on the file list.** When the
   registry file exists, parse and structurally validate it **once per invocation, regardless of
   whether it appears in the argument list.** When it does not exist, do nothing. Presence of the
   file is the only activation switch — **no config flag.** *(DR "Registry validation is a
   store-level pass…"; DR "Activation-on-presence…"; DR Invariant 5.)*

3. **The registry lives beside the atlas; resolve the docs root exactly as the atlas does.** The
   registry is `domains.md` in the resolved docs root — the same directory the atlas writes
   `concepts.md` to. The validator resolves the docs root with `localDocsRoot(process.cwd())` from
   `@nexus/workspace/resolve`, mirroring `generate-atlas.ts` `defaultOutPath()`. *(DR "The registry
   lives beside the atlas, and the validator resolves the docs root to find it".)*

4. **The registry is never validated as a concept page.** No Decision-Log / concept-page content
   rules apply to it; it is validated by its own grammar only. *(DR Invariant 6.)* → In the
   validator file loop, skip any argument that resolves to the registry path.

5. **Two-level hard cap.** Grammar and validator cap nesting at domain + subdomain. A third level is
   a finding naming the offending entry. *(DR "Two-level hard cap"; epic AC2.)*

6. **Full slug path is the identity; leaf slugs may repeat.** An entry's identity is its full
   slash-form path. Duplicate **full paths** are a finding; the same leaf slug under different
   parents is legal (e.g. `connectors/catalog` and `sources/catalog` coexist). *(DR "Full slug-path
   is the identity; leaf slugs may repeat"; epic Notes.)*

7. **The parse is total — it never throws.** A malformed registry yields findings, never an
   exception. *(DR Constraint 3.)*

8. **New findings use the existing finding shape and block the PR like current findings.** Reuse the
   validator's `Finding` shape (`{ file, message }`); any finding makes the run exit non-zero.
   *(DR Invariant 4.)*

9. **Grammar surface syntax (engineer's call, now fixed by this plan).** The DR states the exact
   surface syntax is the engineer's call within the AC (DR "Open Clarifications"). It is decided
   here — do not change it:
   - `## <Title>` per domain; `### <Title>` per subdomain (`#### `+ is a third level → finding).
     A leading `# <Title>` (the registry document title) and any prose before the first `##` are
     ignored.
   - Each heading is followed by a **slug line** — a single backtick-wrapped kebab token alone on
     its line, e.g. `` `connectors` `` — then a one-paragraph filing rubric.
   - **The authored slug is the leaf.** The parser composes the full path from nesting: a domain's
     path is its own leaf slug; a subdomain's path is `<parent-leaf>/<own-leaf>`. Authors never
     repeat the parent in a child's slug. *(This is the non-obvious choice — record a decision stub,
     §7. Refuted alternative: author types the full path in the slug line; rejected because it
     duplicates the parent, adds a "prefix must match parent" rule not required by the AC, and makes
     "leaf slugs may repeat" awkward.)*

---

## 3. Ground truth (verified paths, signatures, conventions)

### Project & tooling
- Portable tools live in **`libs/portable-tools/src/`**; nx project name **`@nexus/portable-tools`**
  (`libs/portable-tools/project.json`).
- Test framework: **vitest**, config `libs/portable-tools/vitest.config.mts`
  (`globals: true`, `environment: "node"`, `testTimeout: 20000`, coverage provider `v8`). Specs are
  `src/**/*.spec.ts`.
- Run tests: `npx nx test @nexus/portable-tools`. Lint: `npx nx lint @nexus/portable-tools`.
  Typecheck: `npx nx typecheck @nexus/portable-tools`.
- Re-vendor / fingerprint pin: `pnpm nexus:vendor-tools` (= `tsx libs/portable-tools/src/vendor-bundle.ts`).
- Source style in this project (match exactly; do **not** run prettier — the root `.prettierrc`
  sets `singleQuote:true` but every file here uses double quotes): **4-space indent, double quotes,
  semicolons, trailing commas in multiline literals.** Local ESM imports carry a `.js` extension
  (e.g. `./bundle.js`), package imports do not (e.g. `@nexus/workspace/resolve`).
- **No barrel files** (CLAUDE.md). Import `parseDomainRegistry` directly from `./domain-registry.js`.

### The validator — `libs/portable-tools/src/validate-concepts.ts`
- Imports (lines 17-19): only `node:child_process`, `node:fs`, `node:path`.
- `export interface Finding { file: string; message: string; }` (lines 32-35). **Reuse this.**
- `const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;` (line 41) — the kebab pattern; the parser
  defines its own copy (`domain-registry.ts` stays self-contained; do not cross-import).
- `const ANCHOR_BULLET = /^-\s+\`([^\`]+)\`/;` (line 46) — last of the top-of-file consts.
- `export function validatePage(file, base, repoRoot, findings): void` ends at line **455**.
- `export function runCli(argv: string[]): number` starts at line **457**; body verified at lines
  457-499 (repoRoot via git toplevel 459-464; files collection with the missing-dir early return
  466-475; `const findings` 477; the per-file loop 478-488; the findings/exit block 490-498).
- `package.json` (`libs/portable-tools/package.json`) already depends on `@nexus/workspace` and
  `yaml`, so `import { localDocsRoot } from "@nexus/workspace/resolve"` resolves.

### The atlas (reference only — do NOT edit) — `libs/portable-tools/src/generate-atlas.ts`
- `defaultOutPath()` (lines 33-38) is the pattern to mirror for docs-root resolution:
  ```
  const resolved = localDocsRoot(process.cwd());
  const docsRoot = resolved.ok ? resolved.docsRoot : FALLBACK_DOCS_ROOT;   // FALLBACK_DOCS_ROOT = "docs"
  return path.join(docsRoot, "concepts.md");
  ```
  The registry equivalent is `path.join(docsRoot, "domains.md")`. Note the returned path is
  docs-root-relative and is resolved against `process.cwd()` (same as the atlas). The real store's
  atlas is at `docs/concepts.md`, so its registry is `docs/domains.md`.

### Docs-root resolver — `libs/workspace/src/resolve.ts`
- `export function localDocsRoot(startDir: string): LocalDocsRootResult` (line 140).
- `export type LocalDocsRootResult = { ok: true; docsRoot: string } | { ok: false; error: Diagnostic };`
  (line 74). In single-repo mode `docsRoot === "docs"` (line 146 → `SINGLE_REPO_DOCS_ROOT`, line 71).

### Bundles / parity / fingerprint
- `ENTRY_POINTS` (`libs/portable-tools/src/build-bundles.ts` lines 10-15) = `generate-atlas`,
  `validate-concepts`, `derive-entry-diff`, `nexus`. **`nexus-cli.ts` does NOT import
  `validate-concepts.ts`** (verified) — so adding registry logic to the validator changes **only**
  the `validate-concepts.mjs` bytes among the four bundles.
- esbuild bundles inline every non-builtin import (`bundle.ts` lines 24-42) → `domain-registry.ts`
  and the `localDocsRoot` import get inlined into `validate-concepts.mjs`. That changes its bytes.
- The committed pin `libs/portable-tools/bundle-fingerprint.json` maps each `<entry>.mjs` (plus
  `claude-components`) to a sha256. `parity.spec.ts` (lines 117-146) asserts a fresh build's hash
  equals the pin: it will FAIL for `validate-concepts.mjs` until you re-vendor. **This is expected —
  §7 handles it.**
- `parity.spec.ts` runs the validator source vs a fresh bundle over the committed corpus with
  `cwd = libs/portable-tools/corpus` and `--concepts-dir corpus/<case>`. There is **no**
  `libs/portable-tools/corpus/docs/domains.md`, so the registry pass is a no-op there and parity
  stays green with **no corpus change** (see §4).
- No `domains.md` exists anywhere in the repo (verified). So the registry pass is inert for the real
  store, for `pnpm nexus:validate-concepts`, and for every existing test.

### Test patterns to copy
- **Atlas spec cwd pattern** (`generate-atlas.spec.ts` lines 395-410): `chdirTmp()` saves
  `process.cwd()`, `process.chdir(makeTmpDir())`, restores in `afterEach`. Use this for any runCli
  test that needs `localDocsRoot` to resolve to a tmp store.
- **Validator spec helpers** (`validate-concepts.spec.ts` lines 44-118): `page(opts)` builds a
  well-formed concept page; `makeTmpDir()`, `writeFile(dir, relPath, content)`,
  `validate(file, base?, repoRoot?)`, and `afterEach` cleanup. Reuse them.
- **runCli exit-code assertions** (`validate-concepts.spec.ts` lines 769-801): call the imported
  `runCli([...])` in-process; assert the returned number.

---

## 4. Out of scope (do not touch)

- **Story 2 (issue #91) — pages file under a domain.** Do NOT add a `domain:` field to any concept
  page, do NOT resolve a page's `domain:` against the registry, and do NOT touch the drain-time
  one-new-Decision-Log-entry rule or its `domain:`-only exemption. Story 1 validates the registry's
  own structure only.
- **Story 3 (issue #92) — the atlas renders the hierarchy.** Do NOT edit `generate-atlas.ts` at all
  (no import of `domain-registry.ts` there, no registry-mode rendering). Clustering/fallback stays
  untouched.
- **Parity corpus growth for the registry (DR Invariant 12).** Do NOT add a registry to the shared
  corpus (`corpus/clean`, `corpus/findings`, `corpus/atlas`, `corpus/base|head`). A `domains.md` at
  the corpus docs root would activate the pass for every existing corpus run and pull in Story 2's
  per-page `domain:` requirement — out of scope. Story 1's AC4 fixture suite lives in the specs.
  The corpus registry/atlas cases land with Story 3 (which can host an isolated registry-mode
  subtree). Record this scoping as a decision stub (§7).
- Migrating any existing store's pages; seed tooling; the new-domain gate; drift advisories —
  all the follow-on epic.

---

## 5. Tests first (TFD — write the failing test before the code)

Write specs in this order; each block must fail before you write the implementation in §6.

### 5A. New spec — `libs/portable-tools/src/domain-registry.spec.ts`

Import from `./domain-registry`: `parseDomainRegistry` (and the `DomainNode` / `ParsedRegistry`
types if you assert against them). Use inline template-string fixtures (NOT committed `.md` files —
template strings preserve exact bytes, including the trailing space in the missing-title case).

Fixtures (use verbatim):

```
WELL_FORMED =
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
`
```
(`connectors/catalog` and `sources/catalog` share the leaf `catalog` under different parents.)

```
THIRD_LEVEL =
`## Connectors
\`connectors\`

Rubric for connectors.

### Catalog
\`catalog\`

Rubric for catalog.

#### Nested Too Deep
\`nested\`

This nests a third level and must be rejected.
`

DUP_PATH =
`## Connectors
\`connectors\`

First connectors rubric.

## Connectors Again
\`connectors\`

A second entry claiming the same slug path.
`

MISSING_TITLE =            // note the trailing space after "##"
`## 
\`connectors\`

Rubric with no domain title.
`

MISSING_SLUG =
`## Connectors

Everything about connectors, but the slug line is missing entirely.
`

MISSING_RUBRIC =
`## Connectors
\`connectors\`

## Sources
\`sources\`

Sources rubric present so only the first entry lacks a rubric.
`
```

Test cases:

1. **AC1 — ordered tree from a well-formed registry.** `parseDomainRegistry(WELL_FORMED)`:
   - `.findings` is `[]` (empty).
   - `.domains.map(d => d.title)` equals `["Connectors", "Sources"]` (registry order).
   - `.domains[0].slug === "connectors"` and `.domains[0].path === "connectors"`.
   - `.domains[0].rubric` contains `"pulling data in"` (rubric captured; don't assert exact string).
   - `.domains[0].subdomains.map(s => s.title)` equals `["Catalog", "Runtime"]` (order preserved).
   - `.domains[0].subdomains[0].path === "connectors/catalog"` (composed full path).
   - `.domains[1].subdomains[0].path === "sources/catalog"`.
2. **AC2 — third level.** `parseDomainRegistry(THIRD_LEVEL).findings` is non-empty; at least one
   finding contains `"Nested Too Deep"` (names the offending entry) and mentions a third level.
   `.domains[0].subdomains` does NOT contain the `#### ` entry.
3. **AC3 — duplicate slug path.** `parseDomainRegistry(DUP_PATH).findings` non-empty; a finding
   contains the path `"connectors"` and the word `"duplicate"`.
4. **AC3 — missing title.** `parseDomainRegistry(MISSING_TITLE).findings` non-empty; a finding
   names the entry by its slug (`"connectors"`) and mentions the missing title.
5. **AC3 — missing slug.** `parseDomainRegistry(MISSING_SLUG).findings` non-empty; a finding names
   the entry (`"Connectors"`) and mentions the missing slug.
6. **AC3 — missing rubric.** `parseDomainRegistry(MISSING_RUBRIC).findings` non-empty; a finding
   names the first entry (`"Connectors"`) and mentions the missing rubric; the second domain
   (`Sources`, which has a rubric) is not flagged for a missing rubric.
7. **Leaf reuse is legal.** From the WELL_FORMED parse, assert no finding contains `"duplicate"`
   (proves same-leaf-under-different-parents does not collide).
8. **Total parse / never throws.** `parseDomainRegistry("")` and `parseDomainRegistry("random\nprose\nno headings\n")`
   return without throwing, with `.domains === []` and `.findings === []`.
9. **Orphan subdomain (coverage).** A registry whose first heading is `### Catalog` (an `### `
   before any `## `) returns a finding mentioning the entry appears before any domain, without
   throwing.

### 5B. Additions to `libs/portable-tools/src/validate-concepts.spec.ts`

Add imports to the existing top-of-file import block: `registryPath`, `validateRegistry` from
`./validate-concepts`. Reuse the file's existing `makeTmpDir`, `writeFile`, `page`, and `afterEach`.
Add a `chdirTmp()`/cwd-restore helper mirroring the atlas spec (save `process.cwd()`, chdir, restore
in an `afterEach`). Reuse the same fixture strings from 5A (duplicate them locally, or define shared
constants at the top of this spec — do NOT create a barrel/shared fixtures module).

10. **`registryPath` resolves beside the atlas in single-repo mode.**
    `registryPath(makeTmpDir())` returns a path ending in `domains.md`, and equal to
    `path.join("docs", "domains.md")` (single-repo docs root is `docs`).
11. **`validateRegistry` maps parser findings onto the registry file.** Write a malformed registry
    (e.g. `THIRD_LEVEL`) to a tmp file; call `validateRegistry(file, findings)`; assert
    `findings.length > 0` and every finding's `.file === file`.
12. **AC4 — fixture suite exit codes (runCli).** For each case: `chdirTmp()`, create `docs/` and
    write the fixture to `docs/domains.md`, call `runCli([])`, assert exit code:
    - `WELL_FORMED` → `0`.
    - `THIRD_LEVEL`, `DUP_PATH`, `MISSING_TITLE`, `MISSING_SLUG`, `MISSING_RUBRIC` → each not `0`
      (i.e. `1`). Parametrize with a loop / `it.each`.
    (No `.nexus/concepts` dir is created; the well-formed case returns 0 via the "nothing to
    validate" branch, malformed cases return 1 because the registry pass populates findings before
    that branch — see §6 wiring.)
13. **No-registry no-op (Invariant 5 / Success Metric 2).** `chdirTmp()`, create
    `.nexus/concepts/alpha.md` = `page()` (clean), do NOT create `docs/domains.md`. Capture
    `console.error`; `runCli([])` returns `0` and no captured line contains `"slug path"` or
    `"domains.md"`. (Existing behavior unchanged.)
14. **Registry never validated as a page (Invariant 6).** `chdirTmp()`, write `WELL_FORMED` to
    `docs/domains.md`; call `runCli(["docs/domains.md"])` (registry passed as an explicit file
    argument). Assert exit `0`. Without the skip guard the registry would be validated as a concept
    page and produce many findings (exit 1), so exit 0 proves the guard.

> TFD assertions test the requirement ("a finding names the entry") via substring/shape, not exact
> wording — do not pin exact message strings.

---

## 6. Steps

### Step 1 — write `domain-registry.spec.ts` (§5A). Run `npx nx test @nexus/portable-tools`; it
must fail (module missing).

### Step 2 — create `libs/portable-tools/src/domain-registry.ts`

Header comment: shared domain-registry grammar + parser (epic #89, STORY-89.01); note the parse is
total (never throws) and is inlined into both bundles by the build.

Exported types and function (exact shapes):

```
export interface DomainNode {
    title: string;      // display title (heading text)
    slug: string;       // authored leaf slug ("" when missing)
    path: string;       // full slash-form identity path (composed from nesting)
    rubric: string;     // one-paragraph filing rubric ("" when missing)
    subdomains: DomainNode[];
}

export interface ParsedRegistry {
    domains: DomainNode[];
    findings: string[];  // structural problems; [] iff well-formed
}

export function parseDomainRegistry(content: string): ParsedRegistry
```

Module-local constants:
```
const DOMAIN_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;      // kebab, same shape as the page slug pattern
const SLUG_LINE = /^`([^`]+)`$/;                     // a slug line: one backticked token, alone
const HEADING = /^(#{2,6})\s+(.*)$/;                 // H2..H6; H1 and pre-heading prose are ignored
```

Algorithm (total — every branch returns; nothing throws):

1. Split `content` on `"\n"`. Segment into **blocks**: a block starts at a line matching `HEADING`
   and runs until the next `HEADING` line or EOF. For each block capture
   `{ level: capture[1].length, title: capture[2].trim(), body: string[] }` where `body` is the
   block's non-heading lines. Ignore any lines before the first heading.
2. Init `domains: DomainNode[] = []`, `findings: string[] = []`, `currentDomain: DomainNode|null = null`,
   and a `recorded: DomainNode[]` list (all nodes that get a path, for duplicate detection).
3. For each block in order:
   - **`level >= 4`** → push finding
     `` `entry "${title || "(untitled)"}" nests a third level — the taxonomy caps at domain plus subdomain (0089)` ``
     and `continue` (not added to the tree).
   - Extract slug + rubric from `body`:
     - Drop leading/trailing blank lines; let `nonBlank` = the body lines that are non-empty after
       trim, in order.
     - If `nonBlank[0]` matches `SLUG_LINE` **and** its capture matches `DOMAIN_SLUG`:
       `slug = capture`; `rubricLines = nonBlank.slice(1)`.
       Else: `slug = ""`; `rubricLines = nonBlank`.
     - `rubric = rubricLines.join(" ").replace(/\s+/g, " ").trim()`.
   - Build the node:
     - **`level === 2`**: `node = { title, slug, path: slug, rubric, subdomains: [] }`;
       `domains.push(node)`; `currentDomain = node`.
     - **`level === 3`**:
       - If `currentDomain === null`: push finding
         `` `subdomain "${title || slug || "(untitled)"}" appears before any domain — a subdomain must nest under a domain (0089)` ``;
         `node = { title, slug, path: slug, rubric, subdomains: [] }` (detached — not attached to any domain).
       - Else: `const composed = (currentDomain.path !== "" && slug !== "") ? \`${currentDomain.path}/${slug}\` : slug;`
         `node = { title, slug, path: composed, rubric, subdomains: [] }`; `currentDomain.subdomains.push(node)`.
   - Push `node` into `recorded`.
   - Per-entry field findings on `node`:
     - `title === ""` → `` `entry with slug "${slug || "(none)"}" is missing its display title (0089)` ``
     - `slug === ""` → `` `entry "${title || "(untitled)"}" is missing its slug line (0089)` ``
     - `rubric === ""` → `` `entry "${title || slug || "(untitled)"}" is missing its filing rubric (0089)` ``
4. **Duplicate path detection**: over `recorded`, ignore nodes with `slug === ""`; count each
   `path`; for every path appearing more than once, push exactly one finding
   `` `duplicate slug path "${path}" — the full slug path is an entry's identity and must be unique (0089)` ``.
5. `return { domains, findings }`.

Node builtins only; no external imports. Match the project style (§3).

Run tests — §5A block should pass.

### Step 3 — write the §5B validator tests. Run tests; the new blocks must fail (symbols missing).

### Step 4 — edit `libs/portable-tools/src/validate-concepts.ts`

**Edit 4.1 — imports.** Find (lines 17-19):
```
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
```
Replace with:
```
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { localDocsRoot } from "@nexus/workspace/resolve";
import { parseDomainRegistry } from "./domain-registry.js";
```

**Edit 4.2 — registry filename constant.** Find (line 46):
```
const ANCHOR_BULLET = /^-\s+`([^`]+)`/;
```
Replace with:
```
const ANCHOR_BULLET = /^-\s+`([^`]+)`/;
const REGISTRY_FILENAME = "domains.md";
```

**Edit 4.3 — add the two exported helpers just before `runCli`.** Find (line 457):
```
export function runCli(argv: string[]): number {
```
Replace with:
```
/**
 * The registry lives beside the atlas in the resolved docs root; resolve it the same way the atlas
 * generator does (decision record — both tools must agree on the registry's location). Returns a
 * docs-root-relative path, resolved against the process cwd exactly as the atlas's default out path.
 */
export function registryPath(startDir: string): string {
    const resolved = localDocsRoot(startDir);
    const docsRoot: string = resolved.ok ? resolved.docsRoot : "docs";
    return path.join(docsRoot, REGISTRY_FILENAME);
}

/**
 * Store-level registry structural pass (epic #89, STORY-89.01). Parses the registry once and maps
 * each structural problem onto a blocking finding against the registry file. The parse is total: a
 * malformed registry yields findings, never a throw (decision-record Constraint 3).
 */
export function validateRegistry(file: string, findings: Finding[]): void {
    const content: string = fs.readFileSync(file, "utf8");
    const parsed = parseDomainRegistry(content);
    for (const message of parsed.findings) {
        findings.push({ file, message });
    }
}

export function runCli(argv: string[]): number {
```

**Edit 4.4 — wire the pass into `runCli` and add the skip guard.** Find the exact block (lines
466-488):
```
    let files: string[] = options.files;
    if (files.length === 0) {
        if (!fs.existsSync(options.conceptsDir)) {
            console.log(`No concepts directory at ${options.conceptsDir} — nothing to validate.`);
            return 0;
        }
        files = fs.readdirSync(options.conceptsDir)
            .filter((name: string) => name.endsWith(".md") && name !== "README.md")
            .map((name: string) => path.join(options.conceptsDir, name));
    }

    const findings: Finding[] = [];
    for (const file of files) {
        if (!fs.existsSync(file)) {
            findings.push({ file, message: "file not found" });
            continue;
        }
        if (isAnchorFile(file)) {
            validateAnchor(file, findings);
        } else {
            validatePage(file, options.base, repoRoot, findings);
        }
    }
```
Replace with:
```
    const findings: Finding[] = [];

    // Store-level registry pass (epic #89): whenever the registry is present, parse and
    // structurally validate it once per run, independent of the file list (decision record —
    // "gated on presence, not on the file list"). An absent registry raises no domain findings.
    const regPath: string = registryPath(process.cwd());
    const hasRegistry: boolean = fs.existsSync(regPath);
    if (hasRegistry) {
        validateRegistry(regPath, findings);
    }

    let files: string[] = options.files;
    if (files.length === 0) {
        if (!fs.existsSync(options.conceptsDir)) {
            // Preserve the pre-change "nothing to validate" exit only when the registry pass is clean.
            if (findings.length === 0) {
                console.log(`No concepts directory at ${options.conceptsDir} — nothing to validate.`);
                return 0;
            }
            files = [];
        } else {
            files = fs.readdirSync(options.conceptsDir)
                .filter((name: string) => name.endsWith(".md") && name !== "README.md")
                .map((name: string) => path.join(options.conceptsDir, name));
        }
    }

    for (const file of files) {
        // Invariant 6: the registry is validated by its own grammar, never as a concept page.
        if (hasRegistry && path.resolve(file) === path.resolve(regPath)) {
            continue;
        }
        if (!fs.existsSync(file)) {
            findings.push({ file, message: "file not found" });
            continue;
        }
        if (isAnchorFile(file)) {
            validateAnchor(file, findings);
        } else {
            validatePage(file, options.base, repoRoot, findings);
        }
    }
```

Leave the `if (findings.length > 0) { … } … return 0;` tail (lines 490-498) unchanged.

### Step 5 — `npx nx test @nexus/portable-tools`. Expect the new specs green AND `parity.spec.ts`
"fingerprint pin › the freshly built bundle hash equals the committed pin" to **FAIL** for
`validate-concepts.mjs` (bytes changed). That failure is expected → Step 6 clears it.

### Step 6 — re-vendor the fingerprint pin. Run `pnpm nexus:vendor-tools` (no `--tools-dir` — the
in-place pin update at `libs/portable-tools/bundle-fingerprint.json` is what the parity test checks;
the hub copy is a separate concern not triggered here). Re-run `npx nx test @nexus/portable-tools`;
parity must now be green. Commit the regenerated `bundle-fingerprint.json`.

### Step 7 — write decision stubs (append-only) to
`.nexus/queue/concept-domain-taxonomy-1c1005a6/sameera/decisions-epic-concept-domain-taxonomy.md`
using the CLAUDE.md stub format. Record at least:
- **Slug-line grammar & leaf-composed paths** — authored slug is the leaf; the parser composes the
  full path from nesting (choice / why / refuted alternative = author types the full path).
- **Registry fixtures live in the specs, not the parity corpus (Story 1)** — deferring the
  corpus registry/atlas cases to Story 3 (choice / why / refuted alternative = add a `domains.md`
  to the shared corpus root now).

### Step 8 — commit. Message: `feat(#90): A domain registry defines the taxonomy`.
(If not already on a story branch off `epic/concept-domain-taxonomy`, branch first before
committing.)

---

## 7. Done checklist

- [ ] `npx nx test @nexus/portable-tools` fully green — new `domain-registry.spec.ts`, the added
      `validate-concepts.spec.ts` blocks, and the whole existing suite including `parity.spec.ts`
      (fingerprint pin + source-vs-bundle parity over the corpus).
- [ ] `npx nx typecheck @nexus/portable-tools` and `npx nx lint @nexus/portable-tools` pass.
- [ ] **Re-vendor obligation (decision-record Invariant 11):** `validate-concepts.ts` now inlines
      `domain-registry.ts` and `localDocsRoot`, so `validate-concepts.mjs`'s bytes change and its
      fingerprint no longer matches the committed pin. Ran `pnpm nexus:vendor-tools` and committed
      the regenerated `libs/portable-tools/bundle-fingerprint.json` in this same PR
      (only the `validate-concepts.mjs` hash should change; `generate-atlas.mjs`,
      `derive-entry-diff.mjs`, `nexus.mjs`, and `claude-components` are unchanged).
- [ ] **`.claude/**` trigger does NOT apply:** Story 1 edits only `libs/portable-tools/src/**` and
      `bundle-fingerprint.json` — no `.claude/**` file is touched, so the CLAUDE.md
      ".claude/** touched → vendor + commit the fingerprint pin" rule is not the driver here; the
      re-vendor above is driven purely by the changed bundle source. (The same `nexus:vendor-tools`
      run recomputes the `claude-components` hash harmlessly; it must stay unchanged.)
- [ ] Application source at **≥95% coverage** — `domain-registry.ts` and the new branches in
      `validate-concepts.ts` are exercised by user-visible behavior (parser findings, exit codes,
      the skip guard, the no-registry no-op). Coverage is a signal, not a target to game.
- [ ] Decision stubs written to
      `.nexus/queue/concept-domain-taxonomy-1c1005a6/sameera/decisions-epic-concept-domain-taxonomy.md`
      (§7 Step 7 above; append-only).
- [ ] No concept page gained a `domain:` field; `generate-atlas.ts` untouched; no registry added to
      the parity corpus (scope guard — §4).
- [ ] Commit message exactly: `feat(#90): A domain registry defines the taxonomy`.
