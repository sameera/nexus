#!/usr/bin/env python3
"""
Convert a repository-relative path to an absolute GitHub URL.

Reads the `docRoot` attribute from docs/system/delivery/config.yml
(cross-ref.docs-root) or config.json (docRoot) and appends the provided
relative path.

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
    1 - Config file not found (neither config.yml nor config.json)
    2 - docRoot not found in config
    3 - Invalid arguments
"""

import json
import sys
from pathlib import Path


def _parse_simple_yaml(content: str) -> dict[str, dict[str, str]]:
    """Parse the 2-level nested config.yml format without external dependencies."""
    result: dict[str, dict[str, str]] = {}
    current_section: str | None = None
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not line[0].isspace() and ":" in line:
            key = line.split(":")[0].strip()
            result[key] = {}
            current_section = key
        elif current_section and ":" in line:
            key, _, value = line.partition(":")
            result[current_section][key.strip()] = value.strip()
    return result


def read_delivery_config(project_root: Path) -> dict[str, str]:
    """Read delivery config from config.yml (preferred) or config.json (fallback).

    Returns a normalized dict with keys: docRoot, project, epicType.
    """
    delivery_dir = project_root / "docs" / "system" / "delivery"

    yml_path = delivery_dir / "config.yml"
    if yml_path.exists():
        try:
            with open(yml_path, encoding="utf-8") as f:
                raw = _parse_simple_yaml(f.read())
            result: dict[str, str] = {}
            cross_ref = raw.get("cross-ref", {})
            github = raw.get("github", {})
            if cross_ref.get("docs-root"):
                result["docRoot"] = cross_ref["docs-root"]
            if github.get("project"):
                result["project"] = github["project"]
            if github.get("epic-type"):
                result["epicType"] = github["epic-type"]
            return result
        except OSError:
            pass

    json_path = delivery_dir / "config.json"
    if json_path.exists():
        try:
            with open(json_path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    return {}


def find_repo_root() -> Path:
    """Find the repository root by looking for common markers."""
    current = Path.cwd()

    # Walk up looking for .git or delivery config
    for parent in [current] + list(current.parents):
        if (parent / ".git").exists():
            return parent
        delivery = parent / "docs" / "system" / "delivery"
        if (delivery / "config.yml").exists() or (delivery / "config.json").exists():
            return parent

    # Fallback to current directory
    return current


def get_doc_root(repo_root: Path) -> str:
    """Read docRoot from delivery config (config.yml or config.json)."""
    config = read_delivery_config(repo_root)
    doc_root = config.get("docRoot")

    if not doc_root:
        delivery_dir = repo_root / "docs" / "system" / "delivery"
        if not (delivery_dir / "config.yml").exists() and not (delivery_dir / "config.json").exists():
            print(f"Error: Config file not found in {delivery_dir}", file=sys.stderr)
            sys.exit(1)
        print("Error: 'docRoot' / 'cross-ref.docs-root' not found in delivery config", file=sys.stderr)
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