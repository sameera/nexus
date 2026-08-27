# Release Procedure

One release is one package: the `nexus` executable, the `nexus-gh` toolkit and the component
payload, at one semantic version. This procedure is the whole of it — follow it top to bottom.

## 1. Choose the version

The version is declared once, in `VERSION` at the repository root. Edit that file and nothing
else: the published manifest reads it, both toolkits resolve it by walking up from their own
position, and the tag and the changelog entry are checked against it.

Use semantic versioning against **adopter-visible stage behaviour**, not against the size of the
diff. A stage that now decides something differently is a minor release even if one line moved.

## 2. Write the changelog entry

Add a `## <version>` section at the top of `CHANGELOG.md`, above the previous one.

Each item says what a lead running a pipeline stage will now experience differently, and names
the stage — `setup`, `discover`, `epic`, `decision-record`, `analyze`, `close`, `distill`. An
item that is a commit subject, a file path or a library version is rejected by the release check,
because none of those is something an adopter runs.

If the release changed no stage behaviour, the entry still exists and says exactly:

    No change to how any pipeline stage behaves.

## 3. Re-pin and verify

    pnpm nexus:pin-bundles
    npx nx run-many -t test --all
    python3 -m unittest discover -s libs/gh-toolkit/tests

The first command rebuilds the executable, recomputes the payload hash and rewrites the
fingerprint pin and its payload manifest. It copies nothing into any repository. The test run is
what enforces the changelog rules and the version agreement; a release cannot be cut past a red
suite.

Commit the result — `VERSION`, `CHANGELOG.md`, `libs/portable-tools/bundle-fingerprint.json` and
`libs/portable-tools/payload-manifest.json` — and merge it to `main`.

## 4. Tag

From the merged commit on `main`:

    git tag v<version>
    git push origin v<version>

The tag names the same version as `VERSION`, the manifest and the changelog entry. Nothing else
is tagged.

## 5. Publish

    pnpm nexus:build-release
    npm publish

`nexus:build-release` stages the three published parts under `dist/`. `npm publish` runs it again
through `prepack`, so a stale `dist/` cannot ship; the manifest's `files` allowlist is what
decides the tarball's contents. The package is published under public access.

Verify the published release the way an adopter meets it, from a directory that is not a checkout:

    npm install -g @sameera/nexus
    nexus version
    nexus-gh version

Both print the version you tagged.

## 6. Publish the releases-page entry

Create the GitHub release for the tag and paste the changelog section as its body. That page is
the changelog's home; the registry listing is not, and the two are not exclusive — Nexus lives in
a git repository whichever channel installs it.
