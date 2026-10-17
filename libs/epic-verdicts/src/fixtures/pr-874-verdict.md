Conformance: Analyze owns every judgment, and the engineer answers on the pull request (.nexus/tmp/epic-829)  ·  epic #829
Mode: full (record #871 @ 2507c820871871b3ca8ed257b57d3a859f6efb4cc0724ccba282fb13eed7cb77)
Surface: 56 files changed, 6 stories (0 closed / 6 open)

Per-story AC conformance:
  STORY #858 Analyze names every departure from the decision record: 4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY #859 Analyze judges the whole epic on the pull request that completes it: 5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY #860 An engineer answers a departure or a finding on the pull request: 6/6 met · 0 partial · 0 unmet · 0 contradicted
  STORY #861 Analyze records answers without judging unchanged code again: 5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY #862 The pull request's verdict carries what close writes into its record: 5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY #863 Analyze run without a pull request reports in the terminal only: 3/3 met · 0 partial · 0 unmet · 0 contradicted

Departures:
  DV1 no longer found · unanswered (fixed in aafbee6: key() compares owner/name, so the analyzed pull request is recognized as itself; G30 held)
  DV2 no longer found · unanswered (fixed in aafbee6: only the results' file lists are dropped and a body still too large is refused; G6 held)
  DV3 (critical) accepted by @sameera (https://github.com/sameera/nexus/pull/874#issuecomment-5981262993): a change in the epic-level state forces a full run so the success metrics are judged (G30); G18's "reads no code" yields to G30 when the two conflict
Findings:
  F1 (low) G39 · utils/implement-epic.sh stop_on_new_answers compares comment links, so an answer added by editing a comment that already held one does not stop the run.
  F2 (low) ID registry read · verdict-items.ts readItemRegistry calls verifyReceipt without ghRepo, unlike every other verdict and answer read.
Recorded:
  Recording answers on a moved head: 13 file(s) changed in the pull request's own change since 6e6470cf5f6d: CHANGELOG.md, components/commands/nxs.analyze.md, libs/epic-verdicts/src/diagnostic.ts, libs/epic-verdicts/src/epic-completion.spec.ts, libs/epic-verdicts/src/epic-completion.ts, libs/epic-verdicts/src/publish-check.spec.ts, libs/epic-verdicts/src/publish-check.ts, libs/portable-tools/bundle-fingerprint.json, libs/portable-tools/payload-manifest.json, libs/portable-tools/src/analyze-close-carry.spec.ts, libs/portable-tools/src/nexus-cli.ts, libs/pr-acceptance/src/judgments-block.spec.ts, libs/pr-acceptance/src/judgments-block.ts.
  Judging again: DV1, DV2, DV3; #858 AC1, #858 AC2, #858 AC3, #858 AC4, #859 AC1, #859 AC2, #859 AC3, #859 AC4, #859 AC5, #860 AC1, #860 AC2, #860 AC3, #860 AC5, #860 AC6, #861 AC1, #862 AC1, #862 AC2, #862 AC3, #862 AC4, #862 AC5, #863 AC1, G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G11, G12, G13, G14, G15, G16, G17, G18, G19, G20, G21, G22, G23, G24, G25, G26, G27, G28, G29, G30, G31, G32, G33, G34, G35, G36, G37, G38, G39, G40, G41, G42, G43, G44, G45, G46, G47, G48, G49, Close can write its key decisions and deviation rationale from the verdict alone, Every departure in a merged pull request was answered before the merge, Answering a departure with no code change takes an analyze run that reads no code, An epic's success metrics are judged on a pull request before the epic's last merge.
  Checking for new departures and against every guarantee: CHANGELOG.md, libs/epic-verdicts/src/diagnostic.ts, libs/epic-verdicts/src/epic-completion.spec.ts, libs/epic-verdicts/src/publish-check.spec.ts, libs/portable-tools/bundle-fingerprint.json, libs/portable-tools/payload-manifest.json, libs/portable-tools/src/analyze-close-carry.spec.ts, libs/pr-acceptance/src/judgments-block.spec.ts (named by no file list).
  Everything else is carried forward unchanged.
Answers not applied:     none
Key decisions:           D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13 @ 2507c820871871b3ca8ed257b57d3a859f6efb4cc0724ccba282fb13eed7cb77
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The judgments block is JSON in a fence longer than any backtick run — Deployed readers parse only the first fence after the verdict marker, and JSON escapes copied answer text (refuted: A nested YAML block)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The toolkit numbers departures, not the model — G6 needs the same ID on a re-run (refuted: The model reuses IDs it reads from the last verdict)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: Every number ever issued stays in the registry — Keeping the full list makes next-unused never reuse a number (refuted: Keep only answered items plus a counter key)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The publish check requires the judgments block on every verdict — A verdict without it would reset the registry (refuted: Accept a missing block as no departures)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The completion check and the epic-number redirect are toolkit verbs — Analyze and close must agree on what shipped (refuted: The stage reads each story's pull requests with gh in prose)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A sibling the head cannot be checked against is not run, never a stop — D10 names a blocking finding as the outcome (refuted: Stop the run on a missing member checkout)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: With a story merged and no completing pull request open, the redirect names no target — D11 runs the local check only when no story has merged (refuted: Fall back to the ordinary local check)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The local run keeps its success-metric rule — D10 scopes the three outcomes to the completing pull request (refuted: Apply the three outcomes to local runs too)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The ledger gate goes with the combined change set — The combined change set was its last caller (refuted: Keep it as unused code until #830)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: Answer lines are read in the same comment pass as waivers — D3 forbids a second comment reader (refuted: A separate readPrAnswers with its own gh call)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The ID step also applies the answers and prints the open counts — The open counts must agree with the block the publish check reads (refuted: The stage reads the comments and decides)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: Newest trusted well-formed answer wins; ill-formed ones are named, never revoke — G10 and G11 require naming every answer that applies nothing (refuted: Take the newest trusted line per ID first)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The publish check requires counts equal to the open items — G15 makes the counts open-only (refuted: Keep the under-count check only)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A waiver drops off a finding re-found as medium or low — G13 lets only a critical or high finding be waived (refuted: Carry the waiver forward)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The implement scripts detect a posted answer by comment link, not time — Comparing links avoids clock skew (refuted: Filter comments by a local-clock --since timestamp)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The answer-recording run's scope is a separate verb, handed back to the ID step — The stage must know the mode before it reads code (refuted: One verb that decides and merges)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A change in the epic-level state forces a full run — A pull request that became the completing one must have its metrics judged (refuted: Treat only the story set as the trigger)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A verdict with judgments but no results makes a --resolve run full, even on the same head — G24 needs every verdict to carry every result (refuted: Carry the empty result set forward)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: Own change is measured from the pull request's current base for both heads — A trunk merge or rebase changes nothing by itself (refuted: Diff the two heads directly)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A deferral is drafted on the item it would settle — The draft has no IDs yet, so drafting on the parent ties the two (refuted: A separate deferred list naming its parent by index)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The size budget is applied inside nexus verdict-check — The whole body's size is known only at publish time (refuted: A separate nexus verdict-fit verb)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: Copied text is kept out of both parsers by escaping and a uniqueness check — A marker in the summary would make the first-occurrence parser read prose (refuted: Make each reader search for the last marker)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: The local result line's form, and where the implement scripts capture reports — A key=value line is unambiguous and the capture dir is invisible to distill and close (refuted: Capture under the system temp directory)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: Delete the epic receipt writer and reader outright — Its reader had no caller and its writer's only caller was removed (refuted: Keep the module and stop calling it)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A moved-head scope applies the posted answers before picking what to judge again — G19 says every answered departure is judged again (refuted: Treat any answer line naming the ID as answered)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A verdict over the size limit drops only the results' file lists; a body still over the limit is refused as verdict-too-large — bestMatch reuses an item's ID by a shared file, so dropping the items' lists re-numbered every item and lost its answer (G6); G29 already says a body still too large publishes nothing (refuted: Let bestMatch match on the anchor alone when the earlier verdict dropped its lists)
  stub .nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md: A pull request's identity leaves out the repository's host — nexus pr-worktree open writes the analyzed repository host-qualified and the claiming read writes owner/name, so the analyzed pull request was never recognized as itself (G30) (refuted: Strip the host in the CLI before calling epicCompletion)
Deferred scope:          none
Epic level:              Completes the epic: it covers every live story.
Success metrics:
  Close writes key decisions and deviation rationale from the verdict alone → unverifiable: the verdict carries them, but close still reads the diff until #830; a close run after #830 that reads no diff decides it
  Every departure in a merged pull request answered before the merge → met
  Answering a departure with no code change reads no code → met
  Success metrics judged before the epic's last merge → met
Scope drift:             new verb nexus pr-answers (serves D13); landed-change.ts refactor (compareChanges extracted, behaviour unchanged)
Notes:                   stories #858, #859, #860, #861, #862, #863 are still open; close them before /nxs.close

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 0 · low 2

<!-- nexus:analyze-receipt -->
```yaml
epic: "#829"
nexus_version: 0.91.0
issues_repo: sameera/nexus
repo: github.com/sameera/nexus
stories: [858, 859, 860, 861, 862, 863]
pr: 874
date: 2026-10-04
head: aafbee67850ad51badb7f5089885b97b1219132a
mode: full
record: "#871"
record_hash: 2507c820871871b3ca8ed257b57d3a859f6efb4cc0724ccba282fb13eed7cb77
findings: { critical: 0, high: 0, medium: 0, low: 2 }
```

<!-- nexus:analyze-judgments -->
```json
{
  "schema": 1,
  "items": [
    {
      "id": "DV1",
      "kind": "departure",
      "found": false,
      "severity": "critical",
      "departsFrom": "G30",
      "summary": "The completion check never recognizes the analyzed pull request as itself: key() compares the raw --repo value (host-qualified github.com/sameera/nexus, as the stage passes repoIdentity) with the claiming read's nameWithOwner (sameera/nexus). Re-running analyze on the most recently merged pull request of a fully merged epic, the target D11 names, lists that pull request as its own sibling, finds its merge commit absent from its head, and reports epic-level not-run with a remedy that cannot work, so no success metric is judged.",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ],
      "stub": null,
      "supersedes": null,
      "answer": null
    },
    {
      "id": "DV2",
      "kind": "departure",
      "found": false,
      "severity": "critical",
      "departsFrom": "G6",
      "summary": "When the size budget fires, withoutFileLists empties every file list, departures and findings included. bestMatch then matches an earlier item only on a shared file or two empty lists, so the next full run on the same head and record gives every departure and finding a new ID and lists the answered ones as no longer found, losing their answers.",
      "files": [
        "libs/epic-verdicts/src/publish-check.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/verdict-items.ts"
      ],
      "stub": {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "reason": "The size budget is applied inside nexus verdict-check: the whole body's size is known only at publish time"
      },
      "supersedes": null,
      "answer": null
    },
    {
      "id": "DV3",
      "kind": "departure",
      "found": true,
      "severity": "critical",
      "departsFrom": "D8",
      "summary": "decideAnswerMode adds two full-run triggers D8 does not list, epic-level-changed and results-unrecorded, and checks them before the unchanged-head test, so an answer-recording run with the head, record and story set unchanged can still judge in full and read code, which G18 says it never does.",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "components/commands/nxs.analyze.md"
      ],
      "stub": {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "reason": "A pull request that became the completing one must have its success metrics judged (G30), and carrying the earlier results forward would skip them"
      },
      "supersedes": null,
      "answer": {
        "verb": "accepted",
        "author": "sameera",
        "link": "https://github.com/sameera/nexus/pull/874#issuecomment-5981262993",
        "reason": "a change in the epic-level state forces a full run so the success metrics are judged (G30); G18's \"reads no code\" yields to G30 when the two conflict"
      }
    },
    {
      "id": "F1",
      "kind": "finding",
      "found": true,
      "severity": "low",
      "about": "G39 (unattended run stops on a posted answer)",
      "summary": "stop_on_new_answers compares the set of comment links holding answer lines before and after a fix round, so an answer the agent adds by editing a comment that already held one keeps its link and does not stop the run.",
      "files": [
        "utils/implement-epic.sh"
      ],
      "answer": null
    },
    {
      "id": "F2",
      "kind": "finding",
      "found": true,
      "severity": "low",
      "about": "ID registry read",
      "summary": "readItemRegistry calls verifyReceipt without ghRepo, unlike every other verdict and answer read, so in a checkout whose gh default repository is not the pull request's the registry reads as empty and numbering restarts at DV1/F1.",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts"
      ],
      "answer": null
    }
  ],
  "keyDecisions": {
    "record": {
      "digest": "2507c820871871b3ca8ed257b57d3a859f6efb4cc0724ccba282fb13eed7cb77",
      "format": "new",
      "decisions": [
        {
          "id": "D1"
        },
        {
          "id": "D2"
        },
        {
          "id": "D3"
        },
        {
          "id": "D4"
        },
        {
          "id": "D5"
        },
        {
          "id": "D6"
        },
        {
          "id": "D7"
        },
        {
          "id": "D8"
        },
        {
          "id": "D9"
        },
        {
          "id": "D10"
        },
        {
          "id": "D11"
        },
        {
          "id": "D12"
        },
        {
          "id": "D13"
        }
      ]
    },
    "stubs": [
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The judgments block is JSON in a fence longer than any backtick run",
        "reason": "Deployed readers parse only the first fence after the verdict marker, and JSON escapes copied answer text",
        "refuted": "A nested YAML block"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The toolkit numbers departures, not the model",
        "reason": "G6 needs the same ID on a re-run",
        "refuted": "The model reuses IDs it reads from the last verdict"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "Every number ever issued stays in the registry",
        "reason": "Keeping the full list makes next-unused never reuse a number",
        "refuted": "Keep only answered items plus a counter key"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The publish check requires the judgments block on every verdict",
        "reason": "A verdict without it would reset the registry",
        "refuted": "Accept a missing block as no departures"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The completion check and the epic-number redirect are toolkit verbs",
        "reason": "Analyze and close must agree on what shipped",
        "refuted": "The stage reads each story's pull requests with gh in prose"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A sibling the head cannot be checked against is not run, never a stop",
        "reason": "D10 names a blocking finding as the outcome",
        "refuted": "Stop the run on a missing member checkout"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "With a story merged and no completing pull request open, the redirect names no target",
        "reason": "D11 runs the local check only when no story has merged",
        "refuted": "Fall back to the ordinary local check"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The local run keeps its success-metric rule",
        "reason": "D10 scopes the three outcomes to the completing pull request",
        "refuted": "Apply the three outcomes to local runs too"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The ledger gate goes with the combined change set",
        "reason": "The combined change set was its last caller",
        "refuted": "Keep it as unused code until #830"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "Answer lines are read in the same comment pass as waivers",
        "reason": "D3 forbids a second comment reader",
        "refuted": "A separate readPrAnswers with its own gh call"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The ID step also applies the answers and prints the open counts",
        "reason": "The open counts must agree with the block the publish check reads",
        "refuted": "The stage reads the comments and decides"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "Newest trusted well-formed answer wins; ill-formed ones are named, never revoke",
        "reason": "G10 and G11 require naming every answer that applies nothing",
        "refuted": "Take the newest trusted line per ID first"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The publish check requires counts equal to the open items",
        "reason": "G15 makes the counts open-only",
        "refuted": "Keep the under-count check only"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A waiver drops off a finding re-found as medium or low",
        "reason": "G13 lets only a critical or high finding be waived",
        "refuted": "Carry the waiver forward"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The implement scripts detect a posted answer by comment link, not time",
        "reason": "Comparing links avoids clock skew",
        "refuted": "Filter comments by a local-clock --since timestamp"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The answer-recording run's scope is a separate verb, handed back to the ID step",
        "reason": "The stage must know the mode before it reads code",
        "refuted": "One verb that decides and merges"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A change in the epic-level state forces a full run",
        "reason": "A pull request that became the completing one must have its metrics judged",
        "refuted": "Treat only the story set as the trigger"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A verdict with judgments but no results makes a --resolve run full, even on the same head",
        "reason": "G24 needs every verdict to carry every result",
        "refuted": "Carry the empty result set forward"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "Own change is measured from the pull request's current base for both heads",
        "reason": "A trunk merge or rebase changes nothing by itself",
        "refuted": "Diff the two heads directly"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A deferral is drafted on the item it would settle",
        "reason": "The draft has no IDs yet, so drafting on the parent ties the two",
        "refuted": "A separate deferred list naming its parent by index"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The size budget is applied inside nexus verdict-check",
        "reason": "The whole body's size is known only at publish time",
        "refuted": "A separate nexus verdict-fit verb"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "Copied text is kept out of both parsers by escaping and a uniqueness check",
        "reason": "A marker in the summary would make the first-occurrence parser read prose",
        "refuted": "Make each reader search for the last marker"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "The local result line's form, and where the implement scripts capture reports",
        "reason": "A key=value line is unambiguous and the capture dir is invisible to distill and close",
        "refuted": "Capture under the system temp directory"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "Delete the epic receipt writer and reader outright",
        "reason": "Its reader had no caller and its writer's only caller was removed",
        "refuted": "Keep the module and stop calling it"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A moved-head scope applies the posted answers before picking what to judge again",
        "reason": "G19 says every answered departure is judged again",
        "refuted": "Treat any answer line naming the ID as answered"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A verdict over the size limit drops only the results' file lists; a body still over the limit is refused as verdict-too-large",
        "reason": "bestMatch reuses an item's ID by a shared file, so dropping the items' lists re-numbered every item and lost its answer (G6); G29 already says a body still too large publishes nothing",
        "refuted": "Let bestMatch match on the anchor alone when the earlier verdict dropped its lists"
      },
      {
        "path": ".nexus/queue/epic-829/sameera/decisions-epic-829-analyze-owns-judgments.md",
        "choice": "A pull request's identity leaves out the repository's host",
        "reason": "nexus pr-worktree open writes the analyzed repository host-qualified and the claiming read writes owner/name, so the analyzed pull request was never recognized as itself (G30)",
        "refuted": "Strip the host in the CLI before calling epicCompletion"
      }
    ]
  },
  "results": [
    {
      "kind": "criterion",
      "about": "#858 AC1",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/portable-tools/src/nexus-cli.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#858 AC2",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#858 AC3",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#858 AC4",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#859 AC1",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#859 AC2",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#859 AC3",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#859 AC4",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "libs/epic-verdicts/src/close-ledger.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#859 AC5",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#860 AC1",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/waiver.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#860 AC2",
      "verdict": "met",
      "files": [
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#860 AC3",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#860 AC4",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#860 AC5",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#860 AC6",
      "verdict": "met",
      "files": [
        "utils/implement-epic.sh",
        "libs/portable-tools/src/nexus-cli.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#861 AC1",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "criterion",
      "about": "#861 AC2",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#861 AC3",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#861 AC4",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#861 AC5",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#862 AC1",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#862 AC2",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#862 AC3",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#862 AC4",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#862 AC5",
      "verdict": "met",
      "files": [
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/merge-precheck.spec.ts",
        "libs/epic-verdicts/src/pr-verdict.spec.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#863 AC1",
      "verdict": "met",
      "files": [
        "components/commands/nxs.analyze.md",
        "libs/portable-tools/src/nexus-cli.ts"
      ]
    },
    {
      "kind": "criterion",
      "about": "#863 AC2",
      "verdict": "met",
      "files": [
        "components/commands/nxs.fix.md",
        "components/commands/nxs.intake.md",
        "components/commands/nxs.close.md",
        "components/skills/nxs-issue-reference/SKILL.md",
        "utils/implement-epic.sh"
      ]
    },
    {
      "kind": "criterion",
      "about": "#863 AC3",
      "verdict": "met",
      "files": [
        "components/commands/nxs.close.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G1",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G2",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G3",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G4",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G5",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G6",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G7",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G8",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G9",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/waiver.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G10",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/waiver.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G11",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/waiver.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G12",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/waiver.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G13",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/waiver.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G14",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G15",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G16",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/merge-precheck.spec.ts",
        "libs/epic-verdicts/src/pr-verdict.spec.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G17",
      "verdict": "held",
      "files": [
        "components/commands/nxs.close.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G18",
      "verdict": "broken",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G19",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G20",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G21",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G22",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G23",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G24",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-worktree/src/landed-change.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G25",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G26",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G27",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G28",
      "verdict": "held",
      "files": [
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G29",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/publish-check.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G30",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G31",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G32",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G33",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G34",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G35",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G36",
      "verdict": "held",
      "files": [
        "components/commands/nxs.analyze.md",
        "libs/portable-tools/src/nexus-cli.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G37",
      "verdict": "held",
      "files": [
        "components/commands/nxs.fix.md",
        "components/commands/nxs.intake.md",
        "components/commands/nxs.close.md",
        "components/skills/nxs-issue-reference/SKILL.md",
        "utils/implement-epic.sh"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G38",
      "verdict": "held",
      "files": [
        "components/commands/nxs.close.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G39",
      "verdict": "held",
      "files": [
        "utils/implement-epic.sh",
        "libs/portable-tools/src/nexus-cli.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G40",
      "verdict": "held",
      "files": [
        "libs/pr-acceptance/src/judgments-block.ts",
        "libs/epic-verdicts/src/merge-precheck.spec.ts",
        "libs/epic-verdicts/src/pr-verdict.spec.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G41",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/pr-verdict.spec.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G42",
      "verdict": "held",
      "files": [
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G43",
      "verdict": "held",
      "files": [
        "libs/epic-verdicts/src/pr-verdict.spec.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G44",
      "verdict": "held",
      "files": [
        "components/commands/nxs.analyze.md",
        "libs/epic-verdicts/src/publish-check.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G45",
      "verdict": "held",
      "files": [
        "libs/pr-worktree/src/landed-change.ts",
        "libs/portable-tools/src/nexus-cli.ts"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G46",
      "verdict": "held",
      "files": [
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G47",
      "verdict": "held",
      "files": [
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G48",
      "verdict": "held",
      "files": [
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "guarantee",
      "about": "G49",
      "verdict": "held",
      "files": [
        "components/commands/nxs.close.md"
      ]
    },
    {
      "kind": "metric",
      "about": "Close can write its key decisions and deviation rationale from the verdict alone",
      "verdict": "unverifiable",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/pr-acceptance/src/judgments-block.ts"
      ]
    },
    {
      "kind": "metric",
      "about": "Every departure in a merged pull request was answered before the merge",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/verdict-items.ts",
        "libs/epic-verdicts/src/publish-check.ts",
        "libs/epic-verdicts/src/merge-precheck.spec.ts"
      ]
    },
    {
      "kind": "metric",
      "about": "Answering a departure with no code change takes an analyze run that reads no code",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/answer-scope.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    },
    {
      "kind": "metric",
      "about": "An epic's success metrics are judged on a pull request before the epic's last merge",
      "verdict": "met",
      "files": [
        "libs/epic-verdicts/src/epic-completion.ts",
        "libs/portable-tools/src/nexus-cli.ts",
        "components/commands/nxs.analyze.md"
      ]
    }
  ],
  "epicLevel": "judge"
}
```

