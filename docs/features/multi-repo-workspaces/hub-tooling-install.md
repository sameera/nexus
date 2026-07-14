---
feature: "Multi-Repo Workspaces"
---

# Hub Tooling Install

`/nxs.distill`'s deterministic steps — atlas regeneration and concept validation — run in a
multi-repo hub via a vendored, committed bundle instead of the in-repo `pnpm nexus:*` scripts.
The hub is a docs-only repo: no `package.json`, no `node_modules`, no `pnpm`. This is the
one-time, per-hub step that places the bundle so a hub checkout can run those steps.

## One-time placement

Once committed, every clone of the hub already carries the bundle — this is a one-time action
per hub repository, not a per-machine or per-clone install.

From the source monorepo (this repo):

1. Build the bundle:

    ```bash
    pnpm nx bundle @nexus/portable-tools
    ```

    This writes `libs/portable-tools/dist/bundle/generate-atlas.mjs` and
    `libs/portable-tools/dist/bundle/validate-concepts.mjs`.

2. Copy both files into the hub's Nexus-owned tools directory — `.nexus/tools/`, a sibling of
   `.nexus/concepts/`, `.nexus/anchors/`, `.nexus/config/`, and `.nexus/queue/` (the same
   directory workspace resolution exports as `portableToolsDir`):

    ```bash
    cp libs/portable-tools/dist/bundle/generate-atlas.mjs <hub>/.nexus/tools/generate-atlas.mjs
    cp libs/portable-tools/dist/bundle/validate-concepts.mjs <hub>/.nexus/tools/validate-concepts.mjs
    ```

3. Commit the two files in the hub repo:

    ```bash
    git -C <hub> add .nexus/tools/generate-atlas.mjs .nexus/tools/validate-concepts.mjs
    git -C <hub> commit -m "Vendor portable-tools bundle"
    ```

## What this is not

- **No `npm install` / `pnpm install`.** The bundle is self-contained; it runs on a plain
  `node` binary alone (plus the `git` CLI, already required by any hub — it's a git repo).
- **No registry, no network at drain time.** Nothing is fetched when `/nxs.distill` runs in the
  hub — the two committed files above are the entire runtime dependency.
- **The bundles are derived artifacts.** They are a compiled build of
  `libs/portable-tools/src/generate-atlas.ts` / `validate-concepts.ts` — never hand-edited in
  the hub.

## When to re-run this

Whenever the in-repo `libs/portable-tools/src/` scripts change and a given hub needs the
update: re-run the three steps above and re-commit. There is no shared or central install to
update — each hub carries its own committed copy.
