---
name: nxs-distill-as-built
description: /nxs.distill's as-built-record contract. Read it only for an as-built record.
---

# nxs-distill-as-built

`/nxs.distill` reads this file only for an epic whose decision record is as-built, and nothing else
reads it. Its rule overrides the base stage's Phase 4 Decision Log Entry rules. The base stage's
phase order and numbering are unchanged, and a phase this file does not name runs exactly as the
base stage states it.

An as-built decision record opens, after its title, with the statement
"This decision record was written after the build by the retroactive `nexus implement` run of pull request <pr>. …". Recognise an as-built
record by that opening in its hashed body, never by a label. Every decision-log entry /nxs.distill
writes from such a record states that the retroactive run, not the lead, decided it, and names the
run's pull request — for example "Decided by the retroactive `nexus implement` run of PR #<pr>, not
by the lead." A record without that opening is attributed to the lead.
