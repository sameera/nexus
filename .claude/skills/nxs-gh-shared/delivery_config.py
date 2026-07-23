#!/usr/bin/env python3
"""Shared delivery-config resolver for the GitHub-publishing skills (epic #121).

Single source of truth (decision-record Invariant 2): both `nxs_gh_create_epic.py` and
`create_gh_issues.py` import `read_delivery_config` from here instead of each carrying a
verbatim copy — the copy-paste drift this epic exists to kill. Kept dependency-free (stdlib
only) so it travels with the vendored `.claude/` component tree and runs on any checkout.

STORY-121.01 is a pure, behavior-preserving extraction: the two functions below are the
former per-script copies, moved unchanged. Later stories layer classification, project-target,
precedence, and write-back onto this same module.
"""

import json
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
    """Read delivery config from settings.yml (canonical), falling back to the legacy
    config.yml / config.json names.

    Returns a normalized dict with keys: docRoot, project, epicType, issuesRepo.
    """
    delivery_dir = project_root / ".nexus" / "config"

    # settings.yml is the committed config file this repo actually writes. config.yml is
    # kept only as a legacy name: prior versions read config.yml (which never existed), so
    # any github: config placed in settings.yml was silently dropped.
    for yml_name in ("settings.yml", "config.yml"):
        yml_path = delivery_dir / yml_name
        if not yml_path.exists():
            continue
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
            if github.get("issues-repo"):
                result["issuesRepo"] = github["issues-repo"]
            return result
        except OSError:
            pass

    json_path = delivery_dir / "config.json"
    if json_path.exists():
        try:
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            # Support nested github object or flat keys
            if isinstance(data.get("github"), dict):
                if data["github"].get("issues-repo"):
                    data["issuesRepo"] = data["github"]["issues-repo"]
            return data
        except (json.JSONDecodeError, OSError):
            pass

    return {}
