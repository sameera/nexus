# Releases

Every release is one package carrying both toolkits, the component payload and this entry. What
an item says is what a lead running a pipeline stage will experience differently — not what a
commit was called, not which file moved, not which library moved. A release that changes no stage
behaviour says so.

## 0.14.0

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
