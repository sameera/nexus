---
title: "Epic Approval Gate"
aliases: ["approval digest gate", "epic filing gate", "decision-grade digest"]
touches: ["nexus-pipeline", "story-as-unit", "issue-sourced-planning", "publishing-config-resolution", "decision-record", "backlog-stub", "fog-referral-gate", "discovery-graduation", "prose-translation"]
last_updated_by: "#414"
status: active
verification: verified
---

# Epic Approval Gate

The epic stage files the epic and its story issues together, gated by a single decision-grade digest the human approves. The digest, not the epic document, is the read surface at the gate, and open questions block it.

## How It Works

The epic stage takes a capability description directly, with no separate brief. It produces a right-sized epic and presents a digest: the feature line, the epic prose, the stories as sized one-liners, and the assumptions and out-of-scope boundary. Approval is the single forcing function; open questions must be resolved first. On approval, the stage files the epic issue and one issue per story, sequences them, and writes the feature navigation index linking to the filed issue. Filing also declares the design-warrant: a medium-or-larger complexity rollup gets the needs-design label, upserted before applied; an absent or unrecognized rollup errs toward needing design, and the lead can edit the label. Under issue-sourced planning, it commits nothing at planning. The draft stays in session scratch. Filing is issue-first, and a re-run reuses the already-filed epic issue. Scope too large for one epic decomposes into backlog stub issues instead of several fully generated epics; the gate's consent covers that irreversible filing. The epic is translated before the digest is built, so the gate reads the wording that will be filed. Each story body is then a verbatim transcription of the translated epic; only the reference rewrite to an issue number may change a body afterwards.

## Key Invariants

1. The epic and its story issues are filed together, gated by one approval.
2. The decision-grade digest, not the epic document, is the read surface at the gate.
3. Open questions block filing; they are the only pre-filing safeguard.
4. Oversized scope becomes backlog stub issues filed on the gate's consent, not fully generated epics.
5. The epic stage takes intent directly; no separate brief is a precondition.
6. Filing commits nothing at planning: the epic issue precedes its story children, and a re-run reuses an already-filed one.
7. The epic and its stories resolve their target repository independently; later stages address the epic where it was filed.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — where planning is gated and filed.
- [story-as-unit](story-as-unit.md) — the unit the gate files one issue per.
- [issue-sourced-planning](issue-sourced-planning.md) — the model this gate files into: issues, not a committed file.
- [publishing-config-resolution](publishing-config-resolution.md) — decides the repository, classification, and project for every issue this gate files.
- [decision-record](decision-record.md) — filing applies its needs-design label from the complexity rollup.
- [backlog-stub](backlog-stub.md) — what oversized scope becomes, and what a promotion re-enters this gate as.
- [fog-referral-gate](fog-referral-gate.md) — the sharpness test inside this stage's right-size phase, which stops an underspecified intent before sizing.
- [discovery-graduation](discovery-graduation.md) — the entry mode consuming a finished discovery, which files through this stage's existing paths.
- [prose-translation](prose-translation.md) — translates the epic before the digest, so the gate approves the wording that is filed.

## Decision Log

### 2026-06-29 — bootstrap — 0010: file epic and stories at one approval digest

Folded story-issue filing into the epic stage behind a single decision-grade digest, replacing a separate decomposition stage and reducing what the human reads at the gate. The considered alternative — keeping a distinct stage to sequence and file stories, or filing one document per story — was rejected: the extra stage was a consumer-less hop, and per-story files fragmented the single epic artifact for no gain the digest does not already deliver.

### 2026-06-28 — bootstrap — 0008: direct intent and stub decomposition

Dropped the feature-brief precondition so the stage takes intent directly, and made oversized scope emit backlog stubs instead of full epics. The considered alternative — generating a full epic per oversized branch up front — was rejected as the multi-epic over-generation the razor forbids; stubs defer the heavy artifact until a branch is actually promoted.

### 2026-07-22 — #114 — Filing commits nothing at planning; issue-first and idempotent

The gate still files the epic and its story issues at one approval, but now commits nothing to the queue at planning — the draft and working notes stay in session scratch, so no planning-time file can drift from the issues that are the source of truth. Filing is issue-first (the epic issue before any story child, the stories created as its children) and idempotent (a re-run reuses an epic issue already filed in the session draft rather than creating a second). I re-verified the page against the shipped stage: it still takes intent directly, gates on the digest, and writes the feature navigation index, so this flips the page from unverified to verified. Refuted alternative: keep committing the epic document at planning as before — one fewer moving part, but it re-creates the committed copy that drifts from the issue humans edit, the exact drift issue-sourced planning removes.

### 2026-07-24 — #121 — Filing targets are resolved per issue kind, not assumed to be the current repo

Where an issue lands became a resolved decision rather than an implicit one, and the epic and the stories resolve it separately. Separate targeting is what expresses the real shape of a multi-repo product — epics are cross-cutting planning artifacts while stories belong beside the code — and it is the only form that handles a repo with no primary code repo of its own, which files its epic into the hub. Resolving the target also fixes a concrete asymmetry: filing honoured a configured target while close ignored it and always acted on the repo it ran in, so an epic filed elsewhere could not be closed. The epic's fallback label became epic-specific in the same pass, made safe by upserting the label before applying it, since the previous generic label neither classified the issue as an epic nor matched what the sibling story path applied. Refuted alternative: one target for both the epic and its stories — simpler to declare and one fewer key, but it cannot express epics in the hub with stories in the code repo, and it strands the no-code-repo case entirely.

### 2026-07-26 — #139 — Filing declares the design-warrant on the epic issue

Whether an epic warrants a decision record is now decided once, at filing, from the epic's own complexity rollup — medium or larger gets the needs-design label — and lives on the issue where the lead can edit it, so every downstream stage answers "should this epic have a record" from the issue graph with no remembered state, and a hand-filed epic without the label is simply an epic without a record. Small and extra-small are both exempt, since the stated threshold is medium-or-larger; an absent or unrecognized rollup errs toward needing design rather than silently skipping the gate. Refuted alternative: derive the need from the epic's embedded machine metadata — absent on hand-filed epics and not editable in the issue interface, exactly where the label form works for free.

### 2026-08-02 — #185 — Oversized scope files stub issues, and a promotion re-enters by issue number

The oversized path stopped writing markdown blocks into a per-feature file and now files one epic issue per functional goal, marked unplanned — so the gate's consent covers an irreversible platform write rather than a local append, and the choice text at the gate says so. Retiring the file also retires the slug those blocks were addressed by: a promotion re-enters this gate by issue number alone, and because a stub is filed as an epic it is the same kind of object this gate produces. That is what forces the operation to be stated rather than inferred — a bare number always means plan this epic and is legal only while the unplanned label is present, loading an already-planned epic is selected by its own flag, and anything else is a capability description. The gate keeps writing no feature navigation index on this path, because a stub writes nothing to the tree at all. Refuted alternative: infer the operation from whether the unplanned label is present and drop the flag entirely — one fewer input to learn, but the same command would then silently do two different things depending on a label a third party can remove, and the two operations differ in consequence.

### 2026-08-11 — #228 — A sharpness test and a discovery entry mode, both inside existing phases

The epic stage changed in two ways, and neither adds a phase. Its right-size phase now tests whether an intent's functional goals can be stated before it measures their size, and stops an underspecified intent with a referral to discovery rather than filing work-shaped stubs. A third entry mode consumes a finished discovery: it treats the discovery document as the intent, skips the sharpness test, and runs the right-size gate unchanged. Both behaviours are described on their own pages rather than here, because this page is already near its capacity and the store splits a concept that no longer fits rather than growing it. Filing itself is untouched. The stubs a discovery produces go through the same batch path under the same contract, and a sharp, right-sized intent sees exactly the run it saw before. Refuted alternative: describe the sharpness test and the discovery entry mode inline on this page — rejected on the same grounds the taxonomy behaviours were split out, and because each of the two is asked about on its own.

### 2026-09-02 — #414 — The approved wording is the filed wording

Translating the epic before the digest means the gate and the filed issues read the same words, rather than the reviewer approving one draft and a later phase writing another. Nothing in the filing phase had previously stopped a run re-drafting a story body after the gate, so a sentence rewritten there would have reached the issue both untranslated and unapproved. Refuted alternative: translate each story file separately after writing it, which keeps every issue body in plain language on its own — it lost because it spends a translator run per story and reopens wording the gate already approved.
