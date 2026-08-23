---
feature: "Lightweight Fix Lane"
status: draft
date: 2026-08-16
---

# `/nxs.fix` — a lightweight lane for small fixes to reach the concept store

A spec for a fifth entry point into the concept store, sized for changes too small to
justify an epic.

**Status: an out-of-band design doc. Nothing is filed.** It is the developer-HLD half of the
bridge CLAUDE.md describes, and it enters Nexus in two steps, in this order:

1. `/nxs.epic` — plan this work and file the epic issue plus its story issues at the approval
   gate. Nothing downstream can run until that epic exists.
2. `/nxs.decision-record --from docs/features/lightweight-fix-lane/spec.md` — import this doc
   as the record's authoritative basis. It files the record as a **sub-issue of the epic
   issue**, so the epic is its precondition, and the epic's stories supply the scope the
   record must cover.

Worth noting against this spec's own razor: this work is plainly epic-sized — a new command,
a validator mode, a helper subcommand, and five edits to the drain. It is not a fix, and it
takes the epic lane. The lane it defines exists for the change that follows it (§7), not for
itself.

## 1. The problem, verified

The knowledge machinery is epic-gated. Chain as it stands in the tree today:

| Link | Where | What it forces |
|---|---|---|
| The distiller is the only writer of `.nexus/concepts/` | `concept-store.md:35`, `distiller.md` | Nothing else may append a decision-log entry |
| It drains only *entries* | `nxs.distill.md:67-96` | An entry is a directory under `.nexus/queue/**` or `.nexus/tmp/` |
| An entry is drainable only with **both** `epic.md` and `close-record.md` | `nxs.distill.md:73-74`, `:97-99` | Either file missing → skipped, never drained |
| `epic.md` has exactly one producer | `libs/epic-resolve/src/resolve.ts` | It takes an epic **issue number** and walks that issue's sub-issue graph |
| `close-record.md` has exactly one producer | `.claude/commands/nxs.close.md` | Preconditions on every sub-issue closed, plus a `link:` to an epic issue |

**Cost floor to record one decision:** an epic issue, at least one story sub-issue, an
implementation PR, and a distillation PR. Four durable artifacts and two review cycles
for a two-line fix.

(The floor is slightly lower than the brief stated: the **decision record sub-issue is
not** part of it. Drain why-source case 3 already accepts an epic with no record at all
(`nxs.distill.md:216-219`), and close's all-sub-issues-closed precondition is satisfied by
the stories alone. The analyze receipt is likewise waivable at close. Neither changes the
conclusion — the epic issue and the story issue are not waivable, and they are the bug.)

### Already relaxed — not rebuilt here

- **No decision record.** Why-source case 3: the close record's Key Decisions and
  Deviation Rationale are the sole *why* carrier.
- **No commits.** Ephemeral `.nexus/tmp/` entries drain identically to committed ones;
  consumption is derived from the trunk store, not from a deletion
  (`ephemeral-handoff-entry.md`, invariants 3–4).
- **Non-epic provenance.** `provenance-reference.md:16` admits literal markers; the
  validator's `PROVENANCE_REF` accepts `bootstrap` and `manual` alongside issue refs.

Only two things actually force the epic: `epic.md`'s single producer, and `/nxs.close`'s
epic-shaped preconditions. `/nxs.fix` bypasses both by minting the two files directly.

## 2. What `/nxs.fix` is

```
/nxs.fix <ref>
```

`<ref>` is a **provenance reference in its existing grammar** — `123`, `#123`, or
`acme/web-app#123`. It is not a new syntax; it is the same token the page will carry, given
at the input. That choice removes an entire class of question: whatever resolves here is
what gets written, in the form it was written.

The command mints an ephemeral **fix entry** at `.nexus/tmp/fix-<n>/`, holding exactly two
files, and stops. It writes nothing to GitHub, cuts no branch, and opens no PR.
`/nxs.distill` drains it on the next run.

### 2.0 What a fix actually requires

**No epic. No story. No parent of any kind.** A plain, standalone GitHub issue is the
intended input, and the command refuses an epic outright (§2.3 step 2).

**One GitHub number is the irreducible floor** — and it may be an issue *or* a PR. Not a
design preference: `PROVENANCE_REF` in the validator admits `#n`, `<owner>/<repo>#n`,
`bootstrap`, and `manual`, and the first two are the only forms an agent can hop back
through. A fix with no number at all has no legal provenance token, so it cannot be filed.
That floor is one artifact the human already created, against four the epic lane forces.

**A PR is not required.** The PR, where one exists, is only the *range source* — the pair
of SHAs the drain recomputes the diff from. A fix committed straight to the trunk with no PR
resolves its range another way (§4, Q5) and is otherwise identical. Nothing in the lane is
PR-driven.

**`feature:` is optional, not absent.** A bug usually *does* belong to a feature, and a
logical bug fix can change how that feature behaves — so the field carries real information
when the human has it. It is optional rather than required for a mechanical reason: it is
read at `nxs.distill.md:176` and consulted by no later phase of the drain, so requiring it
would only force `/nxs.fix` to invent a value it cannot verify. Write it when the fix belongs
to a feature; omit it when it genuinely does not.

Where a fix changes a feature's behavior rather than restoring it, the razor has a boundary
that must be understood before minting — see §3.3.

### 2.1 `epic.md` — header only

Minted directly, never through the resolver. It carries the fields Phase 0.1 of the drain
reads and nothing else:

```yaml
---
title: "<one line: what the fix changed and why it mattered>"
link: "<the ref, canonicalized: #123 or acme/web-app#123>"
feature: "<the feature the bug lives in>"   # optional — omit only when there is none
slug: fix-<n>
entry_kind: fix                             # the only new field; see §3.2
---
```

No `## User Stories`, no `## Implementation Sequence`, no body — the drain reads frontmatter
from this file and nothing else.

`feature:` is asked for and written whenever the human can name one (§2.0); the drain does
not consult it, so it is never fabricated to satisfy a schema. Its value here is to the human
reading the entry and to whoever later asks which feature a page's decision log entry came
from.

The filename `epic.md` is the same naming wart as `close-record.md` (§2.2) and bought the same
thing — a one-line discovery change instead of a parallel code path. It asserts nothing about
an epic existing. `entry_kind: fix` is the field that carries the truth, and it is what the
razor gate keys on.

### 2.2 `close-record.md` — the why and the range

Reuses `.nexus/config/templates/close-record-template.md` with three omissions:

- `record` / `record_hash` — **omitted**. The template already sanctions this ("Omit both
  record keys when the epic legitimately has no record"), and the drain's why-source case 3
  handles it unchanged.
- `analyze:` — `n/a — fix entry (no acceptance criteria)`. Explicit and greppable, never blank.
- `## Deferred Scope` and `## Process Lesson` — **dropped entirely** (§4, Q8).

What it must carry:

- `range:` — one entry, `{repo, base, head}`, full SHAs, whose `head` has reached the trunk
  (§4, Q5). A merged PR is one source of it, not the only one.
- `## Key Decisions` — the *why*, supplied by the human. This is the whole point of the lane.
- `## Deviation Rationale` — `none — a fix entry has no decision record to deviate from.`

Keeping the filename `close-record.md`, though nothing was closed, is deliberate: it is what
makes the distiller change one line of discovery instead of a parallel code path. The name is
the cost paid for the small diff, and it is worth paying.

### 2.3 What `/nxs.fix` does, in order

1. **Resolve the ref.** Qualified refs resolve against the named repo; bare refs against the
   home repo (hub: the hub repo). Determine whether the number is an issue or a PR.
2. **Refuse an epic.** If the target carries the repository's declared epic classification
   (`delivery_config.py resolve epic-label` / `epic-type`), stop: that is an epic, use
   `/nxs.epic`. Also stop if `.nexus/tmp/epic-<n>/` already exists for the same number.
3. **Refuse a member repo.** Hard block, single-repo and hub only (§4, Q4).
4. **Derive the range** (§4, Q5) — from a merged PR when one exists, from named commits when
   the fix went straight to the trunk. Either way the head must have reached the trunk.
5. **Derive the *what*** from `git diff <base>...<head>`. Code-derivable, so derived — never
   asked of the human. This mirrors `/nxs.close` Phase 3 step 2.
6. **Ask for the *why*** — one prompt, seeded with the derived *what*. This is the only
   human interaction, and it is the forcing function that earns the lane's existence.
7. **Write the two files.** Report the paths and that `/nxs.distill` will drain them.

No approval checkpoint. Nothing durable and nothing on GitHub is written, so under the
forcing-function razor a second gate would be pure ceremony (`forcing-function-razor.md`,
invariants 2–3).

## 3. The razor

**A fix entry may only append a decision-log entry to a page that already exists.** It may
not create a page, retire one, edit a Key Invariant, change a Summary, or add a `touches`
neighbour. Any of those means the change is an epic, not a fix.

### 3.1 Stated mechanically

Enforced on the computed page diff, per fix entry, before the distillation-PR opens. For
each `.nexus/concepts/**` path in that entry's staged commit:

1. **Path status must be `M`.** From `git diff --name-status --cached`: `A`, `D`, and `R`
   are all violations. This blocks page creation, retirement, and the `git mv` into
   `_archive/` in one test.
2. **The page must exist at base.** `git show <base>:<path>` resolves — the same `gitShow`
   the validator already uses for its append-only check.
3. **Byte-identity outside the appended entry.** Let

   - `gained` = new Decision Log H3 headings minus old = must be exactly `1`;
   - `head_prefix` = the page content truncated at the line where that gained heading starts;
   - `strip(x)` = `x` with the `last_updated_by:` frontmatter line removed and trailing
     whitespace normalized.

   Then `strip(head_prefix)` must equal `strip(base_content)`, byte for byte.

Test 3 is total. Every forbidden edit — invariant, summary, `touches`, `aliases`, `domain`,
`status`, Integration Points, prior log entries — lands in the compared region and fails.
Nothing needs to be enumerated, so nothing can be forgotten.

The reciprocity fan-out (`nxs.distill.md` Phase 5.1) needs no change: with `touches_added`
and `touches_removed` forbidden, the fan-out is **vacuous by construction** for a fix entry.
If a delta somehow carried one, the fan-out's edit to the neighbour page would fail test 3
on that page.

### 3.2 Where it is enforced

**Drain-side, in the validator, as the load-bearing gate.** New flag on
`libs/portable-tools/src/validate-concepts.ts`:

```
--append-only-log --base <ref> <page paths...>
```

Non-zero exit blocks the PR, under the existing contract the drain already honours
("A non-zero exit from the validator **blocks the PR**", `nxs.distill.md:26-28`). No new
gate semantics are introduced — the razor rides a mechanism the distiller already cannot
talk past.

**Authoring-side, in `/nxs.fix`, advisory only.** The diff is already in hand at step 5, so
the command can warn early — "this touches N behaviours with no existing page; it looks like
an epic". Explicitly **not** load-bearing: `/nxs.fix` writes no pages, so an authoring-side
check can only guess at what the drain will later synthesize. It fails soft and says so.

Both, then, but with the weight in exactly one place. The refuted alternative — enforce only
in `/nxs.fix` — puts the gate on the side that has no visibility into the page writes it is
supposed to constrain, and leaves the drain free to do anything a prompt talks it into.

### 3.3 Two kinds of bug fix — the boundary that decides the lane

A bug usually belongs to a feature, and fixing it can change how that feature behaves. That
splits bug fixes into two kinds, and only one of them belongs in this lane.

**Kind 1 — the fix restores intended behavior.** The code was wrong; the page was already
right, because a concept page states intent, not implementation. Nothing in the body is now
false. The page needs exactly one appended decision-log entry recording what broke, why, and
what stops it recurring. The razor holds with room to spare. **This is the majority of bug
fixes and the lane's target.**

**Kind 2 — the fix changes intended behavior.** The logical bug: the design itself was wrong,
and correcting it makes a Key Invariant or a Summary sentence *false*. This is **not a fix,
it is a design change**, and it goes through `/nxs.epic`.

The reason is not procedural tidiness. Appending a log entry to a page whose body still
asserts the old behavior produces a **self-contradicting page**: the body says one thing, the
log says the opposite. Retrieval is grep-native — a reader loads the Summary and the Key
Invariants and may never reach the log (`grep-native-retrieval.md`). So the cheap path would
leave a confidently false invariant in the store, attributed to a verified page, which is a
worse outcome than the rationale never being recorded at all. A knowledge store that lies is
not cheaper than one with gaps.

The razor's byte-identity test (§3.1) catches this **mechanically**, not by asking anyone to
judge which kind they have: any edit to an invariant or a summary line lands in the compared
region and fails. The refusal names the case:

```
fix-<n>: behavior-change — this fix rewrites <page>'s stated behavior (invariant N /
Summary), not just its history. A fix may append to the decision log; changing what a page
asserts is a design change. Plan it with /nxs.epic.
```

**Accepted cost, stated plainly:** a one-line code change that invalidates one invariant line
pays the full epic price. That is the razor working as designed rather than a gap in it — but
it is a real cost, and §8.4 records it as the thing to watch once the lane has traffic.

### 3.4 The empty-drain case

A fix whose *why* maps to no existing page has nowhere legal to land. That is not a bug in
the lane; it is the razor firing correctly — a decision with no page is a decision that needs
a page, and creating pages is epic work. The drain reports it as a named per-entry hard
block, in the style of `no-close-comment` / `range-unresolvable`:

```
fix-<n>: no-existing-page — this fix's rationale maps to no page in the store, and a fix
entry may not create one. Nothing was written. If this decision deserves a page, it is an
epic: plan it with /nxs.epic.
```

The entry is left in place, rediscoverable, never auto-deleted (invariant 9 applies to it
unchanged).

## 4. The open questions, answered

### Q1 — Issue required, or is a merged PR alone enough?

**Either.** A GitHub issue is preferred but not required.

The reason it costs nothing: `PROVENANCE_REF` in the validator is
`/^(#\d+|[\w.-]+\/[\w.-]+#\d+|bootstrap|manual)$/`, and GitHub issues and PRs **share one
number namespace**. `#412` is a valid, resolving, hoppable reference whether 412 is an issue
or a PR. Nothing in `provenance-reference.md` distinguishes them; nothing needs to.

Hub drains still emit the qualified form, resolved from the entry's recorded
`range[0].repo` exactly as today (`provenance-reference.md`, invariant 5). Because `<ref>`
is *given* in provenance grammar, a qualified input reaches the page unchanged.

**Refuted:** invent a `fix` literal marker beside `bootstrap` and `manual`. It reads
tidily, but a bare word is un-hoppable — the marker's whole job is to let an agent get back
to the context — and it would break consumption derivation, which matches provenance tokens
in structured positions (`ephemeral-handoff-entry.md`, invariant 3). A bare `fix` token
would match every fix entry ever drained.

### Q2 — Where is the razor enforced?

**Drain-side, mechanically, on the computed page diff; authoring-side advisory only.**
Full argument in §3.2.

### Q3 — Does consumption derivation need widening?

**No. Unchanged, and this is load-bearing enough to be worth stating as an invariant.**

`ephemeral-handoff-entry.md` invariant 3 matches provenance in structured positions
(`last_updated_by:` values, `### <date> — <ref> — …` headings) on whole tokens. A fix entry's
provenance token is `#<n>` or `<owner>/<repo>#<n>` — the *same tokens* the matcher already
handles. The matcher never knew or cared whether `#<n>` was an epic, and it still does not.

Better than unchanged: a fix drain's provenance is **guaranteed** present on success. The
razor requires exactly one appended Decision Log entry, and that entry's heading is a
structured provenance position. The accepted consequence for epics — a drain producing zero
deltas leaves no provenance and is re-offered next run — cannot arise for a fix, because a
zero-delta fix is the §3.4 hard block instead.

### Q4 — Hub / member / single-repo

**Single-repo and hub only. Member repos are a hard block, exactly like `/nxs.close --pr`.**
No migration path is built.

Member entries reach the hub through `close-entry-migration`, whose unit is "the epic — the
union of the ephemeral artifacts and the epic's committed scratch". A fix has neither an
epic nor scratch, so the migration would be a second, parallel implementation of a
verify-then-remove protocol for a lane whose entire value proposition is being cheap.

**The hub path instead:** run `/nxs.fix acme/web-app#412` **from the hub**. The qualified ref
resolves against the member repo, the range is stamped with that member's normalized
identity, and the drain derives the diff through `.nexus/tools/derive-entry-diff.mjs`
unchanged — that tool already resolves each `range:` repo to its sibling member checkout.
So the hub story is complete with no new machinery, and it uses the same input grammar as
the single-repo case.

Member-repo diagnostic:

```
/nxs.fix does not run in a member repo. Run it from the workspace hub with the qualified
ref: /nxs.fix <owner>/<repo>#<n>
```

### Q5 — Where does the range come from, and must the PR be merged?

**The landed change must be on the trunk. A PR is one way to get there, not a requirement.**

The invariant is about the trunk, not about PRs. The drain is a post-merge drain (0007) and
its ephemeral merge precondition is the two-test form on `range.head` (`nxs.distill.md`,
invariant 10) — test 1 is plain reachability, `git merge-base --is-ancestor <head> $TRUNK`,
which a commit pushed straight to the trunk satisfies trivially. So the rule is: **`head`
must have reached the trunk at minting time.** Minting against work that has not landed
guarantees the entry fails that gate later and trains the operator to waive it — the exact
failure mode the two-test form exists to prevent.

**Signature:**

```
/nxs.fix <ref> [--range <base>..<head>]
```

**Resolution, in priority order:**

1. **`<ref>` is a PR** → it must be merged. Range from the helper below.
2. **`<ref>` is an issue with exactly one merged closing PR** → range from that PR.
3. **`<ref>` is an issue with no PR, or with more than one** → the fix landed directly, or
   ambiguously. Take `--range <base>..<head>` if given; otherwise ask via free text, the same
   move the drain already makes when a range will not resolve (`nxs.distill.md` Phase 1,
   priority 3). **Never guess**, and never fall back to `HEAD~1..HEAD`: a wrong range
   distills the wrong pages weeks later, and the whole point of `range.ts` is that it refuses
   to guess.

In every case, verify `head` is an ancestor of the trunk before writing the entry, and stamp
full SHAs — never `HEAD`, never a branch name.

**Where a PR is involved, reuse the existing derivation.**
`libs/pr-worktree/src/range.ts` already solves squash-, merge-, and rebase-safety correctly
(merge-commit-anchored, with changed-file-set verification for the ambiguous
squash-vs-rebase case). Do not re-derive a range anywhere. One small addition: a read-only
`range --pr <N>` subcommand printing `{ repo, base, head }` without creating a worktree —
the existing `open --mode close` returns the range only as a side effect of checking out a
worktree, which `/nxs.fix` has no use for.

**Provenance is always what the human named** — never the PR substituted for the issue, and
never the reverse.

### Q6 — Is the conformance gate skipped?

**Yes, outright, and by contract — not left ambiguously optional.**

`/nxs.analyze` checks implemented code against the epic's acceptance criteria, success
metrics, and the decision record's invariants. A fix entry has none of the three. Running
analyze against a fix is not "optional"; it is undefined.

Consequences, all explicit:

- `/nxs.fix` writes no `analyze-receipt.md`, and never asks about one.
- The fix entry's `analyze:` frontmatter reads `n/a — fix entry (no acceptance criteria)`.
  A literal value, so the state is greppable and can never be mistaken for a waiver.
- `/nxs.analyze` invoked against a fix entry stops with that reason rather than degrading.

The gate the lane keeps is the razor (§3), and it is mechanical. That is the honest trade:
the fix lane drops conformance checking because there is nothing to check, and pays for it
with a hard structural bound on what a fix may write.

### Q7 — Naming and collision under `.nexus/tmp/`

`.nexus/tmp/fix-<n>/` beside `.nexus/tmp/epic-<n>/`.

Directory names cannot collide: an issue number is one issue, so `<n>` is either an epic or
it is not, and the prefixes differ. Two belt-and-braces guards in `/nxs.fix` step 2 anyway —
refuse a target carrying the epic classification, and refuse when `.nexus/tmp/epic-<n>/`
already exists — because the failure mode (a fix entry shadowing an epic's materialization)
is silent and expensive.

`slug: fix-<n>` in the header matches the directory, so drain reporting names the entry the
same way in every surface.

### Q8 — Does a fix produce a process lesson?

**No. Nothing.**

The lesson file exists for "estimate-vs-actual, decomposition or sequencing lessons, what the
next epic in this area should do differently", consumed by PM estimation
(`nxs.close.md:564-565`). A fix has no estimate, no decomposition, and no sequencing. A
generated lesson per bug fix is precisely the speculative over-generation the razor exists
to cut, and it would bury the real lessons under volume.

`/nxs.fix` does not create `<docs-root>/delivery/lessons/`, does not write into it, and the
fix entry's `close-record.md` has no `## Process Lesson` section to point at one.

## 5. The distiller diff

Deliberately small. Five edits to `nxs.distill.md`, one flag on the validator, one
subcommand on the PR-worktree helper.

**`nxs.distill.md`**

1. **Input Resolution 2** — ephemeral discovery accepts `.nexus/tmp/fix-<n>/` alongside
   `.nexus/tmp/epic-<n>/`. Same both-files-required rule (`epic.md` + `close-record.md`),
   same consumption derivation, same never-auto-delete, same exclusion from drain-SLO.
2. **Phase 0.4** — the two-test merge precondition applies unchanged (a fix entry always
   carries a `range:`; there is no legacy-entry fallback to consider).
3. **Phase 3** — for a `fix` entry, deltas are `update`-only. No `create`, no `retire`, no
   `touches_added` / `touches_removed`, no `domain` (already create-only, so already
   excluded). Exactly one `## Decision Log Entry`, as for any non-noop delta.
4. **Phase 5.5** — after the existing validator run, for a fix entry additionally run
   `--append-only-log --base HEAD <changed pages>`. Non-zero blocks the PR, unchanged
   semantics.
5. **Phase 5.6** — the committed-removal re-aim has no target for a fix entry. An epic
   entry's re-aim points at `.nexus/queue/epic-<n>/` (the capture rule's scratch home); a
   fix has no epic, so the capture rule wrote nothing and there is nothing to `git rm`. Skip
   the removal; the ephemeral directory is cleaned uncommitted by the next run, as today.

**`libs/portable-tools/src/validate-concepts.ts`** — the `--append-only-log` mode of §3.1.
Three tests, all deterministic, all reusing existing helpers (`gitShow`,
`decisionLogHeadings`, `parseFrontmatter`).

**`libs/pr-worktree/src/`** — a read-only `range --pr <N>` subcommand (§4, Q5).

### Untouched, and confirmed untouched

- **Reciprocity fan-out** — vacuous for a fix (§3.1).
- **Code-anchor refresh** — runs unchanged, and *should*: a fix's diff paths are exactly what
  the sidecar should point at, and anchors are derived state outside the razor's scope
  (the razor governs pages; anchors are regenerable and carry no prose).
- **Atlas regeneration** — a no-op in practice. The generator reads `title`, `touches`,
  `domain`, `status`, and the summary hook; a fix changes none of them. Run it anyway,
  unchanged, so `check-atlas` cannot drift.
- **Validator's existing checks** — every one still runs on the changed pages.
- **The distillation-PR review path** — unchanged. A fix's PR is smaller, not different.

## 6. Out of scope

- No migration path for member repos (§4, Q4).
- No `/nxs.fix --pr` worktree flow. The lane commits nothing, so there is nothing to
  commit on a branch.
- No batching. `/nxs.fix` mints one entry per invocation; `/nxs.distill` batches as it
  already does.
- No back-fill of past fixes. The lane starts empty.
- No change to `/nxs.analyze`, `/nxs.close`, `/nxs.epic`, or `/nxs.decision-record` beyond
  the analyze refusal in §4 Q6.

## 7. First customer

`libs/epic-resolve/src/resolve.ts:80-94` — the `--require-epic` guard.

It rejects any issue with a parent as `not-an-epic`. That is a **story detector, not an epic
detector**: it holds only because Nexus files backlog stubs parentless — "No `parent:` key —
a stub is never a sub-issue of anything" (`nxs.epic.md:374`, and the same contract at
`nxs.close.md:525`). The guard's single caller is `/nxs.epic`'s `--from #<n>` load path
(`nxs.epic.md:100`). An epic that is legitimately a sub-issue of anything — a parent
initiative, a tracking issue, a future hierarchy — is refused with a message telling the user
to pass its parent, which would be wrong.

It is a small, contained fix whose *why* (why parentlessness was ever a sufficient proxy,
and what replaced it) is worth exactly one decision-log entry on an existing page and not one
line more. That makes it the lane's first customer and its proof.

**Not fixed in this session.** Fixing it before the lane exists would mean either losing the
rationale or dressing it as an epic — the two outcomes this spec exists to make unnecessary.

## 8. Open risks

1. **The lane becomes the default.** Every fix is cheaper than every epic, so the pressure
   is one-directional. The razor is the structural answer — a fix genuinely cannot do epic
   work — but a store where new pages stop appearing while decision logs grow is the drift
   signature to watch. Worth a drift-advisory line later; not worth building now.
2. **`close-record.md` as the filename for something that closed nothing.** Bought a
   one-line distiller change; costs a permanent naming wart. Revisit only if a second
   non-epic entry kind appears, at which point the shared shape deserves a real name.
3. **Bare `#<n>` refs to PRs in a single-repo store.** Correct and resolving, but a reader
   scanning a decision log cannot tell an issue ref from a PR ref without following it.
   Accepted: the alternative is a second reference grammar, which `provenance-reference.md`
   invariant 1 forbids outright.
4. **Kind-2 fixes pay the full epic price (§3.3).** A one-line change that invalidates one
   invariant line needs an epic, a story, and two PRs. The razor demands this and the
   store-honesty argument justifies it, but if it turns out that logical bug fixes are common,
   the pressure will be to lie — to append a log entry and leave the false invariant standing,
   because that is the path the tooling permits. **Watch for it before widening anything.**

   The widening to consider, if it comes to that: allow a fix to **strike through** an
   existing invariant in place (`~~...~~`, the retirement idiom the drain already uses) while
   still forbidding adding one, editing one, or creating a page. It is subtractive — it can
   remove a false claim but never assert a new one — and it stays mechanically checkable:
   `strip_strikethrough(head_prefix)` must still equal the base content, so no words can be
   smuggled through the wrapping. It is deliberately **not** in this spec: it is a real
   loosening of the razor, and loosening a razor before there is evidence it binds too tightly
   is how razors die. Revisit with data, not in advance.
