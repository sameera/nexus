# Plan — STORY-81.04: Design-time readers resolve context docs through the docs root

- **Epic:** #81 "Planning Surfaces Follow the Docs Root" (`.nexus/queue/docs-root-planning-surfaces-dd64b3e7/`)
- **Story issue:** #85 · **size:** S · **blocked_by:** STORY-81.01 (#82)
- **Prerequisite:** Story 1 created the docs-root read-out AND added the Phase-0 `<docs-root>`
  resolution to `/nxs.epic`. This story reuses that in `/nxs.epic` and adds the same resolution to
  `/nxs.hld` and `/nxs.council`.

---

## 1. Goal (what "done" means)

Design-time readers currently load product/system context from hardcoded `docs/` literals, so in a
hub layout they silently find nothing. This story routes those reads through the resolved docs root:

- **`/nxs.epic`** — its two context reads use the `<docs-root>` already resolved in Phase 0 (Story 1).
- **`/nxs.hld`** — resolves the docs root and hands the resolved context-doc locations to the
  `nxs-architect` brief.
- **`nxs-architect`** — reads product/system/feature context from the docs root named in its brief,
  not its own baked-in `docs/` literals.
- **`/nxs.council`** — resolves the docs root and hands it to both the `nxs-pm` and `nxs-architect`
  briefs (council is the only command that invokes `nxs-pm`).
- **`nxs-pm`** — reads product/feature context from the docs root named in its brief.

Graceful absence is preserved (a genuinely-missing doc is referenced-if-present, never a hard
failure). A resolution *failure* stops the invoking command — it is not treated as "context absent."

**Scope decision already made (do not revisit):** `nxs-pm` is invoked only by `/nxs.council`, so
routing it requires touching council. This was explicitly chosen. `nxs-pm`'s out-of-taxonomy literals
`docs/decisions/` and `docs/templates/` are **left as-is** — they are not part of the
`features/product/system/delivery` taxonomy this epic moves.

**Files:** markdown only. But all five live under `.claude/`, so re-vendor at the end (§7).

---

## 2. Judgment calls already made — do NOT re-decide

1. **The invoking command resolves; the agents never self-resolve** (decision-record: sub-agents
   don't run the vehicle branch). `/nxs.hld` and `/nxs.council` run the docs-root read-out and pass
   the resulting `<docs-root>` value into the agent brief. The agents read that value.
2. **Agents default `<docs-root>` to `docs` when their brief names none.** `nxs-architect` and
   `nxs-pm` are also invoked standalone (direct user invocation, no planning command). In that case
   there is no brief-supplied docs root; the agent uses `docs` — the single-repo layout — so
   standalone behavior is byte-unchanged (Invariant 2). This default is what makes routing the agents
   safe without self-resolution.
3. **Empty-prefix rule** (Invariant 4): when `<docs-root>` is `.`, a location hangs off the repo root
   (`product/context.md`), never `./`-prefixed or a `.`-named segment.
4. **A resolution failure stops the command** (ADDRESS risk): on a non-zero read-out exit the command
   reports the diagnostic and stops — it never passes a fake `docs` value nor treats failure as
   "context absent".
5. **`/nxs.council` needs `Bash`.** Its `tools:` is `Task` only; add `Bash` so it can run the read-out.
6. **`/nxs.epic` reuses Story 1's Phase-0 `<docs-root>`.** Do not add a second resolution step to
   `/nxs.epic`; Story 1 already put one at the top of Phase 0. This story only changes the two context
   reads to use it. (If, and only if, you are executing Story 4 before Story 1 merged, first apply
   Story 1's Edit E1 — the Phase-0 resolution block.)

---

## 3. Files you will touch

| # | File | Change |
|---|------|--------|
| A | `.claude/commands/nxs.epic.md` | route the two context reads to `<docs-root>` (reuse Phase-0 value) |
| B | `.claude/commands/nxs.hld.md` | resolve `<docs-root>`; route the architect-brief inputs |
| C | `.claude/agents/nxs-architect.md` | preamble + route all `docs/{product,features,system}/` reads |
| D | `.claude/commands/nxs.council.md` | add `Bash`; resolve `<docs-root>`; hand it to both briefs |
| E | `.claude/agents/nxs-pm.md` | preamble + route `docs/{product,features}/` reads |

The canonical read-out invocation (reused in B and D):

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
# docs-only hub (no toolchain): node <tools-dir>/nexus.mjs workspace docs-root
```

---

## 4. Edits

### 4.A `/nxs.epic` — route the two context reads (reuse Phase-0 `<docs-root>`)

**A1 — Phase 2 calibration read.** Find:

```markdown
judgment step — read `docs/product/context.md` and `docs/system/stack.md` if present to calibrate
against existing patterns.
```

Replace with:

```markdown
judgment step — read `<docs-root>/product/context.md` and `<docs-root>/system/stack.md` (the
`<docs-root>` resolved in Phase 0) if present to calibrate against existing patterns.
```

**A2 — Phase 3 personas read.** Find:

```markdown
1. Read `docs/product/context.md` if present — personas and strategy are canonical there. **Reference** them; do not re-tabulate.
```

Replace with:

```markdown
1. Read `<docs-root>/product/context.md` if present — personas and strategy are canonical there. **Reference** them; do not re-tabulate.
```

> Leave the Personas-template prose at lines ~489–490 / ~534 / ~544 (which cite
> `docs/product/context.md` as a canonical-location label inside the epic body you *write*) — those
> are the label an epic prints, not a read path, and Story 1 already left them. Do not touch them.

### 4.B `/nxs.hld` — resolve and hand paths to the architect brief

**B1 — add a resolution step at the start of Phase 1.** Find:

```markdown
## Phase 1 — Architectural analysis (delegate to nxs-architect)

Invoke `nxs-architect` in **decision-record mode**. The architect produces the decision *content* — the
"why", not a 16-section document.
```

Replace with:

```markdown
## Phase 1 — Architectural analysis (delegate to nxs-architect)

**Resolve the docs root first** (the architect reads context under it; it never resolves for itself).
Run the docs-root read-out:

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
```

In a checkout with no in-repo Node toolchain, use `node <tools-dir>/nexus.mjs workspace docs-root`.
Capture the printed line as **`<docs-root>`** (`docs` for single-repo/member, `.` for a repo-root hub,
or the override). **On a non-zero exit, stop and report the diagnostic** — never pass a fake `docs`
value nor treat failure as "context absent".

Invoke `nxs-architect` in **decision-record mode**. The architect produces the decision *content* — the
"why", not a 16-section document.
```

**B2 — route the brief's "Inputs to read".** Find:

```markdown
Inputs to read:
- ${QDIR}/epic.md            # the epic and ALL its user stories — authoritative scope
- docs/product/context.md    # personas, strategy (reference, don't re-tabulate)
- docs/system/stack.md       # technology stack
- docs/system/standards/*    # standards-conformance pass (flag deviations + justify)
```

Replace with:

```markdown
Resolved docs root: <docs-root>   # every doc path below is under this; on a repo-root hub it is `.`
Inputs to read:
- ${QDIR}/epic.md            # the epic and ALL its user stories — authoritative scope
- <docs-root>/product/context.md    # personas, strategy (reference, don't re-tabulate)
- <docs-root>/system/stack.md       # technology stack
- <docs-root>/system/standards/*    # standards-conformance pass (flag deviations + justify)
```

**B3 — the invariants-routing prose.** Find:

```markdown
  Per-subsystem only — route any cross-cutting NFR budget to docs/system/standards/ instead.
```

Replace with:

```markdown
  Per-subsystem only — route any cross-cutting NFR budget to <docs-root>/system/standards/ instead.
```

> Leave the two Phase-4 "do not write under `docs/`" constraints (lines ~149, ~177) unchanged —
> those forbid writing planning artifacts into the human docs tree by whatever name; they are not
> read paths.

### 4.C `nxs-architect` — read context under the brief's docs root

Do these two edits **in order** (preamble first, then the bulk route).

**C1 — add the `<docs-root>` preamble.** Find:

```markdown
The documentation structure is guaranteed to exist and remain current through automated hooks.
Trust the documentation as your primary source of truth.
```

Replace with:

```markdown
The documentation structure is guaranteed to exist and remain current through automated hooks.
Trust the documentation as your primary source of truth.

**Doc locations are under the resolved docs root.** Your brief names the resolved docs root as
`<docs-root>` (e.g. `docs`, or `.` for a hub whose docs root is the repo root). Read every
`<docs-root>/…` location below by joining the suffix under that root — when `<docs-root>` is `.`, the
suffix hangs directly off the repo root (`product/context.md`), never `./`-prefixed. **If your brief
does not name a docs root (a direct standalone invocation), default `<docs-root>` to `docs`** — the
single-repo layout — so your lookups are unchanged. A named location that is genuinely absent stays
reference-if-present, never a hard failure.
```

**C2 — route every context read.** Apply these three replacements across the whole file (use the Edit
tool with `replace_all: true` for each). Every occurrence should change the same way:

- `docs/product/`  →  `<docs-root>/product/`
- `docs/features/`  →  `<docs-root>/features/`
- `docs/system/`  →  `<docs-root>/system/`   *(this also converts `docs/system/standards/`)*

After C2, verify: `grep -n 'docs/product/\|docs/features/\|docs/system/' .claude/agents/nxs-architect.md`
should return **no** hits.

### 4.D `/nxs.council` — add Bash, resolve, hand the value to both briefs

**D1 — add `Bash` to tools.** Find:

```markdown
tools: Task
```

Replace with:

```markdown
tools: Task, Bash
```

**D2 — resolve the docs root at the start of Phase 2.** Find:

```markdown
## Phase 2: Gather Perspectives

Invoke the specialized subagents using the Task tool:
```

Replace with:

```markdown
## Phase 2: Gather Perspectives

**Resolve the docs root first** (the sub-agents read context under it; they never resolve for
themselves). Run the docs-root read-out:

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
```

In a checkout with no in-repo Node toolchain, use `node <tools-dir>/nexus.mjs workspace docs-root`.
Capture the printed line as **`<docs-root>`** (`docs` for single-repo/member, `.` for a repo-root hub,
or the override). **On a non-zero exit, stop and report the diagnostic** — never pass a fake `docs`
value nor treat failure as "context absent".

Invoke the specialized subagents using the Task tool:
```

**D3 — hand `<docs-root>` to the PM brief.** Find:

```markdown
Invoke: nxs-pm
Mode: council
Topic: [The validated topic from Phase 1]
```

Replace with:

```markdown
Invoke: nxs-pm
Mode: council
Resolved docs root: <docs-root>   # read all product/feature context under this root
Topic: [The validated topic from Phase 1]
```

**D4 — hand `<docs-root>` to the architect brief.** Find:

```markdown
Invoke: nxs-architect
Topic: [The validated topic from Phase 1]
```

Replace with:

```markdown
Invoke: nxs-architect
Resolved docs root: <docs-root>   # read all product/system/feature context under this root
Topic: [The validated topic from Phase 1]
```

### 4.E `nxs-pm` — read context under the brief's docs root

Do these in order (preamble first, then the bulk route).

**E1 — add the `<docs-root>` preamble.** Find:

```markdown
# Context Gathering

## Always Read (Both Modes)
```

Replace with:

```markdown
# Context Gathering

**Doc locations are under the resolved docs root.** When invoked by a Nexus command (e.g.
`nxs.council`), your brief names the resolved docs root as `<docs-root>` (`docs`, or `.` for a
repo-root hub). Read every `<docs-root>/…` location below by joining the suffix under that root —
when `<docs-root>` is `.`, the suffix hangs off the repo root (`product/context.md`), never
`./`-prefixed. **Invoked standalone with no docs root named, default `<docs-root>` to `docs`.** A
genuinely-absent file stays graceful (ask the user / proceed), never a hard failure.

## Always Read (Both Modes)
```

**E2 — route the product/feature context reads.** Apply these two replacements across the whole file
(Edit with `replace_all: true` each). Leave `docs/decisions/` and `docs/templates/` untouched — they
are outside this epic's taxonomy.

- `docs/product/`  →  `<docs-root>/product/`
- `docs/features/`  →  `<docs-root>/features/`

After E2, verify only the intended literals remain:
`grep -n 'docs/' .claude/agents/nxs-pm.md` should show hits **only** for `docs/decisions/`
(lines ~40, ~581) and `docs/templates/` (line ~258) — nothing under `product/`, `features/`, `system/`.

---

## 5. Judgment: why the agents default to `docs`, not self-resolve

Both `nxs-architect` and `nxs-pm` run in two contexts: (a) invoked by a planning command that now
hands them `<docs-root>`, and (b) direct standalone invocation. Making them run the read-out
themselves would (i) contradict the decision-record's "sub-agents free of the vehicle branch" and
(ii) re-introduce the swallow-a-resolution-failure risk inside the agent. Instead the invoking command
owns resolution and failure-handling; the agent simply reads the value it is given, and defaults to
`docs` (the single-repo layout, unchanged) when it is given none. This preserves Invariant 2 for every
standalone run.

---

## 6. Acceptance-criteria mapping (Story 4 / #85)

- **AC-1 (`/nxs.epic` or `/nxs.hld` loads product context from the resolved path):** Edits A1/A2
  (epic reuses Phase-0 `<docs-root>`) and B1/B2 (hld resolves and hands the path).
- **AC-2 (architect reads system docs from the resolved location):** Edits B2 + C1/C2 (the standards
  pass reads `<docs-root>/system/standards/`).
- **AC-3 (single-repo → lookup paths unchanged):** every `<docs-root>/…` reproduces the old `docs/…`
  when the read-out returns `docs`; standalone agents default to `docs`.
- **AC-4 (genuinely-absent context stays graceful):** preambles C1/E1 keep reference-if-present; only
  a resolution *failure* (distinct outcome) stops the command (judgment §2.4, §4.B/D).

## 7. Re-vendor and verify (mandatory — you edited five `.claude/` files)

```bash
# Sanity greps — no unrouted taxonomy literals should remain in the agents:
grep -n 'docs/product/\|docs/features/\|docs/system/' .claude/agents/nxs-architect.md   # expect: none
grep -n 'docs/product/\|docs/features/'               .claude/agents/nxs-pm.md           # expect: none

# Re-vendor (the claude-components fingerprint changed) and run the gate:
pnpm nexus:vendor-tools          # regenerates libs/portable-tools/bundle-fingerprint.json — commit it
pnpm nx test portable-tools      # parity.spec.ts must pass
```

## 8. Definition of done

- [ ] `/nxs.epic` context reads use Phase-0 `<docs-root>` (A1, A2); templates untouched.
- [ ] `/nxs.hld` resolves `<docs-root>` and the architect brief lists resolved inputs (B1–B3).
- [ ] `nxs-architect` has the `<docs-root>` preamble and no `docs/{product,features,system}/` literal (C1, C2).
- [ ] `/nxs.council` has `Bash`, resolves `<docs-root>`, hands it to both briefs (D1–D4).
- [ ] `nxs-pm` has the preamble and no `docs/{product,features}/` literal; `docs/decisions/` +
      `docs/templates/` deliberately left (E1, E2).
- [ ] `pnpm nexus:vendor-tools` re-run, `bundle-fingerprint.json` committed, `pnpm nx test portable-tools` green.
