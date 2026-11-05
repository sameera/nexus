---
title: "Close Record: nexus implement builds from the /nxs.hld page when the record has one"
epic: "#971"
feature: "Unattended Epic Implementation"
date: 2026-11-05
nexus_version: 0.127.0
analyze: ran 2026-11-05 @ 450fdbf9493cd1b58e2556c8ea624f00d14239e2
record: "#986"
record_hash: 55124994eed0e89b8a4784320c705a2cd138d2a4d6207a8914eddc09ac58d4de
range:
  - repo: sameera/nexus
    pr: 989
    base: 41474fcd4199616a10e82339c1352ca21c73f6ca
    head: cd3b2baad9f35d9159d63151934a61155f88e48e
story_ranges:
  - story: "#982"
    ranges:
      - { repo: sameera/nexus, pr: 989, base: 41474fcd4199616a10e82339c1352ca21c73f6ca, head: cd3b2baad9f35d9159d63151934a61155f88e48e }
  - story: "#983"
    ranges:
      - { repo: sameera/nexus, pr: 989, base: 41474fcd4199616a10e82339c1352ca21c73f6ca, head: cd3b2baad9f35d9159d63151934a61155f88e48e }
  - story: "#984"
    ranges:
      - { repo: sameera/nexus, pr: 989, base: 41474fcd4199616a10e82339c1352ca21c73f6ca, head: cd3b2baad9f35d9159d63151934a61155f88e48e }
  - story: "#985"
    ranges:
      - { repo: sameera/nexus, pr: 989, base: 41474fcd4199616a10e82339c1352ca21c73f6ca, head: cd3b2baad9f35d9159d63151934a61155f88e48e }
landed_check:
  - story: "#982"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 989, result: unchanged }
  - story: "#983"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 989, result: unchanged }
  - story: "#984"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 989, result: unchanged }
  - story: "#985"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 989, result: unchanged }
---

# Close Record: nexus implement builds from the /nxs.hld page when the record has one

## Key Decisions

- **D1 — The newest trusted, marked comment is the only candidate (#986).** An HLD comment counts only when its first line is exactly the /nxs.hld marker and its author passes the maintainer rule close already uses, reused rather than copied. Untrusted comments are removed before recency is applied. The newest is chosen by the platform's creation time, across every comment page. Older HLD comments are never used, even when the newest is stale or flagged. No HLD comment at all is silent. **Why:** The page is fed to an agent running unattended with broad permissions. Without the trust filter, anyone who can comment on the record can steer the build, because the digest is public and a forged comment can look current. Filtering before recency means an untrusted comment can never hide a trusted one. Only the newest counts because a re-render supersedes the earlier page by the /nxs.hld contract. **Refuted alternative:** Trust any comment, and instead require the link to point at the store the team configured. It needs no author lookup. It lost because a team may move its store, which would make every older page unreadable, and because a stranger could still post a comment that points to a real but superseded page.
- **D2 — Failing to read the record's comments stops the run (#986).** If the record's comments or its current digest cannot be read, the run stops before the branch exists. It does not treat this as "no HLD comment". **Why:** Treating a failed read as absence would build without the design the lead reviewed, with no sign in the output. That is the outcome this epic exists to prevent. **Refuted alternative:** none
- **D3 — The stale and violation checks read only the comment, run before the page is fetched, and fail closed (#986).** The order is fixed: the stale check, then the verdict check, then the page fetch. Stale means the digest is missing, unreadable, or different from the record's current digest, which comes from the one digest program. Flagged means any verdict other than the clean verdict, so a criterion that cannot be met or an unreadable verdict line also counts. A stale or flagged page is ignored. The run prints one line with the reason and continues from the record alone. It never fetches that page. **Why:** The epic's assumption makes these checks comment-only. Running them first means a stale page in an unreachable store never stops the run. The verdict line is free text, so only an exact clean match is safe. /nxs.hld defines a criterion that cannot be met as a violation, so the wider check matches the page's own definition. **Refuted alternative:** Search the verdict for a non-zero violation count and accept everything else. It is closer to the story's literal wording. It lost because a reworded or empty verdict would then pass as clean.
- **D4 — The run reads the raw text at the pinned commit, worked out from the single page link, under the lead's own access (#986).** The run takes the store repository, the commit and the path from the comment's one design link. It reads the file's raw content at that commit through the platform's contents API, with the lead's authenticated GitHub CLI. This works for a private store. The link is parsed by the inverse of the address the publisher builds, kept beside it, so a change to that address breaks a test. No subcommand is added to the assets command, and the store setting and its visibility are not consulted. **Why:** This is the read path /nxs.hld itself documents for agents. The commit pins the bytes, so the text is the page the lead previewed. The rendered page is HTML around the Markdown, so it is the wrong input. **Refuted alternative:** Read the raw-content host address built from the link. It is simpler, but it fails on a private store without a separate token.
- **D5 — An unreadable page stops the run before the branch exists, and the question is answered by running again with the record-only option (#986).** If a current page cannot be read, the run exits non-zero before the clean-tree check and before the branch is created. The output says the page could not be read and why. It asks whether to build from the record alone and names the record-only option as the way to say yes. Running again with that option skips the HLD lookup entirely and prints one line saying so. **Why:** The run refuses when its branch exists. A stop after branch creation would block the very re-run the story prescribes. An unattended run cannot wait for an answer, so the answer has to be something the lead can pass to the next run. A new option is the smallest such input. **Refuted alternative:** Continue from the record alone with a warning, as for a stale page. It needs no new option. It lost because the lead approved a current design, and building without it silently is the outcome the story rejects.
- **D6 — The command reads the page once and gives the agent a local copy, not the link (#986).** The command writes the page text it read to a page copy in the epic's gitignored scratch folder, in the checkout the agent works in. The prompt names that copy and the pinned link it came from. If git does not ignore that folder, the run stops before the branch is created, with the same remedy distill names. **Why:** The command must read the page anyway to decide whether to stop (D5). Handing over the bytes it checked means the agent cannot re-fetch differently, fail mid-build, or parse the URL itself. A file is used instead of prompt text because one command-line argument has a size limit an HLD page could exceed. A file also works unchanged for both harnesses. **Refuted alternative:** Give the agent the pinned link and let it read the page itself, as the /nxs.hld skill says an agent can. It avoids a local file and a gitignore dependency. It lost because the read happens twice, the second read can fail after the branch exists, and the model would be parsing the link.
- **D7 — One prompt paragraph, added only for a current page; otherwise the prompt is byte-identical to today's (#986).** With a current page, the implementation prompt gains one paragraph. It tells the agent to read the page copy and follow its architecture, mechanisms, data and delivery plan. It says the decision record is binding wherever the page and the record disagree. It says the page's choices the record left open, and the answers the page assumed for its own open questions, guide the build but bind nothing. It says the page's delivery plan never overrides one commit per story in blocked-by order. It says not to judge whether the page is correct. In every other case (no comment, stale, flagged, record-only option) the prompt is exactly today's. The fix-round prompt is not changed. **Why:** A byte-identical prompt is what the third success metric needs, and it can be tested. Stating which parts bind is what #985's Notes ask for. Open questions carry recommended answers the lead never decided, so they get the same "guides, binds nothing" status as open choices. The command checks the commit structure, so the page must not be able to undermine it. **Refuted alternative:** In the stale case, also tell the agent to ignore any HLD comment it might see on the record. It would guard against the agent finding the comment. It lost because it breaks prompt identity, and the agent reads the record without its comments today.
- **isCleanVerdict compares exactly after removing wrapping */_ emphasis and one trailing full stop** (a decision stub the verdict on sameera/nexus#989 confirmed). **Why:** the /nxs.hld preview prints the clean verdict in italics, so a byte match would ignore a clean page for formatting alone **Refuted alternative:** a byte-exact match with no normalisation

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
