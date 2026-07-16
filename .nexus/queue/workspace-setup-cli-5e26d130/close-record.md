---
title: "Close Record: Nexus Setup CLI"
epic: #60
feature: "Multi-Repo Workspaces"
date: 2026-07-16
analyze: ran 2026-07-16 @ 1ebbcf6
range:
  - repo: github.com/sameera/nexus
    base: ada130ad1748329a233d7dc20c6e5823f09b3991
    head: 1ebbcf6ea7dabcc8527abd4ca9444bd3fa79ecff
---

# Close Record: Nexus Setup CLI

## Key Decisions

- **Component payload fingerprint pinned as a `claude-components` key in the existing
  `bundle-fingerprint.json`, checked by the same `checkFingerprint` gate as the bundles.** The
  decision record's mitigation was to "extend the existing parity/fingerprint gate" to cover the
  vendored `.claude/` payload; one pin file keeps vendor, pin, and test in single-headed lockstep so
  a distributable whose components lag their source fails the source-repo gate. Refuted: a separate
  `component-fingerprint.json` pin — avoids touching existing spec expectations, but forks the pin
  discipline into two files.

- **Mirror deletion in the deploy primitive is scoped to the `nxs.`/`nxs-` namespace.**
  `deployComponents` removes only files under `.claude/{commands,agents,skills}` whose first path
  segment carries the `nxs.`/`nxs-` prefix and which are absent from the payload; everything else is
  preserved. Convergence requires deleting retired managed files, but "don't clobber user files"
  requires an enforceable ownership boundary — the nxs namespace is exactly the set the retired
  update script owned. Refuted: delete any non-payload file under the three subtrees — simpler, but
  destroys user-authored commands/skills, violating the managed-set invariant.

- **The member-vs-hub collision rule was added inside the resolver's `parseAndValidateManifest`, not
  the CLI.** The epic AC requires member-vs-hub remote collisions rejected "through the resolver's
  remote-identity rule," but the resolver previously only compared members pairwise; the shape
  authority must own the rule so the read and write sides cannot diverge (invariant 2). Refuted: a
  CLI-side pre-check against the hub remote — works for init/add-repo, but creates a second copy of
  collision logic, which invariant 2 forbids.

## Deviation Rationale

- **The shared bundler (`buildBundle`) was changed to emit a `createRequire` banner for *all*
  bundles — beyond the record's "add a new entrypoint, not a second build system."** Without the
  banner, any bundle inlining a CommonJS dependency (the `yaml` package the CLI needs to read the
  manifest) dies on a bare runtime with "Dynamic require of 'process' is not supported." The fix
  belongs in the shared bundler because the defect was already latent in the shipped
  `derive-entry-diff.mjs` — a per-entry externals list or a CJS switch would change the
  distributable's shape for every consumer instead of fixing the one interop gap. The banner is inert
  for bundles that don't inline CJS deps, so the other tools are unaffected in practice.

## Deferred Scope

Deferred items appended to: `docs/features/multi-repo-workspaces/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-16-nexus-setup-cli.md`
