---
title: "Close Record: State each distillation rule once, at the point it acts"
epic: "#713"
feature: "Pipeline Command Surface"
date: 2026-09-20
nexus_version: 0.63.0
analyze: ran 2026-09-20 @ fb741e22e246370cc463df4d46769f0c7d85d1b9
record: "#720"
record_hash: 60559d096154a3d07e9f371d612a166baa5415e93451758ffd105cc8c592e2a4
range:
  - repo: github.com/sameera/nexus
    base: 04c216fe4c2cc4a881d45b40951e78a3c48a3e8d
    head: 33106a91002ab79c893fe35e0a8ee548b0f8ea14
---

# Close Record: State each distillation rule once, at the point it acts

## Key Decisions

- **The failure-class token set became a runtime value, not only a type.**
  `derive-entry-diff.ts` now exports `DERIVE_PROBLEMS` as a `const` array and derives the
  `DeriveProblem` union from it. Record #720 asked that the token contract be pinned by tests, and a
  TypeScript union alone has nothing a test can enumerate at run time. *Refuted alternative:* keep
  the union and restate the token list in the command document — refuted because that is a second
  copy of the set, the very defect this epic removes.

- **Removing the fallback also removed the Phase 0.4 gate's first consequence.**
  The not-merged gate used to name two consequences: a degenerate introducing-commit diff, and the
  collapsed two-gate design. The first described a diff path that no longer exists, so it went, along
  with the waiver's "skips the degenerate priority 1" clause. The derived diff is unchanged — Phase 1
  already derived from the recorded range in both branches of the gate. *Refuted alternative:* leave
  the gate's prose alone as out of story scope — refuted because story #715's second acceptance
  criterion requires no other passage to state a different rule for the same condition.

- **The entry-kind contract gives `intake` the ephemeral-epic removal target, not "none".**
  The document never named a removal target for an intake entry, so Phase 5.6's ephemeral rule
  already applied to it and skipped when `.nexus/queue/epic-<n>/` was absent. *Refuted alternative:*
  write "none", which is what an intake entry means in practice since its `<n>` is a pull request
  number — refuted because the epic's first constraint is that a run over an unchanged queue produces
  identical artifacts, and "none" would have been a behaviour change no story authorised.

- **The per-kind rules moved into the contract by restating each phase kind-neutrally.**
  Later phases now name the *axis* ("the delta vocabulary this entry's kind gives", "the validation
  mode the contract gives") rather than the kind, so the phase text is true for all three kinds and
  the table is the only place a kind is named. *Refuted alternative:* leave each phase's per-kind
  clause and add the table as a summary — refuted because that makes nine copies instead of eight.

- **The run summary is a field table, not a rendered artifact.**
  Phase 6.3 defines the summary as a table of fields, each carrying its own omission rule and zero
  case; the checkpoint, pull request body and completion report keep their existing literal templates
  minus the parentheticals that used to restate those rules. *Refuted alternative:* collapse the three
  templates into one rendered block — refuted because the three have different audiences and story
  #717's acceptance criteria pin their current shapes.

- **The recap's residue went to the Role section, not to a short trailer.**
  The two rules with no action point — the historical design workspace `libs/origin/v2/.nexus/` is
  never written, and the stage runs on no machinery of its own — moved into the opening Role section
  beside the publish gates already stated there. *Refuted alternative:* keep a three-bullet trailer at
  the end of the document — refuted because a short index of rules is exactly the second copy this
  epic exists to remove, and the contradiction that motivated the epic lived in such a list.

## Deviation Rationale

- **The shipped word count lands outside the target band record #720 said was unchanged (deviation
  from record #720, Key Decision "The word-count metric is read against the authored file, counted
  plainly").** That decision states "The target band of 8,000 to 10,000 words is unchanged". The
  authored command document went from 13,035 words to 11,530 — inside the epic's amended success
  metric of 11,600 or fewer, well outside the record's band. *Why:* the epic's success metric was
  amended after the record was approved to say the 8,000–10,000 band is not reachable within this
  scope, because this epic carries four of initiative #709's six Track 1 consolidation items and
  shortening the metadata and usage prose is explicitly out of scope. Record #720's own invariant 11
  agrees with the shipped outcome — it fixes the counting method and the 13,035 baseline, does not
  restate the band, and forbids shortening any section outside the four named removals to reach the
  band's low end. The implementation honoured invariant 11 and the amended metric; the record's prose
  sentence about the band was left behind by the amendment and is what the code refutes. *Assumption
  stated, since nothing could be asked during this run:* the band sentence is the stale side of the
  disagreement, not the shipped number. Phase 8.1 posts this as an amendment on #720.

## Carried Obligations

- **Invariant 10 of record #720 is not yet discharged and falls to this epic's own distillation.**
  It requires the distiller concept page's decision log to gain an entry recording the removal of the
  legacy introducing-commit fallback, because that log currently carries the fallback as an approved
  decision and would otherwise keep a retired rule. `/nxs.analyze` could not verify it — it
  constrains the `/nxs.distill` run that follows this close, and no code in the pull request could
  satisfy or break it. The `/nxs.distill` run for this entry must discharge it.

## Deferred Scope

none. The epic's Out of Scope items were declared at planning rather than discovered during
implementation, and initiative #709 remains open as their home — its finding 5 is already filed as
epic #714, and the remaining tracks (moving the stage's deterministic orchestration into a structured
tooling surface, shortening the command document's metadata and usage prose, and re-pointing the
phrase-matching checks onto structured results) are enumerated in that initiative's body.

## Waived Stories

none.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-20-an-amended-metric-leaves-the-record-behind.md`
