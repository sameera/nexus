## 2026-09-12 — The ordering block is a title-keyed list, not a table

- **Choice:** `## Implementation Order` is a bullet list (`- **<Title>** — blocked by: …`), parsed line by line.
- **Why:** The filed `## Implementation Sequence` is a table keyed on issue numbers; a second table shape at drafting time reads as the same artifact and invites the two to be confused.
- **Refuted alternative:** Mirror the filed table's `| Story | blocked_by |` shape at drafting time.

## 2026-09-12 — A missing ordering row blocks, but only when the draft declares stories

- **Choice:** `checkOrdering` returns nothing when the draft has no `### Story` heading; otherwise every story must have a row.
- **Why:** The decision-record and discovery stages share this checker and have no stories; demanding a block there would block drafts the rule was never written for.
- **Refuted alternative:** Require the block whenever the heading is absent, and let the other stages carry an empty one.

## 2026-09-12 — Filing-body derivation gets its own function rather than widening stripLabels

- **Choice:** `deriveFilingBody` strips labels and removes the ordering section; `stripLabels` keeps its line-local meaning.
- **Why:** `ordering.ts` calls `stripLabels` per line to read a title; widening it to remove a whole section would make the reader depend on the writer.
- **Refuted alternative:** Extend `stripLabels` to drop the block as well.

## 2026-09-12 — An absent necessity section and an empty one are different states

- **Choice:** `smallestUsableVersion` returns `undefined` for a missing section and `[]` for a present but empty one.
- **Why:** The razor forbids a minimum-count rule, so an empty answer must be expressible without being a finding, while an absent section must raise nothing at all for the record and discovery stages.
- **Refuted alternative:** Return `[]` for both and treat the section's presence as irrelevant.

## 2026-09-12 — The failing report gains a header line naming the draft

- **Choice:** `renderRazorFindings` prefixes its findings with `razor-check: <draft> — <n> finding(s):`.
- **Why:** The story requires a stopped run to name the draft as well as the story at fault; the findings themselves carry only the story.
- **Refuted alternative:** Put the draft path into every finding's message.

## 2026-09-12 — The gate renders three groups, not two

- **Choice:** The digest renders "What a plain approval files", "Additions", and "Removals" — one numbered list across all three.
- **Why:** The record requires additions in two labelled groups and sub-item removal kept opt-out; showing the filed set first is what makes the new default legible before the reviewer reads anything optional.
- **Refuted alternative:** Render only the two addition groups and leave the filed set implicit in the digest's story list above.

## 2026-09-12 — An unlabelled story heading reads as inferred rather than throwing

- **Choice:** `storyProvenance` treats a heading with no label as `inferred`; the checker is what blocks it.
- **Why:** The conservative reading — an unlabelled story is never filed by default — and it keeps the reader total, so the gate can render a draft the checker is about to reject.
- **Refuted alternative:** Throw on an unlabelled heading and make every caller handle it.

## 2026-09-12 — The deferral floor is read off the stub's own Meta block

- **Choice:** The stub records `deferred: <n> stories`, and a planning run consuming a stub that says `1 story` skips the deferral step.
- **Why:** The floor is checkable at the moment it matters with no history to keep; the Meta block is already the stub's durable carrier for `estimate` and `candidate stories`.
- **Refuted alternative:** Require each deferral to be strictly smaller than the one before it — unenforceable, since a deferred title is drafted again and can legitimately grow.

## 2026-09-13 — The apply-time closure arm runs before the graph is edited, and re-parenting goes
- **Choice:** The gate re-checks closure over the approved set as its first act, against the ordering block as drafted, and the "re-parent the dependents of a dropped story" step is removed rather than reordered after it.
- **Why:** Once closure blocks, no filed story can wait on a dropped one, so a cascade has no live case; keeping the step only restores the rewrite that made the arm unable to fire.
- **Refuted alternative:** Keep re-parenting and simply run the closure check ahead of it — the step would then be unreachable prose, and a later reader would reorder it back.

## 2026-09-13 — The rollup check is a floor plus a stated driver, not an exact derived value
- **Choice:** `checkRollup` blocks a `complexity` below the largest size in the filed set, and one above it while `complexity_drivers` is empty; how far integration raises it stays judgement.
- **Why:** 0009's rollup takes cross-story integration, which is not mechanically decidable; a fully deterministic rollup would be a new normative default this epic never approved.
- **Refuted alternative:** Derive `complexity` exactly from sizes and count, and check equality — it catches the stale-high case too, but it invents a count threshold the razor does not hold.

## 2026-09-13 — The unconsumed offer and filing-body modules are wired, not deleted
- **Choice:** `offerList` reaches the gate as `nexus razor-offer`, and `deriveFilingBody` as `razor-check --derive`, instead of being cut as speculative.
- **Why:** They are the executable statement of "ordered by what each item unlocks, never by value" and of the ordering block dying at filing; deleting them would leave both as prose a model can drop.
- **Refuted alternative:** Delete both — the record permits the render as command prose, and unconsumed code is the drift the analyze gate named.
