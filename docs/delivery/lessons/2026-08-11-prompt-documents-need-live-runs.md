---
date: 2026-08-11
epic: "Pre-epic discovery: /nxs.discover and the fog referral gate"
source: "#228"
---

# Lesson: a claim that spans two commands is only worth what a live run proves

This epic was sized M and it shipped as M. The estimate was not the interesting part. What cost the
most, and what the next epic in this area should plan for from the start, was proving a claim that no
test could hold.

Most of the work was prose. Six stories produced one new command document, changes to three existing
ones, a documentation sweep, and a small amount of code in the range helpers. The code half behaved
the way code halves do: the exclusion was added, tests pinned it, and it was done. The prose half
carried the risk, because the commands are prompt documents and only the scripted skills have tests
behind them.

The specific shape of the risk is worth naming, because it recurs whenever one stage writes something
a later stage must read. This epic's reasoning is written by one command, survives a third command
rewriting the issue body in between, and is read by a fourth. Nothing in that chain fails loudly. A
missing marker, or a read that never runs, produces a record that simply does not mention what the
discovery decided, and no stage reports the omission. The decision record named this as a risk and
required a walkthrough at the analyze pass to answer it. That requirement was correct, and it should
be the default for any epic whose value depends on two independently changed commands agreeing.

The mechanical half of that walkthrough was cheap and it was not enough. Running the reader's own
query against a constructed set of comments proved the marker string matches on both sides, which
rules out a copy-paste error and nothing else. It cannot prove the reasoning travelled, because in a
constructed fixture there is nowhere else the reasoning could have come from — and nowhere else it
could have leaked in from either.

The live run is what settled it, and it took two passes. The first pass graduated a real discovery,
promoted a stub, and filed a record on a throwaway hosted repository. The record looked right. It
could not be used as evidence, because the discovery folder was still sitting in the clone, so the
agent writing the record had two possible sources for the same text. The second pass removed the
folder first, which is what the real lifecycle does anyway, and then the marked comment was the only
route the text could have taken. That is the pass that moved the success metric from unmeasured to
measured.

Two things follow for the next epic in this area.

Plan the live run as work, not as verification. It needed a throwaway hosted repository, a seeded
discovery, a graduation, a promotion, and a record — and then a second pass once the first proved
unusable. Budgeting it as a checkbox at the end of the analyze pass understates it by a wide margin.
The harness that provisions and tears down a scratch repository already existed for the post-merge
flow, and reusing it is what kept this affordable; an area without that harness should expect to
build one before it can make this kind of claim at all.

Design the run so the thing being measured is the only available path. The first pass failed on this
and the failure was invisible until someone asked what else could have produced the text. The
cheapest form of the question is: if the mechanism under test were removed, would this run still look
like it passed? Ask it while designing the walkthrough, not while reading its output.

One smaller observation, recorded because it will bite again. A scripted live run exercises control
flow and leaves the interaction surface untouched. Both approval gates in these runs were satisfied
from pre-authorised answers rather than by a human choosing. The gates fired and stopped where the
documents say they do; what went unexercised is the prompt a human actually sees. A run of this kind
should say so explicitly rather than let a reader infer full coverage from a passing report.
