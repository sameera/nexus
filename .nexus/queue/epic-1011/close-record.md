---
title: "Close Record: An Initiative Keeps Its Planning Context on Its Own Issue"
epic: "#1011"
feature: "Scope Discipline"
date: 2026-11-14
nexus_version: 0.134.0
analyze: ran 2026-11-11 @ 5466a82d7c8e52d0ec6ba6f668801afff0dbf7f3
record: "#1016"
record_hash: 1a1e5e4bf76ef90ce70503e1a749d0070c1372fd7a42433e9e921d37f708bee2
range:
  - repo: sameera/nexus
    pr: 1020
    base: 1276d4f72d01651df33ca2ec36e145682ede2038
    head: 8fcb0c1ce552a98702dc249426895583f49a3288
  - repo: sameera/nexus
    pr: 1021
    base: 8fcb0c1ce552a98702dc249426895583f49a3288
    head: f1a2d5cda6b510b5b1195a5a822f8d0862e8d1ce
story_ranges:
  - story: "#1012"
    ranges:
      - { repo: sameera/nexus, pr: 1020, base: 1276d4f72d01651df33ca2ec36e145682ede2038, head: 8fcb0c1ce552a98702dc249426895583f49a3288 }
      - { repo: sameera/nexus, pr: 1021, base: 8fcb0c1ce552a98702dc249426895583f49a3288, head: f1a2d5cda6b510b5b1195a5a822f8d0862e8d1ce }
  - story: "#1013"
    ranges:
      - { repo: sameera/nexus, pr: 1020, base: 1276d4f72d01651df33ca2ec36e145682ede2038, head: 8fcb0c1ce552a98702dc249426895583f49a3288 }
      - { repo: sameera/nexus, pr: 1021, base: 8fcb0c1ce552a98702dc249426895583f49a3288, head: f1a2d5cda6b510b5b1195a5a822f8d0862e8d1ce }
  - story: "#1014"
    ranges:
      - { repo: sameera/nexus, pr: 1020, base: 1276d4f72d01651df33ca2ec36e145682ede2038, head: 8fcb0c1ce552a98702dc249426895583f49a3288 }
      - { repo: sameera/nexus, pr: 1021, base: 8fcb0c1ce552a98702dc249426895583f49a3288, head: f1a2d5cda6b510b5b1195a5a822f8d0862e8d1ce }
landed_check:
  - story: "#1012"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1020, result: unchanged }
      - { repo: sameera/nexus, pr: 1021, result: unchanged }
  - story: "#1013"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1020, result: unchanged }
      - { repo: sameera/nexus, pr: 1021, result: unchanged }
  - story: "#1014"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1020, result: unchanged }
      - { repo: sameera/nexus, pr: 1021, result: unchanged }
waivers:
  - { repo: sameera/nexus, pr: 1020, cause: finding, id: F3, severity: high, author: sameera, url: "https://github.com/sameera/nexus/pull/1020#issuecomment-6868944743" }
---

# Close Record: An Initiative Keeps Its Planning Context on Its Own Issue

## Key Decisions

- **D1 — The context lives on the initiative, all in the body or all in parts (#1016).** If the whole initiative body, including the full context text, fits within the body limit, the context sits in the body below the context summary as a collapsed context block. Otherwise the whole context text goes to numbered context parts, and the body keeps the summary plus a visible sentence giving the part count. The context is never split between the body and the comments. **Why:** Each initiative's context lives in one place, so the reader has two cases and one digest scheme covers both. The context lasts as long as the issue, and every teammate sees it at once. That removes both failures the epic names: a pointer to a deleted folder, and a context that teammates cannot see until it is pushed. **Refuted alternative:** Publish the context as a file in the issue asset store and link it at a pinned commit. A pinned commit cannot be changed after the fact and has no size limit. It lost because the asset store is optional: a repository with no declared store is unsupported, as the issue-asset-store page's invariant 3 states, so those repositories would need a second mechanism. The link would also again point at a file the reader must be able to reach, which is the dependency the epic's first success metric removes.
- **D2 — A hidden first-line marker identifies each part, and its number sets the order (#1016).** Each context part opens with a part marker that gives its number and the total count. The parts are joined in marker order. The context text is split on line boundaries, preferring the boundaries between source headings. Size is measured conservatively, with headroom so that the run's later stub-number edit cannot push the body over the limit. **Why:** Posting time cannot set the order, because a repeated run may post a missing middle part after later ones. A hidden marker keeps the rendered comment readable. The marker counts only as the first line, so a marker-like line inside a plan's text is never read as a part. **Refuted alternative:** Order the parts by posting time, with no number. It is simpler and needs no marker, but it lost because a repeated run that fills a gap would reorder the context.
- **D3 — The body records each part's digest, and the reader checks it (#1016).** When the initiative is filed, its body carries a part record. For an inline context it holds the canonical digest of the collapsed context block. For parts it holds the number of parts and the canonical digest of each part. The reader recomputes each digest, and any mismatch counts as changed after filing. **Why:** The context text is complete before filing, so the part record is written into the body at filing and needs no extra edit. The record sits in the body, apart from the parts, so editing a part does not also update its stored digest. One digest rule across Nexus avoids a second normalisation that could drift. **Refuted alternative:** Detect edits from the platform's edited marker on each comment. It needs no record, but the decision-record page already states that the platform's edit history is not reliably retrievable by tooling. It also cannot cover the inline case, because the run's own stub-number edit always marks the body as edited.
- **D4 — A repeated run checks existing comments before posting, and each part is verified as posted (#1016).** Before posting a part, the run reads the initiative's comments, and skips the part if a trusted comment with the same part number and a matching digest already exists. After posting a part, the run reads it back and checks its digest. Every part is posted and verified before the first stub is filed. The run folder is kept until the run completes. **Why:** The issue itself is the record of what landed, so a lost or stale local record cannot cause a double post. Posting the parts before the stubs means no stub exists for anyone to plan while the context is incomplete. **Refuted alternative:** Track posted parts in the filer's existing local ledger, as stubs are tracked today. It is consistent with stub filing, but it lost because a ledger records what was attempted, not what landed: a part posted just before the run dies would be posted twice.
- **D5 — Trust reuses the one owner, member and collaborator rule, applied before matching (#1016).** A context part is read only when its author is a trusted author, under the rule close and the implement command apply. Untrusted marker comments are removed before parts are matched to numbers, and each is reported with its author. A trusted part that the part record does not list is ignored and reported. The body itself is not checked for trust. **Why:** A second trust rule would drift from the first. Removing untrusted comments first means a stranger's comment can never displace a trusted part. Only the issue's author and maintainers can edit the body. **Refuted alternative:** Require each part's author to be the initiative's author. It is stronger, but it lost because it fails when a co-lead resumes an interrupted run or a maintainer performs the migration. The digest check already rejects any text that differs from what was filed.
- **D6 — Both stages share one context lookup that reads only the issue (#1016).** The existing context lookup keeps its outcomes and its output shape, and reads only from the initiative issue, through the configured issues repository. It stops before drafting on a missing part, a digest mismatch, or comments that cannot be read, and it names the initiative and the part. The stop for a mismatched part says the part is restored by editing it back to its filed text. A deleted part is accepted as unrecoverable. With no context it reports that no additional context was found. **Why:** Planning then needs nothing from the checkout, and one lookup keeps the epic stage and the decision-record stage from disagreeing. Treating a read failure as no parts would silently plan without the decisions the context carries. The lead chose to keep the stop for a deleted part rather than plan with the verified parts, because editing an initiative's context after filing is out of scope. **Refuted alternative:** none
- **D7 — A legacy folder pointer stops the run, and the folder is never read as a fallback (#1016).** A body that still carries a legacy folder pointer stops planning and design before drafting. The stop names the initiative and the folder, and says the context must be moved onto the issue. The checkout is never read. The release entry says in words that this is a breaking change, and gives steps that repeat the #997 procedure. **Why:** Releases 0.120.0 and 0.127.0 shipped the folder store to adopters, so folder-based initiatives may exist outside this repository. Reading the body alone would silently drop their context. Reading the folder would break #1014's commitment that no stage reads a folder. The lead chose changelog steps over a migration command. **Refuted alternative:** Keep reading the folder for legacy pointers for one release. It is gentler for adopters, but it lost because it keeps the folder reader that #1014 retires, and it brings back the checkout dependency for exactly those initiatives.
- **D8 — #997 is migrated once by hand, with no migration command shipped (#1016).** The maintainer renders #997's folder text through the same rendering that filing uses. It is about 2,000 characters, so it goes inline. The maintainer replaces the legacy folder pointer with that block and its part record in one body edit, confirms that the new context lookup reads it back with no stop and that the text equals the folder, and only then deletes the folder. **Why:** The epic assumes #997 is the only initiative filed with a folder, so one run is needed. Reusing the filing rendering means the migrated block cannot differ from what a new filing produces, and the reader's own digest check verifies that the text is unchanged. **Refuted alternative:** Ship a migrate command that moves any folder onto its issue. Adopters could reuse it, but it lost because the epic assumes one initiative, so it would be code written for one run, and the lead chose changelog steps for adopters instead.
- **D9 — The store is retired from the one shared list of excluded stores, and the folder code is deleted (#1016).** Remove the initiative store from the shared definition of the stores the gates leave out, so the lists in analyze, close and distill shrink from that one source. Delete the folder writing, folder reading, folder path output and pointer sentence output. Remove the epic stage's instruction to commit the folder. Keep the check on an attached design plan, which now travels in the context text. Delete #997's folder in the same change. **Why:** Membership of that set is a reviewed code change made in one place, so retiring a store is the reverse change in the same place. A store left in the set with nothing in it would mislead. **Refuted alternative:** none
- **Context-block markers and the locate rule live in @nexus/delivery-config/context-block, shared by the story filer, stub rewrite and readers** (a decision stub the verdict on sameera/nexus#1020 confirmed). **Why:** portable-tools depends on delivery-config, so only the lower library can serve both **Refuted alternative:** Copy the markers into the story filer.
- **The shared Runner takes an optional input; postParts runs gh issue comment --body-file - with the part on stdin** (a decision stub the verdict on sameera/nexus#1020 confirmed). **Why:** No file is staged anywhere, so an interrupted run leaves nothing in the adopter's checkout **Refuted alternative:** Stage the part under os.tmpdir(), which a snap-confined gh cannot read.
- **The story filer neither rewrites nor reports refs inside the context (pass 3 skips the collapsed context)** (a decision stub the verdict on sameera/nexus#1020 confirmed). **Why:** The context is planning text kept as filed; reporting its refs would make every re-run end INCOMPLETE **Refuted alternative:** Skip rewriting but still report unresolved refs inside the context.
- **isTrustedAssociation stays the store's one entry point and calls trustedComment from close-record** (a decision stub the verdict on sameera/nexus#1021 confirmed). **Why:** The store and the lookup keep one call shape while the rule itself lives only in close (D5) **Refuted alternative:** Import MAINTAINER_ASSOCIATIONS and compare locally
- **Context-block markers and the locate rule live in @nexus/delivery-config/context-block** (a decision stub the verdict on sameera/nexus#1021 confirmed). **Why:** portable-tools depends on delivery-config, so only the lower library serves both editors and readers **Refuted alternative:** Copy the markers into the story filer
- **Context parts go to gh on standard input via the shared Runner's input** (a decision stub the verdict on sameera/nexus#1021 confirmed). **Why:** No file is staged, so an interrupted run leaves nothing in the checkout and a sandboxed gh needs no path **Refuted alternative:** Stage the part under os.tmpdir()
- **The story filer neither rewrites nor reports refs inside the collapsed context** (a decision stub the verdict on sameera/nexus#1021 confirmed). **Why:** The context is planning text kept as filed; reporting its refs would make every re-run end incomplete **Refuted alternative:** Skip rewriting but still report unresolved refs inside the context

## Deviation Rationale

- **Departs from record #1016 G20 — sameera/nexus#1020 DV1.** The shared excluded-stores list still withholds .nexus/initiatives, labelled legacy, so analyze, close and distill still leave the initiative store out of their diffs. **Why:** handled in #1021 **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1020#issuecomment-6810699432)
- **Departs from record #1016 G21 — sameera/nexus#1020 DV2.** nexus initiative-context still ships the path and pointer subverbs, which print a context folder path and the folder pointer sentence. **Why:** handled in #1021 **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1020#issuecomment-6810699432)
- **Departs from record #1016 D5 — sameera/nexus#1020 DV3.** The lookup checks trust with its own copied OWNER/MEMBER/COLLABORATOR list instead of reusing the rule close applies. They agree today but can drift. **Why:** handled in #1021 **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1020#issuecomment-6810699432)
- **Departs from record #1016 D9 — sameera/nexus#1020 DV4.** The /nxs.epic overview still says the initiative keeps its context in a committed folder which the lead commits. D9 removes the epic stage's instruction to commit it. **Why:** handled in #1021 **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1020#issuecomment-6810699432)
- **Departs from record #1016 G18 — sameera/nexus#1020 DV5.** A trusted comment with a listed part number and a digest the record does not hold is skipped without being reported as ignored. **Why:** only a duplicate trusted part marker with a wrong digest goes unreported; it is still never read, so the context stays correct. Reporting it is a follow-up fix. **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1020#issuecomment-6868944743)
- **Departs from record #1016 release-changelog page, invariant 2 — sameera/nexus#1020 DV6.** The 0.133.0 changelog items name the folder .nexus/initiatives, a repository file path, which the page says no item may name. **Why:** the release-notes suite's file-path rule covers files, not folders, and G22's migration steps must name the .nexus/initiatives folder for adopters. **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1020#issuecomment-6868944743)

## Waived Stories

none

## Deferred Scope

none
