---
title: "Close Record: Prose translation agent with a resident density convention"
epic: "#414"
feature: "Artifact Prose Style"
date: 2026-09-02
nexus_version: 0.1.0
analyze: ran 2026-09-02 @ 8ee7a1441e518bafc8dc66520ced65857a7752ac
record: "#421"
record_hash: c4e7e601441392cbf774bb443e38c05e3b13ebf48a3d85ca13d9f170e947e3c9
range:
  - repo: github.com/sameera/nexus
    base: 1aa869284541b5d170b09eab007df919640f1c62
    head: b6d78935812ccde8969731bb3c12aa965332ffc8
---

# Close Record: Prose translation agent with a resident density convention

## Key Decisions

- **Success metric 5 is accepted.** Record #421 settles the reviewer-judgment metric as a one-time human judgment taken when story #418 lands, not a standing check. #418 landed in this pull request, and the lead's judgment on close is that the translated artifacts of this epic carry no violation of the six form rules. The metric is satisfied and no recurring check follows from it. Refuted alternative: leave the judgment untaken and file a stub to carry it, which would keep an epic metric open on a question the person who could answer it was already looking at.

- **The receipt is a fixed five-field plain-text shape, not JSON.** The receipt is read by the invoking model, never parsed by a program, so a flat line shape is the cheapest thing to return on the leg the whole split exists to keep small. Refuted alternative: a JSON receipt object, which is machine-checkable — but nothing machine-reads it, and its punctuation is paid on every run.

- **The agent body names the two content rules it does not hold.** A small model told only "apply these six" extends them silently. Naming the concreteness and add-nothing rules, and saying they are not the translator's own, is what makes the density-report behaviour follow rather than a guess. Refuted alternative: omit them and keep the body minimal, which is cheaper but leaves story #416's reporting duty unmotivated from the agent's side.

- **Density is the receipt's only finding kind, so it shares the count field.** The fourth field is `density: <count>` with the finding lines directly beneath it; there is no separate general-findings list. Refuted alternative: a generic typed-prefix findings list that would extend to future kinds — but no other kind is in scope, and the epic's out-of-scope section rules out the one that might have been.

- **Regions pair by ordinal position within their own kind.** The Nth fenced block of the before copy pairs with the Nth of the after copy, and a surplus on either side reports as added or removed. A single inserted region would otherwise shift every later pair and turn one edit into a run of findings naming the wrong lines. Refuted alternative: a longest-common-subsequence alignment over regions, which survives insertion better but buys nothing for a check whose passing case is that nothing moved at all.

- **A criteria line is recognised by emphasis or by all three keywords.** A line carrying `**Given**`, `**When**` or `**Then**`, or one carrying all three keywords as standalone words. Refuted alternative: match any standalone `Given`, which is simpler but freezes narrative sentences and leaves the translator unable to work on them. The accepted cost is the reverse case: ordinary prose using all three words is held byte-identical and skipped by the prose scan, so it is both untranslatable and unchecked.

- **The convention names one `translate <file>` marker that each phase points at.** The mechanics — the pre-copy, the agent, the check, the retry, the stop-on-failure rule — are stated once in the resident block, and a phase needing a translation writes two lines naming the file and the moment. A command with three translation points still spends about thirteen lines in total. Refuted alternative: state the full mechanics at each phase, which reads better in place but multiplies the resident cost by the number of translation points and breaches invariant 11's fifteen-line cap.

- **Discovery drafts to session scratch and writes the translated file into the store.** The artifact is translated and verified before it is written out. Refuted alternative: write into `.nexus/discovery/` and translate in place, which is fewer steps and matches how the other commands treat their scratch — but the store is committed, so a failed check would leave a bad file exactly where the commit step expects a good one.

- **Zero and one are excluded by denotation, not by spelling.** The numeric reader drops any value denoting 0 or 1 in every written form and with any suffix, so `1`, `one`, `1%`, `0ms` and `1.0` are all untracked. Excluding only the word forms left the exclusion asymmetric, and the asymmetry false-failed in both directions: `1` rewritten as "one" read as a lost value, and "one" written back as `1` read as an invented one. Neither clears on a retry, which is the one thing a fail-closed gate cannot carry. Refuted alternative: exclude the bare numerals only, which reproduces the same asymmetry one layer down at `1%` against "one percent".

- **A numeric's unit is the suffix written against the numeral.** The key is the value plus an attached suffix (`95%`, `10ms`) or the word `percent`; a free-standing unit word merely following the numeral is not part of the key. Refuted alternative: take the next word as the unit, which would catch "40 words" becoming "40 sentences" — a real defect, bought with a false failure on every honest rewrite that changes what follows a numeral.

- **The retry is stated in the convention block, not at each translate point.** The restore-and-retranslate step is one clause inside each command's shared convention. Refuted alternative: state it at each translate point, which reads better in place — but `/nxs.distill` carries two points and `/nxs.epic` two, so one rule would be written four times and invariant 11's cap would not survive it.

- **Invariant 18 is stated at the transcription step.** `/nxs.epic` Phase 6 step 3 states that story bodies are a verbatim transcription of the translated `epic.md`, with the Phase 6 step 4 pass-3 reference rewrite named as the only permitted post-translation edit. Nothing in Phase 6 had previously stopped a run re-drafting a story body after the gate. Refuted alternative: re-translate each story file after writing it, which burns a translator run per story and reopens wording the gate already approved.

## Deviation Rationale

- **The pre-translation copy is deleted by the shared convention, and a `*.pre` ignore rule ships with it (deviates from #421 invariant 2).** Invariant 2 ends the copy's life at the check's verdict and forbids committing one, but named no mechanism, and no story asked for one. Two translate targets are tracked files — the feature `README.md`, and concept pages staged by `git add .nexus/concepts` — so a surviving copy rides into a commit, and the concept validator cannot see it because it filters on `.endsWith(".md")`. The convention now ends "run prose-verify, then delete `<file>.pre`", the repository `.gitignore` ignores `*.pre`, and `/nxs.setup` scaffolds the same rule into a new project. Refuted alternative: teach `validate-concepts.ts` to reject a stray `.md.pre`, which catches it late, only inside the concept store, and leaves the docs-tree README case uncovered.

- **`/nxs.distill` Phase 0.1 writes the fetched record body to a named file (deviates from #421 by extending story #420's scope).** The grounding pointer named a path no phase ever wrote, so half the grounding corpus was unreachable and abstractions fell through to density findings. Phase 0.1 now writes the fetched body to `<scratch>/<entry-slug>/record-body.md`, and every *why* branch — record sub-issue, committed `decision-record.md`, close record alone — resolves to one named file that Phase 4.6 hands the translator. Story #420's AC1 was amended on the issue to match. Refuted alternative: re-fetch the record inside Phase 4.6, which is a second network read of a body already hashed at Phase 0.1 and a second chance for the two copies to disagree.

- **A negated modal tolerates a bounded run of adverbs (relaxes #421 invariant 15's plain multiset reading).** Invariant 15 reads modal verbs as a multiset and says nothing about negation, so a literal implementation keys "can simply not have" and "cannot have" as different items. The first real translator run produced exactly that rewrite, which is meaning-preserving and strength-preserving, and the reader failed it. The modal reader now pairs a modal with a later `not` across up to three intervening adverbs — a closed list plus any word ending in "ly". Refuted alternative: scan forward to the next `not` anywhere in the sentence, which catches every separation but reads "it can stop runs that are not faithful" as a negated modal, inverting a claim the author never made.

- **Nx tsconfig references were synced across three files (mechanical, no behaviour; not anticipated by #421).** `libs/delivery-config/tsconfig.lib.json`, `libs/portable-tools/tsconfig.lib.json` and the root `tsconfig.json` carry generator output from the `@nx/js/typescript` sync that adding `libs/prose-verify` triggered. No decision is embedded in it.

## Deferred Scope

Deferred items filed as backlog stub issues:

- #426 — hyphenated compound numbers survive the preservation check (and the stale proper-noun docstring)

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-02-prose-translation-agent.md`
