---
date: 2026-07-26
epic: "Rename /nxs.hld to /nxs.decision-record"
source: "#151"
---

# Lesson: Derive a rename sweep's surface list from the success-metric grep, not a hand-list

The epic sized as S and landed as S: three stories, one PR, 30 files, all name-string edits —
the estimate held because #139/#147 had already migrated every machine identifier, leaving a
purely textual sweep.

The one friction: AC3 hand-enumerated the live surfaces to sweep (commands, agents, skills,
anchors, templates, CLAUDE.md, how-to-nexus.md) while success metric 1 demanded zero hits
repo-wide outside the historical paths. The hand-list undercounted — `docs/design/` mockups and
`manual/assets.html` carried live references the AC never named, and the engineer had to extend
the sweep mid-story to make the metric pass. For the next rename epic, define the surface list
as the metric's own grep (everything outside the named exclusions) and enumerate only the
*exclusions* in the AC; a positive hand-list of surfaces will always trail the repo.

Two things worth repeating: delegating presentation detail to the engineer in an epic note (the
`record` chip text) avoided a planning round-trip for a decision the rail's width constraint
settled anyway; and stating the historical exclusions explicitly ("byte-identical") made the
no-rewrite rule mechanically checkable at analyze instead of a judgment call.
