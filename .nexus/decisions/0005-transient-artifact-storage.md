# 0005 — Transient artifact storage: path scheme + `.nexus/` location

**Status:** Largely superseded. The storage *model* (`.nexus/.temp/` gitignored, deleted at
close; `.nexus/staged/<id>.json` durable delta) is replaced by
[`0006`](./0006-queue-distillation-handoff.md) — one committed `.nexus/queue/<branch>/<local-id>/`
folder, drained and deleted by the distiller. This file is **trimmed to the parts 0006 reused
but did not re-justify**: why the transient surface lives under `.nexus/` (vs an external dir or
a worktree), the `<branch>/<local-id>` path scheme and its runtime discovery, and the narrowing
of `docs/` to permanent human artifacts only.
**Date:** 2026-06-14, trimmed 2026-06-23.
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (two-store split),
[`0002-pipeline-audit.md`](./0002-pipeline-audit.md) (transient vs durable classification).
**Superseded in part by:** [`0006`](./0006-queue-distillation-handoff.md) (§2, §3, §4, §5 of the
original; the queue is committed, not gitignored, and there is no staged sidecar).

---

## 1. Why the transient surface lives under `.nexus/` (still standing)

0006's committed queue is a sibling folder under `.nexus/`. That *location* choice — not the
gitignore/commit status, which 0006 reversed — comes from here and is not re-argued upstream.
Three options were evaluated:

|                         | NWD (external dir)                        | Git worktree                  | `.nexus/` sibling folder |
| ----------------------- | ----------------------------------------- | ----------------------------- | ------------------------ |
| Config required         | Yes (`~/.nexus/config.json` + `wip.json`) | None                          | None                     |
| Library access          | Absolute path to source repo              | Cross-worktree path           | Sibling dir, relative    |
| Cleanup                 | Manual delete                             | `worktree remove + branch -d` | `rm -rf` (one path)      |
| Path resolution         | Config + wip.json lookup                  | `git worktree list`           | `git branch` + glob      |

The `.nexus/` sibling folder wins on simplicity: zero config, no git ceremony, library access
is a relative sibling read, discovery is `git branch` + glob. This verdict is independent of
whether the folder is committed — it picks the *location*. 0006 keeps the location and flips the
commit decision (the queue is committed so it travels to main for the distiller; see 0006 §why).

> The original table also had a "files enter git objects: No" row favoring the gitignored
> `.temp`. That distinction is **moot** under 0006: the queue is committed deliberately.

## 2. Path scheme and discovery (still standing)

The surface is `.nexus/<surface>/<branch>/<local-id>/` (0006's surface is `queue/`):

- `<owner>/<repo>` levels are dropped — implicit in the source repo.
- `<branch>` gives human-readable organisation.
- `<local-id>` is a random key generated at `/nxs.epic` time. It handles multiple concurrent
  epics on the same branch and **decouples the folder from the GitHub issue ID**, which does not
  exist yet at epic creation.

**Discovery at command runtime:** `git branch --show-current` + `glob .nexus/<surface>/<branch>/*/`.
The common case (one epic per branch) returns exactly one match; multiple matches prompt the
user to select.

## 3. `docs/` narrowed to permanent human artifacts (still standing)

`docs/` is reserved exclusively for *permanent* human artifacts — overriding the implicit 0004
assumption that pipeline planning files lived there. The transient pipeline workspace is a third
surface, distinct from `docs/` (permanent human) and `.nexus/concepts/` (machine knowledge).
0006 keeps this narrowing; it only reverses the original "leaves no trace in the committed tree"
goal (the queue is now committed, then deleted on distill).

| Path                                                 | Content                                             |
| ---------------------------------------------------- | --------------------------------------------------- |
| `docs/system/stack.md`, `docs/system/standards/*.md` | Human-maintained ground truth (standards also home cross-cutting NFR budgets — 0002 §b G4) |
| `docs/product/context.md`                            | Personas, strategy, anti-goals                      |
| `docs/features/<name>/README.md`                     | Feature brief — human-authored input to `/nxs.epic` |
| `docs/features/<name>/backlog.md`                    | Deferred scope, append-only — `/nxs.close` appends, next `/nxs.epic` re-triages (0002 §b G3) |
| `docs/delivery/lessons/*.md`                         | Process/delivery lessons — one file per lesson, `/nxs.close` adds a file (0002 §b G1; home moved out of `system/` 2026-06-22) |
| `docs/decisions/*.md`                                | Council decision records, ad hoc                    |

The GitHub epic issue and GH close comment are the permanent human-readable record of what was
specced and what shipped.

**`.nexus/config/` — a further `.nexus/` surface (added 2026-06-26; templates nested under it
2026-06-28, see 0004 A0).** Joins `.nexus/queue/` (committed-transient planning) and
`.nexus/concepts/` (machine knowledge) under `.nexus/`. It is per-project and committed, and holds
two kinds of content:

- `.nexus/config/templates/` — the pipeline's blank templates; **tool-agnostic** (one copy read by
  both the Claude and Gemini commands) and **project-tunable**. Seeded by the install/update script
  from the toolkit's single `common/templates/` master, **only when absent** (0004 C0a). This moved
  templates *out* of `claude/.claude/nexus/templates/`.
- `.nexus/config/` (directly) — delivery config (`task-labels.md`, `config.*`); generated/customized
  by `/nxs.setup` per project. Moved *out* of `claude/.claude/nexus/` so per-project state leaves the
  tool namespace.

Both are fixed singletons — the §2 `<branch>/<local-id>` discovery scheme does not apply.

---

## Superseded (see 0006)

- **`.nexus/.temp/` gitignored, deleted at close** → committed `.nexus/queue/`, deleted by the
  distiller on consume (history-recoverable).
- **`.nexus/staged/<local-id>.json` durable `ConceptDelta`** → removed. System A emits no
  machine artifact; the distiller (B) constructs deltas from the committed queue + diff.
- **Close record carrying a `ConceptDelta` block** → close record is human prose only.
