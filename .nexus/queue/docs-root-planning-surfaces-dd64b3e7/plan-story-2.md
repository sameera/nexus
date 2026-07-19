# Plan — STORY-81.02: Close-time writes follow the recorded feature path

- **Epic:** #81 "Planning Surfaces Follow the Docs Root" (`.nexus/queue/docs-root-planning-surfaces-dd64b3e7/`)
- **Story issue:** #83 · **size:** S · **blocked_by:** STORY-81.01 (#82)
- **Prerequisite:** Story 1 must be merged first — it makes `/nxs.epic` write the **actual resolved
  container path** into `feature_path`. This story reads that recorded value. (Entries created before
  Story 1 carry `feature_path: docs/features/<slug>`, which this story also reads correctly — see §2.4.)

---

## 1. Goal (what "done" means)

Today `/nxs.close` ignores `feature_path` and rebuilds a hardcoded `docs/features/<feature>/backlog.md`
literal from the `feature` name, and writes lessons to a hardcoded `docs/delivery/lessons/`. This story
makes close **read the recorded `feature_path`** and target the backlog under it, and **derive the
sibling `delivery/lessons/` location from that same recorded anchor** — never re-resolving the docs
root. On a repo-root hub, closing an epic leaves no `docs/` artifacts; on single-repo, every path is
unchanged.

**This is a markdown-only change** to `.claude/commands/nxs.close.md` — no TypeScript, no read-out call.
But editing a file under `.claude/commands/` restages the vendored `claude-components` fingerprint, so
you **must** re-run `pnpm nexus:vendor-tools` and commit the updated pin (see §5), or `parity.spec.ts`
fails.

---

## 2. Judgment calls already made — do NOT re-decide

1. **Close reads `feature_path`, it does NOT re-resolve the docs root** (decision-record: "Close never
   re-resolves the docs root"). The recorded path pins close's writes to where `/nxs.epic` actually
   created the backlog, immune to a docs-root override changing between plan and close.
2. **The lessons location is derived from the recorded anchor, not resolved fresh.** `feature_path`
   always ends in `features/<slug>`. Strip those final two segments to get the docs root, then join
   `delivery/lessons/`. Do **not** call the docs-root read-out here — that would create a second source
   of truth that disagrees precisely in the override-changed case.
3. **Empty docs root means no prefix.** For a repo-root hub, `feature_path` is `features/<slug>`, so
   stripping the last two segments leaves the empty string → the lessons dir is `delivery/lessons/`
   (never `./delivery/lessons/` or a `.`-named segment).
4. **Backward compatibility is automatic.** An in-flight entry created before Story 1 carries
   `feature_path: docs/features/<slug>`; the same derivation yields `docs/features/<slug>/backlog.md`
   and `docs/delivery/lessons/` — today's behavior, no migration. If a very old entry has **no**
   `feature_path` at all, fall back to today's `feature`-based literal (§4.1 step 3).

---

## 3. The derivation (state it once; reuse everywhere below)

Define these at Phase 0 and reference them by name in every later phase:

- **`<feature-path>`** = the `feature_path` frontmatter value of the queue entry's `epic.md`.
  Examples: `docs/features/onboarding` (single-repo / member) or `features/onboarding` (repo-root hub).
- **`<docs-root>`** = `<feature-path>` with its final two path segments (`features/<slug>`) removed.
  → `docs` for `docs/features/onboarding`; the **empty string** for `features/onboarding`.
- **Backlog target** = `<feature-path>/backlog.md`.
- **Lessons dir** = `<docs-root>/delivery/lessons/` when `<docs-root>` is non-empty, else just
  `delivery/lessons/`.

Worked examples (put these in the command as a table so the executor cannot mis-derive):

| `feature_path` | backlog | lessons dir |
|---|---|---|
| `docs/features/onboarding` | `docs/features/onboarding/backlog.md` | `docs/delivery/lessons/` |
| `features/onboarding` (repo-root hub) | `features/onboarding/backlog.md` | `delivery/lessons/` |
| `handbook/features/onboarding` (hub override `handbook`) | `handbook/features/onboarding/backlog.md` | `handbook/delivery/lessons/` |

---

## 4. Implementation — edits to `.claude/commands/nxs.close.md`

### 4.1 Edit 1 — parse `feature_path` in Phase 0

Find (the Phase 0 frontmatter-extract list):

```markdown
1. Read and parse the `*epic.md` frontmatter. Extract:
    - `epic` (or `title`) — the epic title
    - `link` — the epic GitHub issue reference (e.g. `"#123"`)
    - `feature` — the parent feature name/slug (the queue entry's one-direction pointer, 0006 §4)
    - `complexity` — the story-size rollup (used for lesson framing)
```

Replace with:

```markdown
1. Read and parse the `*epic.md` frontmatter. Extract:
    - `epic` (or `title`) — the epic title
    - `link` — the epic GitHub issue reference (e.g. `"#123"`)
    - `feature` — the parent feature name/slug (the queue entry's one-direction pointer, 0006 §4)
    - `feature_path` — the **actual resolved feature container** `/nxs.epic` recorded (e.g.
      `docs/features/onboarding` in single-repo, `features/onboarding` on a repo-root hub). Close
      targets the backlog under this and derives the sibling lessons location from it — it never
      re-resolves the docs root. Compute two names now and reuse them below:
        - **`<feature-path>`** = the `feature_path` value. (If `feature_path` is absent — a pre-epic
          entry — fall back to `docs/features/<feature>`, today's literal.)
        - **`<docs-root>`** = `<feature-path>` with its final two segments (`features/<slug>`) removed:
          `docs` for `docs/features/onboarding`, or the **empty string** for `features/onboarding`.
          When `<docs-root>` is empty, a taxonomy path hangs directly off the repo root (no `./`
          prefix, no `.`-named segment).
    - `complexity` — the story-size rollup (used for lesson framing)
```

### 4.2 Edit 2 — Phase 4 close-record "Deferred Scope" pointer

Find:

```markdown
    - **Deferred Scope** — a **pointer only** to `docs/features/<feature>/backlog.md` (the scope itself
```

Replace with:

```markdown
    - **Deferred Scope** — a **pointer only** to `<feature-path>/backlog.md` (the scope itself
```

### 4.3 Edit 3 — Phase 5 backlog append target

Find:

```markdown
1. Target `docs/features/<feature>/backlog.md` (create it with the header on first write):
```

Replace with:

```markdown
1. Target `<feature-path>/backlog.md` (the recorded feature container from Phase 0; create it with the header on first write):
```

### 4.4 Edit 4 — Phase 6 lesson location

Find:

```markdown
1. Ensure `docs/delivery/lessons/` exists (`/nxs.setup` scaffolds it; create if absent).
2. Write **`docs/delivery/lessons/<YYYY-MM-DD>-<slug>.md>`** where `<slug>` derives from the epic:
```

Replace with:

```markdown
1. Ensure the lessons dir exists — **`<docs-root>/delivery/lessons/`** (just `delivery/lessons/` when
   `<docs-root>` is empty, i.e. a repo-root hub). `/nxs.setup` scaffolds it; create if absent.
2. Write **`<docs-root>/delivery/lessons/<YYYY-MM-DD>-<slug>.md`** where `<slug>` derives from the epic:
```

> (This also fixes a stray `>` typo in the original filename token — the correct name ends `.md`.)

### 4.5 Edit 5 — Phase 7 checkpoint summary

Find:

```markdown
2. Deferred scope → docs/features/<feature>/backlog.md (<N> item(s))
3. Process lesson → docs/delivery/lessons/<date>-<slug>.md
```

Replace with:

```markdown
2. Deferred scope → <feature-path>/backlog.md (<N> item(s))
3. Process lesson → <docs-root>/delivery/lessons/<date>-<slug>.md
```

### 4.6 Edit 6 — Phase 8 durable-pointer prose

Find:

```markdown
GitHub URLs via `nxs-abs-doc-path`); nothing in the queue may be linked.
```

> This sentence begins "Durable pointers — the feature backlog and the lesson file, both under
> `docs/` — may be included…". Update the parenthetical "both under `docs/`" so it does not claim a
> `docs/` prefix that a hub does not use. Find:

```markdown
close record's **prose inline** (Key Decisions + Deviation Rationale); it must **never** link into
`.nexus/queue/`, or the link dangles the moment the distillation PR merges. Durable pointers — the
feature backlog and the lesson file, both under `docs/` — may be included as bare paths (or absolute
GitHub URLs via `nxs-abs-doc-path`); nothing in the queue may be linked.
```

Replace with:

```markdown
close record's **prose inline** (Key Decisions + Deviation Rationale); it must **never** link into
`.nexus/queue/`, or the link dangles the moment the distillation PR merges. Durable pointers — the
feature backlog and the lesson file, both under the resolved docs root — may be included as bare paths
(or absolute GitHub URLs via `nxs-abs-doc-path`); nothing in the queue may be linked.
```

### 4.7 Edit 7 — Phase 8 GitHub comment "Pointers (durable)" block

Find:

```markdown
### Pointers (durable)
- Deferred scope → docs/features/<feature>/backlog.md
- Process lesson → docs/delivery/lessons/<date>-<slug>.md
```

Replace with:

```markdown
### Pointers (durable)
- Deferred scope → <feature-path>/backlog.md
- Process lesson → <docs-root>/delivery/lessons/<date>-<slug>.md
```

### 4.8 Edit 8 — Phase 9 completion report

Find:

```markdown
Deferred scope:    docs/features/<feature>/backlog.md  (<N> item(s))
Process lesson:    docs/delivery/lessons/<date>-<slug>.md
```

Replace with:

```markdown
Deferred scope:    <feature-path>/backlog.md  (<N> item(s))
Process lesson:    <docs-root>/delivery/lessons/<date>-<slug>.md
```

---

## 5. Verification

`/nxs.close` is an LLM-executed command with no colocated unit test (same posture as #74's drain
change). Verify the derivation by hand, then re-vendor so the fingerprint gate stays green.

1. **Re-read the edited `nxs.close.md`.** Confirm no `docs/features/` or `docs/delivery/` literal
   remains except inside the Phase-0 backward-compat fallback note:

   ```bash
   grep -n 'docs/features/\|docs/delivery/' .claude/commands/nxs.close.md
   ```

   The only acceptable hit is the fallback `docs/features/<feature>` in Edit 1 (§4.1).

2. **Trace the hub case by hand.** Given a queue entry with `feature_path: features/onboarding`:
   - `<feature-path>` = `features/onboarding` → backlog `features/onboarding/backlog.md` ✓ (no `docs/`)
   - `<docs-root>` = strip `features/onboarding` → `""` → lessons `delivery/lessons/` ✓ (no `docs/`)

3. **Trace the single-repo case.** Given `feature_path: docs/features/onboarding`:
   - backlog `docs/features/onboarding/backlog.md` ✓ (unchanged)
   - `<docs-root>` = `docs` → lessons `docs/delivery/lessons/` ✓ (unchanged)

4. **Re-vendor and run the fingerprint gate** (mandatory — you edited a `.claude/commands/` file):

   ```bash
   pnpm nexus:vendor-tools          # regenerates libs/portable-tools/bundle-fingerprint.json — commit it
   pnpm nx test portable-tools      # parity.spec.ts must pass (claude-components pin now matches)
   ```

   Do not hand-edit the fingerprint JSON. If parity fails with a `claude-components … STALE` message,
   you skipped `pnpm nexus:vendor-tools`.

---

## 6. Acceptance-criteria mapping (Story 2 / #83)

- **AC-1 (deferred scope targets the backlog under the recorded path):** Edits 1 + 3 (+ pointers 2, 5, 7, 8).
- **AC-2 (hub → lesson under `<root>/delivery/lessons/`, no `docs/`):** Edits 1 + 4 (derive `<docs-root>`).
- **AC-3 (single-repo → backlog + lesson paths unchanged):** the derivation reproduces
  `docs/features/<slug>/backlog.md` and `docs/delivery/lessons/` when `feature_path` is
  `docs/features/<slug>` (the single-repo recorded value) — verified in §5 step 3.

## 7. Definition of done

- [ ] Phase 0 parses `feature_path` and defines `<feature-path>` + `<docs-root>` (with the
      pre-epic fallback to `docs/features/<feature>`).
- [ ] All eight edit sites reference `<feature-path>` / `<docs-root>`; no bare `docs/features/` or
      `docs/delivery/` literal survives except the fallback note.
- [ ] The §5 hub and single-repo traces both check out.
- [ ] `pnpm nexus:vendor-tools` re-run, `bundle-fingerprint.json` committed, `pnpm nx test portable-tools` green.
