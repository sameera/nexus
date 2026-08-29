---
title: "Target Root Convention"
aliases: ["explicit target root", "repo-bound argument", "operator-supplied root", "target-root helper", "root outranks artifact location"]
touches: ["publishing-config-resolution", "verb-reachability", "issue-sourced-planning", "toolkit-location", "resumable-batch-filing"]
last_updated_by: "#353"
status: active
verification: verified
---

# Target Root Convention

Every repository-bound capability accepts the project it operates against as an explicit target root, defaulting to the invoking directory only when the caller supplies none. The default is a fallback, never the definition: every path a capability reads or writes, and every remote-issuing subprocess it launches, re-bases onto that root, not the process's own working directory. One shared implementation per language is the sole parser of the convention; no entry point defines or defaults the argument on its own.

## How It Works

A repository-bound capability is one that reaches this project's committed store, its resolved docs location, its git history, or its GitHub remote — unlike one that only locates its own source or sibling data files, a separate, untouched concern. Such a capability takes its target root through one uniformly named argument per language, resolved once and threaded through every path join and subprocess launch inside it, rather than re-derived per call site. Two consequences follow from re-basing every path, not only a lookup's starting point: an explicit root always outranks a root derived from an input artifact's own location, so a capability handed an artifact from elsewhere rejects it rather than silently re-rooting around it; and a remote-issuing subprocess inherits the resolved root as its own working directory, so the platform tool it shells out to reads the same repository the capability was told to operate against, never the ambient process directory.

## Key Invariants

1. Every repository-bound capability accepts its target root through one uniformly named argument per language, defaulting to the invoking directory only when the argument is omitted.
2. The default is a fallback, never a definition: every path a capability reads or writes resolves against the passed root, not the process's own working directory.
3. An explicit root outranks a root derived from an input artifact's own location; an artifact resolving outside the root is rejected rather than silently re-rooting the run around it.
4. Every remote-issuing subprocess a capability launches runs with its working directory set to the resolved root, so the platform tool it shells out to reads the same repository.
5. One shared implementation per language is the sole parser of the convention; no entry point defines or defaults the argument independently.
6. The convention parameterizes only where a capability's project state lives, never how it locates its own source or sibling data files.

## Integration Points

- [publishing-config-resolution](publishing-config-resolution.md) — the two issue-creation scripts it already backs now take the root through this convention and reject an out-of-root input artifact.
- [verb-reachability](verb-reachability.md) — every reachable verb touching project state now parses this same argument before its own dispatch.
- [issue-sourced-planning](issue-sourced-planning.md) — the epic resolver now takes its target root through this same convention rather than a bespoke argument of its own.
- [toolkit-location](toolkit-location.md) — the complement this convention deliberately excludes: where a capability's toolkit lives, not where its project lives.
- [resumable-batch-filing](resumable-batch-filing.md) — refuses a target folder resolving outside the passed root, and binds every platform call it makes to that same root.

## Decision Log

### 2026-08-25 — #248 — One convention replaces six ad hoc ways of deciding where a capability's project lives

Every repository-bound capability used to decide its target in one of six different ways — an optional argument falling back to the working directory, a differently-spelled variant of the same idea, an ad hoc upward search, no override at all, and one capability that located itself relative to its own source file — invisible only because this project is developed inside the repository it manages, where the working directory and the target happen to coincide. That conflation breaks the moment a capability is invoked against a different target, such as an adopting repository. A single named argument per language, rather than a leading positional one, was chosen because several entry points already carry meaningful positional arguments of their own: a positional root either collides with those or is distinguished only by argument count, silently binding the next argument as the root when omitted. Re-basing every path a capability touches, not only a lookup's starting point, closes the worse failure mode half-parameterization invites — a capability that resolves its configuration from one repository while reading or writing a relative path in another, silently. Refuted alternative: change the process working directory once at dispatch and leave each capability's own relative-path arithmetic alone — smaller and instantly correct for a single invocation, but these capabilities are also called as library functions from a concurrent test suite and parity harness, where a global working-directory mutation is a race, and it would hide the root from each capability's own contract.

### 2026-08-26 — #249 — Reciprocal link from toolkit-location

Mechanical reciprocity fan-out: the toolkit-location page names this convention as its complement — this one parameterizes where a capability's project state lives, that one governs how a capability locates its own toolkit, the concern this convention's sixth invariant explicitly holds apart.

### 2026-08-29 — #353 — Reciprocal link from resumable-batch-filing

Mechanical reciprocity fan-out: the resumable-batch-filing page names this convention as the source of the root its preflight measures the target folder against, and as what every platform call the run issues is bound to rather than the ambient process directory.
