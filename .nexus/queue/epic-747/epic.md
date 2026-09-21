---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "The Epic Receipt Accepts and Ranks Published Story Verdicts"
slug: receipt-trust-and-ranking
created: 2026-09-21
type: enhancement
complexity: M
complexity_drivers: [two defects in the same reader pair, one of which has no known cause yet and must be reproduced before it can be fixed]
concepts: [aggregated-epic-receipt, conformance-gate, provenance-reference]
link: "#747"
record: "#750"
record_state: closed
---

# Epic: The Epic Receipt Accepts and Ranks Published Story Verdicts

## Description

An epic that ships story by story ends up with one published verdict per story pull request. The close gate asks a question none of them answers on its own, so the toolkit derives one epic receipt from those verdicts. Two defects stop that derivation from returning the answer the published verdicts already hold.

The first defect rejects every verdict. The conformance gate stamps the repository it read in the host-qualified form, `github.com/<owner>/<repo>`. The epic-receipt derivation compares that stamp against the bare `<owner>/<repo>` and drops any verdict that does not match exactly. The two readers of the same block disagree: the single-pull-request reader compares host-qualified to host-qualified and accepts the block the derivation rejects, and each reader's tests encode its own side of the disagreement, so neither test suite can see the split. The observable result is that an epic whose stories all carry verdicts reports that not one story carries a verdict, and the close gate then reads the conformance gate as never having run.

The second defect is not yet explained. One pull request carries two verdicts for the same story, sixteen minutes apart, and a close attempt on the epic reported the older one's severity counts. The newest-wins rule is stated in the code and in the close gate's own prose, and on the recorded timestamps it should have selected the later verdict. Which reader selected the older block, and why, is unknown. That is the first piece of work in this epic: reproduce the selection before changing it, because a fix aimed at the wrong reader would leave the real one intact and look like it worked.

Both defects sit in the shipped toolkit. No adopter repository can work around either one.

## Success Metrics

- An epic whose stories each carry a published verdict produces an aggregate receipt, rather than reporting that no story carries one.
- A gate reading a pull request that carries more than one verdict for a story reports the severity counts of the newest.

## Personas

Per `docs/product/context.md`. This epic is for the lead running the pipeline, who meets both defects at the close gate, and for the maintainer of Nexus itself, who ships the fix.

## Smallest Usable Version

The epic receipt accepts the repository stamp a published verdict carries; The gate reads a pull request's newest verdict, not a superseded one

## User Stories

### Story #748: The epic receipt accepts the repository stamp a published verdict carries

**As a** lead closing an epic that shipped story by story, **I want** the epic receipt to accept the verdicts the conformance gate published, **so that** the close gate reads the judgment that already exists instead of reporting that nothing was judged.

## Acceptance Criteria

- [ ] **Given** a story's pull request carries a published verdict whose stamped repository is written in the host-qualified form, **when** the epic receipt is derived for that story's epic, **then** the verdict is accepted and counts as that story's coverage.
- [ ] **Given** the same verdict with its repository written in the bare owner-and-name form, **when** the epic receipt is derived, **then** it is accepted too, so both forms already published are read.
- [ ] **Given** a verdict whose stamped repository names a different repository, in either form, **when** the epic receipt is derived, **then** it is rejected and does not count as coverage.
- [ ] **Given** an epic every one of whose stories carries an accepted verdict, **when** the epic receipt is derived, **then** the derivation reports an aggregate rather than reporting that no story carries a verdict.

## Notes

The comparison is at `libs/epic-verdicts/src/verdict.ts:91` and `:118`. The stamp the conformance gate writes is described at `components/commands/nxs.analyze.md:512`. Which side to change — the reader, the writer, or both — is a design question for the decision record, not for this story. The story fixes the observable behaviour either way.

### Story #749: The gate reads a pull request's newest verdict, not a superseded one

**As a** lead closing an epic, **I want** a gate that finds two verdicts for one story to report the newer one, **so that** re-running conformance after a correction actually clears the gate.

## Acceptance Criteria

- [ ] **Given** a pull request carrying two verdicts for the same story, **when** the gate reads that pull request's verdict, **then** it uses the one GitHub timestamped later, whatever order the two are returned in.
- [ ] **Given** that the later of the two omits the optional toolkit-version key, **when** the gate reads them, **then** the later one is still the one used.
- [ ] **Given** a verdict the gate has selected, **when** the gate reports its severity counts, **then** the counts are the ones the machine block carries, not any number written in the prose above it.
- [ ] **Given** the fix in place, **when** the test suite runs, **then** a test covering two verdicts on one pull request fails if the older one is selected.

## Notes

Reproduce the mis-selection before changing anything. A fix aimed at the wrong reader would pass its own test while leaving the real one intact, and the criteria above cannot tell those two outcomes apart.

The live case is `geo-nexus/giccp#665`, which carries a verdict for story `geo-nexus/docs#117` at `2026-09-16T02:44:11Z` reporting two high findings and a second at `2026-09-16T02:59:56Z` reporting none. Both name the same epic, the same story and the same analyzed commit. Candidate readers to rule in or out: the timestamp keys used when reviews and comments are collected together, the merge of per-pull-request recency into across-candidate recency, and the close gate's own prose instruction to take the newest body carrying the marker, which a model executes by hand rather than by calling the checker.

## Assumptions

- The verdict block's fields stay as the conformance gate writes them. This epic changes how a verdict is read, and changes what is stamped only if the decision record concludes that is the better side to fix.
- Both verdicts on the pull request that exposed the ranking defect stay readable on GitHub, so there is a live case to reproduce against.

## Out of Scope

- Re-running conformance on any epic whose verdicts were rejected or mis-ranked while these defects were live. That is the lead's action once the fix ships.
- The staleness axes. A verdict whose analyzed commit no longer matches its pull request's head is already reported as stale, and this epic does not change that.
- The candidate discovery ladder. Which pull requests are offered as a story's candidates is unchanged. Only which offered candidate survives is.
- What the conformance gate judges. Findings and severities are carried through unchanged, as they are today.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #748 | none |
| #749 | none |
