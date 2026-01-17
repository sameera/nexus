# nxs-abs-doc-path

Convert repository-relative paths to absolute GitHub URLs for use in documentation.

## Purpose

Ensures all markdown document links in generated documentation use absolute GitHub URLs rather than relative paths. This provides:

-   Consistent link behavior regardless of viewing context (GitHub, local, exported PDFs)
-   No broken links when documents are moved or referenced from different directories
-   Proper navigation in all documentation consumers

## Configuration

The skill reads the `docRoot` attribute from `docs/system/delivery/config.json`:

```json
{
    "docRoot": "https://github.com/sameera/nexus/tree/main/"
}
```

## Usage

```bash
# Convert a single path
python ./.gemini/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/tagging/README.md"
# Output: https://github.com/sameera/nexus/tree/main/docs/features/tagging/README.md

# Convert multiple paths at once
python ./.gemini/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/tagging/README.md" "docs/system/delivery/task-labels.md"
# Output (one per line):
# https://github.com/sameera/nexus/tree/main/docs/features/tagging/README.md
# https://github.com/sameera/nexus/tree/main/docs/system/delivery/task-labels.md
```

## Input Path Handling

The script normalizes input paths automatically:

| Input Format     | Normalized To                                        |
| ---------------- | ---------------------------------------------------- |
| `./docs/file.md` | `docs/file.md`                                       |
| `/docs/file.md`  | `docs/file.md`                                       |
| `docs/file.md`   | `docs/file.md`                                       |
| `../README.md`   | ⚠️ Caller should resolve to repo-relative path first |

## Exit Codes

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 0    | Success                                                     |
| 1    | Config file not found at `docs/system/delivery/config.json` |
| 2    | `docRoot` attribute not found in config                     |
| 3    | Invalid arguments (no path provided)                        |

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
