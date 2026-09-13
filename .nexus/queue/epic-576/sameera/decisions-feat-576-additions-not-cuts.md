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
