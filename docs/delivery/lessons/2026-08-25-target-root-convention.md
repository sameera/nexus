---
date: 2026-08-25
epic: "Reach project state through an explicitly passed target root"
source: "#248"
---

# Lesson: a rebase invalidates the analyze receipt even when it changes nothing substantive

`/nxs.analyze` ran and stamped a receipt at head `08098f4`. Before close, the branch was rebased
onto an updated `main` (which had picked up two dependency bumps and a sibling epic's distill
merge) and one small re-vendor commit landed to fix a build fingerprint the rebase disturbed. The
rebase gave every one of this epic's own commits a new SHA, so `08098f4` was no longer an ancestor
of `HEAD` at close time — the receipt read as stale by the mechanical `git rev-list` check, even
though the four substantive commits it had already validated were unchanged in content.

The gate did the right thing: it can't distinguish "a rebase re-hashed the same diff" from "new
work landed unanalyzed" without re-running, so it correctly forced an explicit waiver rather than
silently passing. But the waiver decision itself required manually diffing the pre- and
post-rebase commit lists to confirm nothing substantive had changed — work a re-run of
`/nxs.analyze` would have skipped entirely for about the same cost.

For the next epic: **run `/nxs.analyze` after the branch's last rebase onto trunk, not before
it.** If a rebase is expected between analyze and close (common whenever another epic merges to
main first), either re-run analyze post-rebase as a matter of course, or budget the close-time
waiver-verification step as real (if small) work rather than assuming a clean receipt will still
be waiting.
