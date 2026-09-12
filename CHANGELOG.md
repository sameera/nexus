# Releases

Every release is one package carrying both toolkits, the component payload and this entry. What
an item says is what a lead running a pipeline stage will experience differently — not what a
commit was called, not which file moved, not which library moved. A release that changes no stage
behaviour says so.

## 0.35.0

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
