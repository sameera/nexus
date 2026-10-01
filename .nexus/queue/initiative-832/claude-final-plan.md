# Final plan: conformance at close and durable knowledge capture

Base: `codex-final-plan.md`. It is adopted with the changes in §0. Everything not named in §0 stands as
Codex wrote it and is restated below only where the change touches it.

## 0. Evaluation of Codex's final plan

Codex's plan carries the four user decisions from claude-r3 §1, the answer/acceptance split from
claude-r3 §6, and the multi-PR supersession fix for trunk verdicts. It needs six refinements. Two cut
machinery that has no reader. One restores a user decision the plan softened. Three close gaps.

| # | Codex plan | Problem | Change |
|---|---|---|---|
| R1 | Close upserts the epic shipped ledger after the checkpoint, so "the hub can read those facts without member checkouts". | Nothing reads the ledger after close. Distill reads ranges from the close record's `range:` list (`nxs.distill.md:358-381`), and recovery reads the close comment's machine block. The ledger becomes a second copy of the ranges with no consumer. | **Retire the ledger write.** Close derives ranges at run time with `deriveRange` and stamps them into the close record and close-comment machine block, as it already does. Keep the ledger *reader* for in-flight epics until they drain. |
| R2 | Fetch a member repo into a temporary Git object store when no checkout exists. | Distill's range-diff tool already requires member checkouts and never fetches (`nxs.distill.md:369-371`). A close that works without one only moves the failure to distill. | **Require the member checkout**, resolved through `resolveVerdictRoots`. Close stops and names the expected path. No temp object store. |
| R3 | A code-changing resolution widens to "a full review" when independence is uncertain. | User decision 2: resolving a deviation **never** triggers a full re-run. | Resolve mode reads the **old-head→new-head diff** and names each AC and guarantee that diff can affect, with a reason. `files:` is a hint, not the boundary (Codex's shared-helper point stands). Everything else carries forward. The receipt lists carried-forward items so a reviewer can see them. Only a record revision re-runs everything. Close's landed-surface check and the epic pass are the backstop. |
| R4 | Story digest over "scope and ACs, using one canonical parser". | Parsing ACs out of a free-form issue body is fragile, and a parser bug makes stale evidence look current. | **Digest the whole story body** with the `nxs-record-digest` canonicalisation. A cosmetic edit costs one targeted trunk pass, which is safe. Revisit only if measurement shows spurious staleness. |
| R5 | "Unattended close" invokes trunk analysis; interactive close "asks the lead to run" it. | `close-epic.sh` runs close **interactively** (stage 2); no headless caller exists. Two paths also mean two behaviours to test. | **One path.** Close offers to run targeted trunk analysis in-session. Interactive: one question, then it runs. `--unattended`: it runs without asking. The lead never re-invokes a second command. |
| R6 | Findings waivers: "a separately recorded human exception names the exact finding and receipt". Mechanism unstated. | A second waiver format would need a second parser. Today's in-close interactive waiver (`nxs.close.md:475-491`) is not mentioned. | **Findings get IDs like deviations** (`F1`, `DV1`). A waiver is a trusted PR comment naming receipt + ID, validated and copied by `analyze --resolve`: one mechanism for both. Interactive close may also accept a waiver at its checkpoint (the lead is the human present), stamped verbatim into the close record and comment. Unattended close accepts only prior waivers. |

Two gaps in slice boundaries are fixed in §6:
- **Slice 2 left the `stale` outcome undefined** before trunk verdicts exist in slice 4. Until then, a stale story blocks and names post-merge `/nxs.analyze --pr <N>` (the existing path).
- **Close's Phase 2 key-decision mining was unassigned.** It goes with the deviation mining in slice 4. Key decisions are read from the approved record, and deviations from the receipts.

## 1. Outcome

At closure, from a closed epic issue, an engineer or agent can answer three questions:
1. Which ACs did the shipped code meet, and on what evidence?
2. Which approved decisions were followed or departed from? Who accepted each departure, and why?
3. What changed in each affected concept, how do the concepts interact, why, and which PRs and commits caused it?

Normal flow: **analyze --pr before merge → merge → close → unattended distill.** No mandatory
post-merge LLM story pass. Close runs one epic-level judgment and runs targeted trunk analysis only
for stories whose PR evidence is stale or missing.

## 2. Settled decisions

1. A PR comment is a valid deviation answer. So are a code change, a decision stub, and a record revision.
2. A resolution re-checks only what it can affect (R3). A record revision re-checks everything.
3. The epic-level check runs inside close, through the shared conformance procedure.
4. The PR review receipt is the per-PR verdict. No second verdict store on story issues, except the trunk verdict (§5.3).
5. An agent's stub **explains** a departure. Only a trusted human comment or a record revision **accepts** it.
6. No new knowledge artifact. Concept pages, Decision Logs, `touches`/Integration Points, anchors, and the epic close comment carry the knowledge.

## 3. Evidence contract: the PR receipt

Extend the existing trusted PR receipt. New fields:
- `stories`: exact covered story numbers, each with `story_hash` (R4).
- `head`: full analyzed PR-head SHA (exists), plus `record_hash` (exists).
- Per-AC and per-guarantee state: met / partial / unmet / contradicted / unverifiable, with evidence and `files:` hint.
- `findings`: each with an ID and severity.
- `deviations`: each with an ID, decision reference, code evidence, status (`open` / `explained` / `accepted`), and the answer's text, author, and URL.
- `supersedes`: the receipt it replaces, when written by `--resolve`.
- `carried_forward`: items not re-judged in a resolve run (R3).

The existing trusted reader picks the newest valid receipt per PR and reports malformed or untrusted
ones separately. Close and distill read receipts, never comment threads.

## 4. Analyze

1. **PR pass** (unchanged entry). Judge ACs and guarantees on the PR head. Run the deviation pass against the record, diff, and stubs. Publish each unanswered or unaccepted departure as a named finding.
2. **`--resolve <receipt> <ID>...`**
   - Same head: validate each trusted comment or stub, copy it in, publish a superseding receipt. No code read.
   - Moved head: read the old→new diff. Re-judge the named items plus every AC or guarantee that diff can affect (R3). Carry the rest forward.
   - Record revised: full pass.
3. **Invalidation.** A changed `story_hash` invalidates that story's verdicts. A changed `record_hash` invalidates every verdict judged against the record.
4. **Extract Phases 1–2** into the shared conformance skill that close also loads.

## 5. Close

### 5.1 Gather (deterministic)

- Walk epic → live stories → every PR claiming each story, across code repos. Include merged, open, and closed-unmerged PRs.
- Make the issue-graph read complete and error-aware: paginate, and treat an API or parse failure as `unknown`, never as empty.
- Deduplicate by (code repo, PR). Keep merge order for multi-PR stories.
- For each merged PR, take the newest trusted receipt that **names that story**.

### 5.2 Classify each story

Per PR: final head = analyzed head; merged; merge commit reachable from trunk; landed surface equal to
the reviewed surface (`git diff --name-status <head> <trunk> -- <PR paths>` is empty, which covers
renames, deletions, and mode changes). Per story: `story_hash` and `record_hash` current.

| State | Outcome |
|---|---|
| `current` | Reuse evidence. |
| `stale` / `unreviewed` | Offer targeted trunk analysis (R5). Re-run the gate once. |
| `failing` | Block, unless a waiver names the exact finding (R6). |
| `unshipped` / active open PR | Block. Analysis cannot fix missing work. |
| `unknown` (API failure) | Block with the diagnostic. |

### 5.3 Targeted trunk analysis

Runs the shared skill on one story against the trunk of **every contributing repo**. It posts one
trunk verdict on the **story issue**. The verdict carries `story_hash`, `record_hash`, the
repo→trunk-SHA vector, and the list of PR receipts it supersedes. A new claiming PR, a changed hash,
or a moved trunk in any listed repo makes it stale.

### 5.4 Epic-level judgment

After every story is `current` or waived, run one pass over the integrated trunk. Read every PR range
in merge order, and inspect code beyond the changed-file union where a cross-story guarantee needs
it. Judge success metrics and cross-story guarantees. A post-release outcome is recorded as a
measurement plan with an owner. Run it for every epic, one-PR epics included. Consider an optimization
only after measurement.

### 5.5 Stamp, checkpoint, close

1. Derive ranges with `deriveRange` from the member checkouts (R2). Stamp them into the close record and the close-comment machine block (R1).
2. Checkpoint: findings, waivers, accepted deviations, ranges, deferred scope, epic judgment.
3. Just before closing the epic issue, re-check the head, hashes, and trunk vector. If any moved, stop and refresh the affected judgment.
4. Post the close comment: record reference, deviations with their accepted reasons (from receipts), ranges, epic judgment, and "distillation pending". Close the epic.
5. Keep deferred-scope filing, the process lesson, and the record amendment in close (Codex's order; moving them is later work).

## 6. Distill

As Codex wrote it. It keeps its `--unattended` flag and the fix and intake lanes. Question-type stops
become a draft PR with a committed questions file. Continuation applies the answers and marks the PR
ready. Non-question failures stop with a diagnostic. Distill adds the PR URL to the epic close comment
idempotently. An unresolved deviation found by distill is named, never given an invented reason.

## 7. Delivery slices

Each slice: TFD, version bump + `CHANGELOG.md`, docs, bundle pin, full suite, per `CONTRIBUTING.md`.

1. **Evidence and enumeration.** Complete, paginated, error-aware story→PR graph. `story_hash` (whole-body digest). Receipts name exact stories. Close behaviour unchanged.
2. **Close without post-merge analyze.** Close derives ranges and landed-surface currency itself and stamps them into the close record. Retire the ledger write (R1) and `close-epic.sh` stage 1. Switch the `--merge` pre-check to the PR receipt. Interim rule: a `stale` story blocks and names post-merge `/nxs.analyze --pr <N>`. Keep the ledger reader for in-flight epics.
3. **Deviation and findings resolution.** IDs on findings and deviations. `analyze --resolve` with the R3 scope. Trusted comment answers and waivers (R6). Answer ≠ acceptance.
4. **Close-time recovery and epic judgment.** Extract the shared skill. Add story trunk verdicts (§5.3), the one-path offer (R5), and the epic pass. Then remove close's Phase 2 key-decision mining and Phase 3 deviation mining in the same release, and compose the close comment from receipts. Retire the post-merge analyze ledger path.
5. **Unattended distill.** Draft-PR questions and continuation. Measure per-stage tokens and time before moving lesson, deferred scope, or amendment out of close.

## 8. Verification

Codex's list stands. Add:
- A resolve run whose code change touches a helper outside the cited `files:`. The affected AC is re-judged, and unaffected ACs are carried forward.
- A cosmetic story-body edit. It produces `stale`, then one trunk pass, then `current`.
- Hub epic with a missing member checkout. Close stops and names the path.
- The close record's ranges feed distill's diff with no ledger record present.
- An interactive checkpoint waiver appears verbatim in the close comment.

Replay #814 / PR 821 read-only first. Record tokens and time per stage, landed-surface mismatch rate,
spurious `story_hash` staleness, and distill question rate. Write-capable acceptance runs only on a
test epic, or with explicit authorization.

## 9. Resolved with the user (2026-09-30)

1. **R1 — retire the ledger write.** No consumer outside this repo reads `nexus:shipped` records. The write is retired in slice 2.
2. **R6 — interactive checkpoint waiver.** Kept. Unattended close accepts only prior PR-comment waivers.
