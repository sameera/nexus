---
name: nxs-close-migration
description: Run the close-migration preflight or the gated migrate step of /nxs.close. Use standalone to diagnose a member repo's close readiness or to recover a half-finished migration.
---

# nxs-close-migration

Run the close-migration helper that gives `/nxs.close` its deterministic cross-repo tail: the
role gate (`preflight`) and the gated copy-commit-verify-remove sequence (`migrate`).

## Purpose

In a multi-repo workspace, a member repo's `/nxs.close` must move the closed queue entry into
the hub — the concept store lives there, so the drain stays atomic. This is the observable
surface of that step:

-   Which close role does this checkout have — single-repo, hub, or member?
-   In member mode, where is the hub, and what branch is it on?
-   Has a given queue entry been migrated to the hub yet, and is that migration verified?

`migrate` is normally driven by `/nxs.close` itself, after its closure checkpoint — do not run it
casually by hand. Run it standalone only to diagnose a stuck close or recover a half-finished
migration (the diagnostic names exactly what to fix).

## Usage

Preflight — read-only, safe to run anytime:

```bash
tsx ./.claude/skills/nxs-close-migration/scripts/close_migration.ts preflight
tsx ./.claude/skills/nxs-close-migration/scripts/close_migration.ts preflight /path/to/a/checkout
```

Migrate — mutating, gated to member mode:

```bash
tsx ./.claude/skills/nxs-close-migration/scripts/close_migration.ts migrate .nexus/queue/<entry-dir>
```

## What it reports

**Member preflight** — migration armed:

```
Close preflight: member mode — migration armed.
  repo    github.com/acme/web-app  (from origin)
  hub     docs-hub  (github.com/acme/docs-hub)
    root:   /ws/docs-hub
    branch: main
```

**Single-repo / hub preflight** — the entry stays put:

```
Close preflight: single-repo mode — the entry stays in this repo.
  repo  github.com/acme/web-app  (from origin)
```

```
Close preflight: hub mode — the entry stays in this repo (the hub drains its own queue).
  repo  github.com/acme/docs-hub  (from origin)
```

**A successful migration:**

```
Migrated queue entry: demo-epic-ab12cd34
  hub commit     <full-sha>  on 'main'  at /ws/docs-hub
  removed        commit <full-sha>

Push the hub commit — closure is not durable until it is pushed:
  git -C /ws/docs-hub push
```

**A failure** — a named diagnostic, naming the file, the entry (when applicable), and the defect:

```
Close migration failed: entry-conflict
  file:  /ws/docs-hub/.nexus/queue/demo-epic-ab12cd34
  entry: demo-epic-ab12cd34
  the hub queue already holds '.nexus/queue/demo-epic-ab12cd34' and it differs from this repo's
  entry; inspect /ws/docs-hub/.nexus/queue/demo-epic-ab12cd34, remove or reconcile it, then
  re-run /nxs.close
```

## Exit codes

| Code | Meaning                                                    |
| ---- | ----------------------------------------------------------- |
| 0    | Success — the read-out or the migration outcome was printed |
| 1    | A named diagnostic was printed (preflight or migrate)        |
| 2    | Usage error — `migrate` requires an entry-dir argument       |

## Safety

`migrate` runs a strict **migrate → verify → gated-remove** order and never reorders it: the
entry is copied into the hub, committed there (path-scoped, so unrelated hub work is untouched),
and only read back and confirmed byte-for-byte identical before the code-repo side is ever
touched. If anything fails before that verification, the hub copy is cleaned up and the code
repo's entry is untouched — nothing is ever left half-migrated. A commit that lands but fails
verification is never auto-reset; its SHA is reported for manual inspection instead.

Re-running `migrate` on an entry already verified in the hub is safe — it recognizes the
identical committed copy and proceeds straight to removal rather than creating a duplicate hub
commit.

Migration is **not durable** until the hub commit is pushed — always follow the printed
`git -C <hub-root> push` instruction.
