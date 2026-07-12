---
title: "Close Record: Workspace Manifest & Resolution"
epic: #38
feature: "Multi-Repo Workspaces"
date: 2026-07-12
---

# Close Record: Workspace Manifest & Resolution

## Key Decisions

- **Resolver landed as an Nx library `@nexus/workspace` (`libs/workspace/`), registered as a root
  devDependency.** The decision record required "one genuinely shared, importable resolver"; this fixes
  its home. An Nx lib gives it inferred test/typecheck/lint targets and a stable import name resolvable
  from skill scripts run at the repo root. *Refuted:* `utils/workspace/` beside the other tsx tooling —
  lighter, but `utils/` is wired into no test project and a bare folder is a weaker "shared module"
  boundary than a named package.

- **Package surface is subpath exports, no barrel** (`./manifest`, `./remote`, … direct to source; no
  `src/index.ts`). Honors the no-barrel rule so consumers import from the defining module. *Refuted:* a
  single `.` → `src/index.ts` entry (the conventional Nx shape) — it is exactly the re-export barrel the
  rule forbids.

- **Concrete artifact filenames, sharing one `hub:` block:** the manifest is
  `<hub>/.nexus/config/workspace.yml`, the member pointer is `<member>/.nexus/config/hub.yml`, and both
  reuse the same `hub: {name, remote}` shape. `hub.yml` reads self-evidently in a member ("the hub this
  repo belongs to"); a member never also holds `workspace.yml`, so the two never collide. *Refuted:*
  `workspace-manifest.yml` / `hub-pointer.yml` — more literal about role, but longer to hand-author with
  no disambiguation benefit.

- **Ship templates only; do NOT commit a live manifest in the Nexus repo.** Templates land at
  `.nexus/config/templates/{workspace,hub}-template.yml`; no live `workspace.yml`/`hub.yml` is committed
  here. A live manifest would flip this single-repo tool into workspace mode once the resolver landed,
  breaking the zero-regression guarantee. The capability is proven by tmp-dir fixtures plus the
  templates; leads copy a template into a real hub. *Refuted:* commit an example manifest as
  documentation — clearer as a sample, but it is read as real config and would break single-repo mode.

- **Remote normalization sharpened to lowercase-host / preserve-path-case.** The ADDRESS risk asked for
  one rule comparing host+path and ignoring protocol and `.git`; this fixes the case handling: DNS hosts
  are case-insensitive so lowering them is always safe, but some self-hosted forges are path-case-
  sensitive, so path case is preserved to avoid a false "same remote" match between genuinely different
  repos. *Refuted:* lowercase the whole string — matches more spellings on GitHub, but risks a false
  duplicate on case-sensitive hosts.

- **Invariant 9 (bare-name security boundary) is enforced in a dedicated shared `bare-name.ts`.** The
  decision record *documented* the guarantee — a pointer/member `name` may only be a bare path segment —
  but the first implementation did not enforce it: a `name` of `../x` was joined onto the parent and
  followed. The fix (commit `9c5b5a1`, caught at `/nxs.analyze`) adds `isBareSegment`, imported by both
  `manifest.ts` and `pointer.ts`, and a new `unsafe-name` diagnostic. It lives in one module because the
  rule applies identically on both sides — mirroring the `remote.ts` precedent and honoring the ADDRESS
  anti-copy-paste risk. *Refuted:* export `isBareSegment` from `manifest.ts` — fewer files, but overloads
  the manifest module with a generic path rule and reads as a weaker shared boundary.

- **Parity is realized as an entry-point-independent description.** `ResolvedWorkspace` carries no
  `entry` field, so `resolveWorkspace(hub).workspace` deep-equals `resolveWorkspace(member).workspace` —
  parity as a literal `toEqual`. Single-repo mode and a missing *member* checkout are both successful
  results (`ok:true`); only a missing *hub* checkout, an undeclared member, or a malformed manifest are
  hard `ok:false` diagnostics — the "missing checkout vs not a workspace" distinction. A checkout holding
  both artifacts resolves as the hub (the manifest is the single source of truth). *Refuted:* an
  `entry:"hub"|"member"` field — it would break the parity `toEqual`, and the caller already knows its
  own start directory.

## Deviation Rationale

- **Member checkout identity is keyed on the expected sibling directory, not the declared git remote.**
  The manifest declares each member's remote identity, but the resolver identifies a member checkout by
  its `basename` / `isDirectory(expectedPath)` and never reads a member's git remote; only the *hub's*
  remote is normalized and verified (the `hub-remote-mismatch` diagnostic). Member `remote` is therefore
  declared-but-unverified in v1. *Why:* there is no git subprocess anywhere in the tree yet; reading each
  member's git remote would be the first, make the pure fs+YAML resolver impure, and require real git
  repos in fixtures instead of tmp-dir directories — over-built for an S story. The v1 layout already
  defines a member's `name` as its expected sibling directory, so the directory name is a legitimate
  identity, and the remote-normalization ADDRESS risk is still honored on the hub side.

- **Generated coverage output is committed to the repo.** `libs/workspace/test-output/vitest/coverage/**`
  (15 files, ~6,000 lines) is tracked and not gitignored. This is not a decision-record item but a
  repo-hygiene divergence that will travel to `main` with the distill PR. *Recommendation:* gitignore
  the vitest `test-output/` directory and remove the tracked coverage files before the distill PR.
  (`/nxs.close` does not modify code, so this is left as a flagged follow-up.)

## Deferred Scope

No scope was deferred at close. Every out-of-scope item was already stubbed during decomposition —
see `docs/features/multi-repo-workspaces/backlog.md` (and the Prime state stub under
`docs/features/prime-workspace-instrumentation/backlog.md`).

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-12-workspace-manifest.md`
