---
title: "Close Record: A Feature Is a GitHub Issue That a New Epic Names"
epic: "#998"
feature: "Issue-Sourced Planning"
date: 2026-11-21
nexus_version: 1.0.0
analyze: ran 2026-11-21 @ 88e2099f6b9429c59d862a7373b2abd3563295d3
record: "#1010"
record_hash: a9d0ca5bb7c1c3e080446c6a1dd4bf08e7442d651e226395092d9ef9b74110d5
range:
  - repo: sameera/nexus
    pr: 1038
    base: f5d9928e7505673b4482ee210519be3968c9116d
    head: 1992fb62225d474f6d484ed013395f1c65330093
story_ranges:
  - story: "#1006"
    ranges:
      - { repo: sameera/nexus, pr: 1038, base: f5d9928e7505673b4482ee210519be3968c9116d, head: 1992fb62225d474f6d484ed013395f1c65330093 }
  - story: "#1007"
    ranges:
      - { repo: sameera/nexus, pr: 1038, base: f5d9928e7505673b4482ee210519be3968c9116d, head: 1992fb62225d474f6d484ed013395f1c65330093 }
  - story: "#1008"
    ranges:
      - { repo: sameera/nexus, pr: 1038, base: f5d9928e7505673b4482ee210519be3968c9116d, head: 1992fb62225d474f6d484ed013395f1c65330093 }
landed_check:
  - story: "#1006"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1038, result: unchanged }
  - story: "#1007"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1038, result: unchanged }
  - story: "#1008"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1038, result: unchanged }
---

# Close Record: A Feature Is a GitHub Issue That a New Epic Names

## Key Decisions

- **D1 — The opt-in is one setting in the shared publishing block, off by default (#1010).** `features-as-issues` is one key in the shared publishing settings block. It is read only through the shared resolver, with the usual precedence, and a member checkout inherits it from its hub. When it is not true, the feature marker resolves to nothing for every stage, so planning, filing and close act exactly as today. **Why:** Being in the block gives the precedence order, the hub layer and the single-reader rule with no extra work. Making "off" mean "no feature marker" puts the whole off switch in the one place every stage already asks. No stage needs its own check to keep a repository that has not opted in unchanged. **Refuted alternative:** A top-level setting outside the publishing block, read by the epic stage alone. It is simpler to describe. It lost because the kind rule needs the same answer, and two readers of one setting can drift apart, which the publishing-config-resolution page's invariant 1 forbids. It would also not be inherited from the hub.
- **D2 — The feature marker follows the classification mode, and a missing feature type is reported (#1010).** The marker comes from two new keys: a feature issue type with no built-in value, and a feature label whose built-in value is `feature`. Under issue-type mode the marker is the type alone. Under label mode and the legacy mode it is the label. Under issue-type mode with no declared type, the marker is nothing, and the epic stage reports that in one line and files as today. **Why:** This copies the initiative marker, which already settled the same question. A guessed issue-type name marks nothing, as the issue-kind-classification page's invariant 6 says. The built-in label `feature` matches the existing built-in labels epic, story and initiative. Matching on the feature path in D5 keeps an existing `feature` label on feature-request issues from confusing lookup. **Refuted alternative:** none
- **D3 — Feature is a declared kind in the one shared kind rule, tested last (#1010).** The kind rule gains the feature kind, read only from the declared mode's marker. It is tested after epic, story, record and initiative. A feature marker carried in a way the mode does not declare reads as none of these, and never stops the run with a mismatch, as the initiative marker already does. **Why:** #1006 requires that an issue reads as a feature only when it carries no other marker. Testing it last means a repository whose epic or initiative label is the feature word loses no epic and no initiative. One rule keeps filing and reading in agreement. **Refuted alternative:** none
- **D4 — Every stage refuses a feature by name as its epic (#1010).** In an opted-in repository, every stage that resolves an epic refuses an issue read as a feature and names it as a feature. That covers the epic resolver and close. **Why:** A feature issue has no parent. Under the issue-kind-classification page's invariant 7, an unmarked parentless issue resolves as an epic, so a feature issue handed to a stage would otherwise resolve as an epic with no stories. Feature issues will be many, so a mistyped number is likely. The refusal sits beside the existing initiative refusal. A feature already fails as a story candidate, because it is not a story. **Refuted alternative:** Let a feature read as none of these in the epic stages. It needs no change to the resolver or to close. It lost because a parentless feature then resolves silently as an empty epic.
- **D5 — Feature lookup is a direct listing, matched on the feature path (#1010).** The epic stage finds a feature's issue in the order the Mechanism gives: the run's ledger, then the stub's feature reference, then a direct listing of feature-marked issues in the epic repository matched on the feature meta block. It files a new feature issue only for a feature that has neither an issue nor a README. An existing feature with a README and no feature issue gets none, and its epic names none. Two matches stop the run with nothing filed. **Why:** A new feature planned first as stubs writes nothing to the tree, so a lookup based on the README would miss its feature issue. The next epic under that feature would then file a duplicate, which fails #1008's second criterion. Matching on the path, not the title, still works after someone renames the issue. A direct listing avoids the delay of the search index on an issue filed moments earlier. Filing for existing features is #999's scope. **Refuted alternative:** Record the feature issue number in the feature README's frontmatter and read it back. It needs no platform query. It lost because the stubs path never writes a README, because it is a second copy of the number, and because #1000 stops writing to the tree.
- **D6 — The feature issue is filed after approval, before the epic and stubs, through the guarded batch filer (#1010).** The feature issue is filed only after the approval or the stubs consent. It goes through the guarded batch filer as its own batch with a kept ledger, as the initiative does. It is filed before the epic and before any stub, into the epic repository, open, and joins the resolved project when one resolves. It carries only the feature marker. Its title is the feature name, and its body is the one-line capability statement plus the feature meta block. **Why:** The filers add the links in their own step after each issue exists, so the feature issue must exist first. The kept ledger is what lets a repeat reuse it. The initiative recorded the same reasoning for filing the container first. The feature issue must carry no other kind's marker, or the kind rule would read it as that kind. **Refuted alternative:** File the epic and stubs first, then the feature issue, then add the links. An interrupted run would then leave the milder state of an unlinked epic. It lost on the initiative's recorded reasoning: linking after creation is a second link path outside the guarded filer.
- **D7 — Epics and stubs record the feature issue number beside the feature path (#1010).** An epic's planning frontmatter carries the feature reference beside the feature path, and it reaches the issue inside the hidden epic-meta block. A stub's Meta carries a feature-issue line beside its feature line. Promotion, reloading a planned epic, the successors of a split stub and the deferral stub all carry the reference forward from their source. **Why:** The resolver already returns the frontmatter as filed. So the number survives every rebuild with no change to the resolver's output shape, as the issue-sourced-planning page's invariants 3 and 5 require. The criteria require naming the issue by number. **Refuted alternative:** Derive the number from the relates-to link when the epic is resolved, keeping one copy. It lost because it adds a relationship fetch to the resolver, whose output must not change for an unchanged graph, because it must filter the related issues by kind, and because the criteria require the number.
- **D8 — The relates-to link is a filer step after the ledger entry, never a parent link (#1010).** Both filers, the single-epic filer and the batch filer, add the relates-to link after the ledger entry is written. Before creating anything, they refuse a batch whose named feature issue does not read as a feature. A failed link warns. A repeat retries the link, and a link that already exists counts as success. The filers never make the feature issue a parent. A relates-to link shows on both issues even when they are in different repositories, which is what #1008's fourth criterion checks. This epic's filing puts the feature issue in the epics' repository, so a pair across repositories is shown by a test that links across repositories, not by filing. **Why:** Links stay inside the guarded filers, as parent links do. The filer checks the named kind itself instead of trusting the caller, the reasoning #705 recorded when it refuted a trusted flag. A link step never abandons an issue that already exists, as the resumable-batch-filing page's invariant 5 requires. **Refuted alternative:** The epic stage adds the links itself with direct platform calls after filing. It touches no filer. It lost because it creates a second write path that neither the ledger nor the pre-filing check sees.
- **D9 — The stage checks the related list before calling the run complete (#1010).** After filing, the epic stage reads the feature issue's related list. If any epic or stub it filed is missing, the run is incomplete and the run folder is kept. **Why:** A failed link only warns, so the filer's summary can say complete while a link is missing. The initiative path solved the same gap by reading its children back, and recorded why. **Refuted alternative:** Make a failed link fail the filer's run. It lost because the filer's summary is a fixed output that #705 froze, and a link step must never fail a run.
- **D10 — Within this epic, feature issues stay open, feature folders stay, and close is unchanged (#1010).** This answers, as far as this epic needs, the three questions the epic left to the record. A feature issue is filed open, and no stage closes or reopens it. Lookup reuses a closed one as it is, and the digest says it is closed. The feature folder, its README and the features index are written exactly as today. Close reads and writes nothing on the feature issue and keeps its writes to the feature path, which #999 stops. **Why:** A feature lives long and gains epics later. Closing it would signal that it is done when it is not, and close would then need reopen logic on every run. The relates-to list already shows each epic's state, so close has nothing to add to the feature issue. The folders and close's writes are #999's and #1000's to change. **Refuted alternative:** Close closes the feature issue when its last related epic closes, so the feature list shows finished work. It lost because the next epic under that feature would have to reopen it, and close would write to a third issue on every run.

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
