---
date: 2026-08-28
epic: "Seed the project templates the pipeline stages read"
source: "#258"
---

# Lesson: a gap the home repository hides is not small, whatever its size looks like

Epic #258 was estimated S, decomposed to two stories, and shipped in two commits with all eight
acceptance criteria met. The estimate held. What is worth carrying forward is not the sizing but
what made the epic necessary in the first place.

**A capability that only ever ran inside its own source checkout was believed to work everywhere.**
Three stages read a template out of `.nexus/config/templates/` and nothing seeded it. In this
repository the files happen to be present, so every stage found what it read and every run passed.
The close stage even carried a fallback to `common/templates/` — a directory that ships in no
release — which made the failure invisible precisely to the person best placed to notice it. The
gap survived because the only environment anyone exercised was the one environment that masked it.
The next epic in this area should ask, for each resource a stage reads, which repository is supposed
to place it and by what act; a resource with no named placer is a gap regardless of whether the
current checkout has the file.

**Writing the acceptance criteria against "the documented bootstrap sequence" rather than against a
named component was the right call and should be repeated.** The epic knew the seeding site was
unsettled — it could land in the setup stage or in #253's install verb — and it refused to fix the
site in the criteria. That refusal let the implementation choose a third site (a standalone
repo-bound `nexus seed-templates` verb that setup invokes) without any criterion needing to be
rewritten, and without the story degrading into documentation-only work. When a story's *what* is
firm but its *where* depends on an epic still in flight, bind the criteria to the observable outcome
and name the openness explicitly in the notes.

**Ordering the removal of a fallback after the arrival of its replacement is cheap and worth stating
in the epic.** Story #324 was blocked on #323 for one reason: there must be no window in which close
has neither a seeded template nor a fallback. The sequence table carried it and the implementation
followed it. This is the kind of ordering that is obvious in hindsight and easy to lose when two
stories are worked in one sitting — putting it in the epic's notes, not only in `blocked_by`, is
what made it survive.

**An unrelated test failure was fixed on the branch rather than deferred.** The pty-bridge suite was
inherited-environment-dependent and blocked the run; it was pinned, and the commit body said plainly
that it was not part of this epic. That was the right trade at this size — a deferred stub for a
one-commit test fix would cost more than it saves — but it is the epic's one deviation and it shows
up as such. For a larger epic the same call should go the other way.
