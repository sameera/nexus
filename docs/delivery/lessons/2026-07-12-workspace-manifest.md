---
date: 2026-07-12
epic: "Workspace Manifest & Resolution"
source: "#38"
---

# Lesson: a stated invariant is not an enforced one — give safety invariants their own AC

The S estimate held: four stories (three S, one M) shipped in four commits across 2026-07-10 to
2026-07-12, sibling-checkout resolution with structured diagnostics landing cleanly against the
decision record. Two things are worth carrying into the next multi-repo epic.

**1. A security/safety invariant written into the decision record was documented but not enforced,
and only `/nxs.analyze` caught it.** Invariant 9 stated that a pointer's bare-name-only form prevents
resolution from being redirected to an arbitrary filesystem location. The first implementation joined a
member/hub `name` onto the parent folder and followed it without checking it was a bare segment — so a
`name` of `../x` escaped the workspace. The guarantee was in prose; nothing tested it. The fix
(`bare-name.ts` + an `unsafe-name` diagnostic) was a small, clean follow-up, but it was found at the
conformance gate rather than during the story that built the artifact.

*For the next epic:* when the decision record states a security or safety invariant, the story that
implements the relevant artifact should carry an explicit acceptance criterion that **enforces and
tests** it — not one that merely documents it. A documented invariant with no adversarial test (the
`../x` case here) is a latent gap that conformance, not implementation, will surface.

**2. You cannot dogfood a workspace feature inside a single-repo tool without breaking your own
zero-regression guarantee.** A live manifest committed in the Nexus repo would have flipped the tool
into workspace mode the moment the resolver landed. The capability had to be proven with tmp-dir
fixtures and shipped templates instead of a live artifact. This constraint holds for the whole
multi-repo program until Nexus itself becomes multi-repo: the follow-on epics (close-entry migration,
cross-repo distill, Prime's workspace state) will each need fixture-based verification rather than a
self-hosted workspace, and their estimates should budget for building that fixture scaffold.
