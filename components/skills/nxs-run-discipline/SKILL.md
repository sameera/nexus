---
name: nxs-run-discipline
description: The one normative statement of the continue rule every Nexus stage command runs under between its gates — when the stage keeps going, the only four places it may stop, and what it names when it stops — and of the completion report layout every stage command ends with. Every stage command except /nxs.close loads it at its start.
---

# nxs-run-discipline

This file is the **one normative home** of how a Nexus stage runs between its gates. Every stage
command except `/nxs.close` loads it at its start: `/nxs.setup`, `/nxs.discover`, `/nxs.epic`,
`/nxs.decision-record`, `/nxs.analyze`, `/nxs.distill`, `/nxs.fix`, `/nxs.intake` and
`/nxs.council`. No command restates it. Each command's opening names its own finish line and its
own gates, because those differ per stage. This file says what happens between them, and how the
run's completion report is laid out.

`/nxs.close` does not load it. It runs one command and shows that command's output unchanged, so it
has no pause to govern and no report of its own. The advisory agents (`nxs-pm`, `nxs-architect`, `nxs-epic-gate`) do not
load it either. They report to a stage, and that stage governs the stops and the report.

## 1. The continue rule

Between two gates, keep going. A step that needs nothing from the lead is done, not announced. When
you have something to tell the lead, put it in the same message as your next action.

Stop only in one of four places:

1. **At one of your gates.** Your opening names them. Each gate stops where your phases say, with
   the same choices. This rule adds no gate and removes none.
2. **At your finish line.** Your opening names it.
3. **At a step you cannot finish without the lead.** For example, an input the arguments did not
   give, or a check whose failure only the lead can fix.
4. **Before a destructive act that no gate or command argument already approved.** A destructive act
   is deleting data this run did not create, force-pushing, or rewriting history.

Every stop names what it needs from the lead: the choice, the missing input, or the act it wants
approved. A stop that names nothing leaves the lead to guess why the run ended.

Three things are not stops. Do none of them between gates:

- **Summarize without acting.** A status note goes with the next action, never in a message of its
  own.
- **Offer to continue.** Asking whether to go on is a stop with no reason behind it. Go on.
- **List choices that block nothing.** A choice that does not change the next step is yours to make.
  Make it, and say what you chose where the lead will read it.

## 2. What the rule does not change

- **Gates.** Every gate that stops a run today still stops it, in the same place, with the same
  choices. A `MANDATORY STOP` stays a stop.
- **GitHub writes.** A write that follows an approved gate or an explicit command argument goes
  ahead without a fresh confirmation, as it does today. The gates that already come before a write
  govern it, so this rule adds no stop before one.
- **Permission prompts.** This rule does not touch them. A permission prompt the harness shows is
  the lead's to answer, whatever this rule says about continuing.
- **Unattended runs.** In a run started unattended, such as `/nxs.distill --unattended`, the
  stage's own unattended rules decide what each gate does. The continue rule adds no stop and
  removes none.

## 3. The completion report

A completion report is what a stage command prints when its run ends after it has written
something: at its finish line, or at a stop after a write. It has three headings, in this order:

1. **Blocked on me** — what waits on the lead before the work can move: a decision, an answer, a
   check by hand, a pull request to review. Each item says what it needs.
2. **Changed** — what the run wrote: files, commits, issues, comments, labels, pull requests. Say
   also what it deliberately left unwritten, where the stage promises that.
3. **Found** — what the run learned and the lead should know: results, counts, notes.

Blocked on me is never left out. When nothing waits on the lead, it says so in one line, and that
line names the next stage to run, for example: `Nothing. Next: /nxs.analyze --pr <N>.`

Each stage's own report template says what goes under each heading. Its existing content keeps its
place under the heading it belongs to; nothing is dropped to fit the layout. A line a script reads
back stays where the script looks for it, such as analyze's result line, which stays the last line.

Two things are not completion reports and keep their own form:

- **A stop that wrote nothing,** such as a refusal or a declined gate. It names what it needs, as
  §1 says.
- **A deliverable,** such as the council's recommendation or an advisory agent's output. It is the
  thing the lead asked for, not a report on a run.
