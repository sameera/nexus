# Contributing to Nexus

This guide is for people working **on** Nexus. If you want to *use* Nexus, read `README.md`
instead — it describes the adopter's install, and nothing here is needed for that.

## Where the components are authored

Nexus's components — the slash commands, agents and skills Claude Code loads — are authored in:

```
components/
├── commands/
├── agents/
└── skills/
```

**`.claude/` is not where they live.** That directory is the one the harness loads, and this
repository deliberately keeps no component there: it holds only your own untracked state
(`settings.local.json`, `worktrees/`), so a fresh clone has no `.claude/` at all.

The separation exists because a file at a loaded path that is *not* the file actually running is a
false affordance, and it is worst in the repository whose maintainer most needs to know which copy
is running. With authoring and loading separated there is exactly one copy that can run — the one
your account's install location resolves — and no ambiguity about which one that is.

Nothing else in the tree changed: the subtree names and layout under `components/` are the same as
they were under `.claude/`, which is what lets the release payload's fingerprint prove that moving
the tree changed nothing about what ships.

## From a fresh clone

```bash
git clone https://github.com/sameera/nexus.git
cd nexus
pnpm install
```

Then point your install location at the checkout, below.

## The maintainer's loop: point the install location at your checkout

You consume Nexus the same way an adopter does — through the single install location for your
account. The difference is what that location holds. An adopter's holds a copy of a release; yours
holds **pointers into your checkout**, so an edit is live with no install step in between.

From the checkout, run the verb from source:

```bash
npx tsx libs/portable-tools/src/nexus-cli.ts install --from-checkout .
```

Run it **from the checkout, not from an installed release**. The `nexus` on your path came from a
release, and a release cut before a change to where the authored tree lives cannot point at the new
one. Running from source has no such circularity.

Then confirm what the location holds:

```bash
npx tsx libs/portable-tools/src/nexus-cli.ts version
```

The read-out names the install location, says whether it holds a copied release or pointers, and —
in the pointing mode — names the checkout the pointers resolve into:

```json
{
  "installLocation": {
    "path": "/home/you/.claude",
    "source": "home-default",
    "content": "checkout-pointer",
    "checkout": "/home/you/projects/nexus/components"
  }
}
```

After that, edit a file under `components/` and invoke the command again in a new session: the
edited body is what runs. There is no deploy step, no copy to refresh and no second set to keep in
sync — the duplicate-set diagnostic stays quiet because the pointers and the checkout are the same
files, compared by resolved real path.

Re-run the install verb only when you add or remove a component file; editing an existing one needs
nothing.

## The other half of the loop: put the toolkits on your PATH

Pointing the install location at your checkout makes the *components* live. It does nothing for the
*toolkits* they invoke. Every component body addresses `nexus` and `nexus-gh` by bare name — a
component never encodes a path to the toolkit it invokes, and the build-time invocation gate
enforces that — so both executables have to resolve on your `PATH` or every `/nxs.*` stage that
shells out fails with `command not found`.

Build the release tree and link it from the checkout:

```bash
pnpm nexus:build-release
npm link
```

That puts `nexus` and `nexus-gh` on your `PATH`, resolved to this checkout's `dist/`. Confirm with

```bash
nexus version
nexus-gh version
```

Both print the same release version, and `nexus version` reports the same install location the
source run above reported.

**Re-run `pnpm nexus:build-release` when you change anything under `libs/`, and whenever you add a
verb or a capability.** The two halves of the loop refresh on different triggers, and the mismatch
bites in one direction: components are live from the checkout, so a body may name a dispatch name
the linked `dist/` does not carry yet. The invocation gate passes — it reads the checkout's own
registry — while the command fails at run time. This is the toolkit's version of the false
affordance the authored-tree move removed for components, and rebuilding is the whole remedy.

An adopter needs none of this: `npm install -g @sameeraperera/nexus` places both executables, and
`README.md` documents that path.

## What not to run in this checkout

- **`nexus deploy`** installs components into one repository's loaded directory. Running it here
  recreates exactly the arrangement this repository removed. The suite's standing check catches it —
  it fails if any Nexus-namespaced component file reappears under `.claude/`.
- **`nexus migrate-components`** removes a repository's *mirrored* copy of the components. Here the
  tree is the authored original, not a mirror, so pointing that verb at this repository would delete
  the source of truth with version history as the only recourse.

## Changing a component

1. Edit under `components/`.
2. Re-pin the release fingerprint, which hashes the payload the release would ship:
   `pnpm nexus:pin-bundles`.
3. Run the suite: `npx nx run-many -t test`.

Two standing checks are worth knowing about before they fail on you:

- **No component at a loaded path** — nothing Nexus-namespaced may appear under `.claude/`.
- **One definition of the authored root** — `AUTHORED_ROOT_DIRNAME` in
  `libs/portable-tools/src/vendor-components.ts` is the only place the authored tree's location is
  named. Any other source file mentioning the loaded directory has to be in that check's waiver set,
  with a stated reason. If you are adding a site that reaches the authored tree, derive it from the
  definition rather than adding a waiver.

## Test-first

Implementation work here follows test-first development, and the repository's other conventions are
in `CLAUDE.md`. Read that file too — it is the one the agents load.
