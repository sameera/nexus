---
title: "Close Record: GitHub Publishing Config"
epic: #121
feature: "Multi-Repo Workspaces"
date: 2026-07-23
analyze: ran 2026-07-23 @ 135a58c01c91d1a103e5104afcd72a7a967f6663
range:
  - repo: github.com/sameera/nexus
    base: b19449990008f2a2843d3a62ec93d64dcc1d74f7
    head: 288906382ecb248dc469d5cb52af2868f97bd5fe
---

# Close Record: GitHub Publishing Config

## Key Decisions

- **One shared resolver, not the copy-paste status quo:** the config-resolution logic (`read_delivery_config`, `_parse_simple_yaml`) is defined exactly once in `delivery_config.py`; both creation scripts import it and the non-script consumers invoke it, so no consumer re-derives config on its own. *Why:* the two verbatim copies were the drift mechanism this epic exists to kill. *Refuted:* keep a private copy in each script and fix them in lockstep — rejected because "keep two copies in sync by discipline" is exactly what already failed here.
- **Declared config replaces probe-by-failure:** classification, project, and repo-targeting are resolved from declared config before any GitHub call. *Why:* probing bakes in false assumptions (org issue-types exist, a project is auto-discoverable) that break on a personal repo — the original crash trigger. *Refuted:* keep probing but harden it — rejected because it cannot distinguish "intentionally none" from "not found yet," so it re-probes forever.
- **Three-way classification with `legacy-auto` as the built-in default:** `types` | `labels` | `legacy-auto`. *Why:* a repo with no block must reproduce today's exact outcome, which itself depends on a probe; `legacy-auto` names and preserves that behavior, making the no-regression guarantee true. *Refuted:* only `types`/`labels` defaulting one way — rejected because either default silently changes classification for half of existing repos.
- **Project target `none | auto | explicit`, with `none` first-class and silent:** `none` makes no lookup, no add-to-project call, no warning. *Why:* the personal-repo case genuinely has no project, and today that path emits a false "no project found" warning every run. *Refuted:* treat missing as `auto` and suppress the warning — rejected because it still re-discovers every run and cannot express deliberate absence.
- **Precedence: invocation > frontmatter > repo settings > hub defaults > built-in:** resolved most-specific-first by `resolve_setting`. *Why:* the invocation argument is an explicit command for this run and must win; frontmatter is per-item intent that must override a repo default; the built-in guarantees a value always exists. This chain is also what lets `/nxs.close` stop ignoring the configured issues-repo. *Refuted:* put repo settings above frontmatter (config-as-law) — rejected because it removes the per-item override frontmatter exists for.
- **Split setup-time seeding from runtime write-back, keep both:** setup seeds proactively with a human present; write-back fills still-absent keys on the first unattended fallback. *Why:* setup can disambiguate an ambiguous project and record a CLI-unavailable fallback, but never re-runs on already-bootstrapped repos — write-back is the safety net that closes that gap. *Refuted:* write-back only — rejected because it forfeits human disambiguation and only acts after the first fallback.
- **The one deliberate outcome change — epic fallback label `enhancement` → `epic`, made safe by an idempotent upsert:** `ensure_label` (`gh label create --force`) runs before the label is applied. *Why:* the generic label does not classify the issue as an epic and is asymmetric with the story path; the upsert removes the only risk (filing stranding on a missing label). *Refuted:* keep the generic label to avoid any change — rejected as semantically wrong and asymmetric when the upsert makes the correct label free of risk.
- **Per-key hub-defaults inheritance; epic/story repo targets resolved separately:** hub defaults merge per key (`{**hub, **repo}`), and the specific `epic-repo`/`story-repo` win over the general `issues-repo` fallback, resolved independently for the epic and the stories. *Why:* a member overriding one key must inherit the rest; separate targeting expresses the real workspace shape (epics as cross-cutting artifacts, stories in the code repo) and handles the member with no code repo. *Refuted:* one inherited block and a single issues-repo for both — rejected because it forces per-member duplication and cannot express "epic in hub, stories in member."

## Deviation Rationale

- **Shared module is wider than "the config reader":** Story 1 AC1 and Invariant 2 literally scope the shared module to `read_delivery_config`, but the shipped `delivery_config.py` also absorbed the GitHub helpers — `set_issue_type` (moved out of `nxs_gh_create_epic.py`), `lookup_issue_type_id`, `repo_has_issue_types`, and `ensure_label`. *Why:* the same anti-drift thesis drives it — these helpers were duplicated or at drift risk across the two scripts, so centralizing them in the one shared module extends the single-source-of-truth invariant rather than contradicting it. Beneficial and aligned, just wider than the story's letter.
- **Write-back does not persist `issues-repo` (Story 7 AC1 descoped):** AC1 originally required write-back to persist classification + project + *the resolved issues-repo*; the shipped code persists only classification and project and deliberately omits issues-repo/epic-repo/story-repo (AC1 marked `[SKIPPED]` in the epic). *Why:* this is the code obeying **Invariant 6** ("write-back never pins 'current repo'"). Unlike classification (a probe output) and project (a discovery output), `issues-repo` has no fallback that yields a fresh concrete value — it is either already declared (add-only write-back correctly leaves it) or absent (pinning it would regress on a repo rename/move). The AC was out of step with the invariant and was descoped to match; not a code gap. Success Metric 6 ("probe and discovery run at most once per repo") is still fully met by persisting the two probe/discovery outputs.

## Deferred Scope

No scope was deferred — all seven stories shipped and closed, every in-scope acceptance criterion met. (The single `[SKIPPED]` AC was descoped as wrong per Invariant 6, not punted to later.) Nothing appended to `docs/features/multi-repo-workspaces/backlog.md`.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-23-github-publishing-config.md`
