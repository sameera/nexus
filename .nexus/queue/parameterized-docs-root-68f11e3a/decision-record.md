---
title: "Decision Record: Parameterized Docs Root"
epic: #74
feature: "Multi-Repo Workspaces"
rating: M
concepts: ["workspace-resolution", "portable-tooling", "distiller"]
date: 2026-07-18
---

# Decision Record: Parameterized Docs Root

## Summary

Make the docs root a resolved property of workspace context. The workspace
resolver becomes the single producer of a per-repo docs root — `docs/` for
single-repo projects and members, the repo root for a hub, an explicit
hub-manifest override winning over both — and the four consumers (atlas
generator, cross-ref skill, hub drain, status read-out) read it instead of
assuming `docs/`. The atlas lands at `<docs-root>/concepts.md` with its concept
links computed from where the file actually sits, so both layouts resolve while
single-repo output stays byte-identical.

## Chosen Approach

One producer, four consumers. The resolver gains a docs-root value on every repo
it describes — the hub, each member, and the single-repo shape — derived from an
optional hub-manifest key plus role defaults. The atlas generator asks the
resolver for its default write location and computes its link prefix as the real
relative path from the atlas's directory to the concept store, removing the baked
constant prefix. The cross-ref skill and the hub drain drop their hardcoded
`docs/` and read the resolved value the same way the workspace-status read-out
already reads the resolver. No consumer re-derives the value, so parity and
byte-identity are preserved by construction. Because the strip now removes the
resolved local docs root and appends the remainder to the operator-set cross-ref
URL, the skill also checks that the URL agrees with the resolved docs root and
surfaces a mismatch as operator error.

## Key Decisions

### The explicit override is a hub-manifest field, not a settings key

- **Decision:** The override lives as an optional docs-root key on the manifest's
  hub mapping. Everything else is a role default the resolver fills: single-repo
  and members get `docs/`, a hub with no override gets the repo root. The resolved
  workspace shape carries a docs-root value on the hub, on every member, and on
  the single-repo shape. The resolver is the sole producer, and the status
  read-out prints the resolved value for each repo it reports.
- **Why:** The deep-equal parity guarantee requires that a hub resolved from the
  hub checkout and from any member report identical docs roots. The manifest is
  the one artifact both entry points read, so a value placed there is visible to
  both; role defaults are pure functions of the role, so they are identical from
  either side too. Scoping the field to the hub keeps the schema extension minimal
  and matches the epic's assumption that only the hub role moves the default.
- **Refuted alternative:** A docs-root key in each checkout's local settings,
  where the cross-ref URL already lives. It needs no manifest schema change, but
  local settings are per-checkout and invisible across checkouts, so a member's
  value could not be seen when resolving from the hub — breaking the parity
  guarantee. Local settings cannot describe a shared workspace fact.

### The atlas generator resolves its own default write location; an explicit output path overrides it

- **Decision:** With no explicit output path, the generator consults the resolver
  from its working directory and defaults its output to `<resolved-docs-root>/concepts.md`
  — `docs/concepts.md` for single-repo, `concepts.md` at the root for a hub. An
  explicit output path wins over the resolved default. Check mode runs the
  identical resolution, so the sync gate always compares against the same location
  write mode uses.
- **Why:** The generator already owns the default output location, so it is the
  natural single place to map resolved-docs-root to atlas path. Centralizing it
  keeps a bare invocation correct in any repo and guarantees write mode and check
  mode never diverge, since both read one resolution point. The portable build
  consulting the resolver at run time is already an established, paid-for cost.
- **Refuted alternative:** Keep the generator resolver-unaware and make every
  caller pass an explicit output path. It keeps the atlas bundle free of a
  resolver dependency, but the docs-root-to-path mapping then scatters across the
  drain's regenerate step, its check gate, and every manual run — each a place to
  drift — and a bare invocation stops working in a hub. The story's acceptance
  criteria also state the generator's own behavior with no output path, which this
  alternative cannot satisfy.

### The atlas link prefix is the computed relative path from the atlas to the concept store, not a constant

- **Decision:** Replace the baked link prefix with the relative path from the
  atlas file's directory to the concept store, emitted with POSIX separators. From
  `docs/concepts.md` this yields the same prefix as today; from `concepts.md` at
  the repo root it points one level shallower; for any explicit output path it
  yields whatever is correct for that location.
- **Why:** The concept store is fixed under the repo root; only the atlas's own
  location moves. The physically correct link is therefore a function of the two
  paths the generator already has, and computing it handles the repo-root layout
  and any explicit output path with one expression. It reproduces the existing
  prefix exactly, protecting byte-identity.
- **Refuted alternative:** Derive the prefix from the docs-root depth (one
  `../` per docs-root segment, then the concept-store path). It works for
  role-default outputs but breaks for an arbitrary explicit output path; the
  actual atlas-to-store relative path generalizes and is simpler.

### The cross-ref strip keys on the resolved docs root, stripped exactly once

- **Decision:** The cross-ref skill obtains the resolved docs root from the
  resolver — the same source the status read-out already uses — and strips exactly
  that prefix once from each repo-relative path before appending it to the
  cross-ref URL. Single-repo resolves to `docs/`, so `docs/…` paths are stripped
  and output is unchanged; a hub resolves to the repo root, so nothing is stripped
  and a root-relative path maps straight onto the root URL. The unconditional
  leading-`docs/` strip is removed.
- **Why:** The workspace-resolution invariant forbids any consumer re-deriving the
  docs root, and this story is sequenced after the resolver work precisely so it
  consumes that output. Keying the strip to the single producer keeps one
  authoritative value; the meaning of the cross-ref URL setting is untouched.
- **Refuted alternative:** Derive the strip amount from the trailing segment of
  the cross-ref URL (strip `docs/` if the URL ends in `/docs`, else nothing). The
  skill already reads that URL, but this makes the URL a second producer of the
  docs-root fact that can drift from the resolver's answer — exactly the
  re-derivation the single-producer invariant forbids.

### The cross-ref URL is checked against the resolved docs root, and a mismatch is surfaced as operator error

- **Decision:** The cross-ref skill compares the trailing segment of the
  operator-set cross-ref URL against the resolved docs root and surfaces a
  mismatch as operator error rather than emitting a link. Agreement means the URL
  points at the same docs root the strip removes: a `docs/` resolved root pairs
  with a URL ending in the docs path; a repo-root resolved root pairs with a URL
  pointing at the repo root. This check ships in this epic and extends the scope of
  the cross-ref story (an edit to that story, not a new task).
- **Why:** After the strip keys on the resolved local docs root, the local root
  and the remote URL are two representations of one fact with nothing enforcing
  their agreement. An operator who moves docs to the repo root but leaves the URL
  pointed at the docs path gets dead links — precisely the failure the epic set
  out to remove. A check surfaces the mismatch at the point the operator can fix
  it, turning a silent bad-link generator into an actionable error.
- **Refuted alternative:** Document the contract in prose and rely on the epic's
  zero-dead-links check to catch mismatches after the fact (document-and-defer).
  It is lighter and matches the epic's note that the URL setting's meaning does not
  change, but it leaves a silent misconfiguration that produces dead links until
  something downstream notices; enforcing agreement at conversion time was chosen
  as the stronger guarantee.

### The hub drain treats the atlas path as resolver-derived, not a literal

- **Decision:** The drain's regenerate and sync-gate steps rely on the generator's
  resolved default, so they carry no path literal. The staged file set and the
  completion report use the resolver-derived atlas path in place of the hardcoded
  `docs/concepts.md`. Single-repo drains are unchanged because the resolved path
  there is still `docs/concepts.md`.
- **Why:** The drain must never recreate a `docs/` folder the hub does not use,
  and its report must name the real location. Sourcing the path from the same
  producer the generator uses keeps one answer across regenerate, check, stage, and
  report; the literal is the last place the old assumption survives.

### Parity and single-repo byte-identity are preserved by construction, not by a new gate

- **Decision:** No new atlas format and no new parity mechanism. The deep-equal
  parity gate keeps passing because the docs-root value is derived only from the
  manifest and role rules. The portable/in-repo byte-parity gate keeps passing
  because source and bundle run the identical new link logic on identical inputs.
  Single-repo byte-identity holds because the resolved value stays `docs/`, the
  default output stays `docs/concepts.md`, and the computed link reproduces the
  existing prefix character-for-character. The generator's new resolver dependency
  ships through the existing re-vendor-and-fingerprint mechanism.
- **Why:** The epic's success metrics require both a byte-identical single-repo
  atlas and continued portable parity; anchoring the new behavior to the existing
  gates rather than inventing a parallel one is what makes those metrics verifiable
  with the tests already in place.

## Constraints & Invariants

1. Single-repo atlas output is byte-identical before and after: the resolved docs
   root stays `docs/`, the default output stays `docs/concepts.md`, and the
   rendered concept link stays exactly the pre-change prefix.
2. The resolver is the sole producer of the docs root; the atlas generator, the
   cross-ref skill, and the drain each read it from resolution and none re-derives
   it from manifests, local settings, or the cross-ref URL.
3. The per-repo docs root is derived only from the hub manifest and role rules —
   never from any per-checkout local state — so hub-side and member-side
   resolution report identical docs roots for every repo (the deep-equal parity
   guarantee extends to the new value).
4. The atlas bundle's output stays byte-identical to the in-repo source's for
   identical inputs under the new link logic; the generator's new resolver
   dependency ships via the existing re-vendor step and fingerprint pin.
5. The generated-atlas contract of decision `0b8973e2` is amended from
   `docs/concepts.md` to `<docs-root>/concepts.md`; the single-repo value is
   unchanged.
6. Atlas link separators are POSIX `/` regardless of host OS, so byte-identity is
   stable across platforms.
7. The cross-ref URL and the resolved docs root must agree; the cross-ref skill
   surfaces a mismatch as operator error rather than emitting a link that would
   dead-end against the repo's actual layout.
8. The hub-manifest docs-root override is validated as a repo-relative,
   non-escaping path (no absolute path, no `..` traversal), consistent with the
   existing bare-name guard, so neither the atlas write nor the strip can escape
   the repo.
9. Resolution stays strictly read-only; adding the docs-root value introduces no
   filesystem writes into the resolver.

## Open Clarifications

None — resolved at the Phase 2 gate. The override policy (hub-manifest field,
role-defaulted), member policy (`docs/` unchanged), and single-repo policy
(unchanged) are settled as Key Decisions. The one residual human decision — whether
to enforce agreement between the cross-ref URL and the resolved docs root in this
epic — was answered "enforce now" and is recorded as a Key Decision and Invariant 7.
