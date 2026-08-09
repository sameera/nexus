# Analyze-pass walkthroughs — epic #228

Record #235 Risks 4 and 5 make five manual walkthroughs a required mitigation at the analyze pass,
because the three changed commands are prompt documents with no automated coverage. The
2026-08-08 analyze receipt found no evidence that any of them ran. This file is that evidence.

Run 2026-08-09 against `feat/pre-epic-discovery-228`. The fixture and the verifier live in the
session scratch directory, not in the tree — nothing here is a committed test.

## (a) A foggy intent — the gate fires

Intent: "Make Nexus usable by a team whose issues do not live in GitHub."

Applied the gate's own test: attempt the decomposition, and ask whether **each** functional goal can
be stated as a one-line goal with an S or M estimate and candidate story titles.

| Functional goal (attempted) | What blocks stating it |
|---|---|
| A stage files a work item through a provider other than GitHub | Nothing has decided where the provider seam sits — the `gh` call sites, the publishing skills, or a new adapter surface. Each is a different set of stories. |
| Ordering between work items survives on a provider with no dependency edges | Undecided whether ordering degrades to a body convention or rules that provider out. |
| The record hash keeps working when the record is not an issue | Approval is the close of the record sub-issue today. Nothing has decided what the record's durable home and approval act are without one. |

Not one goal reaches the stub shape, so the intent is underspecified rather than oversized. Expected
behaviour: stop before sizing, render the `⚠️ Underspecified` block, ask discover-or-override through
`AskUserQuestion`, file nothing. That is what the gate text at `nxs.epic.md` Phase 2 specifies, and it
is the behaviour the walkthrough produced. **Pass.**

## (b) A big-but-clear intent — the gate stays silent and the oversized split still runs

Intent: "Add a `--dry-run` flag to every Nexus command that writes: discover, epic, decision-record,
close, distill."

| Functional goal | Estimate | Candidate stories |
|---|---|---|
| `/nxs.discover` honours `--dry-run` | M | Start reports the folder it would create; resume reports the resolution it would append; close reports the note and the removal |
| `/nxs.epic` honours `--dry-run` | M | The digest renders; the issue bodies render; nothing is filed |
| `/nxs.decision-record` honours `--dry-run` | S | The record body renders; no sub-issue is filed |
| `/nxs.close` honours `--dry-run` | M | The close record renders; the epic issue is not commented or closed |
| `/nxs.distill` honours `--dry-run` | M | Per-concept deltas render; no distillation pull request opens |

Every goal reaches the stub shape, so the sharpness precondition adds no interaction and says nothing.
Sizing then runs unchanged: five command surfaces is XL, which is the existing decomposition path, and
it emits five stubs. Big but clear still splits. **Pass.**

## (c) A sharp, right-sized intent — the run is unchanged

Intent: "Add `--json` to `nexus workspace status` so a script can read the workspace read-out."

One functional goal, estimate S, candidate stories: the read-out emits machine-readable output under
the flag; human output is unchanged without it. Sharp, so the precondition adds no interaction at all,
and sizing sends it straight to Phase 3. A sharp intent sees exactly the run it saw before this epic.
**Pass.**

## (d) Graduation from a real discovery folder — executed with artifacts

Built a real finished discovery in the scratch fixture: `discover-agent-run-history-7f3ac1b2`, with a
discovery doc and three resolved tickets (council, task, interview), an empty "Not yet specified", and
one out-of-scope entry. Then drove `/nxs.epic --discovery` through Phase 0 discovery mode, Phase 1, and
Phase 2b, emitting two real stub work-items with their gists and the two marked comment bodies. A
verifier checked the result against the contracts rather than against my reading of them.

30 of 30 checks passed, covering:

- **Preconditions** — doc status open, every ticket resolved, "Not yet specified" empty, feature path
  readable, index carrying exactly one line per ticket.
- **Filer contract** — every stub parses through the filer's own `parse_frontmatter`, carries
  `ref`/`title`/`labels`, carries **no** `parent` key, carries only the resolved unplanned label
  (`backlog`, resolved live from `delivery_config.py`), estimates S or M, and sources itself to the
  destination rather than to a folder path.
- **Gist fidelity** — each gist in a stub body is byte-identical to the Decided / Why / Refuted lines
  of the ticket it came from, so nothing was paraphrased on the way out.
- **Invariants 4 and 24** — no stub carries `.nexus/discovery`, no stub carries a bare
  `ticket-<nn>-<slug>.md` filename, and every gist heading is a ticket **title**.
- **The surviving copy** — each comment body is the stub's gist section unedited plus the marker.

The run stopped before the filer. Nothing was filed, and no GitHub write of any kind was made.

## (e) The full path — executed live on 2026-08-09 (see (f))

The mechanical half ran. Built a four-comment payload — two marked gist comments and two ordinary
discussion comments — and ran the reader's exact query from `nxs.decision-record.md` Phase 0.4
against it. It selected the two marked comments and dropped the discussion. The marker string the
writer emits (`nxs.epic.md` Phase 2b step 5 and Phase 6b) is the same string the reader selects on;
the verifier asserts that against both files rather than trusting a copy-paste. So the handoff from
graduation to the record is verified end to end **as a mechanism**.

**The live half is no longer outstanding.** It ran on 2026-08-09 against a throwaway hosted
repository, the way `nxs-pr-acceptance` does it for the `--pr` flow. Section (f) records it.

## (f) The live run — AC6, executed against real GitHub on 2026-08-09

Provisioned `sameera/nexus-pr-acceptance-scratch` through the `nxs-pr-acceptance` harness, carrying
the toolchain tree at `ca50c17`, and committed a finished discovery into the clone:
`discover-agent-run-history-7f3ac1b2`, three resolved tickets (council, task, interview), empty
"Not yet specified". The repository was deleted at teardown; the numbers below no longer resolve and
are recorded for the audit trail, not as links.

**Graduation.** `/nxs.epic --discovery` sized the destination L, took the stubs path, and filed two
stub issues — one per functional goal. Both carried the gists in the body and the same text again as
a comment closed by the marker. Verified against the ticket files by diff, not by eye: the
Decided / Why / Refuted lines are byte-identical. Neither stub was a sub-issue of anything, both
carried the resolved unplanned label, and neither body nor comment contained `.nexus/discovery` or a
bare ticket filename. The decision both goals hang on was copied onto both stubs in full, which is
what Phase 2b step 3 requires.

**Promotion.** Promoting the first stub rewrote that issue's body wholesale into a planned epic with
three story sub-issues. The gists were gone from the body; the marked comment survived with
`updatedAt` still null, so GitHub itself never saw an edit. That is the double-write earning its
keep, measured rather than argued.

**The record.** `/nxs.decision-record` ran against the promoted epic. Phase 0.4's marker query
selected exactly one comment out of the issue's real comment set. The filed record was designed on
top of the settled decisions rather than re-deriving them — its invariants restate them as
constraints ("exactly one record exists per top-level invocation…", "the write path performs no
network calls of any kind…").

**Why the first pass was not enough.** The architect the record delegates to read the discovery
folder off disk, which still existed. The record then cited a decision whose gist was never on that
epic's comment. Nothing was contradicted, but the provenance was confounded — the run could not
prove the comment carried the reasoning, because the folder was also available.

**The clean pass.** Removed the discovery folder from the clone and committed the removal, which is
the real lifecycle anyway, then promoted the second stub and ran the record against it under an
explicit prohibition on recovering the folder from git history, restated in the architect's own
prompt. That record carries the second stub's own decision as a constraint — "the history root
always resolves to the list. No path, redirect, or default selection may land a maintainer on a
run's detail first" — and a grep for the other stub's gist vocabulary returns nothing. With the
folder gone, the marked comment is the only path that text could have travelled. **AC6 is met**, and
success metric 4 moves from NOT MEASURED to measured.

**Findings the run produced, none of them fixed here.**

1. The architect reads beyond what Phase 0.4 hands it. In the first pass it read the discovery
   folder directly. In a real run the folder is usually gone by then, so this rarely bites — but the
   input discipline is a genuine gap, and it is the reason the second pass exists. Worth its own
   issue.
2. `/nxs.epic` Phase 6 leaves the feature nav index dirty in the working tree with no commit step
   named at that point. Both live runs hit it. It is consistent with "nothing is committed at
   planning", so it may be intended — but the command document does not say so, and a reader cannot
   tell intent from omission.
3. The command documents invoke a bare `tsx`. It was not on `PATH` in either run; both fell back to
   `./node_modules/.bin/tsx`. Environment gap, not a contract defect.

The one thing a live run still cannot buy: both approval gates were resolved from pre-authorized
operator answers rather than a human clicking through `AskUserQuestion`, because the runs were
scripted. The gates fired and stopped where the documents say they do; what went unexercised is the
UI, not the control flow.

## Observation, not a defect

The stub body's meta block writes the feature **path** under a key named `feature`, while promotion
(Phase 0) says it reads `feature`/`feature_path` from that block. The two names refer to one value.
This predates discovery — the decomposition path writes the same template — and discovery inherits it
unchanged, which is exactly why a discovery stub promotes with no manual edit. Worth tidying on its
own, not here.
