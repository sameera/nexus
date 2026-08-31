# Release Procedure

One release is one package: the `nexus` executable and the component payload, at one
semantic version. This procedure is the whole of it — follow it top to bottom.

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

While the version is below 1.0 the number carries no compatibility signal: a minor bump may
break a pipeline that worked before. An item describing a breaking change to stage behaviour
therefore says **breaking** in words, and says what a lead has to do differently. The release
check enforces that wording once the release's context says it broke something — set
`breakingChange` on the context the changelog spec passes; deciding that it did is yours.

**What the suite checks, and what it does not.** The suite checks the *language* of the entry —
no commit subjects, no file paths, no library versions, a named stage, the explicit no-change
statement, the breaking wording. It does **not** check *coverage*: nothing derives from the diff
which component bodies this release actually moved, so an entry that names some stage passes even
when it omits the change this release made. That is accepted, deliberately, as the author's
judgement rather than a gate. Read the release's own component diff before you write the entry:

    git diff --name-only <previous tag>..HEAD -- components

Every path that list names is a body a lead runs; an item accounts for each behaviour change
among them, or you decide in the open that it changes nothing a lead experiences.

## 3. Re-pin and verify

    pnpm nexus:pin-bundles
    npx nx run-many -t test --all

The first command rebuilds the executable, recomputes the payload hash and rewrites the
fingerprint pin and its payload manifest. It copies nothing into any repository. The test run is
what enforces the changelog rules and the version agreement; a release cannot be cut past a red
suite.

Commit the result — `VERSION`, `CHANGELOG.md`, `libs/portable-tools/bundle-fingerprint.json` and
`libs/portable-tools/payload-manifest.json` — and merge it to `main`.

## 4. Check the invocation gate

    pnpm nexus:release-gate

The tag and the public publish must not run while a shipped component body reaches a toolkit
capability by an in-repository script path instead of by a declared toolkit name. Those paths
exist in no installed package, so a body that names one cannot work outside a source checkout —
and the changelog's claim that a stage runs without a checkout would be false on the first
release.

The gate prints every offending body, the line, and the path it names; it exits non-zero while
any remain. **A non-zero exit stops the release here.** The fix is never to add the path back to
the payload — it is to rewrite the body to invoke the capability by the executable's declared name
(`nexus <verb>`).

Packing and installing locally is unaffected by this gate, and is the intended way to consume the
package definition before it goes green:

    npm pack

## 5. Tag

From the merged commit on `main`:

    git tag v<version>
    git push origin v<version>

The tag names the same version as `VERSION`, the manifest and the changelog entry. Nothing else
is tagged.

## 6. Publish

    pnpm nexus:build-release
    npm publish

`nexus:build-release` stages the three published parts under `dist/`. `npm publish` runs it again
through `prepack`, so a stale `dist/` cannot ship; the manifest's `files` allowlist is what
decides the tarball's contents. The package is published under public access.

Verify the published release the way an adopter meets it, from a directory that is not a checkout:

    npm install -g @sameeraperera/nexus
    nexus version

It prints the version you tagged.

## 7. Publish the releases-page entry

Create the GitHub release for the tag and paste the changelog section as its body. That page is
the changelog's home; the registry listing is not, and the two are not exclusive — Nexus lives in
a git repository whichever channel installs it.

## What a release does not check for the adopter

The manifest and the readme declare the supported platforms and the Node floor. That declaration is
the whole of the answer for this release: nothing checks the runtime at install time or on first
run, so an adopter on an unsupported platform meets an error that never mentions Nexus. This is
accepted rather than overlooked — a first-run prerequisite check is a later release's work.
