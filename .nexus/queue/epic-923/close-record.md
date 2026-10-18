---
title: "Close Record: The analyze verdict on a pull request shows what blocks and how to resolve it"
epic: "#923"
feature: "PR-Driven Delivery"
date: 2026-10-18
nexus_version: 0.116.0
analyze: ran 2026-10-17 @ 2f2f9fa089aa37d82906f4934d7a3b8c114b158b
record: "#949"
record_hash: ee995f627850e38114cc07e82e9d576168c7d49d50f3cb8722deac5b65398505
range:
  - repo: sameera/nexus
    pr: 950
    base: 329c9343e1998ebccdcfa3607b6bdeab2be85d87
    head: 11d88d57bc3232940e36176f7b4ddf8527a26a52
story_ranges:
  - story: "#924"
    ranges:
      - { repo: sameera/nexus, pr: 950, base: 329c9343e1998ebccdcfa3607b6bdeab2be85d87, head: 11d88d57bc3232940e36176f7b4ddf8527a26a52 }
  - story: "#925"
    ranges:
      - { repo: sameera/nexus, pr: 950, base: 329c9343e1998ebccdcfa3607b6bdeab2be85d87, head: 11d88d57bc3232940e36176f7b4ddf8527a26a52 }
  - story: "#926"
    ranges:
      - { repo: sameera/nexus, pr: 950, base: 329c9343e1998ebccdcfa3607b6bdeab2be85d87, head: 11d88d57bc3232940e36176f7b4ddf8527a26a52 }
landed_check:
  - story: "#924"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 950, result: unchanged }
  - story: "#925"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 950, result: unchanged }
  - story: "#926"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 950, result: unchanged }
---

# Close Record: The analyze verdict on a pull request shows what blocks and how to resolve it

## Key Decisions

- **D1 — The toolkit writes the whole verdict body (#949).** The renderer produces every byte of the published body: visible text, receipt block and judgments block. It works from one input, the run's judgments and its run facts. The model writes no verdict text. **Why:** The structure drifts today because the model writes the text from a prose template, and code checks only the machine blocks. With one input, the visible text and the machine data cannot disagree. **Refuted alternative:** Keep the model writing the text, and add a structural check that refuses a malformed layout. It loses because the model would still word and order things freely within the check's limits. Byte-identical output would stay impossible, and runs would need repair loops.
- **D2 — Rendering runs inside the ID step (#949).** The existing ID step calls the renderer, in the same call that numbers the items and applies the answers. That call also reports whether the pull request is blocked, and the stage picks the review event from it. **Why:** The ID step already holds the registry, the applied answers and the open counts. Rendering in the same call means the counts, the items and the text come from one computation. **Refuted alternative:** A separate render command that the stage calls after the ID step. It is easier to test alone. It loses because the model would carry the judgments file and the run facts between two calls, so a stale file or a different count could slip in. That split is what this epic removes.
- **D3 — The judgments block carries everything the visible text shows (#949).** Every model-made thing the visible text shows goes into the judgments block as a new optional field: the fix, the location, the evidence per criterion, scope drift and notes. Existing fields keep their names and meaning. A recording run renders the full verdict from the carried block. **Why:** A recording run judges nothing again on an unchanged head. Without these fields in the block it could not show a fix or evidence again, and the model would have to write them again, which brings the drift back. Earlier readers ignore keys they do not know, so teams running mixed releases are safe. **Refuted alternative:** Pass the visible-only fields to the renderer on each run and keep the block as it is. This matches the epic's assumption word for word. It loses because a recording run would then publish a verdict with no fixes and no evidence.
- **D4 — Refusal for a missing required field (#949).** If an open item judged in this run lacks a required field, the ID step writes no body and stops. The refusal names the item by ID and subject, and names the missing field. #924 sets the required fields as subject, severity, and what is wrong. #925 adds the fix, and the location whenever the item has files. An item carried unchanged from a verdict published before the release is not refused. It is shown without the fields it never had, and its resolution shows only the paste line and the command. **Why:** A required field the renderer cannot fill would leave a gap in the fixed layout. Refusing items carried over from before the release would block every recording run across the upgrade. **Refuted alternative:** Write a placeholder such as "not stated" for a missing field. It loses because the gap would pass silently, which is the failure the epic names.
- **D5 — The renderer is deterministic (#949).** The renderer reads only its input. It reads no clock, environment or network, and the date is a run fact. Sections, items and fields come in a fixed order, and items sort by kind and then by ID number. Line endings are always a single newline. **Why:** Byte-for-byte equality is only testable when nothing outside the input can change the output. **Refuted alternative:** none
- **D6 — Text inside the verdict cannot change its structure (#949).** All draft text and answer text is written as inline text. Line breaks fold to spaces. Characters that would open or close HTML, a section or a marker are escaped. Table-cell separators are escaped. The escaping always gives the same output for the same input. **Why:** Content in the diff can steer the model's text, and answer reasons are free text. Either could otherwise close a collapsed section, forge a headline or repeat a marker. Today the model fixes a marker repeated by copied text by rewriting it by hand. The toolkit now does that itself. **Refuted alternative:** Refuse a draft whose text holds such characters. It loses because a real reason or summary often quotes code that contains `<` or `|`.
- **D7 — Headline and review event follow one rule (#949).** The headline says "Blocked" exactly when at least one blocking item is open. Otherwise it says "Clear to merge". It then gives the open count per severity, computed the same way as the receipt's counts, and then the count of checks to make by hand. The review requests changes exactly when the headline says blocked. **Why:** The merge pre-check and `nexus close` already block on open critical or high items. The headline and the review event must state that same fact, not a second one. The lead chose the headline wording for checks by hand at the clarification gate. **Refuted alternative:** none
- **D8 — Item sections, with a fourth for items no longer found (#949).** Items appear in needs action, worth a look, already answered, and no longer found, in that order. Needs action holds the blocking items and the answers that applied nothing. Worth a look holds open medium and low findings, checks to make by hand, scope drift and notes. Already answered shows the subject first, then the answer, who gave it and the reason. No longer found lists each item with its answer. **Why:** An item no longer found must be listed and never dropped, and it is neither open nor always answered. An answer that applied nothing must be named, and the engineer has to act on it. **Refuted alternative:** Fold the items no longer found into already answered. It loses because an unanswered item there would read as answered.
- **D9 — How each item is resolved (#949).** An open item's resolution is its fix, then for an answerable item a paste line in its own code block, then the command `/nxs.analyze --pr <N> --resolve`. The paste line for accepted or waived stops after the colon. Pasted unedited, it gives no reason and applies nothing, and the next verdict names it as having no reason. The approval line for a deferral appears only on the item it settles. Medium and low findings get the fix only, because they cannot be waived. **Why:** The epic asks for the exact line to paste. A line that is complete without a reason would let an unedited paste accept a departure. **Refuted alternative:** A filled placeholder reason, such as "<your reason>". It reads more clearly. It loses because the answer reader only checks that a reason exists, so an unedited paste would apply an acceptance with a junk reason.
- **D10 — Location links are pinned to the analyzed commit (#949).** An item's location links to the file and line at the analyzed head commit, in the pull request's code repository. The link is built from the repository identity stamped in the receipt, including its host. **Why:** A link to the analyzed commit shows the code that was judged, even after later pushes. Using the stamped host keeps links correct on self-hosted forges. **Refuted alternative:** Link to the pull request's changed-files view. It loses because that view moves with later pushes, and it cannot show an unchanged file where a missing piece of a criterion belongs.
- **D11 — Supporting detail is collapsed, and the machine blocks sit last (#949).** The stories table shows counts only. Evidence per criterion sits in a collapsed section. Epic-level results are one table with one row per check. A run that did not judge the epic level shows one row saying so, and a pull request that does not complete the epic shows no table. Empty sections are left out. Run details is collapsed and shows the full record hash. The receipt block and then the judgments block sit at its end, and the receipt marker is still directly followed by its fence. **Why:** Readers of this release and earlier ones find the receipt by the first fence after its marker, and need the judgments block after the receipt. One epic-level table removes the two lines that contradicted each other. **Refuted alternative:** Leave the receipt visible below the verdict, as today. It loses because it is bookkeeping in the reader's view, which #926 asks to fold away.
- **D12 — The terminal report and the published body separate (#949).** In pull-request mode, the terminal report keeps the run-discipline completion layout. It is short and links to the published verdict. Only the published body uses the rendered layout. A run without a pull request keeps today's terminal report and result line. **Why:** The run-discipline skill fixes one completion layout for every stage, and the unattended implement loop reads the local result line. This departs on purpose from the analyze template's "one layout for both". The lead confirmed it at the clarification gate. **Refuted alternative:** Render the local report too. It loses because local items have no IDs or answers, and changing the local report puts the unattended loop's parsing at risk, outside this epic's scope.
- **D13 — The refusal for a verdict over the size limit changes (#949).** Dropping the results' file lists stays the first step. If the body is still over the limit, the refusal names the longest draft fields to shorten, by item ID. It no longer says to shorten the summary prose, which the model no longer writes. **Why:** Draft fields are now the only text of variable length. **Refuted alternative:** Cut the collapsed evidence automatically. It loses because it silently removes evidence a reviewer may need, and a later run could not tell that it was cut.
- **D14 — One pull request and one release for all three stories (#949).** #924, #925 and #926 ship together in one pull request, with one minor version bump and one CHANGELOG entry. **Why:** The lead chose it at the clarification gate. With one release, published verdicts change layout once, and no release publishes a layout that is only partly built. **Refuted alternative:** A minor release per story, as the house rule for stage-behaviour changes would give. It loses because the verdict layout would change three times, and the first two releases would publish a partial layout.
- **renderVerdict sits in epic-verdicts and is called inside nexus verdict-items when --facts is passed; --out receives the whole body** (a decision stub the verdict on sameera/nexus#950 confirmed). **Why:** D2 puts rendering in the same call that numbers the items and applies the answers **Refuted alternative:** a new --body-out flag beside the judgments-only --out
- **an item's subject is its existing departsFrom or about; summary moved to the post-numbering item-incomplete refusal** (a decision stub the verdict on sameera/nexus#950 confirmed). **Why:** D3 counts exactly five new optional fields, and the refusal can only name an item by ID after numbering **Refuted alternative:** a new subject field
- **R1 measured on the PR #874 verdict re-rendered in the new layout (26,077 characters)** (a decision stub the verdict on sameera/nexus#950 confirmed). **Why:** R1 asks for the largest existing verdict's size in the new layout before merge **Refuted alternative:** a synthetic large epic only
- **every hand-reachable verdict-check refusal ends with one remedy: run nexus verdict-items again and check its body unedited** (a decision stub the verdict on sameera/nexus#950 confirmed). **Why:** G3 says the model writes no byte of the verdict **Refuted alternative:** have verdict-items resolve issuesRepo itself
- **follow-up fixes extend the unreleased 0.116.0 CHANGELOG entry; no new version** (a decision stub the verdict on sameera/nexus#950 confirmed). **Why:** G6 holds the pull request to one bump and one CHANGELOG entry **Refuted alternative:** bump to 0.117.0

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
