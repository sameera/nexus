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

1. Build, pin, and vendor in one step:

    ```bash
    pnpm nexus:vendor-tools --tools-dir <hub>/.nexus/tools
    ```

    `<hub>/.nexus/tools` is the hub's Nexus-owned tools directory — a sibling of
    `.nexus/concepts/`, `.nexus/anchors/`, `.nexus/config/`, and `.nexus/queue/`, and the same
    directory workspace resolution exports as `portableToolsDir` (`PORTABLE_TOOLS_RELATIVE_PATH`
    in `libs/workspace/src/resolve.ts`) — the single definition of that path. This one command,
    in lockstep:
    - rebuilds `generate-atlas.mjs` and `validate-concepts.mjs` from `libs/portable-tools/src/`;
    - updates the committed fingerprint pin `libs/portable-tools/bundle-fingerprint.json` to the
      hash of what it just built (the parity gate — `pnpm nx test @nexus/portable-tools` — asserts
      this pin equals a fresh build, so a source edit that skips this step fails the suite);
    - writes each `.mjs` into `<hub>/.nexus/tools/` from the **same bytes it just hashed**, so the
      vendored artifact always matches the pin.

2. Commit the refreshed pin in **this** repo:

    ```bash
    git add libs/portable-tools/bundle-fingerprint.json
    git commit -m "Re-vendor portable-tools bundle"
    ```

3. Commit the two files in the **hub** repo:

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
  the hub. The parity gate in the source repo guarantees the vendored `.mjs` matches its source
  byte-for-byte; drift is caught there (`pnpm nx test @nexus/portable-tools`), before it ships.

## When to re-run this

Whenever the in-repo `libs/portable-tools/src/` scripts change and a given hub needs the
update: re-run the step above (which rebuilds, re-pins, and re-copies) and re-commit in both
repos. There is no shared or central install to update — each hub carries its own committed
copy. Editing the source without re-vendoring fails `pnpm nx test @nexus/portable-tools` on a
stale-pin mismatch, so the source repo never ships ahead of the vendored artifact.
