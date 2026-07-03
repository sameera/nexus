# nxs-abs-doc-path

Convert repository-relative paths to absolute GitHub URLs for use in documentation.

## Purpose

Ensures all markdown document links in generated documentation use absolute GitHub URLs rather than relative paths. This provides:

-   Consistent link behavior regardless of viewing context (GitHub, local, exported PDFs)
-   No broken links when documents are moved or referenced from different directories
-   Proper navigation in all documentation consumers

## Configuration

The skill reads `cross-ref.docs-root` from `.nexus/config/settings.yml`:

```yaml
cross-ref:
    docs-root: https://github.com/sameera/nexus/blob/main/docs
```

`docs-root` points at the repo's `docs/` directory (not the repo root). If the
settings file is missing or the setting isn't set, the script falls back to a
placeholder default: `https://github.com/{username|orgname}/{reponame}/blob/main/docs`.

## Usage

```bash
# Convert a single path
tsx ./.claude/skills/nxs-abs-doc-path/scripts/get_abs_doc_path.ts "docs/features/tagging/README.md"
# Output: https://github.com/sameera/nexus/blob/main/docs/features/tagging/README.md

# Convert multiple paths at once
tsx ./.claude/skills/nxs-abs-doc-path/scripts/get_abs_doc_path.ts "docs/features/tagging/README.md" "docs/system/delivery/task-labels.md"
# Output (one per line):
# https://github.com/sameera/nexus/blob/main/docs/features/tagging/README.md
# https://github.com/sameera/nexus/blob/main/docs/system/delivery/task-labels.md
```

## Input Path Handling

The script normalizes input paths automatically. Since `docs-root` already
points at the `docs/` directory, a leading `docs/` segment is stripped so
callers can keep passing repo-relative paths unchanged:

| Input Format     | Normalized To |
| ---------------- | ------------- |
| `./docs/file.md` | `file.md`     |
| `/docs/file.md`  | `file.md`     |
| `docs/file.md`   | `file.md`     |
| `../README.md`   | ⚠️ Caller should resolve to repo-relative path first |

## Exit Codes

| Code | Meaning                            |
| ---- | ----------------------------------- |
| 0    | Success                             |
| 3    | Invalid arguments (no path provided) |

## Integration

Used by documentation generation commands including:

-   `nxs.epic` - Epic and User Stories generation
-   Any command that generates markdown with cross-references

## Example Transformation

**Before** (relative path in markdown):

```markdown
### Related Documents

-   [Parent Feature Brief](../README.md)
```

**After** (absolute URL):

```markdown
### Related Documents

-   [Parent Feature Brief](https://github.com/sameera/nexus/tree/main/docs/features/tagging/README.md)
```
