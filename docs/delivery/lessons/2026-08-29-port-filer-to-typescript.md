---
date: 2026-08-29
epic: "Port the story filer to TypeScript"
source: "#353"
---

# Lesson: the design gate's scope edits still are not reaching the issue

Estimated L (1–2 weeks) across eight stories, five of them M, against a 1364-line Python module. It
landed in nineteen minutes of commits: 33 files, +3565/−5, of which 2007 lines are the ported source
and 1511 are the carried-across suite. That is the second consecutive port epic in this line to be
estimated L and land inside a day, and it confirms rather than repeats the #351 lesson: cost in a
behaviour-preserving port tracks *decisions outstanding*, not files touched or lines carried. Record
#375 took thirteen decisions and resolved both open clarifications before a line was written, and the
eight stories that followed were mechanical. The remaining port in this line, #352, has the same
shape and should be estimated on the same basis — the decision count its record has to settle, not
the size of `nxs_gh_create_epic.py`.

The recurrence worth acting on is a process defect, not a technical one. The #351 lesson closed by
observing that the D5 and D6 scope edits were ratified at the design gate but never written back to
the epic issue, so implementation read against superseded acceptance-criteria wording for the whole
epic. This epic did it again, in a milder form. Record #375 raised an ADDRESS risk with a two-part
mitigation — amend the epic's success metric 2, which names "the story filer half of
`test_writeback_integration`" (a half that does not exist; that test drives the epic filer only), and
write the case fresh end-to-end. The engineer wrote the case. Nobody amended the metric. So epic #353
closes carrying a success metric that cannot be measured as written, and the conformance gate spent a
medium finding rediscovering something the record had already diagnosed and prescribed a fix for.

The same failure twice in eight days, from the same cause, means the intention is not the missing
piece. The write-back needs to be someone's step, not someone's memory: `/nxs.decision-record` should
close by applying its own ratified scope edits to the epic and story issues before it files the
record, and refusing to file while a prescribed edit is outstanding. A record that has both diagnosed
a wrong acceptance criterion and specified its replacement is holding everything needed to make the
edit; leaving it as an instruction to a human is what makes it evaporate. Until that exists, treat
any "Scope edit" or "amend the epic" clause in a decision record as a checklist item for the first
implementation commit, and expect the analyze gate to catch what slips.

One estimation note that cuts the other way. Two of this epic's decisions bought their leverage from
sequencing, not from code: the `ProjectAssignment` seam wired inert so #370 became a wiring change
rather than a rewrite of the closed #369, and the registry row flipped last so the cut-over was one
expression against handlers already fully tested. Both were available only because the record fixed
the decomposition before the first story opened. A port sliced without that — where the intermediate
states are a filer that files part of a batch correctly — has a genuinely different risk profile, and
this epic's speed should not be read as evidence that the slicing was free.
