---
title: "Environment Guard"
aliases: ["environment defect", "environment diagnostic", "stderr diagnostic", "duplicate component sets", "missing interpreter guard"]
touches: ["verb-reachability", "release-identity", "nexus-setup-cli", "published-package", "install-location"]
last_updated_by: "#253"
status: active
verification: verified
---

# Environment Guard

An environment defect is named where a human will see it, without any verb's output contract being disturbed. The guard fires on a defect — something broken that a remedy exists for — never on a difference between two versions.

## How It Works

Two defects are detected today: an interpreter the release needs and cannot find, and two component sets resolving on one account. The second means the account's resolved install location and the invoking repository both hold a set, so a component body could resolve to two different versions. Both sides are compared as fully resolved real paths under the one shared ownership predicate — comparing the two locations as whole directories would report a duplicate on every run of the pointing arrangement, whose pointers resolve to the repository's own files. Each diagnostic names the defect, the concrete locations that make it checkable, and what to do about it.

Three placements make the guard safe rather than intrusive. It writes to standard error only, because every verb's contract is that success prints exactly one object on standard output and a guard printing there would break every consumer. It never touches the return value, so the exit code is the verb's own whatever the environment looks like. And the dispatcher runs it once, before dispatch — not each verb — because coverage of a verb added later is a property of where dispatch happens, not of anything that verb remembers to do. Within one invocation the diagnostic appears once however often the guard is consulted.

Detecting a duplicate installation is this guard's job; resolving one belongs to the installer.

## Key Invariants

1. The guard fires on an environment defect, never on a version difference.
2. Every diagnostic goes to standard error; standard output carries exactly the verb's own object and nothing the guard wrote.
3. The exit code is the verb's own, unchanged by the guard.
4. The diagnostic appears once per invocation however often the guard is consulted.
5. A verb added later with no guard code of its own is still covered, because the dispatcher runs the guard before dispatch.
6. Each diagnostic names the defect, where it is, and its remedy.
7. The duplicate comparison is over fully resolved real paths, bounded to the invoking repository and the resolved install location; it never walks ancestors and never scans the machine.

## Integration Points

- [verb-reachability](verb-reachability.md) — the dispatcher that runs this guard before dispatch, which is what makes coverage independent of any individual verb.
- [release-identity](release-identity.md) — shares the interpreter resolution the version verb reports, and is the identity whose differences this guard deliberately does not act on.
- [nexus-setup-cli](nexus-setup-cli.md) — owns the installed component set this guard counts, by the same namespace predicate, and owns resolving a duplicate the guard only reports.
- [published-package](published-package.md) — that package declares the interpreter floor this guard's diagnostic names when the interpreter is absent at run time.
- [install-location](install-location.md) — the account-side location this guard resolves and compares against the invoking repository, rather than a hard-coded home default.

## Decision Log

### 2026-08-26 — #251 — The guard runs in the dispatcher, and a component set is counted by namespace

The guard runs once in the dispatcher before dispatch, writing only to standard error and never touching the return value, because "a verb added later with no guard code of its own is still covered" is a property of where dispatch happens. Making that demonstrable required the dispatcher's verb registry to be injectable, so a verb the real registry does not contain can be dispatched — an accepted testability seam. "Two component sets on one account" means the account home and the invoking repository, the two places a set can resolve from today, and a location counts when its component tree holds a Nexus-namespaced file. Every verb invocation now pays the guard's interpreter probe; the epic states no performance budget, so this is recorded rather than measured. Refuted: wrapping each verb's runnable at registration, which makes every future verb responsible for remembering the wrapper — exactly the coverage gap the guard exists to close; and scanning every ancestor directory for component trees, which would report a defect for any checkout nested under another.

### 2026-08-27 — #252 — Reciprocal link from published-package

The published package declares the supported platforms and the interpreter floor, and that declaration is deliberately the whole of the answer for this release: nothing checks the interpreter at install time or on first run. This guard's run-time diagnostic is therefore the only thing that names a missing interpreter to the adopter who installed anyway, which is why the edge is recorded on both sides. Refuted: a first-run prerequisite check on the second toolkit, which turns the failure into a named one earlier but is a later release's work.

### 2026-08-27 — #253 — The duplicate check reads the resolved location and compares file sets

The account side of the comparison became the resolved install location rather than a hard-coded home default, the comparison became one over fully resolved real paths at file level rather than over the two component directories, and ownership became the shared namespace predicate applied to a path segment rather than a match on a file's name. The guard already ran once before dispatch, wrote only to standard error and left the exit code alone — every placement criterion the work needed — so what was wrong with it was exactly what needed building. A directory-level comparison would have reported a duplicate on every run of the pointing arrangement, in which the two component roots are genuinely different real directories while each installed component resolves to the very file the repository holds. Refuted: leave the guard alone and add a separate check inside the new verbs, which loses on the guard's own founding argument — coverage of a verb added later is a property of where dispatch happens, not of what a verb remembers to do.
