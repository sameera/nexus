---
title: "PR Flow Worktree"
aliases: ["worktree base", "worktree location", "pr worktree", "worktree isolation", "configurable worktree path"]
touches: ["pr-driven-flow", "publishing-config-resolution", "verb-reachability"]
last_updated_by: "#248"
status: active
verification: verified
---

# PR Flow Worktree

The pull-request post-merge flow runs its stages in an isolated worktree, not the lead's own checkout. Where those worktrees are created is declared configuration — a publishing key naming a base directory, resolved through the same precedence chain every other publishing key uses — defaulting to a system-temp location when nothing is declared. An unusable base is refused with a named diagnostic before anything is created.

## How It Works

Conformance opens a detached worktree at the pull-request head; closure opens one on a fresh distillation branch cut from the trunk, and distillation continues in it. Every opening path funnels through one private step that resolves the base, runs the gate, and creates the directory — so both stages resolve identically within a run and the gate cannot be bypassed.

The base comes from the shared publishing resolver, asked for that one key and anchored on the checkout's root — an operator-supplied directory, defaulting to the invoking one, normalized through the version-control system's own top-level answer before anything is selected. An empty answer means undeclared and takes the built-in temp-derived base; a resolver failure stops the run rather than silently writing a commit-bearing checkout into the directory the operator configured away from. A declared value is trimmed, unquoted, home-expanded, and made absolute against the repo root.

A per-checkout segment is then appended underneath. Reuse is path-based; removal is force-and-prune, run from the checkout the operator pointed this capability at.

## Key Invariants

1. A checkout declaring nothing resolves the same base as before the key existed, character for character.
2. The base is obtained only through the resolver seam; this code never parses settings or the manifest itself.
3. The base is resolved from the operator-pointed checkout's root, never from pull-request content — a fork head must not choose where a checkout is written; that root is itself normalized through git's own top-level answer before it is trusted.
4. Every stage of one run resolves the same base, so one declaration serves conformance, closure, and distillation.
5. A per-checkout segment sits under every base, so two checkouts sharing one cannot collide.
6. Nothing is created until the base passes the gate; a refused base leaves the checkout as it was found.
7. A base inside the working tree is allowed only when git reports it ignored; an unanswerable query counts as not ignored.

## Integration Points

- [pr-driven-flow](pr-driven-flow.md) — the flow whose stages run in these worktrees; it owns the stage shape and the stamped range, this page where the worktree lives.
- [publishing-config-resolution](publishing-config-resolution.md) — supplies the base as one more declared key.
- [verb-reachability](verb-reachability.md) — this capability is now also reachable as a verb on the shared executable, held to byte-identical output and matching spawned-process arguments against its script form.

## Decision Log

### 2026-08-01 — #178 — Split from pr-driven-flow; the worktree base becomes declared configuration

The worktree location split out of the flow page because it is loadable on its own: where a heavyweight, commit-bearing checkout lands is an operator's question, answerable without the stage shape or the range rules the flow page keeps. It split now because the location stopped being a hidden temp-derived constant and became a declared key of the existing publishing block — which is what buys it the precedence chain, the hub layer, the resolver seam already built and tested, rather than a second configuration surface. Membership in that block also fixes the shape of the value: the key names a base, and the per-checkout segment is appended unconditionally underneath it, which is what makes the undeclared path byte-identical to the former constant and makes per-repo isolation unconditional instead of a rule the operator must know. The safety gate sits in the library ahead of any creation because closure commits from inside its worktree, so a non-ignored in-repo base would sweep a full second checkout into the repo's own index — and git will happily create such a worktree, so there is no later failure to interpret. Refuted alternative: a dedicated non-publishing section for local filesystem concerns, which reads better on the label and would age better if more machine-local settings arrive — it loses because it would need its own precedence chain and its own hub layer to satisfy the workspace case, the bulk of the cost, bought for naming aesthetics on a single key.

### 2026-08-23 — #247 — Reciprocal link from verb-reachability

Mechanical reciprocity fan-out: the verb-reachability page names this worktree-management capability as one of the ten now reachable as a verb on the shared executable, held to byte-identical output and matching spawned-process arguments against its script form.

### 2026-08-25 — #248 — Every subcommand takes the checkout root as an explicit argument, normalized through git before use

This capability now accepts its checkout root the same way every other repository-bound capability does — an explicit argument defaulting to the invoking directory — rather than reading the process's own working directory directly. Because this is the one capability that also chooses where a heavyweight, commit-bearing worktree gets created, the passed value is normalized through git's own top-level answer for that directory before it selects a role resolver or a base directory, so an operator-supplied path one level too deep, or a symlink, cannot become a new way to point the flow at an arbitrary directory. Existing invocations that pass nothing are unaffected: the default remains the invoking checkout.
