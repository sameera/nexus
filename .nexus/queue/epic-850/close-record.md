---
title: "Close Record: An Initiative Carries the Planning Context of Its Epics"
epic: "#850"
feature: "Scope Discipline"
date: 2026-11-09
nexus_version: 0.129.0
analyze: ran 2026-11-09 @ 08429349d29c5c88f991c6ab20f38a490470e52a
record: "#961"
record_hash: 590054f497a0ab0dca70ded69aff00fe06f5c2e3fe0095eb90f1571acf784f9a
range:
  - repo: sameera/nexus
    pr: 962
    base: 1e1e077d1f2ff0de86881953f5fbcda8f924a9d2
    head: f5162a50a5f74cd72c30c7d95ce1d9701201f67c
story_ranges:
  - story: "#851"
    ranges:
      - { repo: sameera/nexus, pr: 962, base: 1e1e077d1f2ff0de86881953f5fbcda8f924a9d2, head: f5162a50a5f74cd72c30c7d95ce1d9701201f67c }
  - story: "#852"
    ranges:
      - { repo: sameera/nexus, pr: 962, base: 1e1e077d1f2ff0de86881953f5fbcda8f924a9d2, head: f5162a50a5f74cd72c30c7d95ce1d9701201f67c }
  - story: "#853"
    ranges:
      - { repo: sameera/nexus, pr: 962, base: 1e1e077d1f2ff0de86881953f5fbcda8f924a9d2, head: f5162a50a5f74cd72c30c7d95ce1d9701201f67c }
  - story: "#854"
    ranges:
      - { repo: sameera/nexus, pr: 962, base: 1e1e077d1f2ff0de86881953f5fbcda8f924a9d2, head: f5162a50a5f74cd72c30c7d95ce1d9701201f67c }
landed_check:
  - story: "#851"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 962, result: unchanged }
  - story: "#852"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 962, result: unchanged }
  - story: "#853"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 962, result: unchanged }
  - story: "#854"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 962, result: unchanged }
---

# Close Record: An Initiative Carries the Planning Context of Its Epics

## Key Decisions

- **D1 — The context lives in a new committed store keyed by initiative number, excluded from every derived diff (#961).** Keep each initiative context in its own committed folder under the Nexus root, named for the initiative's issue number, outside the queue and outside the discovery store. Add that store to the closed set of pipeline stores that analyze, close and distill leave out of their diffs. That membership is a reviewed code change in the toolkit. **Why:** Every existing home breaks a rule that holds today. The queue requires every entry to carry a close record, the epic stage promises it adds no file under the queue, and only a drain merge removes a queue entry. #832's hand-made copy sat in the queue and was later removed by a hand commit that cleared the queue. The discovery store is removed when a discovery ends. The documentation tree feeds the concept store, which this context must never reach. Keying by issue number lets both readers find the context by convention, and lets a lead write one by hand in the same place for an older initiative. Joining the excluded set stops analyze from showing a committed plan as shipped behaviour, and stops distill from mining it. **Refuted alternative:** Keep the full context off the repository, in a marked comment on the initiative issue, as discovery decisions are kept today. It lost on size: a full plan does not fit in an issue body, and a comment has the same limit. The epic also chose a repository copy explicitly.
- **D2 — The run writes into the context only text the lead supplied or saw at the consent gate (#961).** The context the run writes comes from three sources only: the gate-shown text; in discovery mode, the discovery document and every resolved ticket, verbatim, with their reasoning; and the attached plan, word for word. The split reasoning and the deferred scope are therefore shown at the consent gate beside the objective and the summary. The run adds no model prose the lead did not see, and never copies the lead's typed capability description. The lead confirmed at clarification that losing the typed description in intent mode is acceptable. **Why:** #853 makes the context part of what the lead asked for. If model-written reasoning the lead never saw went into the context, a later promotion could cite it as asked, which turns the model's inference into the lead's request. A later commit diff is not a gate. Typed intent may hold a pasted credential, and the razor forbids it from leaving the run folder, so committing it into a shared repository would break that rule. **Refuted alternative:** Show only the summary at the gate, as #851 says today, and let the lead review the full context in the commit diff. That keeps the gate short. It lost because a diff nobody is required to read becomes the only human check on text that later plans cite as asked.
- **D3 — The summary is consented at the existing gate, and the pointer's number is filled in the run's existing single body edit (#961).** The summary and the context pointer are drafted at the existing consent gate, with the number still to come, and both are repeated inside the consent question. The body is filed with a placeholder for the number. The number is filled in the same post-filing edit that already writes the stub numbers into the initiative. The context goes into the store only after the initiative exists. The run folder stays until the context is in place, so a repeat run finishes the job without filing a second initiative. **Why:** The folder name depends on an issue number that does not exist at the gate. Reusing the one edit the run already makes adds no new body-edit path and keeps the rule that the initiative body is never edited after the run. Repeating the proposal inside the question follows the rule that the lead must not consent to a sentence they could not see. **Refuted alternative:** Name the folder by a slug fixed at the gate, so the pointer is final before filing and the body needs no fill. It lost because readers would then have to parse the location out of the body, and a hand-written context for an older initiative would have no conventional place to go.
- **D4 — A design plan is attached by a new argument on the epic stage, checked before drafting, fed to the decomposition, and kept only when an initiative is filed (#961).** The epic stage takes a new argument that names a plan file. It is accepted only in intent mode and discovery mode, because only those modes can file a new initiative; promotion mode and import mode refuse it and say why. A missing or empty file is refused before anything is drafted, and the refusal names the file. The plan joins the decomposition's run source text after the typed description, so the split, the objective and the reach statements may cite it as asked; the lead chose this at clarification. The plan's name is shown beside the proposed objective inside the consent question. The plan is copied word for word into the context only when the lead accepts the initiative. On a decline, a repository that files flat only, a one-goal split, or a scope that fits a single epic, the run says the plan was kept nowhere. **Why:** Every one of those paths files no initiative, so there is nowhere for the plan to travel, and saying so stops a lead from thinking it was kept. The check before drafting mirrors the refusal import mode already gives for a missing design document. Feeding the plan to the decomposition avoids the lead pasting the same plan into the description to get it used. **Refuted alternative:** Reuse the existing assets argument to carry the plan. It lost because assets are published to an external store and referenced from issue bodies, and the plan must stay in the repository and never reach an issue.
- **D5 — One context lookup serves stub planning and the decision record, and a pointer with no folder stops the run (#961).** Both stages find the context the same way. They read the issue's parent with the parent query promotion already uses for successors, check the parent for the initiative marker, and read the initiative body and every file in its context folder, verbatim, in name order. When the body carries a context pointer but the checkout has no folder, the run stops before drafting, names the expected location, and says the folder is probably not committed or not pulled. A hand-written folder with no pointer is read the same as a filed one. **Why:** The usual cause of a missing folder is an uncommitted or unpulled copy on a teammate's machine, which one pull fixes. Planning on without it would silently produce the re-derived draft this epic exists to prevent. Reading every file in the folder covers #832's layout, one plan file with any name. Both stages need the same answer, so one rule prevents drift between them. **Refuted alternative:** Warn and continue with the body alone. That never blocks a lead. It lost because the warning sits in a long run's output while the draft is built without the decisions the lead was promised.
- **D6 — Promotion widens the run source text, but scope stays bounded by the stub's goal (#961).** In promotion mode, the run source text is the stub body, then the initiative body, then each context file, each under a heading naming its origin. The razor's definition of promotion-mode source text changes to match, and an item drawn from the context can be cited as asked. An item the context assigns to another child of the same initiative goes under Out of Scope, naming that stub, and never becomes a story. The reading list is built from the stub body and the draft, not from the context. **Why:** The planning gate files an asked-for story by default, and an unticked asked story defers as a new stub. Without the bound, a plan covering the whole initiative would let one stub's draft claim a sibling's work as asked, and that work would be filed twice or deferred into a duplicate stub. The reading list is capped at seven pages with direct matches first, and a whole-initiative plan would crowd out the pages this stub needs. **Refuted alternative:** Pass the context to the drafting model as background only, outside the run source text, so it can never be cited as asked. That keeps the source strictly the stub body. It lost because the epic wants settled decisions to land as asked items, as #853's notes say.
- **D7 — The decision-record stage reads the context as settled input, the way it reads discovery gists (#961).** The decision-record stage gets a new step before analysis, on every path (normal, import and revision). It runs the context lookup on the epic and passes the result to the architect as decisions already settled. The architect states each settled decision with its reasoning and does not reopen it. A settled decision with no reasoning becomes an open clarification. Where the approved epic contradicts the context, the epic wins and the record names the departure. **Why:** This copies a pattern that already works, the discovery-gist read, with its rule that the stage never invents a missing reason. The epic is approved after the context was written, so it is the later human decision. **Refuted alternative:** none
- **Move the one excluded-store definition into @nexus/workspace and make the pull-request libraries' range and landed-change diffs read it.** (a decision stub the verdict on sameera/nexus#962 confirmed). **Why:** Close's range diffs were a second, hard-coded statement of the set (G2). **Refuted alternative:** Add the initiative store to each hard-coded copy.
- **nexus initiative-context path|pointer prints the folder .nexus/initiatives/initiative-<n> and the pointer sentence.** (a decision stub the verdict on sameera/nexus#962 confirmed). **Why:** The readers must recognise exactly the pointer the epic stage writes, so its shape lives in code once. **Refuted alternative:** Write the folder and the sentence out in the command body.
- **A kept plan is filed as plan-<its name>, copied with cp.** (a decision stub the verdict on sameera/nexus#962 confirmed). **Why:** The context folder also holds context.md and discovery.md, which a plan of the same name would overwrite. **Refuted alternative:** Keep the plan under its own name, or in a subfolder.
- **nexus initiative-context lookup implements D5 in code for both stages, resolving the store in the issues checkout (the hub in a workspace).** (a decision stub the verdict on sameera/nexus#962 confirmed). **Why:** Two command bodies following prose would drift; a member checkout must find the folder the hub-side run wrote. **Refuted alternative:** Spell the gh parent query and folder read out in each command body.
- **A context folder with no files is treated as absent, so a pointer over an empty folder stops the run.** (a decision stub the verdict on sameera/nexus#962 confirmed). **Why:** An empty folder holds none of the decisions the pointer promises. **Refuted alternative:** Read an empty folder as a found context with no files.
- **The consent question repeats the split table, so context.md holds nothing the question did not show (G5).** (a decision stub the verdict on sameera/nexus#962 confirmed). **Why:** The split table carries each goal's estimate and candidate stories, which a later promotion reads. **Refuted alternative:** Drop the split table from context.md.

## Deviation Rationale

- **Departs from record #961 D5 — sameera/nexus#962 DV2.** The context lookup reads the parent through close's issue-facts reader and initiative check (fetchIssueFacts, isDeclaredInitiative), not the parent query promotion already uses for successors. **Why:** The implemenation uses one way of reading epic-repo across stages, and support for GitHub Enterprise hosts. **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/962#issuecomment-6738802277)

## Waived Stories

none

## Deferred Scope

none
