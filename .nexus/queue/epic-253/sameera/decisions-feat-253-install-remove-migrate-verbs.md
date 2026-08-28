## 2026-08-27 — The mirror's payload argument becomes a tagged union

- **Choice:** `deployComponents(payload, componentRoot, options)` where `payload` is `{ kind: "directory", dir } | { kind: "empty" }`.
- **Why:** Invariant 3 needs "deliberately empty" to be unrepresentable by accident, and a tagged union makes the throw on an unresolvable payload dir survive for every other caller.
- **Refuted alternative:** Keep `payloadDir: string` and add a separate `removeComponents` entry point — two implementations of one mirror, which the record explicitly rules out.

## 2026-08-27 — The checkout-pointing content is written with filesystem symlinks

- **Choice:** Pointer mode writes one `fs.symlinkSync` per payload file, and every write unlinks the destination first.
- **Why:** The record fixes one pointer per payload file; unlinking first is what stops a later copying install writing *through* a surviving pointer into the maintainer's checkout (invariant 6).
- **Refuted alternative:** Hard links — cheaper to reason about for the loader, but they do not track a file the maintainer rewrites in place with a new inode, which is the whole point of the mode.

## 2026-08-27 — The allowlist text lives in one module, not in the verb

- **Choice:** `allowlist.ts` exports `ALLOWLIST_BLOCK`; the verb prints its lines and the story-#318 test asserts the README carries the same string.
- **Why:** Invariant 17 wants drift across the three surfaces to be a failing build, and a shared constant makes the comparison a single equality rather than a fuzzy match.
- **Refuted alternative:** Generate the README region from the constant — refuted in the record itself (a generated region inside hand-written prose).

## 2026-08-27 — The removal verb is named `uninstall`

- **Choice:** `nexus uninstall`, a leaf verb with no flags.
- **Why:** It pairs with `install` at the same scope (the account's one component set) and reads correctly in the ordering notice it has to print — "run uninstall before removing the package".
- **Refuted alternative:** `nexus install --remove`, keeping one verb for one location; refuted because the ordering notice and the "must run before the package goes" warning belong to a verb a user reaches for deliberately, not to a flag.

## 2026-08-27 — The tracked-file gate is a `removable` predicate on the mirror

- **Choice:** Migration passes `removable: (rel) => tracked.has(".claude/" + rel)` into the mirror; vetoed paths come back as `retained`.
- **Why:** Keeps one mirror implementation and one namespace predicate — the gate is a caller's policy, not a second removal path.
- **Refuted alternative:** Have migration list and delete files itself, bypassing the mirror; refuted because it would give the epic a second definition of what Nexus owns.

## 2026-08-27 — The printed git commands name explicit paths, not `-A`

- **Choice:** `git add -- .claude .gitignore`, then a plain `git commit -m`.
- **Why:** Invariant 11 — the verb runs against a branch the owner was already working on, so a printed command that swept the working tree would offer them a commit of the rest of their diff.
- **Refuted alternative:** `git add -A` for brevity; refuted on exactly that.

## 2026-08-27 — `workspace init` loses its `--payload` flag with the fan-out

- **Choice:** The flag is removed from the verb, not left accepted-and-ignored.
- **Why:** Its only referent was the payload the fan-out deployed; accepting it after the fan-out is gone would document a deploy that no longer happens.
- **Refuted alternative:** Keep accepting it for compatibility — refuted because the caller population is one, the same argument the record makes about the seam itself.

## 2026-08-27 — The duplicate comparison is over the two file SETS, not the two roots

- **Choice:** The guard resolves each owned file's real path at both locations and reports a duplicate only when the install location holds a real file the repository does not.
- **Why:** In the pointing mode the two component ROOTS are genuinely different real directories, so a root-level real-path comparison would report a false duplicate on every maintainer run — the property AC2 needs lives at the file level.
- **Refuted alternative:** Compare `realpathSync` of the two component roots; simpler, and wrong in exactly the mode the maintainer lives in.

## 2026-08-27 — `EnvironmentScope.home` is kept as a home-directory override, not replaced by a location override

- **Choice:** The guard still accepts `home`, and feeds it to `resolveInstallLocation` as the home-directory answer; the configuration-directory variable still wins over it.
- **Why:** The account-side location becomes the location a verb would actually install to, which is what the story asks for, while the existing dispatcher-coverage tests keep expressing "this account's home" without knowing about install-location resolution.
- **Refuted alternative:** Replace it with an `installLocation` override — more direct, but it lets a test bypass the resolution the guard is now supposed to share with the verbs.

## 2026-08-27 — The install section is retitled and rewritten, not amended

- **Choice:** README's "Installing & Updating" becomes "Installing" plus a separate "# Upgrading" section; the old repo-targeted `nexus deploy` walkthrough is replaced by `nexus install`.
- **Why:** The record requires the section be rewritten — the allowlist entries cannot be added to a document that teaches the arrangement this epic exists to remove — and the upgrade notes need a heading of their own to be findable and testable as a distinct surface.
- **Refuted alternative:** Keep one combined section and append an upgrade subsection; refuted because the two allowlist copies would then be indistinguishable to a test asserting each surface carries one.

## 2026-08-27 — Invariant 7's "what it holds" line becomes one shared, total describer

- **Choice:** `describeInstalledContent(state)` in install-location.ts returns a sentence for all three states — pointers at a checkout, a copied release, and no set at all — and both `uninstall` and `migrate-components` print it.
- **Why:** Uninstall was the one verb that never named the checkout it was about to unlink from, and a second hand-written copy of migrate's wording would let the two verbs drift apart on the disclosure the invariant is written for.
- **Refuted alternative:** Return `string | null` and let each caller guard; refuted because migrate already proved the set is populated, so its guard would be an unreachable branch that only exists to satisfy the type.

## 2026-08-27 — The `nexus deploy` ban is pinned over the shipped payload, not the repository's prose

- **Choice:** A spec asserts no vendored component file mentions `nexus deploy`; README's note that the verb still works but is unsupported stays.
- **Why:** A component instructing an adopter into the per-repository arrangement is shipped to their machine and immediately trips the duplicate-set diagnostic, while README's mention is the deprecation notice a migrating reader needs.
- **Refuted alternative:** Ban the phrase repository-wide; refuted because it would delete exactly the sentence that tells an existing adopter what happened to the verb they know.
