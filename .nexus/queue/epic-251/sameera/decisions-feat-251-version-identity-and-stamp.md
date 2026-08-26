## 2026-08-26 — Where the release's one version is declared

- **Choice:** A `VERSION` file at the release root, found by both toolkits by walking up from their own file position.
- **Why:** It is one declaration that serves the source checkout and the distributable with no build step and no second copy to keep in step, which is what AC2 ("neither carries a version of its own") actually asks for.
- **Refuted alternative:** Declaring it in the root `package.json` and inlining it into the bundle at build time — the manifest is #252's territory, the Python half cannot read a bundler define, and a walk-up for a manifest has to match on package name, which is a layout fact written down in two places.

## 2026-08-26 — Which payload the version verb fingerprints

- **Choice:** The vendored payload beside the artifact when it exists, otherwise the live root `.claude/` tree.
- **Why:** A source checkout has no vendored copy, and the live tree is the same tree the vendor step hashes into the fingerprint pin — so both postures report the fingerprint of the components that would actually be installed.
- **Refuted alternative:** Reading the committed `bundle-fingerprint.json` pin — it does not travel with the distributable, so the verb would report nothing in the posture that matters most.

## 2026-08-26 — An unresolved version is null, not a default

- **Choice:** `resolveReleaseVersion` / `resolve_release_version` return null/None when no declaration is above the reader.
- **Why:** A fabricated version in a writer stamp is worse than an absent one — story #306 AC2 already makes a reader treat an absent stamp as "written by an unknown toolkit".
- **Refuted alternative:** Falling back to `0.0.0`, which a reader cannot distinguish from a real release.

## 2026-08-26 — Where the writer-stamp contract lives, given prose writers

- **Choice:** Declare the field name and the reader's "unknown writer" rule once in `libs/portable-tools/src/writer-stamp.ts`, and pin every writing/reading surface against it with a test that names those surfaces.
- **Why:** Three of the four stamped artifacts are written by prose commands that cannot import a constant, so a shared TypeScript constant alone would not prevent drift — a test that enumerates the surfaces does.
- **Refuted alternative:** A new `libs/writer-stamp` package depended on by both portable-tools and pr-acceptance — a whole nx library to deduplicate one string literal that the prose writers still could not import.

## 2026-08-26 — How the stamp stays outside every verified hash (AC3)

- **Choice:** Place the stamp as a sibling key beside the digests in frontmatter/machine blocks, never inside the bytes a digest covers, and pin it with a test asserting a stamped receipt parses to the same values as an unstamped one.
- **Why:** The record digest is taken over the decision-record issue body, which this epic does not stamp, so no canonicalisation rule has to change — the invariant holds by placement rather than by a new exclusion rule that would itself have to be carried forever.
- **Refuted alternative:** Teaching `canonicalizeRecordBody` to strip stamp lines — a permanent change to a canonicalisation rule stated as "nothing else", made for a stamp that is never written into that body.

## 2026-08-26 — The guard runs in the dispatcher, and the registry became a parameter

- **Choice:** `runNexusCli` runs the guard before dispatching, and takes an optional registry/home override.
- **Why:** AC5 — a verb added later with no guard code of its own must still be covered — is a property of where dispatch happens, and it is only demonstrable if a verb the real registry does not contain can be dispatched.
- **Refuted alternative:** Wrapping each verb's `run` at registration — every future verb would then have to remember the wrapper, which is the coverage gap AC5 names.

## 2026-08-26 — What counts as "two component sets on one account"

- **Choice:** The account home and the invoking repo are the two roots checked; a root counts when its `.claude/` holds a Nexus-namespaced component file.
- **Why:** Those are the two places a component set can resolve from today — the account-level install #253 introduces and the repo-committed set it replaces — and the namespace prefix is the same predicate `deploy` already owns files by.
- **Refuted alternative:** Scanning every ancestor directory for `.claude/` trees, which would report a defect for any checkout nested under another.
