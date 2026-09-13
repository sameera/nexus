# nxs-assets

The durable asset store for filed issues (epic #594): where a team declares it, how a filing stage
publishes a local file into it, and what the pinned reference it gets back looks like. Load it from
`/nxs.epic` and `/nxs.decision-record` before handling `--assets`; neither stage addresses the store
itself.

## Purpose

Nexus files issues from the command line, and GitHub offers no way to attach a file to an issue from
there. The store is one repository, or one unprotected branch of one, that every member can write to.
A stage publishes each referenced local file there **after approval** and replaces the local path in
the body with a reference pinned to the commit the publish created. An image shows inline; every
other file is a link at that commit. A later upload to the same path makes a new commit and never
changes what an earlier issue shows, so file names need no coordination across epics and the store is
never deleted from.

## Configuration

Both keys live in the `github:` block of `.nexus/config/settings.yml` — the same block as
`issues-repo` — so they ride the same precedence chain and the same hub layer. A hub may declare
either in its `workspace.yml` `github:` defaults; a member that declares none inherits them.

```yaml
github:
    asset-store: acme/assets            # or acme/assets@media to write to a named branch
    asset-size-cap: 5242880             # bytes, per file; this is the default
```

- `asset-store` — `owner/repo` or `owner/repo@branch`. **No default.** A repository that declares
  none at any layer has assets **unsupported**: the stage says so once on the console and files the
  same issue bodies it filed before, with no failure. Nexus never falls back to the issues repository,
  because writing files into a repository nobody nominated is a side effect the team never asked for.
- `asset-size-cap` — the per-file cap, checked against the local file **before any request**. A team
  property, not an invocation flag, so one lead cannot push a large binary into a store the team can
  never prune. Default 5 MB.

## Usage

```bash
# The one resolution step. Prints one of two JSON shapes, or stops on a malformed value.
nexus assets resolve [--root <dir>]
# {"state":"declared","repo":"acme/assets","branch":null}
# {"state":"unsupported"}

# One file in, one reference out. Writes features/<slug>/<filename> in the store through GitHub's
# file-contents endpoint — no clone, no worktree — and prints the address pinned to the new commit.
nexus assets publish --file <local-path> --feature <slug> [--root <dir>] [--json]
# https://github.com/acme/assets/blob/<commit>/features/<slug>/<filename>
```

`--json` prints `{ path, commit, url, filename }` instead of the bare address.

## Exit codes and diagnostics

| Code | Meaning |
| ---- | ------- |
| 0    | Success. |
| 1    | A named problem, on stderr: `assets unsupported:` (no store declared — nothing written), `assets malformed-store:` / `assets malformed-size-cap:` (the value, named), `assets oversize:` (the file's size and the cap — nothing sent), `assets missing-file:`, or `assets github:` carrying GitHub's own error verbatim. |
| 2    | Usage. |

## Rules the verb keeps (decision record #600)

- Nothing is ever deleted from or force-overwritten in the store. A re-publish to an existing path
  is an update commit carrying the existing blob's sha; the earlier commit still resolves.
- The reference names the **commit** the publish created, never a branch.
- One commit per file, in the order the caller publishes them. A partial failure leaves earlier files
  published and harmless; a re-run republishes cleanly.
- No permission or access check of Nexus's own. A rejected write is GitHub's error, reported as such.
