---
date: 2026-07-04
epic: "PTY Bridge"
source: "#11"
---

# Lesson: Isolate the hard concern behind a bare client

The PTY Bridge was scoped deliberately as a self-contained, frontend-free unit: no UI, no Prime
frontend changes, provable end-to-end with a bare `ws` client. That framing paid off. The genuinely
hard concern — a correct, leak-free shell lifecycle — was settled first, against the already-good
server upgrade seam, before any terminal-mount wiring existed. The estimate (M) held; the three
stories decomposed cleanly into one foundation story (11.01) and two that could follow it (11.02
config/origin-guard, 11.03 teardown), and `/nxs.analyze` verified every acceptance criterion with no
critical or high conformance findings against the decision record. When the next epic in this area
(`terminal-mount`) starts, it inherits a known-good contract and is a pure client-side wiring job —
exactly the payoff the isolation was meant to buy.

**What the next epic here should keep doing:** when a subsystem's real risk is a lifecycle/resource
concern rather than the UI, carve it into its own client-provable unit and finish it first. The
frontend job gets simpler and the risky part gets a tight, observable test loop (here: an
active-session registry the tests assert returns to zero).

**One caution for estimation.** A named risk mitigation slipped to backlog during implementation —
the prod-mode PTY smoke test (that the *built* server, not just the dev mount, spawns a PTY). It slid
because it is test infrastructure, not product code, and the dev mount is code-identical to prod, so
the marginal proof felt optional under delivery pressure. Test-infra mitigations are the easy ones to
silently drop. Next time, when the decision record names a mitigation that is itself a test, give it
its own acceptance criterion (or a story) so it is tracked to done rather than absorbed as
"redundant." It is now captured as `pty-bridge-prod-smoke-check` in the feature backlog.
