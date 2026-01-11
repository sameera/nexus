#!/usr/bin/env python3
"""
Convert a repository-relative path to an absolute GitHub URL.

Reads the `docRoot` attribute from docs/system/delivery/config.json
and appends the provided relative path.

Usage:
    python get_abs_doc_path.py <relative-path>
    python get_abs_doc_path.py <relative-path1> <relative-path2> ...

Examples:
    python get_abs_doc_path.py docs/features/tagging/README.md
    python get_abs_doc_path.py "docs/features/tagging/README.md" "docs/system/delivery/task-labels.md"

Output:
    The absolute URL(s), one per line
    e.g., https://github.com/user/repo/tree/main/docs/features/tagging/README.md

Exit codes:
    0 - Success
    1 - Config file not found
    2 - docRoot not found in config
    3 - Invalid arguments
"""

import json
import sys
from pathlib import Path


def find_repo_root() -> Path:
    """Find the repository root by looking for common markers."""
    current = Path.cwd()

    # Walk up looking for .git or config.json
    for parent in [current] + list(current.parents):
        if (parent / ".git").exists():
            return parent
        if (parent / "docs" / "system" / "delivery" / "config.json").exists():
            return parent

    # Fallback to current directory
    return current


def get_doc_root(repo_root: Path) -> str:
    """Read docRoot from config.json."""
    config_path = repo_root / "docs" / "system" / "delivery" / "config.json"

    if not config_path.exists():
        print(f"Error: Config file not found at {config_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in config file: {e}", file=sys.stderr)
        sys.exit(1)

    doc_root = config.get("docRoot")
    if not doc_root:
        print("Error: 'docRoot' attribute not found in config.json", file=sys.stderr)
        sys.exit(2)

    # Ensure docRoot ends with a slash for proper concatenation
    return doc_root.rstrip("/") + "/"


def normalize_relative_path(path: str) -> str:
    """Normalize the relative path (remove leading ./ or /)."""
    path = path.strip()

    # Handle relative path prefixes
    while path.startswith("./"):
        path = path[2:]
    while path.startswith("../"):
        # For parent references, we keep them but this is a simple normalization
        # In practice, the caller should provide paths relative to repo root
        break

    # Remove leading slash if present
    path = path.lstrip("/")

    return path


def to_absolute_url(relative_path: str) -> str:
    """Convert a relative path to an absolute GitHub URL."""
    repo_root = find_repo_root()
    doc_root = get_doc_root(repo_root)
    normalized_path = normalize_relative_path(relative_path)

    return f"{doc_root}{normalized_path}"


def main():
    if len(sys.argv) < 2:
        print("Usage: python get_abs_doc_path.py <relative-path>", file=sys.stderr)
        print("       python get_abs_doc_path.py <path1> <path2> ...", file=sys.stderr)
        sys.exit(3)

    # Support multiple paths
    for rel_path in sys.argv[1:]:
        abs_url = to_absolute_url(rel_path)
        print(abs_url)


if __name__ == "__main__":
    main()