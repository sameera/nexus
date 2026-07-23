#!/usr/bin/env python3
"""Unit tests for the shared delivery-config resolver (epic #121).

Run from anywhere with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
These tests exercise the resolver directly — independent of either creation script — so the
single source of truth has coverage the scripts cannot claim by proxy (STORY-121.01 AC3).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import delivery_config  # noqa: E402
from delivery_config import _parse_simple_yaml, read_delivery_config  # noqa: E402

# The two creation scripts that must import the resolver rather than redefine it.
_SKILLS = Path(__file__).resolve().parent.parent
_EPIC_SCRIPT = _SKILLS / "nxs-gh-create-epic" / "scripts" / "nxs_gh_create_epic.py"
_STORY_SCRIPT = _SKILLS / "nxs-gh-create-story" / "scripts" / "create_gh_issues.py"


def _write_config(files: dict[str, str]) -> Path:
    """Materialize a throwaway project root with the given .nexus/config/<name> files."""
    root = Path(tempfile.mkdtemp())
    cfg = root / ".nexus" / "config"
    cfg.mkdir(parents=True)
    for name, content in files.items():
        (cfg / name).write_text(content, encoding="utf-8")
    return root


class ParseSimpleYaml(unittest.TestCase):
    def test_two_level_nesting(self):
        parsed = _parse_simple_yaml("github:\n  project: acme/1\n  epic-type: Epic\n")
        self.assertEqual(parsed["github"]["project"], "acme/1")
        self.assertEqual(parsed["github"]["epic-type"], "Epic")

    def test_ignores_comments_and_blanks(self):
        parsed = _parse_simple_yaml("# a comment\n\ngithub:\n  project: p\n")
        self.assertEqual(parsed, {"github": {"project": "p"}})


class ReadDeliveryConfig(unittest.TestCase):
    def test_settings_yml_github_block(self):
        root = _write_config(
            {
                "settings.yml": (
                    "cross-ref:\n"
                    "  docs-root: https://example/docs\n"
                    "github:\n"
                    "  project: acme/7\n"
                    "  epic-type: Epic\n"
                    "  issues-repo: acme/issues\n"
                )
            }
        )
        result = read_delivery_config(root)
        self.assertEqual(result["project"], "acme/7")
        self.assertEqual(result["epicType"], "Epic")
        self.assertEqual(result["issuesRepo"], "acme/issues")
        self.assertEqual(result["docRoot"], "https://example/docs")

    def test_missing_config_returns_empty(self):
        root = Path(tempfile.mkdtemp())
        self.assertEqual(read_delivery_config(root), {})

    def test_legacy_config_yml_fallback(self):
        root = _write_config({"config.yml": "github:\n  project: legacy/3\n"})
        self.assertEqual(read_delivery_config(root)["project"], "legacy/3")

    def test_settings_yml_wins_over_legacy(self):
        root = _write_config(
            {
                "settings.yml": "github:\n  project: canonical/1\n",
                "config.yml": "github:\n  project: legacy/1\n",
            }
        )
        self.assertEqual(read_delivery_config(root)["project"], "canonical/1")

    def test_config_json_fallback(self):
        root = _write_config({"config.json": '{"github": {"issues-repo": "acme/hub"}}'})
        self.assertEqual(read_delivery_config(root)["issuesRepo"], "acme/hub")


class SingleSourceOfTruth(unittest.TestCase):
    """STORY-121.01 AC1: a search finds zero duplicate definitions of the resolver."""

    def test_scripts_do_not_redefine_the_resolver(self):
        for script in (_EPIC_SCRIPT, _STORY_SCRIPT):
            src = script.read_text(encoding="utf-8")
            self.assertNotIn("def read_delivery_config", src, f"{script.name} redefines the resolver")
            self.assertNotIn("def _parse_simple_yaml", src, f"{script.name} redefines the YAML parser")

    def test_resolver_lives_in_the_shared_module(self):
        self.assertTrue(hasattr(delivery_config, "read_delivery_config"))
        self.assertTrue(hasattr(delivery_config, "_parse_simple_yaml"))


if __name__ == "__main__":
    unittest.main()
