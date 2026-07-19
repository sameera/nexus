# Implementation Plan — STORY-89.02: Concept pages file under a domain

GitHub issue: **#91**. Epic: #89 (`.nexus/queue/concept-domain-taxonomy-1c1005a6/epic.md`).
Binding authority: `.nexus/queue/concept-domain-taxonomy-1c1005a6/decision-record.md`.
Builds on Story 1 (issue #90, commit `f448932`), already committed on this branch
(`epic/concept-domain-taxonomy`).

Executor: follow this plan verbatim. All paths, line anchors, and signatures below are verified
against the repo at HEAD `f448932`. Do **not** explore or improvise — every fact you need is here.

---

## 1. Goal

Ship per-page `domain:` validation on top of Story 1's committed registry parser + registry
structural pass. "Done" == Story 2's four ACs:

- **AC(a)** — with a registry present: a page whose `domain:` resolves to a defined domain **or**
  subdomain path passes; a page whose `domain:` names an undefined path **or** whose `domain:`
  field is absent fails, with a finding that names the page.
- **AC(b)** — a page may file at a **parent** domain path even when that domain has subdomains;
  parent filing passes.
- **AC(c)** — a store with **no** registry raises zero domain findings, and every existing check
  behaves exactly as before the change (activation-on-presence).
- **AC(d)** — a change that edits **only** a page's `domain:` frontmatter does **not** trip the
  drain-time "exactly one new Decision Log entry" rule (re-filing is orientation metadata, not
  knowledge); any other difference re-arms the rule, and the append-only prior-entries check
  always holds.

---

## 2. Judgment calls already made — do not re-decide

Each item is lifted from the decision record (DR) or the epic. Treat as fixed instructions.

1. **Activation-on-presence; the registry file is the only switch — no config flag.** All
   `domain:` rules fire only when the registry (`domains.md`, beside the atlas) exists. With no
   registry, the validator's findings and exit codes are byte-for-byte the pre-change behavior.
   *(DR "Activation-on-presence…"; DR Invariant 5; epic AC(c).)* → In the validator, page domain
   resolution is gated on a non-null "valid paths" set that is built **only** when the registry is
   present; otherwise it is `null` and no domain finding is ever raised.

2. **Registry validation is a store-level pass, parsed once per run.** Story 1 already parses the
   registry once in `runCli` when present. Story 2 **reuses that single parse** to build the set of
   valid filing paths — it must not parse the registry a second time. *(DR "Registry validation is a
   store-level pass…" — "parses and structurally validates it once per invocation".)*

3. **Parent filing stays legal when subdomains exist.** A page may file at a parent domain path even
   when that domain has subdomains; such a page resolves and passes. *(DR "Parent filing stays legal
   when subdomains exist"; DR Invariant 7; epic AC(b).)* → The valid-paths set contains **every**
   domain path and every subdomain path, so a parent path is always resolvable regardless of whether
   it has children.

4. **`domain:` is a single path per page.** One scalar frontmatter field; multi-domain filing is out
   of scope. *(Epic Assumptions: "`domain:` is a single path per page; multi-domain filing is out".)*
   → Read `fm.fields.get("domain")` and treat a non-string / empty value as "absent".

5. **The identity a page resolves against is the full slash-form path.** `domain: connectors` and
   `domain: connectors/catalog` are distinct paths; a leaf slug reused under two parents
   (`connectors/catalog`, `sources/catalog`) is two distinct paths. *(DR "Full slug-path is the
   identity…".)* → Resolution is exact-string membership in the full-path set.

6. **The Decision Log exemption is scoped to domain-only changes.** The drain-time "exactly one new
   Decision Log entry" rule is skipped **only** when base and head are byte-identical **after
   normalizing out the `domain:` field**. Any other difference (body, or any other frontmatter such
   as `status`, `last_updated_by`, `touches`) re-arms the rule. The append-only prior-entries check
   **always** holds. *(DR "The Decision Log exemption is scoped to domain-only changes"; DR
   Invariant 7; DR Risk "ADDRESS — the Decision Log exemption loosens the append-only integrity
   gate".)*

7. **The registry is never validated as a concept page.** No new work here — Story 1 already added
   the skip guard in `runCli`. Do not re-touch it beyond the wiring in §6. *(DR Invariant 6.)*

8. **New findings use the existing finding shape and block the PR like current findings.** Reuse
   `Finding = { file, message }`; any finding makes `runCli` exit non-zero. A domain finding's
   `.file` is the page's path — that is how it "names the page". *(DR Invariant 4.)*

9. **Domain finding messages (engineer's call, fixed here — do not reword).**
   - Absent: `` frontmatter: missing `domain` — every page files under a registry domain path ``
   - Unresolvable: `` frontmatter: `domain` "<value>" does not resolve to a defined domain or subdomain path ``
   Tests assert on substrings (`"domain"`, `"does not resolve"`, the page filename), never the exact
   full string.

---

## 3. Ground truth (verified paths, signatures, conventions)

### Project & tooling (unchanged from Story 1)
- Portable tools: **`libs/portable-tools/src/`**; nx project **`@nexus/portable-tools`**.
- Test: **vitest** (`globals: true`, `environment: "node"`). Specs are `src/**/*.spec.ts`.
- Commands: test `npx nx test @nexus/portable-tools`; typecheck `npx nx typecheck @nexus/portable-tools`;
  lint `npx nx lint @nexus/portable-tools`; re-vendor `pnpm nexus:vendor-tools`
  (= `tsx libs/portable-tools/src/vendor-bundle.ts`, `package.json` line 23).
- Source style (match exactly; do **not** run prettier): **4-space indent, double quotes,
  semicolons, trailing commas in multiline literals.** Local ESM imports carry `.js`; package
  imports do not. **No barrel files** (CLAUDE.md).

### The validator — `libs/portable-tools/src/validate-concepts.ts` (committed at f448932)
Story 1 already added the registry import, the `REGISTRY_FILENAME` const, `registryPath`,
`validateRegistry`, the store-level registry pass in `runCli`, and the skip guard. Story 2 extends
this file only. Verified anchors:

- **Line 21** — `import { parseDomainRegistry } from "./domain-registry.js";`
- **Lines 29-32** — `interface Frontmatter { fields: Map<string, string | string[]>; bodyStart: number; }`.
- **Lines 34-37** — `export interface Finding { file: string; message: string; }`. **Reuse this.**
- **Line 106** — `export function parseFrontmatter(lines: string[]): Frontmatter | null` — returns
  `fm.fields.get("domain")` as `string | string[] | undefined`. A scalar `domain: connectors` line
  parses to the string `"connectors"` (frontmatter scalar path, lines 132-134).
- **Lines 154-163** — `function decisionLogHeadings(content: string): string[]`; ends at line 163
  with `    return log.filter((line: string) => line.startsWith("### "));` then `}`. **Insert
  `stripDomainLine` immediately after this function.**
- **Line 298** — `export function validatePage(file: string, base: string | null, repoRoot: string, findings: Finding[]): void {`
  — the signature to extend with the new gated parameter.
- **Lines 335-341** — the derived-field loop (`for (const derived of ["slug", "id"])`) ends, blank
  line, then `    const bodyLines: string[] = lines.slice(fm.bodyStart);`. **Insert the domain
  block between them** (keeps all frontmatter checks together, before body checks).
- **Lines 433-457** — the `if (base !== null)` changed-page block. The exemption edits the
  `} else if (previous !== null) {` branch (line 442) and its `if (gained !== 1)` (lines 445-447).
  The first branch `if (previous !== null && previous === content)` (line 440, "Unchanged against
  base: nothing to enforce") and the `} else if (logHeadings.length !== 1)` new-page branch
  (line 454) stay as-is.
- **Lines 476-482** — `export function validateRegistry(file: string, findings: Finding[]): void`
  (currently returns `void`; Story 2 changes it to return `ParsedRegistry`).
- **Line 484** — `export function runCli(argv: string[]): number {`.
- **Lines 498-502** — the store-level registry pass:
  ```
      const regPath: string = registryPath(process.cwd());
      const hasRegistry: boolean = fs.existsSync(regPath);
      if (hasRegistry) {
          validateRegistry(regPath, findings);
      }
  ```
  Story 2 changes this to capture the parse and build the valid-paths set.
- **Lines 520-534** — the per-file loop, including the skip guard (lines 521-524) and the
  `validatePage(file, options.base, repoRoot, findings);` call (line 532). Story 2 passes the new
  argument on that call only.

### The Decision-Log "one new entry" rule lives ONLY here
`grep` over `libs/portable-tools/src/*.ts` confirms the "exactly one new Decision Log entry" /
append-only rule exists solely in `validate-concepts.ts` `validatePage` (lines 433-457).
`derive-entry-diff.ts` is hub-mode diff derivation for the distiller (epic #54) — it emits diffs,
it does **not** enforce the Decision-Log rule. **Do not touch `derive-entry-diff.ts`.**

### Parser surface Story 2 consumes — `libs/portable-tools/src/domain-registry.ts` (do NOT edit)
- `export interface DomainNode { title: string; slug: string; path: string; rubric: string; subdomains: DomainNode[]; }`
  (lines 14-20).
- `export interface ParsedRegistry { domains: DomainNode[]; findings: string[]; }` (lines 22-25).
- `export function parseDomainRegistry(content: string): ParsedRegistry` (line 74). Total — never
  throws. A domain's `.path` is its leaf slug; a subdomain's `.path` is `<parent-leaf>/<own-leaf>`
  (composed, lines 91-104). Nodes with a missing slug have `slug === ""` and `path === ""` — exclude
  these when collecting valid filing paths. Detached orphan subdomains (an `###` before any `##`)
  are **not** in `.domains`, so they are never collectible as valid paths.

### Docs-root resolver — `libs/workspace/src/resolve.ts`
- `export function localDocsRoot(startDir: string): LocalDocsRootResult` (line 140). In single-repo
  mode `docsRoot === "docs"` (lines 145-146, `SINGLE_REPO_DOCS_ROOT` line 71). A checkout with no
  workspace manifest/pointer is single-repo (lines 116-122) — so `registryPath(anyTmpDir)` returns
  `path.join("docs", "domains.md")` with **no** workspace marker files needed in tests (Story 1
  test at spec line 906 already proves this).

### Bundles / parity / fingerprint
- `ENTRY_POINTS` (`build-bundles.ts` lines 10-15) = `generate-atlas`, `validate-concepts`,
  `derive-entry-diff`, `nexus`. **`nexus-cli.ts` does NOT import `validate-concepts.ts`** (verified),
  and no source module imports `validatePage`/`validateRegistry` except the spec (verified — only a
  generated `dist/validate-concepts.d.ts` references it, which the build regenerates). So editing
  `validate-concepts.ts` changes **only** the `validate-concepts.mjs` bytes among the four bundles.
  `domain-registry.ts` and `generate-atlas.ts` are untouched, so `generate-atlas.mjs`,
  `derive-entry-diff.mjs`, `nexus.mjs`, and `claude-components` stay byte-identical.
- `bundle-fingerprint.json` pins each `<entry>.mjs` (+ `claude-components`) to a sha256.
  `parity.spec.ts` "fingerprint pin › the freshly built bundle hash equals the committed pin"
  (lines 117-123) will **FAIL** for `validate-concepts.mjs` until you re-vendor. Expected — §6 Step 6.
- `vendor-bundle.ts` (line 79) writes `bundle-fingerprint.json` in place; it also recomputes the
  `claude-components` hash (line 73) which must stay unchanged (no `.claude/**` edits this story).
- Parity corpus (`libs/portable-tools/corpus/{clean,findings,atlas,base,head}`) has **no**
  `domains.md`, so the registry pass and `domain:` resolution are inert for every corpus run
  (`validDomainPaths` is `null` there). The corpus `base/head` `no-new-entry.md` fixture (a body
  change with no new log entry) has no `domain:` field, so the domain-only exemption leaves it
  flagged exactly as today — parity preserved. **Do NOT add a registry to the corpus** (same scope
  guard as Story 1; DR Invariant 12's corpus growth lands with Story 3).
- No `domains.md` exists anywhere in the repo (verified) — the pass stays inert for the real store,
  for `pnpm nexus:validate-concepts`, and for every existing test.

### Test patterns to copy (all already in `validate-concepts.spec.ts`)
- Helpers (lines 46-127): `page(opts)`, `makeTmpDir()`, `makeGitRepo()`, `commitAll(dir, msg)`,
  `writeFile(dir, relPath, content)`, `validate(file, base?, repoRoot?)`, `validateWithCwd(dir, fn)`,
  and the `afterEach` cleanup. **Reuse them.**
- `DEFAULT_FRONTMATTER` const (lines 21-26) — has no `domain:` line; append one to build a filed page.
- `chdirTmp()` helper + cwd-restoring `afterEach` (lines 891-904) inside the existing
  `describe("domain registry (epic #89, STORY-89.01)")`. Use the same shape for new runCli tests.
- `REGISTRY_WELL_FORMED` fixture const (lines 809-836) — defines domains `connectors`
  (subdomains `connectors/catalog`, `connectors/runtime`) and `sources` (subdomain
  `sources/catalog`). **Reuse it.** Valid paths it yields:
  `connectors`, `connectors/catalog`, `connectors/runtime`, `sources`, `sources/catalog`.
- `--base` mode tests (lines 628-769) use `makeGitRepo()` + `commitAll()` + `validateWithCwd()` +
  `validate(file, sha, dir)`. Copy this shape for the AC(d) exemption tests.
- runCli exit-code assertions (lines 771-802, 924-962) call the imported `runCli([...])` in-process.

---

## 4. Out of scope (do not touch)

- **Story 1 (issue #90) — the registry grammar/parser and structural pass.** `domain-registry.ts`
  is DONE; only *consume* `parseDomainRegistry` / `ParsedRegistry`. Do not change the grammar, the
  parser, or the registry-structure findings. Story 1's `registryPath`, `validateRegistry` body
  (beyond the return-type change in §6), the skip guard, and the AC4 fixture tests stay as they are.
- **Story 3 (issue #92) — the atlas renders the hierarchy.** Do NOT edit `generate-atlas.ts` at all.
  No registry-mode rendering, no atlas grouping. Story 2 is validation only.
- **Parity corpus growth (DR Invariant 12).** Do NOT add a `domains.md` (or any registry fixture) to
  the shared corpus — it would activate the pass for every corpus run and pull in the `domain:`
  requirement for corpus pages. Story 2's fixtures live in the specs.
- **Drain-side filing, the new-domain gate, drift advisories, seed tooling** — the follow-on epic.
- **Migrating any existing store's pages** — a consumer-side chore. Do not add `domain:` to any real
  concept page in `.nexus/concepts/` or `docs/`.

---

## 5. Tests first (TFD — write the failing test before the code)

All additions go in `libs/portable-tools/src/validate-concepts.spec.ts`. No new spec file and no new
imports are needed — every symbol (`validatePage`, `runCli`, `registryPath`, `validateRegistry`,
`Finding`) and every helper is already imported/defined. Write these blocks first; each must fail
before you write §6.

Add near the existing `REGISTRY_WELL_FORMED` const, a shared valid-paths set for the page-level tests:

```
const VALID_DOMAIN_PATHS = new Set(["connectors", "connectors/catalog", "connectors/runtime", "sources", "sources/catalog"]);
```

And a page-level helper (mirrors `validate()` but passes the gated set):

```
function validateDom(file: string, validPaths: Set<string> | null): Finding[] {
    const findings: Finding[] = [];
    validatePage(file, null, path.dirname(file), findings, validPaths);
    return findings;
}
```

### 5A. `describe("validatePage — domain filing (STORY-89.02)")`

1. **AC(a) resolves at a domain → pass.** page with `frontmatter: \`${DEFAULT_FRONTMATTER}\ndomain: connectors\``;
   `validateDom(file, VALID_DOMAIN_PATHS)` has no finding whose message includes `"domain"`.
2. **AC(a) resolves at a subdomain → pass.** `domain: connectors/catalog`; no `"domain"` finding.
3. **AC(b) parent filing with subdomains present → pass.** `domain: connectors` (a domain that has
   subdomains in `VALID_DOMAIN_PATHS`); no `"domain"` finding.
4. **AC(a) undefined path → fail naming the page.** `domain: nope/not-real`;
   `validateDom(file, VALID_DOMAIN_PATHS)` has a finding whose `.file === file` and whose message
   includes `"does not resolve"` (and includes the value `"nope/not-real"`).
5. **AC(a) absent field with registry present → fail naming the page.** plain `page()` (no domain);
   `validateDom(file, VALID_DOMAIN_PATHS)` has a finding whose `.file === file` and message includes
   `"missing"` and `"domain"`.
6. **AC(c) no registry → no domain finding even when absent.** plain `page()`;
   `validateDom(file, null)` has **no** finding whose message includes `"domain"`. (Proves the gate:
   `null` set = registry absent.)
7. **Leaf reuse resolves under either parent.** `domain: sources/catalog` → pass; `domain: connectors/catalog`
   → pass (both in the set; same leaf, different parents).

### 5B. `describe("runCli — domain filing (STORY-89.02)")` (chdirTmp + cwd-restore afterEach)

Copy the `chdirTmp()` helper + restoring `afterEach` from the existing STORY-89.01 block. Each test:
`chdirTmp()`, write `docs/domains.md` (usually `REGISTRY_WELL_FORMED`), write concept pages under
`.nexus/concepts/`, capture `console.error` where asserting on messages, call `runCli([])`.

8. **AC(a) end-to-end pass.** registry `REGISTRY_WELL_FORMED`; `.nexus/concepts/alpha.md` =
   `page({ frontmatter: \`${DEFAULT_FRONTMATTER}\ndomain: connectors\` })`. `runCli([])` returns `0`.
9. **AC(a) undefined path → exit 1, names the page.** same registry; `alpha.md` with
   `domain: ghosts`. Capture `console.error`; `runCli([])` returns `1`; some error line includes
   both `"alpha.md"` and `"does not resolve"`.
10. **AC(a) absent field → exit 1, names the page.** same registry; `alpha.md` = plain `page()`.
    `runCli([])` returns `1`; some error line includes `"alpha.md"` and (`"missing"` + `"domain"`).
11. **AC(b) parent filing → exit 0.** same registry; `alpha.md` with `domain: connectors` (parent
    that has subdomains). `runCli([])` returns `0`.
12. **AC(c) no-registry no-op.** do NOT write `docs/domains.md`; `.nexus/concepts/alpha.md` = plain
    `page()` (no domain). Capture `console.error`; `runCli([])` returns `0`; no error line includes
    `"domain"`. (Distinct from Story 1's Invariant-5 test: this asserts the *page* passes with no
    `domain:` field when no registry.)

### 5C. `describe("validatePage — Decision Log domain-only exemption (STORY-89.02)")`

Use `makeGitRepo()` + `commitAll()` + `validateWithCwd()` + `validate(file, sha, dir)` (the `validate`
helper passes `validDomainPaths` as its default `null`, so these tests exercise only the exemption,
not domain resolution). Build a base page that carries a `domain:` line, e.g.
`const FM_WITH_DOMAIN = \`${DEFAULT_FRONTMATTER}\ndomain: connectors\`;` and
`page({ frontmatter: FM_WITH_DOMAIN })`.

13. **AC(d) domain-only change → exempt, passes.** base = `page({ frontmatter: FM_WITH_DOMAIN })`,
    commit; head = `page({ frontmatter: \`${DEFAULT_FRONTMATTER}\ndomain: sources\` })` (only the
    `domain:` line differs, no new log entry). `validate(file, sha, dir)` has **no** finding whose
    message includes `"Decision Log"`.
14. **AC(d) domain-plus-body change → not exempt, must carry an entry.** base as above; head changes
    the `domain:` line **and** the lead (`page({ frontmatter: FM_WITH_DOMAIN_SOURCES, lead: "Alpha does the thing well, revised." })`),
    no new log entry. Some finding message includes `"gained 0 entries"`.
15. **AC(d) body-only change → unchanged behavior.** base = `page({ frontmatter: FM_WITH_DOMAIN })`;
    head keeps `domain: connectors` but changes the lead, no new log entry. Some finding message
    includes `"gained 0 entries"`.
16. **AC(d) append-only still holds under a domain-only change.** base = `page({ frontmatter: FM_WITH_DOMAIN })`;
    head changes the `domain:` line **and** edits a prior Decision Log heading (reuse the
    `### 2026-07-04 — #1 — Seed` → `### 2026-07-05 — #1 — Seed` edit from the existing append-only
    test at spec lines 704-721). Some finding message includes `"append-only"`. (Proves the
    exemption skips only the one-entry count, never the append-only guard.)

> TFD: assert on substrings / `.file` equality, never exact full message strings.

---

## 6. Steps

### Step 1 — write the §5 spec blocks (5A, 5B, 5C) in `validate-concepts.spec.ts`, plus the
`VALID_DOMAIN_PATHS` const and `validateDom` helper. Run `npx nx test @nexus/portable-tools`; the new
blocks must fail (the gated parameter and the exemption do not exist yet).

### Step 2 — edit `libs/portable-tools/src/validate-concepts.ts`

**Edit 2.1 — import the `ParsedRegistry` type.** Find (line 21):
```
import { parseDomainRegistry } from "./domain-registry.js";
```
Replace with:
```
import { parseDomainRegistry, type ParsedRegistry } from "./domain-registry.js";
```

**Edit 2.2 — add `stripDomainLine` after `decisionLogHeadings`.** Find (lines 162-163, the end of
`decisionLogHeadings`):
```
    return log.filter((line: string) => line.startsWith("### "));
}
```
Replace with:
```
    return log.filter((line: string) => line.startsWith("### "));
}

/**
 * Return `content` with its frontmatter `domain:` field removed (epic #89, STORY-89.02). Used by the
 * changed-page check to detect a re-file: a change whose only difference is `domain:` is orientation
 * metadata, not knowledge, so it is exempt from the one-new-Decision-Log-entry rule. Only the field
 * inside the opening frontmatter block is dropped; a body line is never touched.
 */
function stripDomainLine(content: string): string {
    const lines: string[] = content.split("\n");
    const kept: string[] = [];
    let delimiters = 0;
    for (const line of lines) {
        if (line.trim() === "---") {
            delimiters++;
            kept.push(line);
            continue;
        }
        if (delimiters === 1 && /^domain:\s*/.test(line)) {
            continue;
        }
        kept.push(line);
    }
    return kept.join("\n");
}
```

**Edit 2.3 — extend the `validatePage` signature with the gated parameter.** Find (line 298):
```
export function validatePage(file: string, base: string | null, repoRoot: string, findings: Finding[]): void {
```
Replace with:
```
export function validatePage(file: string, base: string | null, repoRoot: string, findings: Finding[], validDomainPaths: Set<string> | null = null): void {
```

**Edit 2.4 — add the domain-resolution block.** Find (lines 335-341):
```
    for (const derived of ["slug", "id"]) {
        if (fm.fields.has(derived)) {
            findings.push({ file, message: `frontmatter: \`${derived}\` is derived state — the filename is the slug (0003 §2.1)` });
        }
    }

    const bodyLines: string[] = lines.slice(fm.bodyStart);
```
Replace with:
```
    for (const derived of ["slug", "id"]) {
        if (fm.fields.has(derived)) {
            findings.push({ file, message: `frontmatter: \`${derived}\` is derived state — the filename is the slug (0003 §2.1)` });
        }
    }

    // Domain filing (epic #89, STORY-89.02): when a registry is present every page must file under a
    // defined domain or subdomain path. Gated on presence — validDomainPaths is null when the store
    // has no registry, and then no domain finding is ever raised (decision-record Invariant 5).
    // Parent filing is legal: validDomainPaths carries every domain path, so a parent path resolves
    // whether or not it has subdomains (Invariant 7).
    if (validDomainPaths !== null) {
        const domain: string | string[] | undefined = fm.fields.get("domain");
        if (typeof domain !== "string" || domain === "") {
            findings.push({ file, message: "frontmatter: missing `domain` — every page files under a registry domain path" });
        } else if (!validDomainPaths.has(domain)) {
            findings.push({ file, message: `frontmatter: \`domain\` "${domain}" does not resolve to a defined domain or subdomain path` });
        }
    }

    const bodyLines: string[] = lines.slice(fm.bodyStart);
```

**Edit 2.5 — scope the one-entry rule with the domain-only exemption.** Find (lines 442-447):
```
        } else if (previous !== null) {
            const oldHeadings: string[] = decisionLogHeadings(previous);
            const gained: number = logHeadings.length - oldHeadings.length;
            if (gained !== 1) {
                findings.push({ file, message: `Decision Log: page changed against ${base} but gained ${gained} entries (must be exactly 1)` });
            }
```
Replace with:
```
        } else if (previous !== null) {
            // Re-filing is orientation metadata, not knowledge (epic #89, STORY-89.02): when the only
            // difference between base and head is the `domain:` field, the one-new-entry rule is
            // exempt. Any other difference re-arms it; the append-only check below always holds.
            const domainOnly: boolean = stripDomainLine(previous) === stripDomainLine(content);
            const oldHeadings: string[] = decisionLogHeadings(previous);
            const gained: number = logHeadings.length - oldHeadings.length;
            if (!domainOnly && gained !== 1) {
                findings.push({ file, message: `Decision Log: page changed against ${base} but gained ${gained} entries (must be exactly 1)` });
            }
```
Leave the append-only `for` loop, the `} else if (logHeadings.length !== 1) {` new-page branch, and
everything else in the block unchanged.

**Edit 2.6 — return the parse from `validateRegistry` and add `collectDomainPaths`.** Find
(lines 476-482):
```
export function validateRegistry(file: string, findings: Finding[]): void {
    const content: string = fs.readFileSync(file, "utf8");
    const parsed = parseDomainRegistry(content);
    for (const message of parsed.findings) {
        findings.push({ file, message });
    }
}
```
Replace with:
```
export function validateRegistry(file: string, findings: Finding[]): ParsedRegistry {
    const content: string = fs.readFileSync(file, "utf8");
    const parsed: ParsedRegistry = parseDomainRegistry(content);
    for (const message of parsed.findings) {
        findings.push({ file, message });
    }
    return parsed;
}

/**
 * The set of full slug paths a page may file under: every domain path and every subdomain path.
 * Parent paths are always included, so filing at a parent that has subdomains resolves (Invariant 7).
 * Entries with a missing slug (path "") are excluded — they are separately flagged as malformed.
 */
function collectDomainPaths(parsed: ParsedRegistry): Set<string> {
    const paths: Set<string> = new Set();
    for (const domain of parsed.domains) {
        if (domain.slug !== "") {
            paths.add(domain.path);
        }
        for (const sub of domain.subdomains) {
            if (sub.slug !== "") {
                paths.add(sub.path);
            }
        }
    }
    return paths;
}
```

**Edit 2.7 — reuse the single parse in `runCli` to build the valid-paths set.** Find (lines 498-502):
```
    const regPath: string = registryPath(process.cwd());
    const hasRegistry: boolean = fs.existsSync(regPath);
    if (hasRegistry) {
        validateRegistry(regPath, findings);
    }
```
Replace with:
```
    const regPath: string = registryPath(process.cwd());
    const hasRegistry: boolean = fs.existsSync(regPath);
    let validDomainPaths: Set<string> | null = null;
    if (hasRegistry) {
        const parsed: ParsedRegistry = validateRegistry(regPath, findings);
        validDomainPaths = collectDomainPaths(parsed);
    }
```

**Edit 2.8 — thread the set into the page validation call.** Find (lines 529-533):
```
        if (isAnchorFile(file)) {
            validateAnchor(file, findings);
        } else {
            validatePage(file, options.base, repoRoot, findings);
        }
```
Replace with:
```
        if (isAnchorFile(file)) {
            validateAnchor(file, findings);
        } else {
            validatePage(file, options.base, repoRoot, findings, validDomainPaths);
        }
```

### Step 3 — run `npx nx test @nexus/portable-tools`. Expect the §5 blocks green and the whole
existing suite green **except** `parity.spec.ts` "fingerprint pin › the freshly built bundle hash
equals the committed pin", which must **FAIL** for `validate-concepts.mjs` (bytes changed). That is
expected → Step 4 clears it. Also run `npx nx typecheck @nexus/portable-tools` and
`npx nx lint @nexus/portable-tools`.

### Step 4 — re-vendor the fingerprint pin. Run `pnpm nexus:vendor-tools` (no extra args — it
rewrites `libs/portable-tools/bundle-fingerprint.json` in place). Re-run
`npx nx test @nexus/portable-tools`; parity must now be green. Confirm the diff to
`bundle-fingerprint.json` changes **only** the `validate-concepts.mjs` hash (the other three bundle
hashes and `claude-components` must be unchanged). Stage the regenerated pin.

### Step 5 — append decision stubs (append-only) to
`.nexus/queue/concept-domain-taxonomy-1c1005a6/sameera/decisions-epic-concept-domain-taxonomy.md`
using the CLAUDE.md stub format (the file already exists with Story 1's two stubs — append, do not
overwrite). Record at least:
- **Domain-only exemption via a normalized string compare** — Choice: detect a re-file by removing
  the frontmatter `domain:` line from base and head and comparing for byte-equality; the one-entry
  rule is skipped only when they match, and the append-only check always runs. Refuted alternative:
  exempt any frontmatter-only change (rejected per DR — `status`/`last_updated_by`/`touches` are
  knowledge- or provenance-bearing and must still carry an entry).
- **Valid-paths built by reusing the single registry parse** — Choice: `validateRegistry` returns the
  `ParsedRegistry`, and `runCli` builds the valid-paths `Set` from it, so the registry is parsed once
  per run and threaded into `validatePage` via a nullable parameter (null = no registry = no domain
  finding). Refuted alternative: parse the registry a second time to build the set (rejected — DR
  requires "parse once per run").

### Step 6 — commit. Message exactly: `feat(#91): Concept pages file under a domain`.
(Already on the epic branch `epic/concept-domain-taxonomy`; if the workflow uses a per-story branch,
branch off it before committing — otherwise commit here.)

---

## 7. Done checklist

- [ ] `npx nx test @nexus/portable-tools` fully green — the new §5 blocks (5A/5B/5C), the whole
      existing suite, and `parity.spec.ts` (fingerprint pin + source-vs-bundle parity over the
      corpus, whose `no-new-entry.md` behavior is preserved because there is no registry there).
- [ ] `npx nx typecheck @nexus/portable-tools` and `npx nx lint @nexus/portable-tools` pass.
- [ ] **Re-vendor obligation (DR Invariant 11):** `validate-concepts.ts` changed, so
      `validate-concepts.mjs`'s bytes change and its fingerprint no longer matches the committed pin.
      Ran `pnpm nexus:vendor-tools` and committed the regenerated
      `libs/portable-tools/bundle-fingerprint.json` in this same PR. **Only the `validate-concepts.mjs`
      hash changes**; `generate-atlas.mjs`, `derive-entry-diff.mjs`, `nexus.mjs`, and
      `claude-components` are unchanged (no `.claude/**` edits, no atlas/parser edits).
- [ ] **`.claude/**` trigger does NOT apply:** Story 2 edits only `libs/portable-tools/src/**` and
      `bundle-fingerprint.json` — no `.claude/**` file is touched. The re-vendor above is driven
      purely by the changed bundle source, not by the CLAUDE.md `.claude/**` rule.
- [ ] Application source at **≥95% coverage** — the new domain block (missing / unresolvable /
      resolves), `collectDomainPaths`, `stripDomainLine` (both drop and keep branches), and the
      exemption's `domainOnly` true/false paths are all exercised by the §5 tests. Coverage is a
      signal, not a target to game.
- [ ] Decision stubs appended to
      `.nexus/queue/concept-domain-taxonomy-1c1005a6/sameera/decisions-epic-concept-domain-taxonomy.md`
      (§6 Step 5; append-only — Story 1's two stubs remain).
- [ ] Scope guards held: `generate-atlas.ts` and `domain-registry.ts` untouched;
      `derive-entry-diff.ts` untouched; no `domains.md` added to the parity corpus; no `domain:`
      field added to any real concept page.
- [ ] Commit message exactly: `feat(#91): Concept pages file under a domain`.
