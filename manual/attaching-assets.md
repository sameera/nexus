# Attach assets to filed issues

Use assets when a diagram, screen mockup, or sketch makes an epic or its decision record easier to review. Nexus publishes the files only after you approve the draft, then replaces their local paths with links pinned to the commit that published them. An image displays inline; other files are linked. A later file with the same name cannot change what an already-filed issue shows.

## Before you start

Your team needs a GitHub repository or writable branch to hold issue assets. Configure it once in the repository's `.nexus/config/settings.yml`:

```yaml
github:
  asset-store: acme/issue-assets          # or acme/issue-assets@media
  asset-size-cap: 5242880                 # optional; bytes per file (5 MB by default)
```

`asset-store` must be `owner/repository`, optionally followed by `@branch`. Everyone who files an issue needs permission to write to that location. Nexus does not fall back to the issues repository: if no asset store is configured, it will tell you that assets are unsupported and file the issues without them.

For HTML mockups, configure the renderer your team hosts:

```yaml
github:
  asset-renderer: "https://preview.example.com/?url={url}"
```

The value must be an absolute `http` or `https` URL with exactly one `{url}` placeholder. Nexus substitutes the mockup's commit-pinned URL into that placeholder. Without this setting, an HTML file is a plain link to its source; GitHub does not render HTML in an issue.

## Add assets to an epic

Pass one or more local files with `--assets`. The flag may be repeated or take a comma-separated list.

```text
/nxs.epic Add saved-search sharing --assets assets/sharing-flow.png,assets/sharing-mockup.html
```

Nexus checks that each file exists, that no two supplied files have the same filename, that each file is within the configured size cap, and that it can read the asset store. This check does not upload anything.

In the generated draft, place each asset where it helps the reader. Use the local path exactly as you supplied it:

```markdown
![Sharing flow](assets/sharing-flow.png)

[Interactive sharing mockup](assets/sharing-mockup.html)
```

Use image Markdown for an image you want shown inline. Use a normal link for a document, video, HTML mockup, or other file. A supplied file that is not referenced in the draft is reported but not uploaded.

Review the approval digest carefully. It identifies the store and its visibility, and tells you whether HTML mockups will use the configured renderer or remain source links. Choose **revise** if the asset placement or HTML behavior is not right; no files are published until you approve.

## Add assets to a decision record

Use the same option when a decision record needs the diagram or sketch that informed a choice:

```text
/nxs.decision-record #123 --assets assets/architecture-options.png
```

It also works with a record revision:

```text
/nxs.decision-record #123 --revise --assets assets/revised-architecture.png
```

The asset illustrates the decision; it does not replace the written rationale. Put it in the draft as Markdown using the exact declared path, then approve the filing checkpoint.

## What happens after approval

Nexus uploads every referenced asset to `features/<epic-slug>/` in the configured store, creating one commit per file. It rewrites the local path before filing or updating any issue:

| Asset type | Filed result |
| --- | --- |
| Image | Inline image using the commit-pinned file URL |
| HTML with `asset-renderer` configured | Link to the renderer for the commit-pinned mockup |
| HTML without a renderer, or any other file | Link to the commit-pinned file URL |

The published URL always names the new commit, never a branch. Reusing a filename creates a later version for a later issue while the earlier issue continues to show its original version.

## Common problems

- **“assets are unsupported”** — add an `asset-store` setting at the repository or workspace level, then start a new run.
- **Missing asset or duplicate filename** — correct the path, or rename one of the files. Two different directories with the same filename still conflict because they would have the same destination.
- **File is too large** — reduce the file size or have the team raise `asset-size-cap`; the limit is a team setting, not a per-command override.
- **Store cannot be read or upload fails** — confirm the configured repository/branch and your GitHub access. Nexus reports GitHub's error without attempting another storage location.
- **HTML opens as source rather than a mockup** — configure a valid `asset-renderer`. The renderer must be able to serve the configured store, including a private store, using the reader's GitHub access.

For a quick configuration check, run:

```bash
nexus assets resolve
```

It prints the declared store and branch, or reports that no asset store is configured.
