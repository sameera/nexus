# Releases

Every release is one package carrying both toolkits, the component payload and this entry. What
an item says is what a lead running a pipeline stage will experience differently — not what a
commit was called, not which file moved, not which library moved. A release that changes no stage
behaviour says so.

## 0.94.0

- **Close takes the epic.** `nexus close --epic <N>`, or a bare `nexus close <N>`, closes epic
  `<N>` in the issues repository the checkout resolves to. Close reads no single pull request: its
  gate and its close record come from the epic's stories and the pull requests that claim them, in
  whichever repository each merged. From the hub, an epic whose pull requests merged in a member
  repository no longer needs one of them named. Whichever form names the epic, an issue that is
  not filed as an epic, by its label or issue type, stops close before it writes anything. A
  repository that declares no classification still accepts an unmarked top-level issue, and a
  re-run that finishes a close whose comment stamps that epic skips the check. Stops and
  re-run hints name `nexus close --epic <N>`, and the report lists every merged pull request the
  close covers.
- **Close's `--pr` is a shortcut that accepts any pull-request reference.** `nexus close --pr`
  takes a number, `owner/repo#N` or a pull-request URL, finds the epic from that pull request, then
  runs as `--epic` does. A qualified reference is read in the repository it names, so a member
  pull request no longer fails to parse. A pull request that has not merged still stops close
  early. Scripts that call `nexus close --pr <N>` keep working. Asked what an epic has shipped,
  analyze now points at `nexus close --epic <epic>`.
- **Close names what was wrong with its arguments.** A value that does not parse gets its own
  message saying what close expected and what it got, and missing arguments print the usage. Close
  no longer answers a typing mistake with "close runs only against a merged pull request".
  `--epic`, `--pr` and a bare number together are refused. `/nxs.close` relays all three forms
  unchanged, and its refusal without arguments names `nexus close --epic <N>`.

## 0.93.1

- **The unattended implement run stops on an answer edited into an existing comment.** After each
  fix round, the run checks whether the round answered an item on the pull request, because it posts
  as the lead and only the lead may accept, waive or approve. The check used to compare which
  comments held answer lines, so an answer added by editing a comment that already held one went
  unnoticed. It now compares the answer lines themselves. A round that adds or changes an answer
  line, in a new comment or an edited one, stops the run before the push and names the comment. A
  round that edits only other text, or only removes an answer line, carries on. `nexus pr-answers`
  gains `--lines`, which prints one row per answer line.
- **Analyze keeps its departure and finding IDs in any checkout.** Analyze read the ID registry
  from the checkout's default repository instead of the pull request's. In a checkout whose default
  repository is another one, it found no earlier verdict and restarted numbering at DV1 and F1, so
  an answer written against an old ID stopped applying. It now reads the pull request's own
  repository, like every other verdict and answer read.

## 0.93.0

- **Close and analyze count a story closed by a commit of a merged pull request as shipped by
  it.** A pull request that carries its `Closes #<n>` lines in its commits, one per story, gets no
  closing link on GitHub, because GitHub reads closing words only from the pull request body. The
  story still closes from the commit when it merges. Close used to report such a story as
  unshipped, with "no pull request claims it", unless the pull request body also named the story
  with a scope word. Close now reads the commit that closed the story and counts the merged pull
  requests that hold it, so the one-commit-per-story pull request closes with no body edit and no
  waiver. An open or unmerged pull request that also holds that commit still counts for nothing.
  Analyze reads the same way when it decides whether a pull request completes its epic.

## 0.92.0

- **Close no longer asks anything (breaking).** Close is now a plain command, `nexus close`. It
  runs no model, has no checkpoint and asks no question. Everything close used to ask must be on
  the pull request before close runs. Answer a departure or a blocking finding in a comment on the
  pull request, then run `/nxs.analyze --pr <N> --resolve` so the verdict records the answer; close
  reads answers only from the verdict. Post a revised-record or landed-change waiver on the pull
  request in its fixed form. When something is missing, close stops before writing anything, prints
  the reason, the item and the remedy, and exits with an error. Fix it and run close again.
- **The direct command is `nexus close`; `/nxs.close` relays to it, and the close-epic script calls
  it.** `/nxs.close --pr <N>` now runs `nexus close` with the same arguments, shows its output
  unchanged, and ends with one line telling you to call `nexus close` directly next time. It does
  not interpret, retry or fix a stop. Without `--pr` it refuses as before. Its recovery section now
  names `nexus close --recover <epic>`, the command that replaces the hand-run re-stamp steps. The
  close-epic script calls `nexus close` directly too, under Claude and Codex alike, so it runs from
  merge to distill with nobody at the terminal. When close stops, the script prints close's reason
  and remedy again and starts no distill. When close succeeds, the script still checks the hand-off
  note against GitHub and git before it starts distill. Extra harness arguments now go to distill
  only.
- **What `nexus close --pr <N>` checks.** It closes the epic of a merged pull request. Every gate
  runs before it creates anything: the checkout is a single repository or a hub, the pull request
  merged, the pull request names one epic (otherwise it names passing the epic's entry path), every
  sub-issue is closed, and every story is current. A revised record or a file that did not land as
  reviewed passes only with a trusted waiver comment already on the pull request. Each merged pull
  request's verdict must have no open critical or high item and must carry its judgments. Each
  failing gate prints one stop naming the reason, the item and the remedy, and exits with an error;
  a waiver stop prints the exact comment to post. When every gate passes, it reuses the distill
  branch an earlier run cut for the epic, local or pushed, or cuts one from the trunk, and finds or
  creates the epic's queue entry.
- **`nexus close` writes the close record from the pull requests' verdicts.** After its gates pass,
  it writes the close record into the epic's queue entry and commits it on the distill branch. It
  reads only each merged pull request's verdict, the decision record's body and the issue graph:
  no diff, no decision stub, no engineer note and no story-issue comment, and it asks nothing. Key
  Decisions lists every decision of the record whose hash it stamps, in record order, then each
  decision stub a verdict confirmed, once. Deviation Rationale has one entry per accepted departure
  per pull request, in merge order, naming what it departs from, the pull request and the
  departure's ID, the reason, and who accepted it. A pull request that changed no files keeps its
  merge-order place. A waived critical or high finding is listed with who waived it. Close reads the
  epic, its stories and its record from the configured issues repository, also when `epic-repo`
  names one other than the checkout's.
  `analyze:` reads `ran <date> @ <head>` from the most recently merged pull request's verdict, as
  before. Text copied from an answer, a stub or a proposal can no longer add a close-record marker
  or a fenced block.
- **The record amendment comes from the verdicts' superseding marks.** When a verdict marks an
  accepted departure as superseding a record decision, `nexus close` posts one amendment comment on
  the decision record, naming each superseded decision, what shipped instead and why. A re-run
  finds that comment and does not post a second. No mark, no comment. A failed post is reported
  and does not stop the close: close prints the amendment's exact text and the record issue to post
  it on by hand, and a later re-run of `nexus close` posts it if it is still missing.
- **`nexus close` files the approved scope, posts the close comment, closes the epic and hands
  off.** Each deferred-scope proposal a trusted person approved on a merged pull request is filed
  once as an unplanned epic stub, with the repository's epic classification and unplanned label
  and no parent. The stub carries the goal as its title, the feature path, where it came from (the
  epic, the pull request, the proposal and who approved it) and a hidden key. It has no estimate
  and no ordering; planning sizes it. A proposal nobody approved is never filed. The close record
  names each stub's number. Then close writes the story markers, commits and pushes the distill
  branch, posts the record amendment and the close comment, closes the epic issue and, with
  `--handoff <path>`, writes the hand-off note in its usual three lines, only when every step
  succeeded. Before each write it looks for what an earlier run did: a stub is found by its key
  among the issues that mention the epic, even after it was promoted, so a plain re-run finishes a
  partial close with no second stub, amendment, close comment or distill branch. Once the close
  comment is on the epic, a re-run only closes the issue, writes the note and reports; when no
  earlier distill branch is found, it stops before creating one. A failed
  push stops close before anything is posted, with the epic open. A failed close comment stops
  close with the epic open, and the stop names re-running `nexus close` to post it.
- **`nexus close --recover <epic>` re-stamps a closed epic whose decision record was revised.**
  Distill refuses an entry whose record changed after close. Recovery fixes that without a model.
  It stops, before writing anything, while the revised record is not approved, and names approving
  it. For each merged pull request it needs one of two things: a verdict judged against the
  current revision, or a trusted revised-record waiver on the pull request accepting it. A pull
  request with neither stops recovery, and the stop names both remedies, with the exact waiver to
  post. Key Decisions then takes the record's decisions from the new body. A re-judged pull
  request's departures are rebuilt from its verdict; a waived one's are kept. Recovery re-stamps
  `record_hash` and `analyze:`, commits and pushes the entry on its distill branch, and posts a
  fresh close comment, so distill's recovery from the epic issue finds the new hash. It changes
  nothing else in the entry, files no stub and posts no amendment. When no entry is left, it posts
  only the fresh comment and names `/nxs.distill --recover <epic>`.
- **A story that shipped inside another story's pull request is waived by a comment on its own
  issue (breaking).** Close no longer offers this waiver. Post the waiver comment on the story's
  issue before close runs, as someone who can speak for the issues repository; when it is missing,
  `nexus close` stops and prints the exact comment. Close then writes the story's marker before its
  close comment, and Waived Stories names the story and the date of the waiver comment. A story
  that already carries the marker passes as before.
- **Promoting an epic stub keeps the key close filed it under.** `/nxs.epic`'s promotion rewrites
  the stub's body; it now carries over the stub's hidden key, so a later close run still recognises
  the stub and does not file it again. A promotion whose stub body cannot be read is refused
  before any write, rather than dropping the key. `nexus create-story` takes `--issues-repo <owner/repo>` to
  file into a repository other than the configured story repository.
- **An epic in flight whose verdicts were published before analyze recorded its judgments needs
  one full analyze run per merged pull request (breaking).** Those verdicts carry no judgments, so
  `nexus close` stops on each such pull request and names `/nxs.analyze --pr <N>`. Run it on
  every merged pull request of the epic, then close.
- **A customised close-record template is ignored (breaking).** The close record's shape is now
  fixed: `nexus close` renders it, and `/nxs.close` relays to `nexus close`. A close-record
  template your project tuned is ignored with no warning when close runs. Seeding no longer places
  that template, and a copy already in your repository is left as it is. The close record and the
  close comment `nexus close` writes have no Process Lesson section and no lesson pointer.
- **No lesson is written (breaking).** Nothing read the process lesson, so no close writes one any
  more: neither `nexus close` nor `/nxs.close` writes a lesson file, and neither the close record
  nor the close comment points at one. Setup no longer creates the lessons folder or its README,
  and its summary no longer lists them. A discovery closed with no build still writes its note
  there, and now creates the folder when it is missing. Lesson files already in your repository
  stay as they are.

## 0.91.0

- **Analyze names every departure from the decision record.** `/nxs.analyze` now lists each place
  the code departs from the approved record — or from the epic's description when it has none —
  and names what it departs from: a decision or guarantee by its ID, an old-format decision by its
  title, or a named section. A decision stub that explains a departure is shown beside it but
  answers nothing. A departure where the code does the opposite of a record decision is marked as
  superseding it, with what the code does instead. Code that matches the record lists none.
- **An unanswered departure blocks (breaking).** It counts as a critical finding when it breaks a
  guarantee or an invariant and a high one otherwise, so the review requests changes and the merge
  pre-check and close stop on it. A broken guarantee is now reported once, as a departure, and no
  longer also as a separate finding; the report's "Guarantee violations" line is gone.
- **Each departure on a pull request has an ID that later runs keep.** On `/nxs.analyze --pr`, the
  new `nexus verdict-items` numbers departures `DV1`, `DV2`, ... against the pull request's newest
  verdict: a departure found again keeps its ID, a new one takes the next unused number, and one no
  longer found stays listed with its answer. The verdict carries them in a second machine block
  after the verdict block, whose keys are unchanged.
- **The publish check refuses a verdict without its departures (breaking).** `nexus verdict-check`
  refuses a drafted verdict with no judgments block, with one it cannot read, or whose severity
  counts leave out an unanswered departure. A verdict published before this release still reads.
- **Analyze judges the whole epic on the pull request that completes it.** `/nxs.analyze --pr`
  now asks, through the same read of each story's pull requests that close gates on, whether the
  pull request completes its epic: it covers every live story, or every other live story has
  merged with no open pull request. Only then does it judge the success metrics and the guarantees
  that span stories, over this change plus what each merged sibling landed. Each metric is met,
  not moved (a high finding), or unverifiable, naming what would decide it. A broken cross-story
  guarantee is a departure. A pull request that leaves another story unshipped judges no metric.
- **A completing pull request behind its siblings gets a blocking finding (breaking).** When the
  head does not contain a merged sibling's change — or another member's checkout trunk does not —
  the verdict carries a high "epic-level check not run" finding that names bringing the branch up
  to date, or fetching the member checkout. A failed read of the epic's pull requests now stops
  every `/nxs.analyze --pr` run and publishes nothing.
- **Analyze no longer combines an epic's verdicts (breaking).** Aggregate mode is gone, and so is
  `nexus epic-verdicts combined`, which now reports its removal. `/nxs.analyze <epic>` reads the
  epic's pull requests first: once any story has merged, it combines nothing and names
  `/nxs.analyze --pr` on the open pull request that completes the epic, or on the most recently
  merged one when every story has merged. `nexus epic-verdicts pr-target --epic <N>` prints that
  answer on its own.
- **An engineer answers a departure or a finding on the pull request.** A comment line of the
  form `DV2 — accepted: <reason>` accepts a departure, and `F1 — waived: <reason>` waives a
  critical or high finding; one comment may hold several. On the next `/nxs.analyze --pr` run,
  `nexus verdict-items` reads them through the same reader close reads waivers with, applies the
  newest answer per ID from an author who can speak for the repository, and the verdict lists each
  answered item with who answered and a link. An answer from anyone else, with an unknown ID, a verb
  that does not fit the item, no reason, or a waiver of a medium or low finding applies nothing and
  is named in the verdict. A decision stub still answers nothing.
- **Every finding on a pull request has an ID too.** Findings are numbered `F1`, `F2`, ... against
  the pull request's newest verdict, the way departures are, so a waiver survives a re-run.
- **The severity counts cover only open items (breaking).** The verdict's critical, high, medium and
  low counts now leave out an accepted departure and a waived finding, so the review approves, and
  the merge pre-check and close stop blocking, once every blocking item is answered. They read the
  verdict exactly as before. `nexus verdict-check` now refuses counts that differ from the open
  items, in either direction, as `counts-not-open`; that replaces `departures-uncounted`.
- **Close no longer offers to override blocking findings (breaking).** A receipt with open critical
  or high items stops `/nxs.close` with no "Override and close" choice. It names answering each item
  on the pull request, then running `/nxs.analyze --pr <N>` again to record the answers.
- **An unattended implement run stops if it posts an answer.** The implement script and its Codex
  entry point tell each fix round never to answer, and after each round list the pull request's
  answer comments with the new `nexus pr-answers`; a new one stops the run and names its link. The
  scripts now need `nexus` on the PATH.
- **Recording answers is a short run.** `/nxs.analyze --pr <N> --resolve` records the answers on a
  pull request without judging it all again; the new `nexus verdict-scope` decides what it may skip.
  When the head has not moved, it reads no code: it copies the answers in and publishes a complete
  new verdict. When the head moved, it judges again only the answered departures (including those
  answered in a comment since the last verdict) and what the changed files affect, and carries every other result forward. A file counts as changed only when
  the pull request's own change to it differs, so merging trunk into the branch or rebasing it
  changes nothing by itself. A file no result was judged on is checked for new departures and
  against every guarantee.
- **It judges everything again when it cannot tell what changed, and says why.** A revised decision
  record, a changed story set, a change in whether the pull request completes its epic, or an
  earlier verdict that recorded no file lists or whose head cannot be read makes the run a full
  one, naming the reason. With no earlier verdict, or only one published before this release, it
  stops and names a full `/nxs.analyze --pr <N>` run. Close now names `--resolve` as the run that
  records answers.
- **Every verdict records what each result was judged on.** A full run on a pull request now records
  each criterion, guarantee and success-metric result with the files it read, so a later
  `--resolve` run can tell what a change affects. A verdict without them still reads; the next
  `--resolve` run on it is a full one.
- **A pull request's verdict carries what close writes into its record.** Its judgments block now
  holds the key decisions: every decision of the record by its ID (by title in an old-format
  record), tied to the record digest the verdict stamps, and each decision stub the code confirms,
  with its choice, reason and refuted alternative. A stub the code contradicts is not a key
  decision. `nexus verdict-items` builds the record's half from the record itself, through the new
  `--record-body` and `--record-hash`; a record in neither format is carried whole.
- **Analyze proposes deferred scope, and approving it clears the item it settles.** A criterion of a
  covered story left unmet or partial, or record scope no delivered story covers, can be proposed
  for deferral with a `DS` ID tied to its finding or departure. A `DS1 — approved` line from an
  author who can speak for the repository marks it for filing by close, names the approver, and
  stops that item blocking. Accepting or waiving the item without approving files nothing, and the
  verdict says so. Scope another story of the epic will deliver is never proposed.
- **The publish check guards the new content (breaking).** `nexus verdict-check` now refuses a
  verdict with no key decisions or ones tied to another record digest, a proposal for a story the
  verdict does not cover, and a body that repeats a verdict marker, as copied answer text could.
  Answer text inside the judgments block can no longer change how either block reads. A verdict
  over the platform's 65,536-character limit has its results' file lists dropped and says so; a
  departure's or a finding's file list is never dropped, so they keep their IDs and answers on the
  next run; the check
  writes those bytes back to publish; one still too large is not published, and the check names
  its size. A verdict published before this release still reads, as having no judgments.
- **A pull request no longer shows its verdict's judgments.** The judgments block is now compressed
  and encoded inside an HTML comment behind the same marker, so the rendered comment shows the
  summary and the verdict block only. The judgments of an epic the size of #829's, every file list
  kept, now publish well under 20,000 characters. Every reader still reads verdicts published in
  the earlier, visible form. `nexus verdict-judgments --pr <N> --repo <repo>` (or `--body <path>`)
  prints a verdict's judgments as readable JSON.
- **Analyze without a pull request reports in the terminal only (breaking).** `/nxs.analyze` run
  without `--pr` no longer writes `analyze-receipt.md`, in `.nexus/tmp/` or in an old-contract
  committed entry; it writes no file at all. Its report now ends with one fixed line, `Analyze
  result: critical=<C> high=<H> medium=<M> low=<L> head=<full HEAD>`, giving the open counts and
  the commit it read. A run that stops before judging prints no such line. `nexus epic-verdicts
  derive` prints its receipt and no longer writes one beside the epic.
- **Close never reads a local analysis file.** `/nxs.close` reads the analysis only from the
  verdict on the pull request, and behaves the same when a file an older release wrote is still
  beside the epic. The fix lane, the intake lane and the issue-reference rules no longer name one.
- **The implement scripts work from analyze's terminal report.** The headless implement script and
  its Codex entry point capture each local analyze run's final report in their own scratch space,
  which no stage reads, and read the result line from it; each fix round works from that report. A
  run that printed no result line stops the script and names the report.

## 0.90.1

- **The merge pre-check names blocking findings even when the head has moved.** When the one-command
  close script refuses to merge because a pull request's head moved past its analyze receipt, and
  that receipt also reported critical or high findings, the refusal now names those findings too.
  Before, it named only the moved head. The merge is refused exactly as before.

## 0.90.0

- **Close names an untrusted waiver comment even when a trusted one clears the stop.** When
  `/nxs.close --pr` applies a lead's waiver on a pull request, it now also names every waiver
  comment on that pull request from an author who cannot speak for the repository, or that it
  could not read. Before, those comments went unmentioned once a trusted waiver applied.
- **Close refuses a record waiver that names another repository's issue.** A `record-revised`
  waiver whose `record:` names the right issue number in a different repository now clears nothing,
  and close names it. A bare `#<n>` reference still names the epic's own decision record.

## 0.89.0

- **Close takes one run, and starts no analyze run (breaking).** The one-command close script no
  longer runs `/nxs.analyze --pr` after the merge, no longer checks coverage, and no longer
  requires a shipped record on the epic issue before it starts `/nxs.close`. It goes from the
  merge pre-check straight to close. A lead must run `/nxs.analyze --pr` on each pull request
  before it merges; close's own evidence gate then decides whether that analysis still holds.
- **Analyze no longer writes a shipped record (breaking).** `/nxs.analyze --pr` on a merged pull
  request now publishes its receipt on the pull request and writes nothing on the epic issue. A
  lead who ran analyze after the merge to record what shipped no longer needs to.
- **Close no longer requires a shipped record.** `/nxs.close --pr` no longer stops on a story with
  no record on the epic issue. It derives that story's range itself. An epic in flight whose
  stories already carry records closes as before: close still uses the range each record stamped,
  and still stops if the platform no longer reports the merge commit a record saw.
- **Analyze no longer reports what an epic has shipped (breaking).** Asked what an epic has
  shipped, `/nxs.analyze` now points to `/nxs.close`, which reports each story as current, stale,
  never reviewed, unshipped, unknown or excluded. A lead who checked coverage through analyze uses
  close's evidence gate instead. The retired commands say what replaced them when called.

## 0.88.0

- **Close stops on a story whose evidence is stale (breaking).** `/nxs.close --pr` now stops,
  before it mines anything, on a story whose receipt no longer holds for what merged. It names
  the story, the pull request and each reason, and a story stale for several reasons gets every
  one in a single report. A lead must clear each one with the remedy it names before close will
  go on. There are three reasons:
    - a reviewed file did not land as it was reviewed;
    - the head that merged is not the head analysis reviewed;
    - the decision record was revised after the receipt was written. This names every story that
      receipt covers.
- **Each stale stop names the remedy that can clear it.** A moved head names `/nxs.analyze --pr`
  on that pull request. A revised record names that run, or a waiver comment a trusted lead posts
  on that pull request. A file that did not land as reviewed names only that waiver, never an
  analyze run, because re-analyzing the same head cannot change what landed.
- **"Unknown" now means only that close could not read something.** When close cannot read a
  receipt, the decision record's current revision, or the landed-file check, it reports the story
  as unknown, names what it could not read, and stops. It never guesses a state from a failed read.
  A story's text is still never a reason.
- **Close reads waivers from the pull request and no longer asks for them (breaking).** A lead who
  accepts a revised record or a file that did not land as reviewed now posts a waiver comment on
  that pull request, in the fixed form `/nxs.close` documents, before running close. Close reads
  it and goes on, and never asks. Its checkpoint no longer offers "Proceed against the revised
  record". A lead who used to answer that question must post the waiver comment instead. The
  override for open critical or high findings stays at the checkpoint, as before.
- **A waiver covers only what it names.** A waiver clears one reason, on the pull request it is
  posted on. A waiver for a landed change must name every changed file, or close still stops and
  names the files it leaves out. A waiver for a revised record names the revision it accepts, so a
  later revision stops close again. A waiver from someone who cannot speak for the repository is
  named and clears nothing. A moved head can never be waived. If close cannot read the comments, it
  reports the story as unknown and stops.
- **Close states every waiver it applied.** The close record and the close comment on the epic
  list each waiver with its author, a link to the comment, and the files or the record revision
  it accepted.

## 0.87.0

- **Editing a story after analysis no longer flags it at close.** `/nxs.close --pr` no longer
  reports a story as "changed since analysis" because its text changed after its receipt was
  written. It no longer reports a story as "unknown" because its receipt records no story text.
  A wording fix to a story no longer calls for an analyze run per pull request. A revised decision
  record still makes every story stale, as before.
- **Analyze no longer records story text in its receipt.** `/nxs.analyze --pr` no longer takes a
  fingerprint of each story before reading it, and the published receipt no longer carries one.
  The pre-publish check now refuses a drafted receipt that still records story text, and no
  longer fetches the stories it names.
- **Older receipts keep working.** A receipt an earlier release wrote that records story text is
  still read without error by close and by the merge pre-check, and the recorded text changes no
  outcome.

## 0.86.0

- **The one-command close script refuses to merge over a head analysis never saw (breaking).** When
  a lead asks the close-and-distill command to merge an open pull request, its pre-check now
  refuses when the commit the receipt analyzed is not the pull request's current head. The
  refusal names re-running `/nxs.analyze --pr` on that pull request. A lead who pushes even a small
  commit after analysis must re-analyze before the command will merge.
- **The merge pre-check says which of four things it found.** A clean receipt is reported with
  its finding counts before the merge. A pull request with no receipt is reported as "analysis has
  not run", naming `/nxs.analyze --pr` on it. A receipt with critical or high findings is reported
  with its counts, and the merge is refused. A receipt that could not be read, or that carries no
  trusted author, is reported as a read failure, never as "not run". Before, no receipt and
  blocking findings printed the same message.
- **The pre-check reads the receipt and nothing else.** It runs no analysis and reads no shipped
  record. Story text that an older receipt recorded is read without error and changes nothing.
  The command still refuses hub and member checkouts, and still merges only when asked to.

## 0.85.0

- **Close stops on a story nobody reviewed, with no waiver (breaking).** `/nxs.close --pr` now
  checks that a trusted analyze receipt names each story on every merged pull request that claims
  it. A story that no receipt names stops close as "never reviewed" before anything is mined. The
  stop names `/nxs.analyze --pr` on that pull request as the remedy. A pull request with no commits
  that belong to the story needs no receipt of its own when another receipt names the story. The
  "Close without analysis" choice at close's conformance gate is gone, and a missing receipt there
  is now a hard stop too. A lead who used to waive a missing analysis must now run
  `/nxs.analyze --pr` on the named pull request before closing. The revised-record choice and the
  blocking-findings override still work as before.
- **Close stops on a story with unfinished work (breaking).** Close now sees every pull request
  that claims a story, not only the merged ones. A story stops close as "unshipped" when an open
  pull request claims it, even if another one merged, and the stop names that open pull request. A
  story whose only claiming pull requests closed without merging, or that nothing claims and no
  marker excludes, stops the same way. No analyze remedy is named, because analysis cannot finish
  work that has not merged: merge or close the open pull request, then re-run close. A receipt
  close could not read stops its story as "unknown", and a failed read of the claiming pull
  requests still stops close, never reading as "no pull request".
- **Analyze's coverage is unchanged.** `/nxs.analyze` run against an epic still counts merged pull
  requests only. An open or closed-unmerged pull request never counts as shipped there.

## 0.84.0

- **Close checks that each reviewed file landed as it was reviewed.** For every merged pull request
  whose trusted analyze receipt names the head that merged, `/nxs.close --pr` compares what that
  head changed in each file with what the pull request itself landed. A sibling pull request that
  edited the same file, before or after, does not count, and neither do moved lines. A file the
  merge renamed, deleted or landed with a different mode is reported as changed. A pull request
  with no receipt, with no range, or analyzed at another head is reported as not checked, with the
  reason. Close reports a changed file but does not yet stop on it. The close record and the close
  comment's machine block both state each story's result under a new key, added beside the
  existing ones, so `/nxs.distill` reads them as before.
- **Close stops on a pull request that never reached trunk.** When the checkout holds a pull
  request's merge commit but trunk does not reach it, close reports the pull request as not landed
  and stops on its story, with no waiver. This is the stacked pull request merged into its base
  branch. A merge commit the checkout does not hold is still "checkout behind", never "not landed".

## 0.83.0

- **Close derives each story's commit ranges itself.** `/nxs.close --pr` now runs the new
  `nexus epic-verdicts ranges` for every epic, whether it shipped as one pull request or several.
  It reads every merged pull request that claims each story and lists each story's ranges in merge
  order, with no range supplied by the lead. Where a shipped record exists, close uses the range it
  stamped and still stops hard on a merge commit that moved. Otherwise close derives the range in
  the checkout of the repository the pull request merged in. A pull request with no commits that
  belong to the story is listed as "no range", never dropped. The close record and the close
  comment's machine block both carry the range list and a new per-story list; the new key is added
  beside the existing one, so `/nxs.distill` reads the record as before and computes its diff from
  those ranges.
- **Close now needs a checkout of every repository a story merged in.** In a hub, a member with no
  checkout stops close before it writes anything, and the stop names the path the checkout was
  expected at. Close fetches nothing in its place. A checkout that does not hold a pull request's
  merge commit stops close as "checkout behind" and names the fetch to run. A hub lead must hold
  each member checkout, up to date, before closing. The shipped-record gate is unchanged.

## 0.82.0

- **Each analyze receipt records the story text it checked, and close sees when it changed.**
  `/nxs.analyze --pr` takes a fingerprint of each story's issue body when it first reads the
  stories, with the new `nexus story-fingerprints`, and writes one per story into the receipt it
  publishes. The fingerprint is the decision-record digest, so a change only to line endings or
  trailing spaces, or to the title, is not a change. Before publishing, `nexus verdict-check` now
  refuses a receipt whose fingerprints are missing, extra, or differ from the story's current text,
  and the lead runs analyze again. Close's evidence report names a story changed since analysis,
  with the pull request whose receipt is out of date, and names a receipt written before
  fingerprints existed as unknown. The report still blocks nothing, and the shipped record and the
  ledger gate are unchanged.

## 0.81.0

- **A receipt counts only for the stories it names.** Close's evidence report now reports a story
  as having no receipt unless a receipt on a pull request that claims it names that story. A story
  added to the epic after its receipt was written therefore shows as having no receipt. A receipt
  that names no story is listed as covering none, never as covering the whole epic. The report
  still blocks nothing; the ledger gate is unchanged.

## 0.80.0

- **A story's pull requests are read in full, and a failed read stops the run.** Analyze and close
  share one read of the merged pull requests that claim a story. It now reads every page of the
  closing links and the cross-references, so a busy story no longer loses the pull request that
  shipped it. A failed read, on any page, is an error that names the story and the cause, and is
  never reported as "no pull request". `nexus epic-verdicts coverage` then reads every remaining
  story, names every failed one, prints no coverage and exits 1, and the close-epic script stops
  before close.
- **Close gains a per-story evidence report.** `/nxs.close` runs `nexus epic-verdicts evidence`
  after the ledger gate passes and repeats what it prints. If any story's pull requests or
  receipts cannot be read, close stops before mining anything and names the story. The report
  decides nothing else; the ledger gate is unchanged.

## 0.79.0

- **An unattended distill stops at any question instead of draining around it.** Under
  `/nxs.distill --unattended`, a not-merged pull request or an ambiguous provenance repository now
  stops the whole run, the same as a taxonomy forced fit already did. The run opens no pull
  request and names each condition in its stop report. Before, the affected entry was left out and
  the other entries still drained.
- **Every distillation pull request description carries the run summary.** An attended run's
  description now has the same `Run summary` section an unattended one gets: each entry's source
  and deletion, sections changed, validator verdict and page count, skipped and blocked entries,
  and the waiver line. An unattended run's description differs only by its first line.
- **The close-epic script starts close only after analyze actually recorded the pull request.**
  A headless analyze that stops and reports the stop in words still exits cleanly. The script now
  reads the outcome from GitHub instead: the pull request must carry a verdict, and the epic issue
  must carry this pull request's shipped record. Otherwise the script stops before close. Distill
  also starts only when the hand-off note's worktree is registered with git on the note's branch,
  not merely any git checkout at that path.

## 0.78.0

- **One command closes and distills a merged epic pull request.** The close-epic script runs
  `/nxs.analyze --pr` unattended, then `/nxs.close --pr` interactively for its one checkpoint,
  then `/nxs.distill --unattended` in the worktree close left, on claude or codex. The lead never
  changes directory. Distill starts only when close's hand-off note matches GitHub and git: the
  epic issue closed and the distill branch pushed. `--merge` merges an open pull request first,
  but only a non-draft, mergeable one with a clean conformance verdict. `--background` returns once
  close is verified and keeps distill's log and outcome in the checkout's scratch area.
  `/nxs.close` gains `--handoff <path>` for this script; without it, close is unchanged.
  Single-repo checkouts only.

## 0.77.0

- **The distill stage can run with nobody watching.** `/nxs.distill --unattended` skips its
  checkpoint and opens the distillation pull request on its own once drafting finds nothing to ask
  about. Every point that used to ask a question — a not-merged pull request, an ambiguous
  provenance repository, a taxonomy concept that fits no domain — instead excludes the affected
  entry (or, for the taxonomy case, stops the whole run before touching git) and is named in a
  stop report, never guessed or defaulted. A blocked run pushes nothing. The pull request
  description now shows every field the checkpoint would have shown, in both modes. Without the
  flag, `/nxs.distill` is unchanged, including when nobody happens to be watching it run.

## 0.76.0

- **The close stage now refuses at once without a pull request.** Since 0.72 a close run this way
  could never pass its own shipped-record check, and only reported that after resolving the epic
  and writing its local artifacts. It now refuses before touching the epic or any file, and names
  `/nxs.close --pr <N>` as the path that works. `/nxs.close --pr` itself is unchanged.

## 0.75.0

- Decision-record drafting now stops if a seeded approval-first template has the right headings in the wrong order. The record checker blocks a choice repeated in one Approval brief group or listed without a cost sub-bullet, so the checkpoint cannot hide an accepted trade-off behind an ID alone.
- Close and distill now stop with a named diagnostic if the shared section reader fails, instead of continuing with an assumed record baseline. New and old approved records continue through the same reader and hash checks.

## 0.74.1

- **A filed record or epic keeps its nested bullets nested.** When `/nxs.decision-record` or
  `/nxs.epic` removed the provenance labels from a draft before filing, it also shrank every
  indentation to one space. GitHub then showed each sub-bullet, such as a trade-off under its
  choice in a record's Approval brief, as a separate top-level bullet. Indentation now reaches the
  filed issue as drafted. A body filed before this release keeps the flattened list until it is
  edited.

## 0.74.0

- **`/nxs.decision-record` now drafts every new record approval contract first.** The record opens
  with How it works, a short explanation of the design in the epic's and stories' own words. An
  Approval brief follows. It lists what must be resolved before approval, and every decision that
  gives something up, with what it gives up. Then come the Guarantees, grouped by what a reviewer
  checks and each naming the decisions behind it, and the Risks and dependencies. A Concept-store
  changes section appears only when the design changes a concept-page statement. The full reasons
  for each decision, a Terms list for every internal name, and the detailed mechanism move to an
  appendix at the end. Each decision there states its trade-off, the exact old and new wording of
  any epic or story text it changes, the story that delivers it, and the guarantees it supports.
  The old Summary, Chosen Approach, Key Decisions, Constraints & Invariants and Open Clarifications
  sections are gone from new records. How it works has a guideline of about 300 words, and runs
  longer when the design needs it. A small or medium epic's record now always has a How it works
  section, so the shortest records get a little longer.
- **A revision of a record approved in the old format stays in the old format.**
  `/nxs.decision-record --revise` drafts it from the old template, so its approved lines still
  match. Records already filed are not rewritten.
- **The record checkpoint's cut list reads the new sections.** For a new-format draft it lists
  every refuted alternative under its decision, every guarantee the model added, each under its
  group (Existing behaviour to preserve included), and every risk the model added. A decision whose
  alternative is written as `none` adds no line. An old-format revision's list reads the old
  sections and marks approved lines as frozen, as before. A guarantee or a risk with no provenance
  label now blocks at the draft check, so none can drop off the list.
- **Cutting a guarantee or a risk no longer renumbers the rest.** The gap stays, because decisions
  and the Approval brief cite them by ID. The stage passes the cut IDs to the derive step. When a
  surviving line still cites a cut ID, filing stops and names each such line, and the lead fixes it
  by hand. An old-format revision still renumbers its invariants.
- **A field written as `none` in the draft is absent from the filed record.** The draft states
  every field of a decision, `none` where it is empty, and the derive step removes those lines. The
  clean-body assertion fails on any that survives.
- **A record draft that reads as neither format no longer files.** The checkpoint's draft check
  now blocks a record with no Guarantees section and no Constraints & Invariants section, since no
  later stage could read its parts.
- **`/nxs.analyze`, `/nxs.close` and `/nxs.distill` read a new-format record.** Each asks the new
  read-only `nexus record-sections` command for the record's format and parts. `/nxs.analyze`
  checks every guarantee, Existing behaviour to preserve included, reports a broken one as critical
  and names it by its ID in the report and the receipt. `/nxs.close` checks for deviations against
  How it works, the Mechanism and the guarantees, takes each decision's reason and refuted
  alternative from the appendix, and names a deviated decision by its ID. `/nxs.distill` builds
  Decision Log entries from the appendix's decisions and reasons, and rewrites each statement named
  under Concept-store changes as the record gives it, without reporting it as drift. A record
  approved in the old format reads as before, and a record whose headings match neither format is
  read whole, as before. The record hash is computed the same way for both formats, so every
  stamped hash still verifies.
- **The record checkpoint checks each promised epic or story change against the live issue.**
  Before the cut list, `/nxs.decision-record` runs the new read-only `nexus record-amendments`
  command. For each "Epic commitment affected" line it reads the named issue and reports whether
  the exact new wording is there, after normalising whitespace and case only, and what the issue
  says today. A change whose wording is present gets the status `amended (verified <date>)`. A
  change whose wording is absent stays `pending`: the record gains a BLOCKER risk naming the issue,
  the exact wording to apply and what the issue says today, and the change is listed first under
  "Resolve before approval" with the date it was checked. A change applied in different words
  still reads as pending. The lead applies the record's wording on GitHub, or revises the decision
  to the wording used. An issue the command cannot read stops the checkpoint.
- **The record checkpoint blocks a draft whose parts do not point at each other.** After the
  amendment check and before the cut list, `/nxs.decision-record` runs the record checker again,
  and `nexus razor-check --record` now blocks each of these gaps in a new-format draft, naming the
  guarantee or decision and its line. A guarantee that cites no decision and is not under Existing
  behaviour to preserve. In an epic of more than one story, a decision that names no delivering
  story. An epic or story change whose status is not amended. Each of these three is allowed when
  the Approval brief lists its ID under "Resolve before approval". Two more gaps block whatever the
  brief says: a change that does not quote both the exact old and the exact new wording (an
  addition quotes `Old: ""`), and a decision with a trade-off that the brief does not list, or lists
  under both "Resolve before approval" and "Choices with trade-offs". A guarantee or a decision
  written without its `G<n>` or `D<n>` ID also blocks whatever the brief says, since no check could
  match it. An ID counts only as a whole
  word in the right group, so `D31` does not stand for `D3`. The check proves that an ID is listed,
  not that the brief's sentence about it is right. The new `--epic <path>` flag names the resolved
  `epic.md`, whose stories are counted; without it the checker counts the stories in `--source`.
  Old-format drafts get no new checks.
- **`/nxs.decision-record` never edits the text of the epic issue or of a story issue.** It still
  moves the epic's labels as before. A decision that changes what the epic or a story says is
  recorded in the record for the lead to apply.
- **Breaking: a repository seeded before this release must re-seed its decision-record
  template.** Seeding never overwrites a project's copy, so the project's record template is still
  the old one, and `/nxs.decision-record` now stops and says so instead of drafting from it. Move
  that copy aside and run `nexus seed-templates`, which also adds the old-format template a revision
  needs. Carry any local tuning over into the new copy.

## 0.73.2

- **`/nxs.analyze --pr` now records a member's merged pull request on the hub's epic issue.** In a
  multi-repo workspace the shipped-record step looked the pull request up in the hub instead of the
  member it merged in. From a member checkout it stopped with `pr-not-found`; from the analyze
  worktree it stopped with `missing-hub-checkout`. Either way no record was written, so `/nxs.close`
  blocked every story of a hub-plus-member epic on `story-unrecorded`. The step now reads the pull
  request, its merge commit and its range from the member, and posts the record on the epic issue
  in the hub, naming the member as the repository it merged in. Single-repo and hub runs are
  unchanged. An epic stuck on this is unblocked by re-running `/nxs.analyze --pr` over each of its
  merged member pull requests.

## 0.73.1

- **A distillation no longer stops because the epic's record wrote its repository the short way.**
  The shipped ledger stamps a merged pull request's repository as `owner/repo`, and a checkout
  knows itself as `github.com/owner/repo`. The drain compared the two as plain strings, so
  `/nxs.distill` refused every epic closed through the ledger with `unknown-repo: range names repo
  '<owner/repo>' but this checkout's identity is '<host/owner/repo>'` — on the first epic that shipped
  the ledger, on its own distillation. It now compares them the way every other reader of a stamped
  repository does, so both written forms name the same repository and a stamp naming a genuinely
  different repository is still refused.

## 0.73.0

- **When a pull request that implemented a story merges, `/nxs.analyze --pr` now records what it
  shipped on the epic issue.** The record names the pull request, the story it implements, the
  repository it merged in, its merge commit and the commit range it shipped. One record per code
  repository and pull-request number: a re-run replaces that record's body and leaves every other
  record alone, so two leads recording two pull requests minutes apart cannot drop each other's
  work. A run against an open pull request is unchanged — it publishes the engineer's review and
  writes nothing on the epic issue.

  The post-merge run is now part of the loop rather than optional, because the close gate reads
  those records. An epic whose pull requests merged before this release is backfilled by running
  `/nxs.analyze --pr <N>` over each of them once.

- **`/nxs.close` now takes merge state and the close range from the epic's records.** It stops
  asking the platform whether a pull request merged — the question that returned "unmerged" for
  merged work whenever it went to the wrong repository — and stops deriving a range it cannot
  derive without a copy of the repository the code merged in. An epic whose stories merged
  elsewhere now closes with no waiver and no manual override, and each range entry names the
  repository its own record names.

  One live check remains, and it is a hard block rather than a waiver: whether the platform still
  reports the same merge commit for each recorded pull request. A story with no record is also a
  hard block, naming the story.

- **Every merged pull request that shipped part of a story now reaches the close range.** The rule
  in place before kept one pull request per story, so a later fix displaced the feature it was
  fixing and the displaced code never reached the range — quietly, with nothing to notice. A record
  is keyed by the pull request, so the slot a second pull request could evict no longer exists. Two
  pull requests of one story are ordered by the merge time each record stamped, not by number, and
  findings are summed once per record.

- **`/nxs.close` no longer asks you to waive an analysis whose commit moved.** That question was
  never a judgment: the answer could not make the shipped code any different, and the conformance
  record is now written by the run that saw the merge, so the judged code and the shipped code are
  the same code. No state describes the analysed commit as stale, and no waiver is offered for one.
  A decision record revised since the analysis is a real judgment and is unchanged — still
  reported, still taking its own waiver. The one thing left to adjudicate at close is findings.

- **One reader now answers what an epic shipped, and the checks it replaced report their own
  removal.** The branch-name and same-repository search is gone, so no gate resolves a story's pull
  requests by guessing at a branch name or by a link that only ever pointed inside one repository.
  `nexus epic-verdicts merge-gate` and `nexus epic-verdicts currency` no longer exist: invoking
  either prints what replaced it rather than succeeding inertly or failing as an unrecognised
  command. Published reviews stay as the engineer's read surface and are never read to establish
  what shipped.

- **`/nxs.analyze` can now be asked what an epic has shipped.** Run against an epic rather than a
  pull request, it classifies every story as shipped, unrecorded, unshipped or excluded. The
  distinction that matters is between a story with nothing recorded at all — unfinished work — and
  a story whose merged pull request never went through the gate, which one post-merge run fixes.
  The live story set is re-read each run, so a story added to the epic after a record was written
  shows up as unshipped without invalidating the records already there.

## 0.72.0

- **A verdict that names no issues repository is read as belonging to the epic being read, not to
  its code repository.** The previous release made readers compare the repository a verdict's
  story numbers belong to before matching a number, and for a verdict published before the key
  existed it read the code repository the verdict stamps as that answer. In a workspace whose
  issues and code live in different repositories, that is the wrong answer for every pre-existing
  verdict: on a live epic, four of five story verdicts were dropped and the epic-level gate refused
  to run, telling you to re-run the conformance gate on every merged pull request.

  Readers now take the key the verdict states, and nothing else. A verdict that states none is
  accepted by whichever epic's story it was discovered for, because candidate discovery already
  tied that pull request to that story. Only a verdict that *states* a different repository is
  rejected, and it is still named in `rejected` and in the `issues-repo-mismatch` condition, so a
  dropped verdict is never confused with a missing one. Every verdict published since the gate
  started writing the key states it, so the accepted-unstated population only shrinks.
  `/nxs.analyze` and `/nxs.close` say the same.

## 0.71.0

- **A published verdict's story numbers are now matched only against the repository they belong
  to.** A verdict names the stories it covers as bare numbers, and every reader matched them by
  number alone. Where an epic's issues live in one repository and its code in another, an unrelated
  issue that happens to share a number read as your story — which is what happened on a live epic.

  Readers now resolve those numbers against the repository the verdict names, or — when it names
  none — the code repository it stamps. That fallback is what the whole population published before
  this release already relies on, so nothing is rejected for omitting the key: a verdict whose
  issues and code live in one repository reads exactly as it did. What is rejected is a verdict
  whose numbers land in a different repository than the one being read.

  A rejection is never silent. `/nxs.close`'s epic-wide derivation names the dropped pull request
  and the repository its numbers resolve against, so a story reported as carrying no verdict is
  never confused with a story whose verdict was rejected. Reading one pull request's verdict stops
  with a named condition instead, because there is no other candidate to fall back to — re-running
  `/nxs.analyze --pr <N>` on that pull request is what clears it.

## 0.70.0

- **`/nxs.analyze` now names the repository a published verdict's story numbers belong to, and
  cannot publish without it.** A verdict names the stories it covers as bare numbers. Which
  repository those numbers resolve against was stated by a key the stage was told, in prose, to
  omit whenever it equalled the code repository — and nothing checked that it was written when the
  two differed. On a real epic whose issues live in one repository and whose code lives in another,
  the published verdicts named only the code repository, and both numbers they carried also existed
  there as unrelated items. A reader matching by number alone could not tell the difference.

  The key is now written on every publish, whether or not the two repositories match, and the
  omit-when-equal rule is gone: that conditional is what failed. Immediately before publishing —
  on the review path and on the self-authored-comment fallback alike — the stage hands the exact
  body it is about to post to a check that resolves both repositories itself and refuses a body
  naming no issues repository. A refusal stops the publish and names the value the block should
  have carried; the run does not report success. You can call it directly as
  `nexus verdict-check --body <path>`.

  Nothing already published changes. A verdict written before this release names no issues
  repository, legitimately, and readers still resolve its numbers against the code repository it
  stamps. Re-running analyze on a pull request whose verdict cross-matched while this was live is
  your call, and is what corrects it.

## 0.69.0

- **`/nxs.decision-record` can now satisfy the razor check it prescribes.** The stage runs the
  shared razor checker over its own draft and tells you to fix what blocks before going on. That
  checker read every third-level heading as a user story, so it demanded a provenance label on
  every decision a record states — while the razor says outright that a decision carries no label.
  A record with six decisions produced six blocking findings, and the only way to clear them was to
  label something the rule forbids labelling. The check now reads a story as a heading that names
  one, the same definition the ordering check already used, so a record's decisions raise nothing.

  Everything else the checker reports on a record is unchanged: a quotation that is not in the
  run's source text still blocks, and so does every other rule that applies to the draft. The
  `epic` stage is untouched — a story heading and an acceptance criterion still each carry a label,
  and the acceptance-criteria ceiling still applies. A record already approved while this was live
  was approved against a check that never passed; re-running the check over it is your call.

## 0.68.0

- **`/nxs.close` no longer picks a pull request's analyze verdict by hand.** When a pull request
  carried more than one published verdict — analyze re-run after a correction — the gate was told
  in prose to take the newest, and on at least one real close it reported the superseded one's
  severity counts instead. The two blocks differed in one thing: the later omitted the optional
  toolkit-version key, and the more complete-looking block won. The gate now calls a command that
  returns the verdict a pull request carries and reports what it returns. The command applies
  maintainer authorship, the repository stamp, the pull request named, and newest by GitHub's own
  timestamp — a date written inside a block, the number of keys it carries and the prose above it
  decide nothing. The severity counts reported are the ones the machine block carries.

  That command is available to you directly as `nexus pr-verdict --pr <N> --repo <owner/repo>`. It
  prints what the pull request's verdict is, whether it is still current, and the analyzed commit.
  Re-running analyze after a correction now clears the close gate, which is what it was always
  meant to do.

- **`/nxs.distill --recover` picks that verdict the same way.** Rebuilding a lost entry from
  GitHub, the stage used to read the analyze block on the epic's linked pull request by hand, with
  its own copy of the newest-wins rule. It now calls the same command, so a recovered close and a
  live one report the same verdict for the same pull request. A pull request carrying no verdict
  leaves the close comment's verdict standing, as before.

## 0.67.0

- **`/nxs.close` now reads the story verdicts `/nxs.analyze` already published.** An epic that
  ships story by story ends up with one published verdict per story pull request, and the close
  gate derives one epic receipt from them. That derivation dropped every verdict whose stamped
  repository was written with its host — which is the only form analyze writes. An epic whose
  stories had all been judged reported that not one of them carried a verdict, and the gate then
  read conformance as never having run. Both readers of a published verdict now treat the
  host-qualified and the bare spelling of a repository as naming the same repository, so the
  verdicts already sitting on your merged pull requests are read as they stand.

  A verdict stamping a genuinely different repository is still rejected, in either spelling, and a
  stated host that disagrees is still a conflict. Nothing analyze writes has changed, and no
  verdict already published is rewritten, retracted or re-judged.

## 0.66.0

- `/nxs.distill` now reads the instructions for a path only once it has established that the run
  takes that path. The stage resolves the run's shape first — its mode, the workspace shape, each
  entry's recorded kind, and whether the concept store has a domain registry — and then loads only
  the contracts that shape names. The ordinary drain, a single-repo checkout draining epic entries
  with no recovery, no close hand-off and no registry, loads none of them: the recovery procedure,
  the continuation exceptions, the hub rules, the fix and intake rules and the taxonomy gate are no
  longer part of what it reads. The stage's loaded size for that run drops by about a third, and a
  check now holds it under a recorded ceiling with a second check naming any rule that moves back.

  Nothing any path does has changed. Every refusal, gate, diagnostic and ordered step is the same
  one, in the same order, reached from the contract that now states it. A recovery run, a
  continuation hand-off, a hub drain, a fix or intake entry and a store with a registry all behave
  exactly as they did before.

## 0.65.0

- **The decision-record checkpoint now reads exactly like the epic approval gate.** Both gates used
  to ask you to learn two idioms. At the planning gate a number flipped a tick. At the record
  checkpoint a number deleted, off a bare numbered list with no ticks on it. A lead who ran both
  stages in the same week read "type 3" two ways.

  The checkpoint now renders one numbered checklist with **every line already ticked**, numbered as
  one sequence from 1 across refuted alternatives, model-added invariants and model-added risks
  alike. A number flips exactly one line, whatever kind it is, and one typed selection covers the
  whole list. Typing nothing files the record as drafted, with no re-render and no second
  confirmation.

  **The convention itself has not changed** — this gate still removes, and a plain approval still
  files the record minus nothing. What is aligned is how you read the list and what a number does to
  it, not which direction the default points.

- **A line the approved record already carries is now marked frozen, and refuses to be cut.** On a
  `--revise` run the draft re-derives most of the invariants the approved body already holds. Cutting
  one at the checkpoint would change approved content outside the supersession comment trail, which
  is the one place a superseded record state is reconstructible from. Those lines are now marked
  where you read them, and typing one's number is refused with the reason and the route stated: the
  change belongs in the drafted body under the revision path. An epic with no record, and one whose
  record is still open, are unaffected — an open body is edited in place by design, so nothing about
  it is frozen.

## 0.64.0

- **The decision-record checkpoint now shows you every invariant and every risk the drafting model
  added.** The stage has always labelled each invariant and each risk as yours or its own, and
  checked each quotation against what you typed. None of that ever reached your screen: the
  checkpoint listed the refuted alternatives and nothing else, then the labels were stripped and the
  record was filed. A constraint the model invented on its own became binding on the build without
  anybody being shown that nobody had asked for it.

  The checkpoint's list now holds all three kinds — every refuted alternative, under the decision it
  belongs to, then every invariant the model added, then every risk it added — numbered as one
  sequence from 1, in the record's own section order. One typed selection cuts any of them, whatever
  kind it is, and the cut lands before the record is filed.

  **An invariant or a risk you asked for is not listed.** That is your own definition of the epic,
  and striking it is a revise rather than a cut — the same treatment the planning gate gives an
  acceptance criterion you asked for.

  The list is no longer assembled by the drafting model. It comes from the same checker that builds
  the planning gate's checklist, and the stage transcribes it, so a line the model added can no
  longer quietly fail to reach you.

## 0.63.0

- **`/nxs.distill` no longer substitutes a diff when a recorded revision cannot be reached.** The
  single-repo fallback that re-derived the diff from the commit which introduced the queue entry is
  gone, and so is the prompt that asked you for a replacement base and head. A failure from diff
  derivation — an unreachable recorded base or head included — now blocks that one entry, reports
  the tool's diagnostic, leaves the entry's files untouched, and lets the rest of the run drain.

  This is a behaviour change. The fallback fired on a stale or shallow checkout just as readily as
  on a legacy entry whose history was rewritten, and on that far more common cause it wrote a
  different change's diff permanently into the concept store. A blocked entry is recoverable; a
  wrong concept page is not. The block names both remedies: update the checkout the range points
  into, or correct the recorded range stamp in the entry's `close-record.md`, then re-run. A blocked
  entry is never auto-deleted and is rediscovered by the next run.

- `/nxs.distill`'s command document now states each of its rules once, at the step that acts on it.
  The closing rule recap is gone, the three entry kinds have one contract instead of eight scattered
  restatements, the checkpoint / pull request / completion report render one run summary instead of
  three definitions of the same values, and the descriptions of the delegated programs keep the
  invocation, the consumed output and the failure action without re-explaining how each program
  works inside. Apart from the removed fallback above, a run over an unchanged queue produces the
  same checkpoint decisions, the same pull request body and the same counts as before.

## 0.62.0

- **The epic approval gate now shows you the filed set as one pre-ticked checklist.** The digest used
  to list every drafted story, then offer a separate numbered list below it saying which of them a
  plain approval would actually file, with a third group for criteria and a fourth for boundaries —
  and a number meant *add* under one heading and *delete* under another. You had to hold two sets in
  your head and diff them to know what you were approving.

  There is now one list. Every story, every model-added acceptance criterion on a story being filed,
  and every assumption and out-of-scope item appear once, numbered in one sequence, each line already
  ticked or unticked to show exactly what a plain approval files. Every line states whether you asked
  for it or the drafting model added it, and an asked-for line quotes the fragment of your own words
  it rests on. **A number flips the line it names**, in whichever direction that line is set, so one
  typed selection both adds and removes.

  What this changes for you beyond the reading: **you can now drop a story at the gate.** Previously
  only criteria and boundaries could be struck, and removing a story from the smallest usable version
  meant revise, hand-edit and re-run. Unticking one is enough, and it is treated by where the story
  came from — an asked-for story defers as an unplanned epic issue, a model-added one is discarded.
  The `## Smallest Usable Version` line is re-derived from what you actually filed, so it no longer
  reaches the issue naming a story nobody planned.

  Assumptions and out-of-scope items you *asked for* are now listed too, not just the inferred ones.
  The boundary you approve is the whole boundary; the provenance beside each line is what tells them
  apart.

  The default is unchanged: a plain approval still files the smallest usable version and nothing
  else, and an empty selection is still identical to a plain approval. The ticks are written into the
  text rather than rendered as a checkbox control, because that control cannot arrive pre-ticked
  and an untouched box would then mean *drop it* — which would make a tired reviewer lose scope by
  inaction, the exact failure this default exists to prevent.

  The checklist reaches you **inside a code block**, so the ticks and the numbers arrive as the gate
  computed them. Rendered as ordinary markdown, a `- [x]` line is consumed as a task-list control and
  the numbers are re-sequenced from the list's own position, and you are shown an unnumbered,
  untickable list naming nothing you can flip. The same rule now covers the decision record's
  refuted-alternatives cut list, where the renumbering would silently make a typed number name a
  different alternative.

- `nexus razor-offer` prints that checklist instead of the offer list. It now emits every line the
  gate renders — ticks, numbers, sizes, blockers and provenance across stories, criteria and
  boundaries — so the gate transcribes one command's output rather than hand-numbering three groups
  after it.

- **The pipeline now runs in Codex as well as Claude.** Install with
  `nexus install --harness codex`, then invoke `$nxs-setup`, `$nxs-epic`, `$nxs-analyze` and the other
  stages as skills. Both harnesses use the same authored workflows, helpers and review roles.
  Codex setup reads and updates `AGENTS.md`; approval gates accept a conversational answer when
  a choice tool is unavailable, keeping a numbered checklist and its flips in one response.
  Specialist reviews run sequentially, with disclosure, when subagents are unavailable. Claude
  remains the default and its component bodies are unchanged.
- The install, uninstall, version and deploy commands accept `--harness claude|codex`.
  Codex skills live at the account's standard skill location and can coexist with Claude.
  Updates and removal affect only the selected harness. A Codex install from a checkout is a
  generated snapshot: re-run installation after edits; Claude's live pointers still work.
- The headless epic implementation and analyze loop accepts `HARNESS=codex`, uses Codex's event
  stream and stops on a failed turn before pushing. Its default remains Claude.


## 0.61.0

- **The teaching stage leaves Nexus.** `/nxs.teach` and `/nxs.teach-plan`, the `nxs-workbook` skill,
  the `nxs-concept-extractor` subagent and the `nexus workbook` verb are no longer part of this
  package. They ship as `@sameeraperera/nexus-teach`, which installs beside Nexus into the same
  component root, under its own `nxsx` prefix: `/nxsx.teach`, `/nxsx.teach-plan`, `nxsx-workbook`,
  `nxsx-concept-extractor`, and the `nxsx` executable.

  If you teach a roadmap, install that package and use the new names; the surface is otherwise
  unchanged, and a workbook, a plan and a lesson page written under the old names are read as they
  are, with nothing to migrate. If you do not, `nexus install` simply places four fewer components.
  Either way the concept slugs the stage was written under still resolve here, as retired entries
  saying where the concept went.

  One stage changes what it does. `/nxs.decision-record` no longer pins a workbook's sources when it
  closes a record — it does not drive a verb it no longer ships. It reports that the record is closed
  and available to pin from, and the pinning is the teaching stage's own step.

- A package's install now sweeps the files its own record claims, whatever they are named. The
  sweep built its candidate set from the Nexus prefix *before* it consulted the record, so a
  component under any other prefix was never a removal candidate for anyone — including the package
  that placed it, which is the only thing entitled to clear it. A second package could add
  components and never retire one. Nexus's own sweep is unchanged, and still leaves another
  package's files alone.

- The package now publishes the sources of the five libraries a second Nexus-ecosystem package
  builds against — workspace resolution, the delivery config, epic resolution, the record digest
  and the release identity — under `@sameeraperera/nexus/lib/<library>/<module>`. Nothing about an
  existing install changes: the executable is still one self-contained bundle, and these sources are
  a build-time surface for another package, never a runtime dependency. It exists so the teaching
  stage can ship separately without a second copy of Nexus's workspace and epic resolution going out
  of step with this one.

## 0.60.0

- `analyze`, `close` and `intake` now withhold the pipeline stores from the diffs they derive when
  the lead's shell is zsh. Each captured the exclusion list into a shell variable first, and zsh
  does not word-split an unquoted variable, so git received one nonsense pathspec, withheld
  nothing, and still exited 0. The failure was silent and it failed open: queue and discovery churn
  reached the close record and the conformance verdict, and a change whose only content was
  pipeline-store edits passed `intake`'s "nothing to record" refusal instead of being stopped by
  it. A lead on bash sees no change, and `distill` was already correct.

## 0.59.0

- `distill` now refuses a concept page whose `touches:` names a page the store does not hold. A
  dead edge used to pass the validator silently — the page that left took no bullet with it, so the
  edge matched itself on both sides — and a drain could publish one without anything saying so. The
  check runs both on the whole store and on the handful of changed pages a drain validates, and it
  blocks: drop the edge, or restore the page it names.
- `setup`'s install and uninstall verbs now share a component root with other packages instead of
  owning it. Each install records the files it placed, and removes only those; a file another
  installed package placed is left alone, and uninstall clears this package's set rather than
  every file carrying the namespace. An install that overwrites a file another package also ships
  says which ones, and that whichever package installed last is the body that runs. An install
  location that has no record yet — every one that exists today — behaves exactly as before, and
  the record it writes is what scopes the next run.

## 0.58.0

- `/nxs.teach` now earns a **reference page** for a concept the session drills a second time. The
  brief and the session's report name the concept, and the prose file may carry the page under a
  `reference` key. The lesson is still written when the page is left out, and every later session
  names the concept again until its page exists. The page renders beside the lessons from the
  workbook's `reference/` folder, and each lesson that drilled the concept links to it from its
  warm-up. The render refuses a reference file that names other than one concept, covers a concept
  no written lesson taught or another file already covers, or runs past five hundred words
  (epic #481, decision record #659).
- A printed workbook page no longer clips a long line of code. On paper a code block now wraps
  instead of scrolling, so every committed workbook re-renders once and `nexus workbook check`
  reports its pages as changed until it does.

## 0.57.0

- `/nxs.epic` and `/nxs.decision-record` now tell the lead which form an HTML mockup's link will
  take **before** approval: the approval digest carries the renderer the intake answer resolved, so
  a lead who wanted the other form can abort, configure and re-run rather than discover it on an
  issue that is already filed. After publishing, the stage says on the console which form it
  actually filed, so falling back to the plain link is never silent. A repository that names no
  renderer files exactly the bodies it filed before. A private store with a renderer named is a
  warning the lead decides on — a renderer cannot read a private store yet — never a refusal.

## 0.56.0

- `/nxs.epic` and `/nxs.decision-record` now build an HTML mockup's reference from a renderer a team
  names, so a reviewer following that link in a filed issue opens the mockup as a page instead of
  reading its markup. The team declares one address template carrying a `{url}` slot, and the
  filing stage substitutes the asset's commit-pinned address into that slot verbatim. Every other
  asset — and HTML in a repository that names no renderer — keeps exactly the reference it had
  before. A named template that is not an absolute web address, or that carries no slot, stops the
  stage at intake, before the draft exists.

## 0.55.0

- `/nxs.epic` now deletes its own run folder (`nexus planning-dir remove`) once every issue it will
  file exists on GitHub — the epic and every story issue on the full-epic path, every stub issue on
  the decomposition path — so a checkout no longer accumulates drafts of work that already shipped
  as issues. Any ending short of a complete filing (an `⚠️ INCOMPLETE` create-story run, a failed
  stub or gist post) leaves the folder untouched, so the same run can be repeated against it exactly
  as it could before this release.

## 0.54.0

- `/nxs.epic`'s decomposition path (Phase 2b) and story-filing path (Phase 6) now write every
  transient work-item — the stub bodies, the discovery gist files, and the per-story issue
  work-items — into the run's own `RUN_DIR`, the same folder the draft and its source text already
  live in, instead of a separately named scratch location. Everything one run will ever file from
  is now readable from one place, before and after it is sent (decision record #646).

## 0.53.0

- `/nxs.setup` now appends a `.nexus/tmp/` line to `.gitignore` when one is not already present,
  idempotently. Planning drafts and materialized epics both assume that exclusion; making it true
  once at setup replaces every planning run re-checking it for itself.
- `/nxs.distill`'s drain scan now states explicitly that a planning run's folder
  (`.nexus/tmp/planning/<run-name>/`, decision record #646) is never a drainable entry and is never
  recursed into — it sits one level deeper than the `<kind>-<n>/` shape the scan looks for and
  carries no close record. No behaviour changed; the scan already skipped it by construction, and
  this is the explicit guard against a future change accidentally teaching it to recurse there.
- `/nxs.epic`'s Phase 4 notes on the source text and the assets-intake result now describe them as
  staying inside the run's own folder rather than "session scratch", matching the folder's new home.

## 0.52.0

- `/nxs.epic`'s approval digest, its resume report and its revise report now all name the
  repository-relative path to the run's full draft (`${DRAFT_DIR}/epic.md`) beside what they show,
  instead of pointing at an unnamed "session scratch". The digest is a condensation; naming the full
  draft beside it lets the reviewer check the condensation instead of trusting it, and a `revise`
  or a resume both read back the exact path just reported.

## 0.51.0

- `/nxs.epic` now drafts an epic into a per-run folder inside the checkout, under the gitignored
  `.nexus/tmp/planning/`, instead of the invoking harness's own session temp directory. A lead can
  now open the full draft in the same editor that already has the checkout open, and a resume check
  finds a pending draft by listing that folder (`nexus planning-dir list`) rather than reaching
  outside the repository. The new `nexus planning-dir` command (`ensure` / `list` / `remove`) is the
  deterministic tool layer decision record #646 asks for: every phase of one run agrees on the same
  path, and removal runs behind a guard that refuses any name that is not a plain folder under the
  planning namespace.

## 0.50.0

- `epic`, `decision-record`, `distill`, `discover` and `teach` no longer load the `nxs-prose-style`
  skill, and the skill is removed from the package. Each of those five stages now carries one short
  rule block directly above the step that writes a human-facing artifact. The block states the six
  plain-language form rules, one before-and-after sentence pair, and the text the rules never touch.
  A lead sees the same artifacts drafted under the same rules, stated where the model is about to
  write instead of in a file loaded at the top of the stage. The two content rules, write concrete and
  add nothing, stay in each stage's prose convention.
- The `epic`, `decision-record`, `distill`, `discover` and `teach` command bodies, and the razor
  skill they load, are rewritten in the plain register they ask for: no em-dash asides and none of
  the coined words the removed skill forbade, and each file is shorter than before. No stage decides,
  gates or refuses anything differently. Every heading, gate name, command line and counted limit
  reads as before. A lead should see the same stages draft plainer artifacts, because the largest
  text in the model's context is now an example of the wanted style instead of a counter-example.

## 0.49.0

- `epic`, `decision-record`, `analyze` and `close` now write a cross-repository issue reference in
  the qualified `owner/repo#N` form on any surface published outside the repository the issue lives
  in. In a multi-repo workspace the issues live in the repository `epic-repo` names while the code
  and the pull requests live in a member. Before this release an `analyze --pr` review posted on a
  member's pull request said "epic #114", and `#114` resolved to an unrelated issue in the member
  repository. A reference written onto a surface in its own repository — the close comment on the
  epic issue, a story body — stays bare, because qualifying it there would add noise and no
  information.
- The materialized `epic.md`, the analyze receipt and the close record now declare the repository
  their bare numbers resolve against. `epic.md` and the close record carry an `issues_repo:`
  frontmatter key, and the analyze and close machine blocks carry an `issues_repo:` field beside the
  existing `repo:` field, which names the code repository. Both keys are omitted when the two
  repositories are the same, so a single-repo project's artifacts are unchanged. A reader that finds
  no key resolves the numbers against the repository it already knows, exactly as before.
- `analyze --pr` now names the target repository when it publishes its review or its comment. A
  member-qualified `--pr owner/repo#N` previously let `gh` pick a base repository from the
  checkout's remotes, which is the same failure the previous release fixed for the pull-request
  reads.

## 0.48.0

- `analyze`, `close` and `distill` now read the trunk and the pull request from the repository the
  work is contributed to, not from the checkout's `origin`. A lead who works from a fork has an
  `origin` naming their own copy: it carries no `pull/<N>/head` ref for a pull request opened
  against the canonical repository, and its `main` can be far behind the merge. Before this release
  `analyze --pr` failed to fetch the pull request's head in such a checkout, `close --pr` cut the
  distill branch from the fork's stale `main`, and the close record stamped the fork as the
  repository the work landed in. The rule is now: read `upstream` when the checkout declares that
  remote, else `origin`. Pushes are unchanged and still go to `origin` — the lead pushes the distill
  branch to their own fork.
- `analyze` and `close` also name that repository when they ask GitHub about the pull request.
  Left to itself `gh` picks a base repository from the remotes it finds, so in a fork checkout its
  answer and the fetch's answer could be two different repositories, where one pull-request number
  means two different pull requests.
- Stages that resolve the trunk in shell ask the toolkit for it (`nexus trunk`, and `nexus trunk
  --form remote` for the remote alone) instead of writing `origin/main` out, so the stage bodies
  and the `--pr` machinery cannot answer the question differently. A checkout with no `upstream`
  remote behaves exactly as it did before.

## 0.47.0

- `epic`'s approval digest no longer drops the assumptions and out-of-scope items the drafting model
  inferred. They are the boundary the smallest usable version was drawn inside, so a plain approval
  now files them, and the digest calls each one out in a numbered **Boundaries** group. Naming a
  number deletes that item before filing. Before this release a plain approval deleted every
  inferred assumption and exclusion, and an epic could file with both sections empty.
- `epic`'s approval digest now files the acceptance criteria the drafting model inferred on a plain
  approval, as the razor always stated. They are listed under **Inferred criteria**, and naming a
  number deletes that criterion. Before this release a plain approval deleted them all, so a filed
  story could be left with one criterion or none.

## 0.46.0

- `/nxs.decision-record` gains Phase 4 step 8: when step 6 closes the record and a committed workbook
  plan teaches the epic, the stage pins each learner slice's **sources** with `nexus workbook pin
  <slug> --epic <n> --sources <file>`. Sources name the record section stating the invariant the
  slice's story implements, and one exemplar file already in the tree. Pinning at approval puts the
  sources in place before any lesson in the epic is written. A Phase 4.5 re-close runs the same step.
  A record left open for review pins nothing, and the report tells the lead to run the step once it
  is closed. In a workspace the verb reads the epic and its record from the hub. A record that is not
  approved yet, or one closed as not planned, pins nothing and is not an error; a slice already
  pinned keeps its sources; a handoff slice or a scaffold is never pinned, and a plan carrying sources
  on one is refused. Every learner slice of the epic is pinned together or none is, and a re-approval
  of the plan keeps sources already pinned.
- Pinned sources are checked against what already exists, so a lesson's grounding is traceable: the
  section must be a heading the decision record carries that holds no other section. A refuted
  alternative names the decision heading that states it — an invariant under Constraints & Invariants
  takes its alternative from a Key Decisions entry — and must be one that decision states, with what
  it lost on. It is owed whenever the named section itself states one, and when the record states
  none it is omitted rather than held as a placeholder. The exemplar must be one file present in the
  repository. Any mismatch refuses the whole pin and writes nothing.

## 0.45.0

- `epic` accepts `--assets <path>…`: local diagrams, mockups and sketches the filed issues should
  carry. The draft names them by local path and nothing leaves the machine before the approval gate;
  on approval each file a body references is published into the team's declared asset store, one
  commit per file, and the local path is replaced with a reference pinned to that commit — an image
  renders inline, every other file (HTML included) is a link to the version approved. A missing path
  or two files sharing a name stops the run before drafting; a declared file no body mentions is
  reported and not published; a repository that declares no store says assets are unsupported once
  and files the same issue bodies it filed before. The approval digest names the store and its
  visibility, and warns — without refusing — when a public store backs a private issues repository.
  A run resumed after `revise` recovers the declared assets from the draft folder, so the rewrite
  and the clean-body assertion run on the resumed filing as they do on a first one. The store (`asset-store`, `owner/repo` or `owner/repo@branch`) and the per-file cap
  (`asset-size-cap`, default 5 MB) are declared once, in the same settings block as the issues
  repository, and a hub may declare them for every member.
- `decision-record` accepts the same `--assets <path>…`, on a first filing and on `--revise`: the
  record sub-issue carries the diagram the decision was made against, published only after the
  pre-filing checkpoint is answered with an approval and referenced at the commit that published it.
  A revision's new assets are new commits even when they reuse a file name, so every reference in
  the superseded body still resolves. A repository with no declared store files the record without
  them and says so once.

## 0.44.0

- `/nxs.teach-plan` gains Phase 7 — the **approval gate**. `nexus workbook gate <name>` refuses, in
  code, a draft whose coverage verdict is missing, names a gap, or is contradicted by a fresh check of
  its slices, and names every gap. A clean draft prints one digest for the whole roadmap, however many
  epics it spans: every slice in order with its mark, each split story with its parts, each scaffold
  beside the slice that forced it, each removed concept beside the learner's phrase, the phrases that
  matched nothing, and whether the focus matched no story. The agent shows it word for word. The
  reviewer may change a slice's mark with `--mark <story>=learner|handoff`, which rebuilds the draft
  from the recorded judgements and prints the gate again, or approve.
- Approval, `nexus workbook gate <name> --approve --commands <file>`, writes the **committed plan**
  the `/nxs.teach` session teaches from. It refuses a draft that changed after the gate was printed,
  refuses without reviewer-declared suite and grading commands, and refuses — naming each story —
  when a story on the issue graph changed since the roadmap was resolved. Every story is pinned to its
  state at the moment of approval. Lesson names come from each slice's identity, one branch per story
  is prefixed with the workbook, each slice records its own epic, and the dependency edges between
  slices are recorded. None of the learner's interview words reaches the committed workbook.
- `/nxs.teach` now teaches a plan with **split stories and scaffolds** step by step: a split story's
  next part is taught once the previous part's exercise is finished, each part has its own lesson, and a
  scaffold is taught by writing its lesson. A handoff prompt names the epic its own slice belongs to
  and never lists a scaffold among the slices to leave alone. A slice's **pinning test is written on
  arrival**: the brief asks for it when the plan holds none, and at a handoff the session asks for the
  handed-off slice's test and the next story slice's test before it writes the prompt. A test is
  recorded once and never rewritten.
- A `/nxs.teach` session that stopped on drift can now be continued: the learner **re-approves** the
  plan through `/nxs.teach-plan`. The rewrite keeps every slice up to the last written lesson first and
  unchanged and plans only the rest, so no written lesson is taught again and no concept is introduced
  twice. Re-approval pins the changed story to its current state, reuses the committed plan's commands,
  and refuses — leaving the approved plan, its lessons and its pages unchanged — a draft whose coverage
  is not clean, one not planned over the taught part, or one whose merge renamed a concept identifier a
  written lesson carries.
- An approved plan now renders a workbook **home page**: every slice in plan order with the slices it
  depends on, including the edges from one part to the next and from a scaffold to the slice it serves.
  A slice with a written lesson links to its page, one without is shown as not yet written, a handoff is
  marked as handed off, and a scaffold as a teaching step. Approval, every `/nxs.teach` session, and
  `nexus workbook render` and `check` all produce it from the plan and the lessons, so it exists before
  any lesson is written, stays current after each session, and needs no network to display.

## 0.43.0

- The `/nxs.epic` approval gate now **checks the set you approved before it edits anything**, so an
  addition whose prerequisite you did not also take is caught instead of quietly re-wired. The gate
  used to re-parent a dropped story's dependents onto that story's own blockers first, which left
  every approved set closed by construction and the closure rule unable to fire in the direction the
  addition convention added it for. It now re-checks closure over the graph as drafted, returns to
  the choice naming both stories, and re-parents nothing on your behalf: you take the prerequisite
  too, or drop the addition.
- The epic's **`complexity` rollup and the needs-design label are now checked against the stories you
  actually filed**, not only re-derived by hand. The rollup may not sit below the largest size in the
  filed set, and it may not sit above it while `complexity_drivers` states nothing that raises it.
  How far cross-story integration raises it is still your judgement — what is checked is that the
  judgement was made over the set that shipped, and stated.
- The gate's offer list takes its **order and its numbering from the checker** rather than deriving
  them again in prose, and `/nxs.epic` derives the filing body — provenance labels and the ordering
  block removed — with the same checker, which asserts what it wrote. Only the two groups a selection
  can act on are numbered now: what a plain approval files is shown as plain bullets, so no number
  names an action the selection has no meaning for.
- A deferral stub written for a single story now says `deferred: 1 story`, the form the deferral
  floor reads back, so a one-story deferral is recognised as the floor and defers nothing further.

## 0.42.0

- The razor's rule set now describes **two gate conventions over one shared shape**, rather than one
  convention it asserts for both gates. The shape is unchanged — numbered prose grouped by parent,
  coarse actions, a typed list of numbers, an empty selection identical to a plain approval, and
  nothing applied to content a prior partial run already filed. The planning gate's convention is
  **addition**, and the rule set states exactly what a plain approval files and what happens to each
  group the reviewer does not take. The decision-record checkpoint's convention is **removal**, and
  the rule set says why that gate has nothing to add to: a refuted alternative is not scope. The
  precedence clause still holds across the split — where a stage's own wording disagrees with the
  rule set, the rule set governs.

## 0.41.0

- Scope you asked for that the smallest usable version does not need now **survives as a planned-later
  item** instead of being dropped at the gate. After the epic's own issues are filed, `/nxs.epic`
  files one epic stub carrying the titles of the asked-for stories you did not take — through the
  same stub producer, the same unplanned label and the same resumability the oversized path already
  uses, so planning it later meets this same command and this same gate. It carries story titles
  only: a deferred title is drafted again when it is planned, so no acceptance criteria travel with
  it. Its source line names the originating epic by issue number. Scope the drafting model added that
  you declined is still discarded and carries into no stub, and an epic whose smallest usable version
  needed every asked-for story files no stub at all. The stub's number is recorded back on the draft,
  so re-running a partly completed filing never files a second one. The chain terminates at a floor:
  a planning run that consumes a single-story deferral defers nothing further.

## 0.40.0

- Adding a story at the `/nxs.epic` gate now re-derives what the story set determined, the way
  removing one always has. The epic's `complexity` rollup, the **needs-design** label that follows
  from it, and any utilization-risk banner in the body are re-derived in **one step**, fired by any
  difference between the drafted story set and the filed one — in either direction. Additions that
  carry the epic past the threshold gain the design warrant; ones that leave it below do not get it.
  A warning the filed epic still carries describes the story set that was actually filed, not the
  draft as first written. The same step re-checks closure over the filed set and re-runs the epic
  gate, because a set the reviewer assembled at the gate has been checked by nothing until it does.

## 0.39.0

- **The `/nxs.epic` approval gate now offers additions instead of cuts.** A plain approval files the
  smallest usable version and nothing else. Every other story is offered in one stably numbered list
  under *Additions*, and you file it only by naming its number. The stories you asked for sort first
  and are rendered as asked-for, each carrying verbatim the fragment of your own words the drafting
  model cited for it — so a story claiming your authority is a claim you can reject in the one place
  you are already deciding. Within each group the order follows what unlocks what, never a ranking by
  value. A model-added story you do not take is discarded and leaves no trace. The inversion is at
  story granularity only: a model-added acceptance criterion, assumption or out-of-scope item on a
  story that *is* being filed stays opt-out, listed under *Removals*, and one typed selection covers
  both directions. An empty selection is still identical to a plain approval.
- Every **story heading** in a drafted epic now carries a provenance label, because a story's label
  is what decides whether it is filed by default. `nexus razor-check` blocks an unlabelled heading and
  checks an `asked` heading's fragment against the run's source text like any other citation.

## 0.38.0

- The smallest usable version an epic names is now **checked before you see the approval gate**, not
  taken on trust. `nexus razor-check` walks the draft's ordering block over the
  `## Smallest Usable Version` line: a name matching no story stops the run, and so does a story in
  the set that waits on a story the set leaves out — the finding names the draft, the story and the
  blocker, so the fix is obvious without hunting. A set that cannot run is never rendered to a
  reviewer. The same rule is applied a second time at apply time, over the set actually approved for
  filing. A draft with no such section raises nothing, and no minimum-count rule is added anywhere.

## 0.37.0

- `/nxs.epic` now settles the story order **while it drafts**, not after you approve. A drafted epic
  carries one `## Implementation Order` block naming each story's blockers by title, the approval
  digest shows you what each story waits on beside the story itself, and filing derives its sequence
  from that same block — so the ordering you approved is the ordering that gets filed. `nexus
  razor-check` blocks a draft whose block leaves a story unplaced, names a story that does not
  exist, or forms a cycle. The block is drafting-time only: it is removed when the filing body is
  derived, and the assertion that no drafting-time token reaches an issue now covers it, because
  once the issues exist GitHub's own dependency edges are the graph.

## 0.36.0

- `/nxs.teach-plan`, the planning phase that turns a planned **epic** into a teaching roadmap, gains
  Phase 6 — the rewrite. `nexus workbook rewrite <name>` replaces the plan draft the planning pass
  just wrote with one whose slices are **ordered** and in which every concept is introduced once and
  assumed thereafter. The order respects the roadmap's dependency edges and, among the orders those
  edges permit, takes at every step the slice introducing the fewest concepts not yet introduced;
  ties break by ascending story number, so a roadmap rewritten twice with nothing changed holds the
  same slices in the same order. Ownership follows from that order: a concept belongs to the first
  slice that reaches it, and every later slice that proposed the same concept now records it as
  assumed. A slice whose every concept an earlier slice already teaches stays in
  the plan and introduces nothing, so its story is never dropped. With `--declare <file>` the phase
  also removes what the learner said in the interview that they already know, reporting back which
  of their words matched no concept the roadmap teaches. A slice that would introduce more than four
  new concepts — the ceiling for what one sitting can carry — now becomes the fewest parts that all
  fit, spread as evenly as those parts allow, sitting consecutively where the original sat and each
  naming the same story; a later part assumes what the earlier parts taught. The plan draft
  therefore admits **several slices for one story**, each saying which part of it it is, where
  before one story was always one slice. Where a slice assumes a concept that no permitted ordering
  of the real work could introduce beforehand, the rewrite inserts a **scaffold** immediately before
  it — a teaching step that teaches exactly one concept, names no story, is identified by that
  concept and records which slice's assumption forced it. Reordering is tried first, so a concept
  some permitted order could deliver in time gets that order rather than a scaffold; a concept no
  story introduces at all is scaffolded; a concept only a handed-off story would introduce never is.
  The draft contract therefore also admits a **slice with no story**. Each handoff slice is then
  placed immediately before the earliest learner slice it unblocks, with several handoffs for one
  slice forming one block before it, and a handoff that unblocks nothing ordered after every learner
  slice — so a coding agent is handed the non-focus work at the step that needs it rather than all
  of it at the start. The rewrite then checks the finished plan
  for coverage and names **every** gap: a learner slice assuming a concept no earlier learner slice
  introduces, and — named as such, with the story it came from — a learner slice assuming a concept
  only a handed-off story would introduce, which says the focus boundary is drawn in the wrong
  place. A concept no story on the roadmap introduces at all is background, not a gap. The plan is
  written whatever the verdict and carries it, but the phase stops rather than handing a plan with
  gaps to approval. The rewrite reads no story text and no issue graph, so the planning session
  still holds neither.

## 0.35.0

- `analyze --pr` now resolves a pull request to the stories it actually implements. A reference in
  the pull-request body counts only when it names the issues repository **and** says the pull
  request takes the work on — a closing keyword, `implements` or `part of`; a bare number, a
  reference to another repository, and a story the body merely cites as background no longer reach
  the story list. **Breaking:** a pull request whose only signal was an unqualified mention in its
  body now stops the gate instead of resolving. Pass `--story <n>` — which now replaces candidate
  gathering entirely, reading no other text — or add a claim of scope to the body. Because the
  story list is stamped verbatim onto the receipt the epic aggregate trusts, a lead should dismiss
  or edit reviews published by `analyze` before this release on any epic still open: a receipt
  written under the old rule can still name stories nobody read, and `close` will pass on them.
- `analyze --pr` no longer stops on a number that matches no issue: it is set aside and named in
  the refusal, while a genuine GitHub failure — an unreachable host, a rejected credential, a rate
  limit, a missing repository — still stops the run and reports itself.
- `analyze --pr` reads GitHub's own closing-issue links only when the pull request lives in the
  issues repository, since that linkage is same-repository by construction and a member pull
  request's numbers would otherwise collide with hub story numbers.

## 0.34.0

- `nxs-landed-reference`'s Section E gains E.2, the same-kind reconciliation: re-running `/nxs.fix`
  or `/nxs.intake` against a number that already carries an entry of that lane's own kind now
  rewrites the entry in place — wholesale, at the point of writing, announced before anything is
  replaced — instead of silently colliding or silently overwriting. A same-kind entry recorded
  against a different reference, or reached only through a linked pull request or issue, still
  refuses rather than rewrites, and an **epic**'s own materialization is never eligible for this
  reconciliation at all — only a fix or an intake entry ever is. `/nxs.intake` also refuses a
  rewrite over an entry that already recorded filed deferred-scope issues, naming them and the
  remove-and-re-run alternative.

## 0.33.0

- `/nxs.intake` now refuses a reference that carries the repository's epic classification, and
  refuses a reference whose number — or a number reached through a closing pull request or a
  closed issue — already has a `/nxs.fix` entry or an epic materialization recorded against it.
  Both refusals apply right after the reference resolves, ahead of the lane's own "this is an
  issue, not a pull request" refusal, so an epic reference is always named as an epic rather than
  being sent to `/nxs.fix` first.

## 0.32.0

- `nxs-landed-reference` gains a shared Section E stating the epic-classification refusal and the
  cross-kind collision refusal, generalized from "collides with an epic" to "collides with any of
  the three entry kinds — epic, fix, intake — that is not the caller's own." A slot is occupied
  only when the candidate entry's recorded reference resolves to the same repository, and the
  check now also reaches through a closing pull request or a closed issue, not only a reference's
  own number. `/nxs.fix`'s Phase 2 now loads this shared section instead of restating it inline,
  and gains the intake collision it did not check before.

## 0.31.0

- `/nxs.teach-plan` now plans the concepts of every story on a planned epic's roadmap after the
  interview. Each story is read
  once, by its own new `nxs-concept-extractor` subagent started with nothing but the story's
  number, and the planning session holds only the short list that subagent hands back — never the
  story's text. Every list passes a code check of shape, identifier form and size through the new
  `nexus workbook extract` verb; a bare empty list, an extra field or an over-long list counts as no
  readable list, and a refusal names what it refused cut to size, so no unchecked text of any length
  reaches the session. An identifier YAML would read as `true`, `false` or `null` is refused. The
  session then merges synonyms from `nexus workbook vocabulary`, so a concept two stories share
  carries one identifier, and the draft's vocabulary keeps every merged-away name as an alias of it.
  `nexus workbook draft` writes one stub per story —
  story, mark, introduced concepts and the new assumed concepts — as an uncommitted draft beside
  the roadmap. It writes only when every story has a checked list, and otherwise writes nothing and
  names every story that has none; a re-run re-extracts only those stories and any whose text
  changed. The draft is never written into the committed workbook, so it cannot be taught until it
  is approved.
- Every stub `/nxs.teach-plan` writes for a planned epic's roadmap now carries a mark: learner, or
  handoff to a coding-agent session the learner runs separately. A learner who named no focus in the
  interview gets every slice marked learner, read from the interview record's explicit whole-roadmap
  statement — so a story added after the interview is never handed off for that reason alone. When
  a focus was named, each extraction subagent also judges its story against the recorded focus
  words, a list without that verdict counts as unreadable, and code turns the verdict into the mark.
  The pass asks the learner nothing, a missing interview stops it before any subagent starts, and a
  focus that matched no story still writes the draft and says so. Verdict reasons are filed as
  personal records under the ignored learner folder and appear on no stub; the proposal file the
  subagent wrote is removed once it is checked, so the reason is kept nowhere else. A handoff mark builds
  nothing and starts no coding-agent session.
- A handoff stub in a planned epic's `/nxs.teach-plan` draft now carries only its story and its
  mark: no concepts, no sources and no lesson, so it never becomes a workbook page, and a stub
  offering any of them is refused. The handed-off story is still extracted and merged, and its
  checked list reaches the identifier a learner slice assumes through the vocabulary's aliases, even
  when the merge renamed what it proposed. The draft writes no
  sibling list; once approved, the shipped handoff prompt leaves every other slice of the plan —
  every other slice of the same epic included — to the learner.

## 0.30.0

- `close` no longer runs a member repository's own copy on any path: a member checkout is now a
  hard block at the workspace preflight, in both the plain and the `--pr` flow, naming the hub
  and the epic-addressed close as the replacement. The close-and-migrate path — the member-mode
  checkpoint items, the migration step, the push instruction — is deleted; a member epic closes
  from the hub instead, over its merged pull requests.
- The retired `nexus close-migration` verb (and its `preflight`/`migrate` subcommands) now
  refuses immediately, naming the replacement, instead of running the deleted migration. Its
  surviving, non-migration half — reporting a checkout's close role — is the new
  `nexus close-role` verb.
- A guard now pins that the only shipped code path removing a committed queue entry is the
  drain's own staged deletion, on its own branch; anything else that starts removing one fails
  the build until deliberately waived.

## 0.29.0

- A new `nexus queue-relocate` verb one-shot relocates every stranded entry sitting in a
  member's committed queue into the hub queue, in preparation for retiring `close`'s
  member-specific migration path: it gates every candidate entry across every present member
  before copying any of them, copies bytes without editing them, commits each entry path-scoped
  in the hub, and verifies the commit byte for byte against the source. It never removes the
  member-side copy — it prints the removal command for the lead to run as an ordinary commit.
  Re-running it against an already-relocated workspace copies nothing.
- `nexus workspace status` now names any present member whose committed queue still holds an
  entry, and says whether it has already been relocated to the hub or still needs
  `nexus queue-relocate`; the line persists until the member-side copy is gone.

## 0.28.0

- distill/close: attributing a queue entry to a repository is no longer positional. The drain-SLO
  report, and the hub's migrated-entry attribution, now name every distinct repository an entry's
  range list names, in the order they first appear, rather than only the first range entry's
  repository — an entry that shipped over several pull requests is chased at every repository it
  touched, not just one. Resolving which repository a provenance reference belongs to is likewise
  no longer positional: when a range list names more than one repository, the drain probes each
  for the epic's own issue and requires exactly one title match, asking the lead when that is not
  decisive. A resolution failure at the repository level (a missing checkout, an undeclared
  repository) is now reported once per repository rather than once per range entry that named it.

## 0.27.0

- distill: `nexus derive-entry-diff` now carries the pull request each range entry stamped
  (`pr:`, when present) through to the derived diff and its header line, so the drain can trace
  a behavioral claim back to the change that justified it. Code anchors written by a multi-entry
  drain now append which pull request last changed each path to the anchor's role text, and a
  path a later entry renamed or deleted away is no longer anchored. A repository's stored anchor
  identifier is now its newest drained head rather than the head of whichever entry happened to
  be recorded. The structured provenance token in a concept page's frontmatter and Decision Log
  heading is unchanged; the pull requests involved are named in the Decision Log entry's body.
  An entry stamped before this pull-request field existed degrades attribution to the repository
  and short head, named as a degradation in the drain's report — never silently.

## 0.26.0

- distill: the range reader no longer refuses a repository named by more than one range
  entry — an epic closed over several pull requests in one repository now drains, where it was
  previously blocked. It reads every stamped range entry, orders a repository's entries by
  ancestry of their recorded heads (never the order they happened to be stamped in), and emits
  one diff per range entry rather than one per repository; two heads that cannot be ordered by
  ancestry stop that entry by name rather than guessing an order. `nexus derive-entry-diff` is now
  the single reader for both hub and single-repo mode — single-repo mode resolves each entry
  against its own identity instead of running separate range-reading prose, and the interim
  `range-list-unsupported` refusal single-repo mode carried is deleted.

## 0.25.0

- close: closing an epic that shipped as several story pull requests now writes every close
  artifact on ONE branch for the whole epic, cut only after every story pull request's merge state
  is gated and its stamped head is verified as an ancestor of the trunk the branch is about to be
  cut from — never a branch per pull request, and never a worktree opened before those checks pass.
  `nexus pr-worktree open --pr <N1,N2,...> --mode close --branch <b>` derives every range, verifies
  the trunk, and opens the worktree in one all-or-nothing call, printing `{ wtPath, ranges: [...] }`
  instead of a singular `range`; a failed trunk check names the pull request and tells the lead to
  `git fetch origin main` and retry. A single `--pr <N>` keeps today's singular output unchanged.
  Because every story branch commits its per-user scratch into the same epic-keyed queue path, and
  every story pull request merges before this branch is cut and trunk-verified, every engineer's
  notes are present on that one branch by construction — nothing separately gathers them.

## 0.24.0

- close: closing an epic that shipped as several story pull requests, and hits a story with no
  discoverable pull request of its own, now stops and names that story instead of reading it as an
  ordinary missing analysis — the lead is offered a choice, per story, to waive it ("shipped inside
  a sibling's pull request") or stop the close. Declining on any missing story leaves the epic open.
  A waived story is written to GitHub only after the closure checkpoint, via a new `nexus
  epic-verdicts waive-story --story <N>` command, which stamps the resolved no-pull-request marker
  label the analyze-time aggregation already knows how to skip. The close record now names every
  waived story and its waiver date in a `Waived Stories` section.

## 0.23.0

- close: closing an epic that shipped as several story pull requests now stamps the close
  record's `range:` with one entry per pull request — each naming the pull request it came from —
  instead of one entry standing in for the repository. `nexus pr-worktree range --pr
  <N1,N2,...>` derives the whole list from the one existing merge-anchored derivation, called once
  per pull request; a range that cannot be verified for any single pull request stops the whole
  close before anything is written, with no partial list.
- distill: a single-repo drain that encounters a close record stamping several `range:` entries
  for its own repository now names the entry and blocks it (continuing with the rest of the
  queue) instead of draining one entry and silently dropping the others — that shape needs #214's
  reader.

## 0.22.0

- close: closing an epic that shipped as several pull requests now gates on every story pull
  request being merged, checked before the existing currency choice gate. A story pull request
  still open stops the close and names that pull request and its story — a hard block with no
  waiver offered, distinct from the currency check's stop-or-waive choice.

## 0.21.0

- analyze/close: `nexus epic-verdicts derive|currency|combined` no longer refuses to run against an
  epic that is itself a GitHub sub-issue (the promoted-child-of-an-initiative shape this
  repository's own epics use) — the collection step now resolves the epic without demanding proof
  it has no parent, a check meant only for the `--from` entry point.
- analyze: `nexus epic-verdicts combined` now withholds the pipeline stores (`.nexus/queue`,
  `.nexus/discovery`, the workbook) from every per-pull-request change set it unions, the same
  exclusion every other derived diff already applies.
- analyze/close: the story-verdict collection now searches every repository the workspace declares
  — not only the invoking checkout's own — so a story whose pull request lives in a declared member
  repository is found instead of silently missing.

## 0.20.0

- analyze: aggregate mode now falls back to today's ordinary full-epic conformance run whenever not
  a single required story carries a verdict — previously this was reported the same as a genuine
  partial gap. Only a mix of some-verdict/some-not stories now stops and names the gap. A story
  marked with the new `no-pr-label` (resolved through the shared publishing resolver, default
  `no-pull-request`) ships without its own pull request by design: it is excluded from the coverage
  requirement and named as excluded on the epic receipt, and never counts toward either the
  fallback or the partial-gap state.

## 0.19.0

- analyze: aggregate mode now judges the epic's success metrics and any decision-record invariant
  spanning two stories against the **combined** code of every story pull request — the one
  judgment no single story's own PR can carry. The new `nexus epic-verdicts combined` read prints
  the union of each story pull request's own changed-file set (each pull request's own diff, never
  a range spanning two of them, and no worktree created); a finding only the combined set shows is
  attributed to the epic rather than to a single story, and a cross-story check the combined set
  cannot yet decide is reported as unverifiable rather than passed silently.

## 0.18.0

- close: the choice gate now recognizes the aggregate epic receipt (a `stories:` list instead of a
  single `head:`) and re-checks it with the same `nexus epic-verdicts` helper that derived it,
  rather than reading it as a stale single-head receipt. A stale story is reported by name, on
  whichever axis — code or decision-record — it failed, never collapsed into one epic-wide "stale"
  statement. `nexus epic-verdicts currency` is the new read: it re-checks each story's verdict
  against that story's pull request's current head and, when a record is named, the record's
  current digest, and reuses `pr-acceptance`'s receipt parser (now also surfacing the stamped
  `record` / `record_hash` fields) instead of a second parser.

## 0.17.0

- analyze: when an epic's stories were each analyzed on their own pull request, `/nxs.analyze` run
  against the epic now detects their published verdicts and derives one epic receipt from them
  instead of re-running conformance from scratch. A story carrying no verdict on any of its
  candidate pull requests stops the derivation and names that story, rather than deriving a receipt
  with a silent hole in it. Findings are summed once per distinct verdict, never per story, so a
  verdict covering two stories is not double-counted. The new `nexus epic-verdicts derive` helper
  is the one program both `/nxs.analyze` and (soon) `/nxs.close` call for this, sharing the
  collection, trust and recency rules record #495 already fixed for a single pull request's
  verdict.

## 0.16.0

- analyze: `--pr` now resolves the epic and stories correctly for two pull-request shapes that
  previously resolved to the wrong issues, or to none. A PR carrying its `Closes #<n>` lines one
  per commit is now read from those commit messages — GitHub's own linked-issues field reads the
  pull-request *body* alone, so such a PR looked to the ladder as though it named nothing and the
  only signal left was its branch name. And a **pull request that ships a whole epic** — one
  branch, all of that epic's stories, a branch named for the epic — now resolves to that epic and
  its own live story set, instead of being mistaken for a story.
- analyze, decision-record: what an issue *is* now comes from the repository's declared
  `github.classification` — the `epic` / `story` / `decision-record` label under
  `classification: labels`, the corresponding GitHub issue type under `classification: types`,
  either one under the legacy default — and never from the issue graph's shape. The previous rule
  ("it has a parent, and that parent lists it back, therefore it is a story") cannot tell a story
  of an epic from an epic of an initiative: in a repository that files epics under initiatives it
  resolved one level too high, so `/nxs.analyze --pr` checked the initiative's non-existent
  acceptance criteria and decision record, and `/nxs.decision-record --from` refused every genuine
  epic as `not-an-epic`. Both now read the declared marker. When the declared mode's marker is
  absent and the other mode's marker would have answered, the run stops with
  `classification-mode-mismatch` rather than working around settings that do not describe how this
  repository files issues.
- analyze: a `--pr` run that resolves no story now names every candidate it considered *and why
  each was dropped*, rather than listing the numbers alone.
- analyze: the `--pr` mode machine block now stamps `repo` (the target repository actually read —
  the member, not the hub) and `stories` (the story issue number(s) the verdict covers), full and
  untruncated. `/nxs.close --pr`'s trusted-block selection is now scoped to the repository the PR
  lives in: the author-association check, the `pr:` match, and a new `repo:` match (when present)
  are all checked against that repository, so a block copied from a different PR — possibly in a
  different member — can never be read as this PR's verdict. A block predating epic #211 carries no
  `repo:` key and is always accepted, unchanged from before.

## 0.15.0

- analyze: in `--pr` mode, the epic and the story it checks now come from a validated candidate
  ladder (`nexus pr-worktree stories`) instead of GitHub's closing-keyword linkage alone — that
  linkage is same-repository only and produced nothing for a member PR whose story lives in the
  hub. The ladder tries an explicit story reference, the PR's own linked/closing issues, the
  `Closes #<n>` trailers in its commit messages, the issue number in its branch name, and
  repo-qualified issue references in its body, validating every
  candidate against the live issue graph; a PR resolving to no story stops the run and names what
  was considered, and one resolving to several is covered, not refused. Findings are now scoped to
  only the story (or stories) a PR implements, never every story of the epic, and success-metric
  coverage — a property of the whole epic — no longer runs in `--pr` mode at all.

## 0.14.0

- analyze: `--pr` now accepts a member-qualified reference (`owner/repo#N`) or a full pull-request
  URL, not only a bare number. From a hub checkout, this opens the `--pr` role gate to a declared
  member: the run reads that member's own checkout and code, and reports the member repository
  (not the hub) as what it read. Naming a repository the workspace does not declare, or a declared
  member not checked out where the workspace expects it, stops the run and says so. A bare number
  keeps its existing meaning — this checkout's own repository — and `/nxs.close --pr` is unchanged:
  it still refuses a member outright, with its refusal message now naming close specifically.

## 0.13.0

- analyze: the gate now runs only for an epic entry. Instead of naming each non-epic kind in its
  own refusal clause, the check inverts: any entry whose recorded kind is not epic — a fix entry, an
  intake entry, or a kind added later — stops the gate with a stated reason and writes no receipt,
  so a future kind can never fall through this check unnoticed.
- distill: the two razor refusals that used to name only `/nxs.epic` as the remedy for a landed
  change that needs a new page or a changed assertion now also name `/nxs.intake`, since the change
  behind the refusal has usually already shipped. The completion report and the distillation
  pull request body both state the count of drained entries by kind — epic, fix, intake — whenever
  more than an epic drained this run.
- The fix lane's advisory warning, printed when a fix's behaviours map to no existing page or would
  change what a page asserts, now names `/nxs.intake` for a change that has already landed,
  alongside `/nxs.epic` for one that has not been built yet.

## 0.12.0

- distill: an intake entry's pull request body is now re-verified at drain time against the
  fingerprint `/nxs.intake` stamped when it recorded the change. A body edited since, or one that
  can no longer be fetched, blocks that entry with no waiver and writes nothing for it — the
  remedy is re-running `/nxs.intake` and re-approving its gate, then re-running the drain. An
  unchanged pull request drains normally.

## 0.11.0

- distill: the drain now accepts a third recorded entry kind, `intake`, written by `/nxs.intake`.
  An intake entry drains with the full epic vocabulary — it may create a page, change what an
  existing page asserts, or add or retire an invariant — unlike a fix entry, which stays bounded to
  one appended decision-log line. The checkpoint before the distillation pull request names, per
  intake entry, every page it creates, every page whose assertions change, and every invariant it
  retires. Draining an epic entry or a fix entry is unchanged, including one discovered in the same
  run as an intake entry.

## 0.10.0

- No change to how any pipeline stage behaves.
- `/nxs.intake` now lists every follow-up its pull request names as a keep-or-drop item at its
  approval gate. A kept follow-up becomes an open epic stub issue on the same terms a deferred-scope
  stub filed at `close` already does; a dropped one is filed nowhere and named in no record.

## 0.9.0

- No change to how any pipeline stage behaves.
- New: `/nxs.intake` records a design change that already landed as a merged pull request whose
  reasoning was never approved by a decision record. Give one pull request reference; the lane
  derives what changed from the diff, reads why from the pull request body, its review threads and
  its commit messages, asks only about a decision none of those explain, and renders one approval
  gate before writing anything. Draining the entry it writes is later scope.

## 0.8.0

- No change to how any pipeline stage behaves.
- Internal only: the fix lane's reference resolution, range resolution and qualification rules
  move into a shared skill that a second landed-work lane will also use, so the two cannot
  silently drift apart. `/nxs.fix` itself still writes the same entry from the same input.

## 0.7.0

- A planned roadmap can now be taught, and the teaching stage arrives as two commands rather than
  one. `/nxs.teach-plan` resolves the roadmap — from one epic issue or from a backlog query — and
  runs a single bounded interview that establishes what the learner already knows and what they
  came to learn, in one pass, once per roadmap. `/nxs.teach` writes one lesson per sitting. They are
  separate entry points because a session's references only accumulate: each names its own set and
  neither names the other's, so a session ordering a roadmap is never also holding the material a
  lesson is written from.
- Roadmap resolution refuses anything that is not a planned epic *before* the learner is asked
  anything, and refuses a query returning more than ten epics, or epics in more than one repository,
  before it fetches at all. The resolved roadmap is derived and gitignored, and it carries every
  story's body and every dependency edge, so nothing later goes back to the issue graph.
- A teaching session will now teach a story that was already closed when the plan pinned it.
  Previously any closure read as drift, which blocked every slice of a roadmap resolved from
  already-delivered work — learning from what the team has shipped was impossible. Closure still
  blocks when it happens *after* the pin.
- The analyze stage no longer counts a story issue that is still open as a conformance finding. A
  story closes when the pull request carrying it merges, and analyze runs before that merge, so open
  stories are the ordinary state at this gate. Analyze now reports them as a note asking the lead to
  close them before running close, and its severity tally counts nothing for them — a lead whose only
  blocking finding was "the stories are still open" now gets a clean gate and can fix what actually
  diverged. Close is unchanged: an open sub-issue still blocks it.

## 0.6.0

- The label that marks an epic nobody has planned yet is now `needs-refinement` instead of
  `backlog`. A lead reading an epic issue's labels can no longer mistake the marker for "part of
  the product backlog" in the everyday sense. Only the builtin default changed: a repository that
  declares its own `unplanned-label` in `settings.yml` keeps whatever it declared, and a repository
  taking the default renames its live label in place with `gh label edit backlog --name
  needs-refinement`, which keeps every issue that already carried it.

## 0.5.0

- The analyze, close and distill stages now withhold the same set of pipeline stores from the diff
  they read — the queue, the discovery store, and the new workbook store. Analyze and close
  withheld nothing before, so a lead running either against a branch that also touched a queue
  entry or a discovery folder saw that prose presented as shipped behaviour; they no longer do.
  Each stage asks the toolkit for the set (`nexus excluded-stores`) instead of carrying its own
  list, so the three stages cannot drift apart.
- A repository can now hold a workbook — a committed folder under the Nexus root that a learner
  opens — and no stage reads its pages back as behaviour.
- Everything a workbook retains about one person — the concept ledger, progress, learning records
  and the hint log — sits under a single learner folder, which one ignore rule excludes however
  many workbooks the repository holds. Nothing writes a personal record until git confirms the
  path is ignored, so a repository set up before workbooks existed cannot quietly commit a
  person's stumbles.
- A workbook session that pauses at a handoff comes back to it. Each handoff is its own record
  naming the story that was handed off; starting a session lists every outstanding one and offers
  the most recent. Resolving a handoff marks its record instead of deleting it, so what was handed
  off and when stays readable.
- A lesson is now written as prose and front matter, and the toolkit renders it to a page. Writing
  a lesson costs the prose and nothing more. An authored lesson that contains markup fails the
  render and the failure names the file, so no page's markup can be hand-written or generated by
  an agent. The render produces the whole workbook or nothing, and identical lessons render
  byte-identical pages.
- Pages take their colours and typography from the same reading-surface definition the application
  reads, so a workbook and the product look alike by construction rather than by matching.
- A page is opened by double-clicking it. Nothing is served, nothing is started, and every asset a
  page needs is a file beside it, so a lesson reads on a machine with no network. Each page states
  that it was generated and names the authored lesson, as the first thing in the file, so a
  reviewer meets it before any markup. Printing a page gives ink on white whatever the screen
  theme is, and leaves the navigation off the paper.
- `nexus workbook` is how a workbook is reached: `create` makes the committed folder and ensures
  the one rule that excludes the learner folder, `render` turns the authored lessons under
  `lessons/` into pages beside them in the order `plan.yml` gives, and `session` is what opening a
  workbook means — it lists every outstanding handoff and resumes at the story that was handed off.
  `handoff` records a pause and `resolve` marks one done. `check` re-renders the lessons and
  compares: a committed page edited by hand, or left behind by a lesson that has since changed,
  fails the check and is named, instead of being read as if it were current. It reports the drift
  and repairs nothing — re-rendering is the fix, and it stays the author's to run.
- A render that fails leaves no page behind at all, not even the last render's. A page a learner
  could still open after a failed render would be one that no longer matches the lesson that
  produced it, and nothing on the page would say so.
- In a workspace with a hub and members, a workbook belongs to the member repository whose roadmap
  it teaches. Creating one in the hub is refused and names the members it could have meant; run
  from the hub, `--repo <member>` says which one.
- A lesson can declare an interactive widget where it belongs in the prose, as a fenced block that
  stays ordinary markdown, and the renderer resolves it against a shared component library. A
  declaration naming a component the library does not hold fails the whole render and names the
  missing component, so a page with a hole in it is impossible rather than unlikely. A widget's
  content is in the page at render time and interaction only reveals it, so an untouched widget
  still prints. The library ships empty; the first component arrives with the stage that needs it.

## 0.4.0

- The epic, decision-record, discover and distill stages now write plain language as they draft,
  instead of handing a finished draft to a separate prose translator. A lead reads the same plain
  prose at the approval gate. Each stage reaches that gate in a fraction of the time, because the
  translator's repeated re-reading of the artifact and its sources is gone.
- The setup stage no longer adds an ignore rule for the translator's scratch copies, because no
  stage writes one any more.

## 0.3.0

- The discover stage can now settle what a person will see, not just what the system will do. A
  ticket whose decision is a user-facing surface is flagged as one, and the stage offers a few
  plain-text wireframe variants and asks you to pick before it rules — so the sketch is the
  instrument the decision is made with, not an illustration drawn afterwards. The chosen variant
  is recorded in the resolution itself, which is what the epic stage already copies onto the
  backlog stubs it files, so the sketch reaches the issue without a separate document to lose.

## 0.2.0

- **Breaking.** The second command name is withdrawn. Every stage — setup through distill — now
  runs through the one `nexus` command, and an invocation using the old second name fails. Nothing
  in the release needs a Python interpreter any more, so a machine with no Python runs the whole
  pipeline.
- The epic, decision-record and discover stages now refuse a draft that carries scope nobody asked
  for. Every scope-bearing item states where it came from, and a draft that breaks the counted
  limits is sent back rather than filed.
- A reviewer at the epic approval gate can cut a story from the draft in one action, instead of
  restating the epic to get a smaller one.
- The epic, decision-record, discover and distill stages hand their drafted artifact to a prose
  translator before a lead reads it, so what comes back is in plain language rather than the
  drafting voice.
- The sequencing page is retired. The backlog query is now the only inventory of unstarted work,
  and the ordering a lead follows is the blocked-by graph on the issues themselves, so the epic
  stage no longer maintains a wave table that could go stale against the issues.

## 0.1.0

- Nexus installs from the public registry instead of being cloned. Both toolkits land on your
  path from one install, and the components travel inside the package, so every stage from setup
  through distill runs without a checkout and without a second fetch after installing.
- The Nexus components are no longer committed in your own repository, so a component change no
  longer shows up in your own diff. From this release on, a change to what the epic,
  decision-record, analyze, close or distill stage decides is reported here instead.
- Running any stage leaves no interpreter byte-code behind in the repository it ran against.
