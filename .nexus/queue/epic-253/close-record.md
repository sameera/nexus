---
title: "Close Record: Build the install, removal and migration verbs on one component-mirror primitive"
epic: "#253"
feature: "Component Distribution"
date: 2026-08-27
nexus_version: 0.1.0
analyze: ran 2026-08-27 @ 76dab01768b30b6bdce693ddb427982ae138f21b
record: "#339"
record_hash: a11789ceb0cde4449e1ba0280bcf317b7e6c4d1da6dcd2490a638adf0d7cc728
range:
  - repo: github.com/sameera/nexus
    base: 1fb4102182e43ae5cb74ab89cfe09a41d3fff7a7
    head: 43ee3223bce8f01b2e4457218a45f2fbf8f51ecc
---

# Close Record: Build the install, removal and migration verbs on one component-mirror primitive

## Key Decisions

- **The mirror's payload argument became a tagged union.** `deployComponents(payload, componentRoot, options)` takes `{ kind: "directory", dir } | { kind: "empty" }`. Invariant 3 needs "deliberately empty" to be unrepresentable by accident, and the union keeps the throw on an unresolvable payload directory alive for every non-empty caller. *Refuted:* keep `payloadDir: string` and add a separate `removeComponents` entry point — two implementations of one mirror, which the record rules out.

- **The checkout-pointing content is written with filesystem symlinks, and every write unlinks the destination first.** One `fs.symlinkSync` per payload file. Unlinking first is what stops a later copying install writing *through* a surviving pointer into the maintainer's checkout (invariant 6). *Refuted:* hard links — cheaper to reason about for the loader, but they do not track a file the maintainer rewrites in place with a new inode, which is the whole point of the mode.

- **The removal verb is `nexus uninstall`, a leaf verb with no flags.** It pairs with `install` at the same scope — the account's one component set — and reads correctly in the ordering notice it has to print. *Refuted:* `nexus install --remove`, keeping one verb for one location; the ordering notice and the "must run before the package goes" warning belong to a verb a user reaches for deliberately, not to a flag.

- **The tracked-file gate is a `removable` predicate handed to the mirror, not a second removal path.** Migration passes `removable: (rel) => tracked.has(".claude/" + rel)`; vetoed paths come back as `retained`. This keeps one mirror implementation and one namespace predicate — the gate is a caller's policy. *Refuted:* have migration list and delete files itself, which would give the epic a second definition of what Nexus owns.

- **The printed git commands name explicit paths.** `git add -- .claude .gitignore`, then a plain `git commit -m`. Invariant 11: the verb runs against a branch the owner was already working on, so a command that swept the working tree would offer them a commit of the rest of their diff. *Refuted:* `git add -A` for brevity, on exactly that ground.

- **The duplicate comparison is over the two file SETS, not the two component roots.** The guard resolves each owned file's real path at both locations and reports a duplicate only when the install location holds a real file the repository does not. In the pointing mode the two roots are genuinely different real directories, so a root-level comparison would report a false duplicate on every maintainer run. *Refuted:* compare `realpathSync` of the two roots — simpler, and wrong in exactly the mode the maintainer lives in.

- **`EnvironmentScope.home` was kept as a home-directory override rather than replaced by an install-location override.** The guard feeds `home` to `resolveInstallLocation` as the home-directory answer, and the configuration-directory variable still wins over it. The account-side location becomes the location a verb would actually install to, while the existing dispatcher-coverage tests keep expressing "this account's home". *Refuted:* an `installLocation` override — more direct, but it lets a test bypass the resolution the guard is now supposed to share with the verbs.

- **Invariant 7's "what it holds" disclosure became one shared, total describer.** `describeInstalledContent(state)` returns a sentence for all three states — pointers at a checkout, a copied release, no set at all — and both `uninstall` (nexus-cli.ts:412) and `migrate-components` (nexus-cli.ts:465) print it. Uninstall was the one verb that never named the checkout it was about to unlink from, and a second hand-written copy of migrate's wording would let the two drift apart on the disclosure the invariant exists for. *Refuted:* return `string | null` and let each caller guard — migrate has already proved the set is populated, so its guard would be an unreachable branch existing only to satisfy the type.

- **The allowlist text lives in one module, not in the verb.** `allowlist.ts` exports `ALLOWLIST_BLOCK`; the verb prints its lines and `allowlist-docs.spec.ts` asserts the README carries the same string. Invariant 17 wants drift across the three surfaces to be a failing build, and a shared constant makes the comparison a single equality rather than a fuzzy match. *Refuted:* generate the README region from the constant — refuted in the record itself (a generated region inside hand-written prose).

- **The README install section was retitled and rewritten, not amended.** "Installing & Updating" became "Installing" plus a separate "Upgrading" section, and the repo-targeted `nexus deploy` walkthrough was replaced by `nexus install`. The allowlist entries cannot be added to a document that teaches the arrangement this epic exists to remove, and the upgrade notes need a heading of their own to be findable and testable as a distinct surface. *Refuted:* one combined section with an appended upgrade subsection — the two allowlist copies would then be indistinguishable to a test asserting each surface carries one.

- **The `nexus deploy` ban is pinned over the shipped payload, not the repository's prose.** `supported-arrangement.spec.ts` asserts no vendored component file mentions `nexus deploy`; the README's note that the verb still works but is unsupported deliberately stays. A component instructing an adopter into the per-repository arrangement is shipped to their machine and immediately trips the duplicate-set diagnostic, while the README mention is the deprecation notice a migrating reader needs. *Refuted:* ban the phrase repository-wide, which would delete exactly the sentence telling an existing adopter what happened to the verb they know.

- **`workspace init` loses its `--payload` flag with the fan-out.** The flag is removed from the verb, not left accepted-and-ignored; `InitDeps` is deleted outright. Its only referent was the payload the fan-out deployed, and accepting it afterwards would document a deploy that no longer happens. *Refuted:* keep accepting it for compatibility — the caller population is one, the same argument the record makes about the seam itself.

## Deviation Rationale

- **Invariant 6's first clause is met in the mirror but not in the two sibling walkers** (deviates from record #339, invariant 6). `deploy-components.ts` gates subtree roots with `lstat` via `isRealDirectory`, but `inspectInstallLocation` (install-location.ts:110) and `componentRealPaths` (environment-guard.ts:76) still gate with `fs.existsSync`, which follows a link. Nothing is deleted through it — invariant 4 and invariant 6's deletion clause both hold, and the per-file pointer content Nexus writes never produces this state — but a subtree-pointed location is misreported as a copied release, and a subtree root pointing at a *file* throws ENOTDIR; in `componentRealPaths` that throw is pre-dispatch and unhandled, so it fails every `nexus` verb. **Why:** the final `/nxs.analyze` run at the merged head found it, graded it medium, and judged it non-blocking with a named two-line remedy — it was deliberately left to a follow-up rather than reopened into an epic already assessed L with no slack. Deferred as a stub issue.

- **Invariant 1 shares the predicate but duplicates the prefix list** (deviates from record #339, invariant 1). Mirror, removal, migration and the duplicate guard all call `isNexusNamespaced` / `isNexusNamespacedPath`, but `NAMESPACE_PREFIXES` (nexus-namespace.ts:12) is module-private, so migrate-components.ts:50-52 hand-writes `nxs.*` / `nxs-*` as ignore globs. A prefix added to the predicate would silently leave the ignore entries stale, and the next stale command re-commits the set migration just removed — the harm invariant 12's entries exist to prevent. No test pins the two together. **Why:** same as above — found by the final analyze run, graded low, deliberately deferred. Deferred as a stub issue.

- **Invariant 2's before/after settings assertion covers `install` only** (deviates from record #339, invariant 2, as instrumentation). `uninstall` and `migrate-components` carry no equivalent assertion. Both are safe by construction — neither can reach a top-level non-namespaced file — so this is a gap in how the fourth success metric is measured, not a defect in the build. **Why:** graded low by the final analyze run and deferred with the other two.

- **Shipped components were re-pointed off `nexus deploy`, beyond any story's scope** (deviates from record #339's story scope, not from a decision). `.claude/commands/nxs.setup.md` and `how-to-nexus.md` now name `nexus install`, and a new `supported-arrangement.spec.ts` fails the build if any vendored component names the verb. **Why:** it follows from the record's "the surviving repository-targeted deploy verb is documented as unsupported" decision. A shipped component teaching an adopter the per-repository arrangement is delivered to their machine and then immediately trips the duplicate-set diagnostic Nexus itself ships — the epic would have documented the arrangement it exists to remove.

- **`nexus workspace init` lost its `--payload` flag, wider than story #316's stated scope** (deviates from record #339's scope edit for the workspace-init story). Story #316 says only the component fan-out is removed; the flag and the `InitDeps` seam went with it. **Why:** the flag's only referent was the fan-out payload, and the record decided "the seam is removed, not disabled" — a flag accepted after the thing it configured is gone documents a deploy that does not happen.

- **The workspace-init output carries the substance of the unsupported-arrangement notice, not the notice** (deviates from record #339's scope edit for the workspace-init story). The record required the init to "carry the deploy verb's unsupported-arrangement notice"; the shipped init instead states that components are not deployed per repository and names `nexus install` and `nexus migrate-components`, while the notice itself lives in the deploy verb's own usage text (nexus-cli.ts:112-113). **Why:** the substance the record wanted the lead to receive — that per-repository deployment is not the arrangement, and what to run instead — is delivered in the init's own voice, where a lead reading init output is standing; repeating the deploy verb's wording verbatim in a verb that no longer deploys would name a command the lead was not invoking. This is the one place an approved instruction was replaced rather than extended, so it is amended on the record thread.

## Deferred Scope

Deferred items filed as backlog stub issues:

- #343 — Every component walker gates a subtree root without following a pointer (invariant 6, all four call sites)
- #344 — One namespace prefix list, and the settings-boundary assertion covers all three verbs (invariants 1 and 2)

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-27-install-remove-migrate-verbs.md`
