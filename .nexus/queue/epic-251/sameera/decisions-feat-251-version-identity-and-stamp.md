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
