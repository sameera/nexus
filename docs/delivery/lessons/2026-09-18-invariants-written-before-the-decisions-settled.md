---
date: 2026-09-18
epic: "The renderer reads a private store as the reader"
source: "#614"
---

# Lesson: invariants written before the decisions they depend on had settled

Two of this epic's three close-time deviations are not deviations of the build from the design. They
are the design's own invariant list disagreeing with the design's own key decisions.

Record #660 states thirteen new invariants. Invariant 9 says a response is uncacheable when the
request "carried a session cookie". But the credential-criterion decision, three sections earlier in
the same record, had already established that a cookie on a request the browser did not mark as a
navigation is not read at all. The two statements cannot both be implemented. The engineer implemented
the decision, which was right, and the invariant was left describing something else. The same shape
produced the third deviation: the chosen-approach prose describes the sign-in redirect without the
navigation condition that the credential-criterion decision had already imposed on every credential
path.

Neither cost anything this time — `/nxs.analyze` caught both as low observations, the shipped behaviour
was correct on both, and close recorded the wording as the thing that lagged. The cost is that three
stages each had to re-derive that conclusion independently, and a reader of record #660 alone would
still be misled.

**What the next epic in this area should do differently:** write the Constraints & Invariants section
*last*, after every key decision is settled, and read each invariant back against the decisions above
it. An invariant is a restatement of a decision's consequence, so it cannot be drafted before the
decision it restates. On a record of this size — eight key decisions, thirteen new invariants, twelve
inherited — that read-back is a few minutes and it is the only thing standing between a stale sentence
and three stages spending effort on it.

**Estimate vs actual:** complexity M, three stories, sized M/M/S. Shipped as one pull request with one
commit per story in `blocked_by` order, conformance clean on the first full analyze run at the merged
head. The sizing held. Decomposition into three stories along the reader's own path — sign in, be
served, be refused — matched how the code wanted to be written, and the acceptance criteria were
checkable without a network because record #660 required the exchange, clock and randomness to be
supplied rather than reached for. That requirement is worth carrying into any future epic that adds a
credential surface.
