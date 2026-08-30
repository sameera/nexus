---
date: 2026-08-30
epic: "Port the epic filer to TypeScript"
source: "#352"
---

# Lesson: a "shared mechanism" reuse still needs a report-free contract stated up front

This epic (L, nine stories) sized the port as composition over construction — reuse the
shared configuration/classification module from the toolkit-shell epic and the platform layer
from the story filer port — and that estimate held: the genuinely new engineering was the body
derivation, not the plumbing. But the reused platform layer and project lookups still printed
in the story filer's vocabulary, and making them report-free (so each filer can render its own
lines) was a scope addition discovered at the design gate rather than sized into the epic from
the start. It turned out bounded — the story filer's own pinned output tests caught every
regression during the move — but it easily could not have been.

For the next epic that reuses a mechanism another capability built for itself: ask explicitly,
at decomposition time, whether the mechanism currently prints, sleeps, or otherwise carries the
first caller's assumptions baked in. "It already exists" is not the same claim as "it is
reusable as a library" — a lookup or platform call that prints is not reusable, and that
distinction is worth a line in the epic's own scope before a story discovers it needs one.

A second, smaller pattern worth repeating: this epic's confirmation-prompt divergence (refuse
rather than hang with no terminal) and its colour-gating divergence were both decided and
ratified in the decision record before implementation, not discovered mid-story. Both then
implemented cleanly with a dedicated environment-record seam. Naming a behavioural exception at
the design gate, rather than leaving "behaviour preservation" as an absolute with implicit
exceptions, kept implementation from having to re-litigate them.
