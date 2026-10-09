---
title: "Conformance Gate"
aliases: ["analyze receipt", "conformance receipt", "analyze-close gate", "the receipt"]
touches: ["nexus-pipeline", "decision-record", "record-digest", "pr-driven-flow", "durable-close-record", "writer-stamp", "fix-lane", "pipeline-store-exclusion", "intake-lane", "pr-story-resolution", "shipped-ledger", "verdict-repository-scoping", "published-verdict-selection", "close-and-distill-command", "pr-verdict-answers", "story-evidence-report", "reading-list", "epic-completion-judgment"]
last_updated_by: "#896"
status: active
verification: verified
---

# Conformance Gate

Analyze checks the implemented code against the acceptance criteria in scope, the decision
record, and the invariants on the concept pages the epic lists, and names every place the code
departs from them. It publishes its verdict only on
a pull request. Close treats the verdict as a hard precondition, reading it back rather than
regenerating it.

## How It Works

Against a pull request, analyze publishes a review carrying a machine-readable block, followed by
a second block that lists each departure, finding and deferred-scope proposal with its ID. Run
without a pull request, analyze reports in the terminal and writes nothing. A departure is judged
against a baseline that depends on the record's format, or against the epic's description when the
epic has no record. Each departure cites what it departs from. A broken guarantee is one departure,
never also a separate finding. A departure is marked superseding only when the code does the
opposite of a record decision. An entry lacking
acceptance criteria, success metrics, or decision record is refused rather than passed, and states
that as a literal value no reader can mistake for a waiver.

## Key Invariants

1. Analyze publishes its verdict only on a pull request; no other report artifact exists, and a run
   without a pull request writes nothing.
2. When an unapproved decision record blocks analyze, the run publishes nothing, so a missing
   receipt means exactly one thing to close: there is no analysis to read.
3. A departure from the decision record is accepted only by a trusted comment that names its ID, or
   by a record revision; a decision stub explains a departure but never accepts it, and an
   unanswered departure blocks.
4. Close reads the receipt before mining anything else; it never infers conformance itself.
5. A receipt with an open critical or high item stops close, with no override; a record-stale
   receipt still needs a waiver.
6. The receipt has one form, a published verdict on the pull request; each new verdict is complete
   and supersedes the earlier one by the newest-trusted rule.
7. The verdict records which release wrote it; a receipt carrying no such record, or one naming a
   release other than the reader's, is read exactly as before.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the stage pair this gate sits between.
- [fix-lane](fix-lane.md) — the lane this gate refuses to run against, having no criteria to check.
- [decision-record](decision-record.md) — its approval state makes the gate meaningful;
  unapproved blocks analyze.
- [record-digest](record-digest.md) — the hash the receipt stamps to detect record staleness.
- [pr-driven-flow](pr-driven-flow.md) — the only mode in which this gate publishes a verdict.
- [durable-close-record](durable-close-record.md) — the close comment restating this verdict
  durably.
- [writer-stamp](writer-stamp.md) — the record of which release wrote the verdict, carried in
  the published verdict.
- [pipeline-store-exclusion](pipeline-store-exclusion.md) — analyze draws its verdict from a diff withholding every member; it withheld none before.
- [intake-lane](intake-lane.md) — the other lane this gate refuses to run against, having no criteria to check.
- [pr-story-resolution](pr-story-resolution.md) — decides which criteria are in scope against a pull request: the resolved stories' criteria, never every story's.
- [published-verdict-selection](published-verdict-selection.md) — decides which of a pull request's published blocks is its verdict; this gate reports what that returns rather than choosing one.
- [verdict-repository-scoping](verdict-repository-scoping.md) — names the repository this gate's published verdict resolves its story numbers against, and the check the gate must pass before publishing one.
- [shipped-ledger](shipped-ledger.md) — the record this gate writes on the epic issue for a merged pull request, and the source every later gate reads what shipped from.
- [close-and-distill-command](close-and-distill-command.md) — the stage that runs this gate with nobody watching before close, and reads its outcome from the published verdict and the shipped record, never from the exit status.
- [pr-verdict-answers](pr-verdict-answers.md) — numbers the departures and findings this gate judges, and applies the answers posted on the pull request.
- [story-evidence-report](story-evidence-report.md) — the close report that reads the story fingerprints this gate records in its pull-request receipt.
- [reading-list](reading-list.md) — supplies the pages whose invariants the gate checks, read as they stood before the change.
- [epic-completion-judgment](epic-completion-judgment.md) — where the epic-level judgment happens; split from this page.

## Decision Log

### 2026-07-28 — manual — Named as its own concept

The receipt that proves analyze ran and gates close existed only as command-file procedure,
referenced in passing elsewhere in the store — `record-digest.md` builds an invariant on
"its receipt" and `nexus-pipeline.md`'s own Decision Log notes in an aside that "close reads
a missing receipt as analyze never ran" — with no page stating the contract itself. Filed
manually rather than waiting for a distill, because no open epic touches this mechanism to
trigger one, and the gap was concrete enough (a page already assuming it, a reader unable to
find it) to fix on sight. Prompted the same-day clarification to 0003 §2.2: the concept
store's file-path/code ban excludes the literal artifact (a path, a schema field, a marker
string) but not the behavioral contract a reader needs — what the receipt proves, who writes
and reads it, what its absence means. Refuted alternative: fold this into `nexus-pipeline.md`
— rejected, that page already sits at its word cap describing the whole pipeline shape, and
adding the receipt's contract there would relocate the omission rather than fix it.

### 2026-07-31 — #170 — Receipt placement becomes contractual, and the verdict reaches a durable surface

Where a local receipt lands stopped being an accident of where the epic resolved and became a stated contract: for an issue-sourced epic it sits in the ephemeral area beside the materialized epic, for an old-contract epic in the committed entry, and the two stages that read it depend on that placement rather than re-deriving it. The same change gave the verdict a second, durable home — the close comment stamps it, waiver text included — so a reader of the closed epic can see it closed on a waiver without the receipt file, which is now disposable in both local placements. This page's claims were re-checked against the shipped code while patching it, retiring its unverified bootstrap flag.

### 2026-08-26 — #251 — The receipt records which release wrote it, in both forms

The local receipt and its published-review block both now carry the writing release, so a later change to how receipt data is written is detectable rather than silently invalidating every receipt in flight. The record is placed beside the digests the receipt already carries, never inside the bytes any of them cover, so a stamped receipt verifies exactly as an unstamped one does — an invariant pinned by a test rather than left to the placement being obvious. Reading is unchanged in both directions: a receipt with no such record reads as an unknown writer, and one naming a different release is read normally. Refuted: gating close on the receipt's release matching the reader's — a rung of the deferred version-difference ladder, and the epic's own scope explicitly stops at making a difference detectable.

### 2026-09-05 — #263 — Refusing an entry the check is undefined for, rather than passing it

The gate now stops outright against an entry that carries no acceptance criteria, no success metrics and no decision record, because checking code against three things that do not exist is undefined rather than optional. Stopping is the honest outcome; degrading into a pass would report a conformance judgement nobody made. Such an entry states the state in words instead — a literal value, never a blank — so it stays greppable and can never be read as a waiver of a check that was never available. The considered alternative — let the gate run and emit an empty or trivially-passing receipt — was rejected because a receipt is precisely the artifact the closing stage treats as proof the check ran, and one that means "nothing was checkable" is indistinguishable downstream from one that means "everything passed".

### 2026-09-07 — #405 — Reciprocal link from pipeline-store-exclusion

Mechanical reciprocity fan-out: analyze withheld nothing from the diff it judged, so a branch that also touched a queue entry or a discovery folder presented planning prose to the gate as shipped behaviour. It now derives its diff from the same named set close and distill use, so a conformance verdict cannot be drawn from a surface the pipeline wrote itself.

### 2026-09-08 — #483 — Reciprocal link from intake-lane

Mechanical reciprocity fan-out: the gate's epic-only rule now also names the intake lane as a kind it stops against, beside the fix lane it already refused.

### 2026-09-10 — #211 — Against a pull request, the criteria in scope are the ones that pull request implements

The gate's summary said it checks the epic's acceptance criteria, and that stayed exactly true while a run covered a whole epic at once. A run against one story's pull request does not: the sibling stories of the same epic have not landed yet, so checking their criteria would mark every story pull request failing for work nobody claimed to have shipped. What is in scope is now decided next door, by pull-request story resolution, and this page's claim is narrowed to match. Locally that is still the epic's criteria; against a pull request it is the resolved stories' criteria, and a sibling's code in the diff reads as scope drift instead of an unmet criterion. Nothing else about the receipt moved. Its two forms, its placement, the blocked-run-emits-nothing rule, and the single meaning of a missing receipt are all unchanged.

Mechanical reciprocity fan-out: the pull-request story resolution page names this gate as what it narrows, so a reader arriving at either page learns which criteria a given run answers for.

### 2026-09-10 — #212 — A receipt can be derived rather than judged, and its absence still means one thing

Analyze against an epic whose stories were each judged on their own pull request now derives the receipt from those verdicts instead of judging the epic again. The gate's own contract does not move. Analyze still writes the receipt as its only output, close still reads it back before mining anything else, and a stale or blocking receipt still needs an explicit waiver. What moved is the meaning of an absent receipt. Analyze can now run, find that only some stories carry a verdict, and refuse to derive, so "analyze never ran" stopped being the only way a receipt goes missing. The invariant is restated as what close can actually observe, which is that there is no analysis to read. Refuted alternative: give the gate a sixth state for a refused derivation. That state was rejected because the lead's remedy is the same in both cases, and a second meaning for an absent receipt would fork the gate's classification for no decision it changes.

Mechanical reciprocity fan-out: the aggregated epic receipt page names this gate as the one whose receipt it fills, so a reader arriving at either page learns which shape a given run produced.

### 2026-09-21 — #747 — Which block counts became a rule this gate invokes

In pull-request mode the gate had been told, in prose, to take the newest block carrying the marker and to check its author and the repository it stamps. A model carried that out by hand, and on a live close it reported a superseded verdict's severity counts: the later of two blocks omitted an optional key and the more complete-looking one won. A rule this gate's verdict depends on cannot have a non-deterministic executor and no test that can fail, so the whole rule moved behind a command the gate invokes, with no hand-selection path left behind. What the gate asserts is unchanged — it still reads a receipt before mining anything else and never infers conformance itself. What changed is that obtaining the pull request's verdict is now somebody else's decision, stated on its own page.

### 2026-09-21 — #751 — Reciprocal link from verdict-repository-scoping

The gate's publish step now has a boundary check it must pass, and the repository rules it enforces are stated on their own page rather than here.

### 2026-09-22 — #769 — A merged run records what shipped, and the code-staleness axis is gone

The gate gained a second output and lost a classification. Against a merged pull request it now
writes a record on the epic issue naming the story, the repository, the merge commit and the range
that shipped, so the question of what an epic shipped is answered where it was cheap and certain
rather than reconstructed later from repositories a reader may not hold. A run against an open
pull request is unchanged: it publishes its review for the engineer and writes nothing durable.
The classification lost the code axis entirely. Comparing the analysed commit against a branch
that kept moving after the merge was never a judgment a lead could act on, because the answer
cannot make the shipped code any different, and the waiver it demanded trained the lead to
overrule the tool. What remains is findings, and a decision record revised since the analysis,
which is a real judgment and keeps its waiver. Refuted alternative: keep the code axis as an
advisory that blocks nothing. It loses because an advisory nobody may act on is noise on the one
surface a lead reads at close.

### 2026-09-27 — #814 — Reciprocal link from close-and-distill-command

The close-and-distill command declared an interaction with this concept, so this page mirrors it.

### 2026-10-01 — #827 — Reciprocal link from story-evidence-report

Mechanical reciprocity fan-out: the receipt this gate publishes on a pull request now records a fingerprint of each named story's text, and the close stage's evidence report compares those fingerprints with each story's current text.

### 2026-10-04 — #829 — Analyze makes every judgment, and its verdict lives only on the pull request

Close used to read the diff, the decision record and the decision stubs again after the merge, and
then ask the lead why the code departs from the record. Those are judgments analyze could make
before the merge, when the engineer who made each choice can still answer. The departure pass moved
into analyze, so the verdict now lists each departure with an ID that the engineer answers on the
pull request. Close lost its blocking-findings override, because the verdict's counts now cover only
open items and the remedy is an answer on the pull request. The local receipt is gone: a run without
a pull request reports in the terminal and writes nothing, so close behaves the same whether or not
one happened. The epic-wide receipt combined from story verdicts is retired. The success metrics
and the guarantees that span stories are judged on the pull request that completes the epic. The
links to the ephemeral hand-off entry and the aggregated epic receipt are removed, because neither
interaction exists any more. Refuted alternatives: keep a broken guarantee as a separate critical
finding beside its departure, which gives one fact two IDs and two answers that could disagree; and
run every implement round against a pull request, which costs a worktree and a published verdict per
round.

### 2026-10-09 — #896 — The gate also checks the invariants on the epic's listed pages, and epic-level judgment moves to its own page

Before this change the gate never read the concept store, so code could break a recorded invariant unnoticed. It now lists every unstruck invariant on each listed page, skips those a stated change in the record covers, and judges the rest. A contradiction becomes an ordinary departure at severity high, so an earlier release still reads the verdict. Refuted alternative: a separate result kind for concept invariants, which would break close for a team running mixed releases. The rewrite pushed the page's own content past the cap, so the judgment of success metrics and cross-story guarantees on the completing pull request moved to the epic-completion-judgment page, with no change to the rule.
