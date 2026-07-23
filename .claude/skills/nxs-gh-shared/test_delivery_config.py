#!/usr/bin/env python3
"""Unit tests for the shared delivery-config resolver (epic #121).

Run from anywhere with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
These tests exercise the resolver directly — independent of either creation script — so the
single source of truth has coverage the scripts cannot claim by proxy (STORY-121.01 AC3).
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import delivery_config  # noqa: E402
from delivery_config import (  # noqa: E402
    DEFAULT_EPIC_LABEL,
    DEFAULT_STORY_LABEL,
    _parse_simple_yaml,
    ensure_label,
    lookup_issue_type_id,
    read_delivery_config,
    resolve_classification,
    resolve_epic_label,
    resolve_story_label,
    set_issue_type,
)


class _Result:
    """A minimal CompletedProcess stand-in for the injected `run` callable."""

    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class FakeRun:
    """Records the commands it was asked to run and replays canned results in order."""

    def __init__(self, results):
        self._results = list(results)
        self.calls: list[list[str]] = []

    def __call__(self, cmd):
        self.calls.append(cmd)
        return self._results.pop(0) if self._results else _Result()

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


class ClassificationResolution(unittest.TestCase):
    def test_absent_resolves_to_legacy_auto(self):
        self.assertEqual(resolve_classification({}), "legacy-auto")

    def test_unrecognized_resolves_to_legacy_auto(self):
        self.assertEqual(resolve_classification({"classification": "banana"}), "legacy-auto")

    def test_explicit_modes(self):
        self.assertEqual(resolve_classification({"classification": "types"}), "types")
        self.assertEqual(resolve_classification({"classification": "labels"}), "labels")
        self.assertEqual(resolve_classification({"classification": "LEGACY-AUTO"}), "legacy-auto")

    def test_reads_from_settings_yml(self):
        root = _write_config({"settings.yml": "github:\n  classification: labels\n"})
        cfg = read_delivery_config(root)
        self.assertEqual(resolve_classification(cfg), "labels")


class LabelDefaults(unittest.TestCase):
    def test_epic_label_default_is_epic_not_enhancement(self):
        self.assertEqual(DEFAULT_EPIC_LABEL, "epic")
        self.assertEqual(resolve_epic_label({}), "epic")

    def test_story_label_default(self):
        self.assertEqual(DEFAULT_STORY_LABEL, "story")
        self.assertEqual(resolve_story_label({}), "story")

    def test_configured_label_names_win(self):
        self.assertEqual(resolve_epic_label({"epicLabel": "Epic-Item"}), "Epic-Item")
        self.assertEqual(resolve_story_label({"storyLabel": "user-story"}), "user-story")

    def test_read_delivery_config_surfaces_mappings(self):
        root = _write_config(
            {
                "settings.yml": (
                    "github:\n"
                    "  classification: types\n"
                    "  epic-type: Epic\n"
                    "  epic-label: epic\n"
                    "  story-type: Story\n"
                    "  story-label: story\n"
                )
            }
        )
        cfg = read_delivery_config(root)
        self.assertEqual(cfg["epicType"], "Epic")
        self.assertEqual(cfg["epicLabel"], "epic")
        self.assertEqual(cfg["storyType"], "Story")
        self.assertEqual(cfg["storyLabel"], "story")


class EnsureLabel(unittest.TestCase):
    def test_upserts_with_force(self):
        run = FakeRun([_Result(0)])
        self.assertTrue(ensure_label("epic", run))
        cmd = run.calls[0]
        self.assertEqual(cmd[:3], ["gh", "label", "create"])
        self.assertIn("epic", cmd)
        self.assertIn("--force", cmd)

    def test_targets_repo_with_dash_R(self):
        run = FakeRun([_Result(0)])
        ensure_label("epic", run, repo="acme/hub")
        self.assertIn("-R", run.calls[0])
        self.assertIn("acme/hub", run.calls[0])

    def test_failure_is_reported_not_raised(self):
        run = FakeRun([_Result(1, stderr="no scope")])
        self.assertFalse(ensure_label("epic", run))


class IssueTypeHelpers(unittest.TestCase):
    def _types_response(self):
        return json.dumps(
            {"data": {"repository": {"issueTypes": {"nodes": [{"id": "IT_1", "name": "Epic"}]}}}}
        )

    def test_lookup_matches_by_name_case_insensitive(self):
        run = FakeRun([_Result(0, stdout="acme/repo"), _Result(0, stdout=self._types_response())])
        self.assertEqual(lookup_issue_type_id("epic", run), "IT_1")

    def test_lookup_uses_explicit_repo_without_repo_view(self):
        run = FakeRun([_Result(0, stdout=self._types_response())])
        self.assertEqual(lookup_issue_type_id("Epic", run, repo="acme/hub"), "IT_1")
        # With an explicit repo, no `gh repo view` call is needed — the query targets acme/hub.
        self.assertEqual(len(run.calls), 1)
        self.assertIn("owner=acme", run.calls[0])
        self.assertIn("repo=hub", run.calls[0])

    def test_lookup_returns_none_when_issue_types_null(self):
        run = FakeRun([
            _Result(0, stdout="acme/repo"),
            _Result(0, stdout=json.dumps({"data": {"repository": {"issueTypes": None}}})),
        ])
        self.assertIsNone(lookup_issue_type_id("Epic", run))

    def test_set_issue_type_returns_success(self):
        self.assertTrue(set_issue_type("I_1", "IT_1", FakeRun([_Result(0)])))
        self.assertFalse(set_issue_type("I_1", "IT_1", FakeRun([_Result(1)])))


class SingleSourceOfTruth(unittest.TestCase):
    """STORY-121.01 AC1: a search finds zero duplicate definitions of the resolver."""

    def test_scripts_do_not_redefine_the_resolver(self):
        for script in (_EPIC_SCRIPT, _STORY_SCRIPT):
            src = script.read_text(encoding="utf-8")
            self.assertNotIn("def read_delivery_config", src, f"{script.name} redefines the resolver")
            self.assertNotIn("def _parse_simple_yaml", src, f"{script.name} redefines the YAML parser")

    def test_scripts_do_not_redefine_the_shared_gh_helpers(self):
        # Issue-type lookup/set and the label upsert live once in the shared module (STORY-121.02).
        for script in (_EPIC_SCRIPT, _STORY_SCRIPT):
            src = script.read_text(encoding="utf-8")
            for helper in ("def lookup_issue_type_id", "def set_issue_type", "def ensure_label"):
                self.assertNotIn(helper, src, f"{script.name} redefines {helper}")

    def test_resolver_lives_in_the_shared_module(self):
        self.assertTrue(hasattr(delivery_config, "read_delivery_config"))
        self.assertTrue(hasattr(delivery_config, "_parse_simple_yaml"))


if __name__ == "__main__":
    unittest.main()
