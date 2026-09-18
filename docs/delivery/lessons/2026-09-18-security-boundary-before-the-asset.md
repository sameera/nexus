---
date: 2026-09-18
epic: "The renderer serves a pinned HTML mockup as an isolated page"
source: "#612"
---

# Lesson: Build the boundary while there is nothing behind it

This epic was sized M on three drivers: the first hosted service in a package that
had only ever shipped a command-line tool, a security boundary fixed before there
was a session to lose, and an operational home with a named owner. Two stories
shipped in one pull request, conformance came back clean on the first pass, and the
epic closed with no unmet criterion. The M was right, but not for the reason the
drivers suggested.

**The driver that cost nothing was the one that looked most expensive.** Fixing the
security boundary before there was a credential behind it was the cheap part, not
the risky part. With no session to lose, the boundary could be written as the
simplest thing that is observable — refuse an opaque origin outright — and proved
against a renderer a developer starts, with no deployment and no test account. Epic
#614 then added the credential behind a boundary that already turned the sandbox
away. Had the order been reversed, the same boundary would have had to be retrofitted
around a live session, and every invariant about it would have been load-bearing from
the first commit. **The next epic in this area should keep taking the boundary first
whenever the thing it protects does not exist yet — the window where it is cheap is
exactly the window where it seems premature.**

**The driver that actually cost was the operational home, and it was deferred, not
paid.** Hosting was cut from story #619's criterion during planning — narrowed from
"reachable from outside the team's network" to "answers at an address the team
designates" — and the epic closed having proved a shape a serverless host can take
without naming the host, the payer or the owner. That was the right call for this
epic and it is why the M held. It leaves two deferred items and one live
contradiction: the product documentation still says the product has no backend. **The
lesson for estimation is that a complexity driver named "an operational home with a
named owner" is not paid by an epic that only builds to a deployable shape; a driver
the epic defers should not be counted in its size.**

**Deviations were all in one shape and all benign.** Every one of the three came from
the decision record stating a rule in terms of a surface the epic does not yet have —
a redirect that cannot change the commit, a refusal set that did not anticipate a
transport failure, a credential rule conditional on a credentialed endpoint. None
contradicted an approved choice; all three elaborated a clause the record left
unapplied. **A record written one epic ahead of its surface will produce deviations
of this kind by construction.** That is an acceptable cost for the ordering above,
but the next record in this area can reduce it by marking which clauses are conditional
on a later epic's surface, so the close pass reads them as pending rather than as gaps.
