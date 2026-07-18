---
name: nxs-workspace-status
description: Print the workspace status read-out — the hub, each declared member, and each member's checkout state — resolved from the current checkout. Use to verify a new or changed multi-repo workspace before a downstream stage depends on it, or to confirm a repo is in single-repo mode.
---

# nxs-workspace-status

Render an on-demand, read-only status read-out of the workspace, resolved from the current
checkout.

## Purpose

The workspace status read-out is the observable surface of the workspace resolver. It answers,
for wherever you are standing in the workspace:

-   Which repo is the hub, and what is its remote identity?
-   Which member repos are declared, and is each one checked out where it is expected?
-   Or: is this just a single repo with no workspace declared?

It is a thin view over the one shared resolver — it derives nothing itself — so what it shows is
exactly what every Nexus command will see. That makes it the way to verify a workspace before a
downstream stage depends on it.

## Usage

Run from anywhere inside a checkout (the hub or any member repo):

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/workspace_status.ts
```

Optionally pass a directory to resolve from instead of the current working directory:

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/workspace_status.ts /path/to/a/checkout
```

## What it reports

**A resolved workspace** — the hub (name, normalized remote, path, resolved docs root) followed by
each declared member with its checkout state and its own resolved docs root:

```
Workspace: docs-hub
  hub      docs-hub  (github.com/acme/docs-hub)
    /ws/docs-hub
    docs root: repo root
  members: 2 declared, 1 checked out
    [present] web-app  (github.com/acme/web-app)
      /ws/web-app
      docs root: docs
    [missing] api  (github.com/acme/api)
      /ws/api  <- expected checkout not found
      docs root: docs
```

The hub's docs root is `repo root` unless the manifest sets an explicit `docs-root` override (in
which case that value prints instead); every member's docs root is always `docs`.

A member marked `[missing]` is declared in the hub manifest but not checked out at its expected
sibling location. This is reported state, not a failure — the read-out names the member, its
remote, and where it was expected so setup is self-diagnosable.

**Single-repo mode** — a checkout with neither a hub manifest nor a hub pointer. This is stated
plainly, never as an error:

```
No workspace declared — single-repo mode.
  /repo has neither a hub manifest nor a hub pointer; Nexus commands operate on this repo alone.
```

**A resolution failure** — a structural defect the resolver cannot get past (a malformed
manifest, a hub that is not checked out, a member the manifest does not declare). The named
diagnostic is printed and the command exits non-zero:

```
Workspace resolution failed: missing-hub-checkout
  file:  /ws/web-app/.nexus/config/hub.yml
  entry: hub (docs-hub)
  hub 'docs-hub' (git@github.com:acme/docs-hub.git) is not checked out at the expected location /ws/docs-hub
```

## Exit codes

| Code | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| 0    | Resolved — a workspace (member checkouts may be missing) or single-repo mode |
| 1    | Resolution failed — a named diagnostic was printed                         |

## How it resolves

The script calls `resolveWorkspace` from `@nexus/workspace/resolve` — the single deterministic
producer of workspace context — and renders its result with `renderWorkspaceStatus` from
`@nexus/workspace/status`. It is read-only: it reads the committed manifest and pointer and stats
expected checkout locations; it never clones, fetches, or writes. Resolution from the hub and
from any member yields an identical description, so the read-out is the same wherever you run it.
