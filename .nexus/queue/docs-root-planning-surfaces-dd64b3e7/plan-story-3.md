# Plan — STORY-81.03: Setup scaffolds under the resolved docs root

- **Epic:** #81 "Planning Surfaces Follow the Docs Root" (`.nexus/queue/docs-root-planning-surfaces-dd64b3e7/`)
- **Story issue:** #84 · **size:** S · **blocked_by:** STORY-81.01 (#82)
- **Prerequisite:** Story 1 created the docs-root read-out (`docs_root.ts` + `nexus workspace docs-root`).
  This story consumes it.

---

## 1. Goal (what "done" means)

Today `/nxs.setup` scaffolds `docs/system/…`, `docs/product/context.md`, and `docs/delivery/lessons/`
at hardcoded `docs/` paths, and the `nxs-setup` skill writes `docs/product/context.md`. This story
makes setup **resolve the docs root once** (via the read-out it already half-uses in Phase 0) and
scaffold every artifact under it, and makes the `nxs-setup` skill write the product context under the
resolved root. On a repo-root hub, a fresh bootstrap creates `system/…`, `product/…`, `delivery/…` at
the repo root with no `docs/` directory; on single-repo, every path is unchanged.

**Files:** `.claude/commands/nxs.setup.md` and `.claude/skills/nxs-setup/SKILL.md`. Markdown only —
no TypeScript. But both live under the managed `.claude/` subtrees, so you **must** re-run
`pnpm nexus:vendor-tools` and commit the updated fingerprint pin (see §6), or `parity.spec.ts` fails.

---

## 2. Judgment calls already made — do NOT re-decide

1. **Setup resolves the docs root fresh, at the point of use, via the read-out** (decision-record:
   workspace-level paths with no recorded value resolve fresh). Setup already runs a workspace read-out
   in Phase 0 through the dual-vehicle branch (tsx script vs `nexus.mjs` verb); add the **docs-root**
   read-out right beside it and capture the value once as `<docs-root>`.
2. **Empty-prefix rule** (Invariant 4): if `<docs-root>` is `.`, the taxonomy hangs directly off the
   repo root (`system/stack.md`); otherwise prefix it (`<docs-root>/system/stack.md`). Never a
   `./`-prefixed path or a `.`-named segment.
3. **A resolution failure stops setup** — it never falls back to a literal `docs/` (ADDRESS risk).
4. **The skill takes the resolved target from its invoker; standalone it resolves for itself.**
   `/nxs.setup` (Phase 5) hands the skill the resolved `<docs-root>/product/context.md` path. Run on
   its own (the skill's documented standalone mode), the skill resolves the docs root via the same
   read-out. Either way it writes under the resolved root (Story 3 AC-3).
5. **`/nxs.setup` needs `Bash` to run the read-out.** Its `tools:` frontmatter currently omits `Bash`
   even though Phase 0 already invokes a `tsx` read-out. Add `Bash` (§4.1) so the read-out reliably runs.

---

## 3. Files you will touch

| # | File | Change |
|---|------|--------|
| A | `.claude/commands/nxs.setup.md` | add `Bash` to tools; resolve `<docs-root>` in Phase 0; route Phases 3/4/5/6/7 |
| B | `.claude/skills/nxs-setup/SKILL.md` | write the product context under the resolved root |

---

## 4. Implementation — edits to `.claude/commands/nxs.setup.md`

### 4.1 Edit 1 — add `Bash` to the tools frontmatter

Find:

```markdown
tools: Read, Write, Edit, Glob, Grep, WebSearch, Skill
```

Replace with:

```markdown
tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, Skill
```

### 4.2 Edit 2 — resolve the docs root in Phase 0

Find the end of Phase 0 step 1 (the existing status read-out block):

```markdown
    In a checkout with no in-repo Node toolchain, use the portable CLI instead —
    `node <tools-dir>/nexus.mjs workspace status` (in a workspace hub, `<tools-dir>` is
    `.nexus/tools`). Both run the identical resolver.
```

Insert this **immediately after** it (a new sub-step that captures the docs root; keep the existing
step-2 "Branch on the result" that follows):

```markdown

    Then obtain the **resolved docs root** — the value every scaffold path below prefixes — from the
    single-value read-out (the same two vehicles):

    ```bash
    tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
    ```

    In a checkout with no in-repo Node toolchain, use `node <tools-dir>/nexus.mjs workspace docs-root`.

    - Capture the one printed line as **`<docs-root>`**: `docs` for a single-repo project or a member,
      `.` for a hub whose docs root is the repo root, or the hub's configured override.
    - **On a non-zero exit** it printed a resolver diagnostic to stderr. **Stop and report it.** Never
      fall back to a literal `docs/` — a resolution failure is not "single-repo".
    - **Empty-prefix rule:** when `<docs-root>` is `.`, a taxonomy path hangs directly off the repo
      root (`system/stack.md`); otherwise prefix it (`<docs-root>/system/stack.md`). Never a
      `./`-prefixed path or a `.`-named segment. Reuse `<docs-root>` for Phases 3–7 below.
```

### 4.3 Edit 3 — Phase 3 system-docs scaffold

Find:

```markdown
Create:

```
docs/
└── system/
    ├── stack.md            # Technology stack overview
    └── standards/
        └── *.md            # Project-specific standards (by judgment)
```

**Generate only the files listed above** — no `README.md` or index file at `docs/system/`. Nothing in the pipeline reads one.

### 3.1 `docs/system/stack.md`
```

Replace with:

```markdown
Create (under the resolved docs root — the tree below hangs off `<docs-root>`; on a repo-root hub
that is the repo root, so `system/stack.md`, not `docs/system/stack.md`):

```
<docs-root>/
└── system/
    ├── stack.md            # Technology stack overview
    └── standards/
        └── *.md            # Project-specific standards (by judgment)
```

**Generate only the files listed above** — no `README.md` or index file at `<docs-root>/system/`. Nothing in the pipeline reads one.

### 3.1 `<docs-root>/system/stack.md`
```

### 4.4 Edit 4 — Phase 4 delivery scaffold

Find:

```markdown
2. **`docs/delivery/lessons/`** — create the folder plus a `README.md` documenting the one-file-per-lesson convention (`<date>-<slug>.md`, source-epic in frontmatter). This is the home `/nxs.close` writes process/delivery lessons to.
```

Replace with:

```markdown
2. **`<docs-root>/delivery/lessons/`** — create the folder plus a `README.md` documenting the one-file-per-lesson convention (`<date>-<slug>.md`, source-epic in frontmatter). This is the home `/nxs.close` writes process/delivery lessons to.
```

### 4.5 Edit 5 — Phase 5 product context + hand-off to the skill

Find:

```markdown
Invoke the **`nxs-setup` skill** to run the interactive product-context interview. The skill asks at most 5 strategic questions one at a time, infers the rest with PM expertise, and writes `docs/product/context.md`.

Personas live canonically in `docs/product/context.md` — later epics reference them rather than re-tabulating.
```

Replace with:

```markdown
Invoke the **`nxs-setup` skill** to run the interactive product-context interview, **telling it the
resolved target path**: it writes the product context to `<docs-root>/product/context.md`. The skill
asks at most 5 strategic questions one at a time, infers the rest with PM expertise, and writes that file.

Personas live canonically in `<docs-root>/product/context.md` — later epics reference them rather than re-tabulating.
```

### 4.6 Edit 6 — Phase 6 CLAUDE.md refactor link

Find:

```markdown
2. **Replace with links** — add a "Technical Patterns and Standards" section linking to `docs/system/`.
```

Replace with:

```markdown
2. **Replace with links** — add a "Technical Patterns and Standards" section linking to `<docs-root>/system/`.
```

### 4.7 Edit 7 — Phase 7 summary block

Find:

```markdown
- `docs/system/stack.md` — technology stack
- `docs/system/standards/[file].md` — [brief description]
- `docs/product/context.md` — product context (interactive)
- `.nexus/config/issue-labels.yaml` — task label set
- `docs/delivery/lessons/README.md` — lessons convention
```

Replace with:

```markdown
- `<docs-root>/system/stack.md` — technology stack
- `<docs-root>/system/standards/[file].md` — [brief description]
- `<docs-root>/product/context.md` — product context (interactive)
- `.nexus/config/issue-labels.yaml` — task label set
- `<docs-root>/delivery/lessons/README.md` — lessons convention
```

> Leave the `.gitignore` summary line and everything else in Phase 7 unchanged.

---

## 5. Implementation — edits to `.claude/skills/nxs-setup/SKILL.md`

The skill must write the product context under the resolved root. It uses a target path its invoker
provides, and resolves one itself when run standalone.

### 5.1 Edit 8 — add a "Resolve the target path" preamble to the Process

Find:

```markdown
# Process

## Step 1: Check Existing Context

First, check if context already exists:

```
Read docs/product/context.md
```
```

Replace with:

```markdown
# Process

## Step 0: Resolve the product-context path

You write to **`<context-path>`**, the product context under the resolved docs root:

- **Invoked by `/nxs.setup`** — it hands you the resolved path (`<docs-root>/product/context.md`).
  Use it verbatim as `<context-path>`.
- **Standalone** — resolve the docs root yourself, then set `<context-path>` = `<docs-root>/product/context.md`:

  ```bash
  tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
  ```

  In a checkout with no in-repo Node toolchain, use `node <tools-dir>/nexus.mjs workspace docs-root`.
  Capture the printed line as `<docs-root>` (`docs` for single-repo/member, `.` for a repo-root hub,
  or the override). When `<docs-root>` is `.`, the path is `product/context.md` (no `./` prefix). On a
  non-zero exit, stop and report the diagnostic — do not fall back to a literal `docs/`.

## Step 1: Check Existing Context

First, check if context already exists:

```
Read <context-path>
```
```

### 5.2 Edit 9 — the goal statement (top of the skill body)

Find:

```markdown
You are an experienced product strategist helping a founder or product leader quickly establish their product context. Your goal is to create a comprehensive `docs/product/context.md` file by asking **at most 5 questions** — one at a time — and using your expertise to infer everything else.

This skill is the interactive interview engine behind `/nxs.setup`. It can also be invoked on its own to refresh `docs/product/context.md` without re-running the full project bootstrap.
```

Replace with:

```markdown
You are an experienced product strategist helping a founder or product leader quickly establish their product context. Your goal is to create a comprehensive product context file at `<context-path>` (resolved in Step 0) by asking **at most 5 questions** — one at a time — and using your expertise to infer everything else.

This skill is the interactive interview engine behind `/nxs.setup`. It can also be invoked on its own to refresh the product context without re-running the full project bootstrap.
```

### 5.3 Edit 10 — the Step 4 write instruction

Find:

```markdown
Create the full `docs/product/context.md` using the template structure.
```

Replace with:

```markdown
Create the full product context at `<context-path>` (from Step 0) using the template structure.
```

> Leave the frontmatter `description:` line (which mentions `docs/product/context.md`) as prose
> metadata — it is not a write path the skill executes. Optionally update it for accuracy, but it is
> not required for the acceptance criteria.

---

## 6. Verification

1. **Grep for surviving literals** in both files:

   ```bash
   grep -n 'docs/system/\|docs/product/\|docs/delivery/' .claude/commands/nxs.setup.md .claude/skills/nxs-setup/SKILL.md
   ```

   Expect **no hits** except the optional frontmatter `description:` line in `SKILL.md` (§5.3 note).

2. **Trace the hub case.** With `<docs-root>` = `.`: stack → `system/stack.md`, product context →
   `product/context.md`, lessons → `delivery/lessons/` — all off the repo root, no `docs/` dir. ✓

3. **Trace the single-repo case.** With `<docs-root>` = `docs`: `docs/system/stack.md`,
   `docs/product/context.md`, `docs/delivery/lessons/` — unchanged. ✓

4. **Re-vendor and run the fingerprint gate** (mandatory — you edited files under `.claude/`):

   ```bash
   pnpm nexus:vendor-tools          # regenerates libs/portable-tools/bundle-fingerprint.json — commit it
   pnpm nx test portable-tools      # parity.spec.ts must pass (claude-components pin now matches)
   ```

---

## 7. Acceptance-criteria mapping (Story 3 / #84)

- **AC-1 (hub → stack/standards/product/delivery under `<root>/…`, no `docs/`):** Edits 2–7.
- **AC-2 (single-repo → paths unchanged):** the read-out returns `docs`, so every `<docs-root>/…`
  reproduces the old `docs/…` literal (verified §6 step 3).
- **AC-3 (the `nxs-setup` skill writes context under the resolved root):** Edits 8–10 (`<context-path>`).

## 8. Definition of done

- [ ] `/nxs.setup` has `Bash` in tools and resolves `<docs-root>` once in Phase 0.
- [ ] Phases 3/4/5/6/7 scaffold under `<docs-root>`; the skill writes to `<context-path>`.
- [ ] §6 grep shows no surviving `docs/system|product|delivery` literals (bar the noted frontmatter line).
- [ ] The hub and single-repo traces both check out.
- [ ] `pnpm nexus:vendor-tools` re-run, `bundle-fingerprint.json` committed, `pnpm nx test portable-tools` green.
