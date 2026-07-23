#!/usr/bin/env python3
"""Unit tests for the shared delivery-config resolver (epic #121).

Run from anywhere with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
These tests exercise the resolver directly — independent of either creation script — so the
single source of truth has coverage the scripts cannot claim by proxy (STORY-121.01 AC3).
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import delivery_config  # noqa: E402
from delivery_config import (  # noqa: E402
    DEFAULT_EPIC_LABEL,
    DEFAULT_PROJECT,
    DEFAULT_STORY_LABEL,
    PRECEDENCE,
    PROJECT_AUTO,
    PROJECT_NONE,
    _normalize_hub_defaults,
    _parse_simple_yaml,
    ensure_label,
    lookup_issue_type_id,
    read_delivery_config,
    read_hub_defaults,
    repo_has_issue_types,
    resolve_classification,
    resolve_epic_label,
    resolve_epic_repo,
    resolve_issues_repo,
    resolve_project_target,
    resolve_setting,
    resolve_story_label,
    resolve_story_repo,
    set_issue_type,
    write_github_block,
)

_MODULE = Path(__file__).resolve().parent / "delivery_config.py"


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


class ProjectTargetResolution(unittest.TestCase):
    """STORY-121.03: the Project V2 target resolves to none | auto | explicit."""

    def test_absent_resolves_to_auto(self):
        # No `github:` block (or no project key) reproduces today's discovery behavior.
        self.assertEqual(DEFAULT_PROJECT, PROJECT_AUTO)
        self.assertEqual(resolve_project_target({}), ("auto", None))

    def test_none_is_first_class_and_case_insensitive(self):
        self.assertEqual(resolve_project_target({"project": "none"}), ("none", None))
        self.assertEqual(resolve_project_target({"project": "NONE"}), ("none", None))
        self.assertEqual(PROJECT_NONE, "none")

    def test_auto_is_explicit_value(self):
        self.assertEqual(resolve_project_target({"project": "auto"}), ("auto", None))
        self.assertEqual(resolve_project_target({"project": "Auto"}), ("auto", None))

    def test_explicit_owner_number_target(self):
        self.assertEqual(resolve_project_target({"project": "acme/7"}), ("explicit", "acme/7"))

    def test_explicit_title_preserves_original_case(self):
        # A project name/title is case-sensitive; only the mode keywords are folded.
        self.assertEqual(
            resolve_project_target({"project": "Backend Roadmap"}),
            ("explicit", "Backend Roadmap"),
        )

    def test_reads_none_from_settings_yml(self):
        root = _write_config({"settings.yml": "github:\n  project: none\n"})
        self.assertEqual(resolve_project_target(read_delivery_config(root)), ("none", None))

    def test_reads_explicit_from_settings_yml(self):
        root = _write_config({"settings.yml": "github:\n  project: acme/12\n"})
        self.assertEqual(
            resolve_project_target(read_delivery_config(root)), ("explicit", "acme/12")
        )


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


class PrecedenceResolution(unittest.TestCase):
    """STORY-121.04 AC1: one precedence chain, most-specific first —
    invocation > frontmatter > repo settings > hub defaults > built-in, each adjacent pair."""

    def test_precedence_order_is_declared_most_specific_first(self):
        self.assertEqual(PRECEDENCE, ("invocation", "frontmatter", "repo", "hub", "builtin"))

    def test_invocation_beats_frontmatter(self):
        self.assertEqual(
            resolve_setting("project", invocation={"project": "inv"}, frontmatter={"project": "fm"}),
            "inv",
        )

    def test_frontmatter_beats_repo(self):
        self.assertEqual(
            resolve_setting("project", frontmatter={"project": "fm"}, repo={"project": "repo"}),
            "fm",
        )

    def test_repo_beats_hub(self):
        self.assertEqual(
            resolve_setting("project", repo={"project": "repo"}, hub={"project": "hub"}),
            "repo",
        )

    def test_hub_beats_builtin(self):
        self.assertEqual(resolve_setting("project", hub={"project": "hub"}, builtin="bi"), "hub")

    def test_builtin_is_the_last_resort(self):
        self.assertEqual(resolve_setting("project", builtin="bi"), "bi")
        self.assertIsNone(resolve_setting("project"))

    def test_builtin_may_be_a_mapping(self):
        self.assertEqual(
            resolve_setting("classification", builtin={"classification": "legacy-auto"}),
            "legacy-auto",
        )

    def test_empty_or_absent_higher_layer_falls_through(self):
        # An empty string at a higher layer is "unset" — it never shadows a lower layer's value.
        self.assertEqual(
            resolve_setting("project", frontmatter={"project": ""}, repo={"project": "repo"}),
            "repo",
        )
        self.assertEqual(
            resolve_setting("project", invocation=None, frontmatter={}, repo={"project": "repo"}),
            "repo",
        )


class IssuesRepoResolution(unittest.TestCase):
    """STORY-121.04 AC2/AC3: issues-repo resolves through the one shared chain, so /nxs.close and
    both creation scripts target the same repo."""

    def test_from_repo_settings(self):
        root = _write_config({"settings.yml": "github:\n  issues-repo: acme/hub\n"})
        self.assertEqual(resolve_issues_repo(read_delivery_config(root)), "acme/hub")

    def test_absent_is_empty_string(self):
        self.assertEqual(resolve_issues_repo({}), "")

    def test_frontmatter_and_invocation_override_repo(self):
        cfg = {"issuesRepo": "acme/hub"}
        self.assertEqual(resolve_issues_repo(cfg, frontmatter={"issuesRepo": "acme/fm"}), "acme/fm")
        self.assertEqual(resolve_issues_repo(cfg, invocation={"issuesRepo": "acme/inv"}), "acme/inv")


class EpicStoryRepoResolution(unittest.TestCase):
    """STORY-121.05: epic-repo/story-repo are repo-level keys resolved through the shared chain;
    the specific key wins over the general issues-repo, which is the fallback for whichever is
    unspecified (decision-record Invariant 9)."""

    def test_epic_repo_falls_back_to_issues_repo(self):
        cfg = {"issuesRepo": "acme/hub"}
        self.assertEqual(resolve_epic_repo(cfg), "acme/hub")
        self.assertEqual(resolve_story_repo(cfg), "acme/hub")

    def test_specific_epic_repo_beats_general_issues_repo(self):
        cfg = {"issuesRepo": "acme/hub", "epicRepo": "acme/epics"}
        self.assertEqual(resolve_epic_repo(cfg), "acme/epics")
        # story-repo unset here, so stories still fall back to issues-repo
        self.assertEqual(resolve_story_repo(cfg), "acme/hub")

    def test_story_repo_specificity(self):
        cfg = {"issuesRepo": "acme/hub", "storyRepo": "acme/web-app"}
        self.assertEqual(resolve_story_repo(cfg), "acme/web-app")
        self.assertEqual(resolve_epic_repo(cfg), "acme/hub")

    def test_absent_everything_is_empty_string(self):
        self.assertEqual(resolve_epic_repo({}), "")
        self.assertEqual(resolve_story_repo({}), "")

    def test_hub_epic_repo_beats_repo_issues_repo_no_code_repo_case(self):
        # AC3: a member with no primary code repo does not declare epic-repo, so it inherits the
        # hub's epic-repo (the hub repo) — the epic issue lands in the hub. Falls out of per-key
        # hub inheritance + epic-repo specificity, no special-casing.
        self.assertEqual(resolve_epic_repo({}, hub={"epicRepo": "acme/docs-hub"}), "acme/docs-hub")

    def test_repo_epic_repo_overrides_hub(self):
        # A member WITH its own code repo declares epic-repo locally, which wins over the hub.
        self.assertEqual(
            resolve_epic_repo({"epicRepo": "acme/web-app"}, hub={"epicRepo": "acme/docs-hub"}),
            "acme/web-app",
        )

    def test_frontmatter_and_invocation_override(self):
        cfg = {"epicRepo": "acme/epics"}
        self.assertEqual(resolve_epic_repo(cfg, frontmatter={"epicRepo": "acme/fm"}), "acme/fm")
        self.assertEqual(resolve_epic_repo(cfg, invocation={"epicRepo": "acme/inv"}), "acme/inv")

    def test_read_delivery_config_surfaces_repo_targets(self):
        root = _write_config(
            {"settings.yml": "github:\n  epic-repo: acme/docs-hub\n  story-repo: acme/web-app\n"}
        )
        cfg = read_delivery_config(root)
        self.assertEqual(cfg["epicRepo"], "acme/docs-hub")
        self.assertEqual(cfg["storyRepo"], "acme/web-app")


class HubDefaults(unittest.TestCase):
    """STORY-121.05: the Python resolver reads workspace-wide github defaults (the `hub` layer)
    by shelling out to the `workspace github-defaults` CLI verb — guarded so a single-repo
    checkout (no workspace artifact) never spawns node."""

    def test_no_workspace_artifact_returns_empty_without_running(self):
        root = Path(tempfile.mkdtemp())
        (root / ".nexus" / "config").mkdir(parents=True)
        run = FakeRun([])
        self.assertEqual(read_hub_defaults(root, run=run), {})
        self.assertEqual(run.calls, [])  # guard short-circuits: no node spawn in single-repo

    def test_artifact_present_but_no_cli_returns_empty(self):
        # A member checkout (hub.yml present) but no vendored nexus.mjs anywhere → best-effort {}.
        root = Path(tempfile.mkdtemp())
        (root / ".nexus" / "config").mkdir(parents=True)
        (root / ".nexus" / "config" / "hub.yml").write_text(
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n", encoding="utf-8"
        )
        run = FakeRun([])
        self.assertEqual(read_hub_defaults(root, run=run), {})
        self.assertEqual(run.calls, [])  # no CLI found → nothing run

    def test_reads_defaults_via_injected_cli(self):
        # hub.yml present AND a (dummy) vendored nexus.mjs exists → the verb is invoked and its
        # JSON is normalized into the hub layer.
        root = Path(tempfile.mkdtemp())
        (root / ".nexus" / "config").mkdir(parents=True)
        (root / ".nexus" / "config" / "hub.yml").write_text(
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n", encoding="utf-8"
        )
        (root / ".nexus" / "tools").mkdir(parents=True)
        (root / ".nexus" / "tools" / "nexus.mjs").write_text("// bundle\n", encoding="utf-8")
        run = FakeRun([_Result(0, stdout='{"project": "acme/1", "epic-repo": "acme/docs-hub"}')])
        result = read_hub_defaults(root, run=run)
        self.assertEqual(result, {"project": "acme/1", "epicRepo": "acme/docs-hub"})
        self.assertIn("github-defaults", run.calls[0])

    def test_normalize_maps_github_keys_and_drops_unknown(self):
        raw = '{"project": "acme/1", "classification": "labels", "story-repo": "acme/w", "banana": "x"}'
        self.assertEqual(
            _normalize_hub_defaults(raw),
            {"project": "acme/1", "classification": "labels", "storyRepo": "acme/w"},
        )

    def test_normalize_tolerates_garbage(self):
        self.assertEqual(_normalize_hub_defaults("not json"), {})
        self.assertEqual(_normalize_hub_defaults("[1,2,3]"), {})
        self.assertEqual(_normalize_hub_defaults("{}"), {})


class WriteGithubBlock(unittest.TestCase):
    """STORY-121.06/07: the one surgical, add-only settings.yml writer shared by setup-seeding
    and runtime write-back. It preserves unrelated sections/comments, never overwrites a declared
    key, and never writes an empty value (Invariants 5, 6, 10)."""

    def _settings(self, content: str) -> Path:
        return _write_config({"settings.yml": content})

    def _read(self, root: Path) -> str:
        return (root / ".nexus" / "config" / "settings.yml").read_text(encoding="utf-8")

    def test_appends_a_fresh_block_preserving_existing_sections(self):
        root = self._settings("cross-ref:\n  docs-root: https://example/docs\n")
        report = write_github_block(root, {"classification": "labels", "project": "none"})
        text = self._read(root)
        # The pre-existing cross-ref block survives verbatim.
        self.assertIn("cross-ref:\n  docs-root: https://example/docs\n", text)
        self.assertIn("github:", text)
        self.assertIn("  classification: labels", text)
        self.assertIn("  project: none", text)
        self.assertEqual(set(report["added"]), {"classification", "project"})
        # Round-trips through the reader.
        cfg = read_delivery_config(root)
        self.assertEqual(resolve_classification(cfg), "labels")
        self.assertEqual(resolve_project_target(cfg), ("none", None))

    def test_inserts_only_absent_keys_into_an_existing_block(self):
        root = self._settings("github:\n  classification: types\n")
        report = write_github_block(root, {"classification": "labels", "project": "none"})
        text = self._read(root)
        # classification was already declared → untouched; only project is added.
        self.assertIn("  classification: types", text)
        self.assertNotIn("classification: labels", text)
        self.assertIn("  project: none", text)
        self.assertEqual(report["added"], ["project"])

    def test_never_overwrites_a_declared_key_including_explicit_auto(self):
        root = self._settings("github:\n  project: auto\n")
        report = write_github_block(root, {"project": "none"})
        self.assertIn("  project: auto", self._read(root))
        self.assertEqual(report["added"], [])

    def test_skips_empty_values(self):
        root = self._settings("cross-ref:\n  docs-root: x\n")
        report = write_github_block(root, {"classification": "labels", "issues-repo": ""})
        text = self._read(root)
        self.assertIn("  classification: labels", text)
        self.assertNotIn("issues-repo", text)
        self.assertEqual(report["added"], ["classification"])

    def test_idempotent_second_run_is_a_no_op(self):
        root = self._settings("cross-ref:\n  docs-root: x\n")
        write_github_block(root, {"classification": "labels"})
        before = self._read(root)
        report = write_github_block(root, {"classification": "labels"})
        self.assertEqual(report["added"], [])
        self.assertEqual(self._read(root), before)

    def test_writes_a_comment_above_a_fresh_block(self):
        root = self._settings("cross-ref:\n  docs-root: x\n")
        write_github_block(
            root, {"classification": "labels", "project": "none"}, comment="seeded by setup — gh unavailable"
        )
        text = self._read(root)
        self.assertIn("# seeded by setup — gh unavailable", text)
        # The comment sits with the block, after the preserved cross-ref section.
        self.assertLess(text.index("cross-ref:"), text.index("# seeded by setup"))
        self.assertLess(text.index("# seeded by setup"), text.index("github:"))

    def test_creates_settings_file_when_absent(self):
        root = Path(tempfile.mkdtemp())  # no .nexus/config yet
        report = write_github_block(root, {"classification": "labels"})
        self.assertTrue((root / ".nexus" / "config" / "settings.yml").exists())
        self.assertEqual(report["added"], ["classification"])
        self.assertEqual(resolve_classification(read_delivery_config(root)), "labels")


class RepoHasIssueTypes(unittest.TestCase):
    """STORY-121.06: the setup-time probe for whether the repo/org exposes issue-types."""

    def _resp(self, issue_types):
        return json.dumps({"data": {"repository": {"issueTypes": issue_types}}})

    def test_true_when_types_present(self):
        run = FakeRun([_Result(0, stdout="acme/repo"), _Result(0, stdout=self._resp({"nodes": [{"id": "IT_1"}]}))])
        self.assertIs(repo_has_issue_types(run), True)

    def test_false_when_feature_absent_null(self):
        run = FakeRun([_Result(0, stdout="acme/repo"), _Result(0, stdout=self._resp(None))])
        self.assertIs(repo_has_issue_types(run), False)

    def test_false_when_feature_present_but_no_types(self):
        run = FakeRun([_Result(0, stdout="acme/repo"), _Result(0, stdout=self._resp({"nodes": []}))])
        self.assertIs(repo_has_issue_types(run), False)

    def test_none_when_query_fails(self):
        run = FakeRun([_Result(0, stdout="acme/repo"), _Result(1, stderr="boom")])
        self.assertIsNone(repo_has_issue_types(run))

    def test_none_when_repo_cannot_be_resolved(self):
        run = FakeRun([_Result(1, stderr="not a repo")])
        self.assertIsNone(repo_has_issue_types(run))


class ResolveCli(unittest.TestCase):
    """The read-only `resolve` CLI that non-script consumers (/nxs.close) call to obtain a value
    through the shared resolver instead of re-parsing settings themselves (Invariant 2)."""

    def _run_cli(self, root, *cli_args):
        return subprocess.run(
            [sys.executable, str(_MODULE), *cli_args, "--root", str(root)],
            capture_output=True,
            text=True,
        )

    def test_resolve_issues_repo_prints_configured_value(self):
        root = _write_config({"settings.yml": "github:\n  issues-repo: acme/hub\n"})
        out = self._run_cli(root, "resolve", "issues-repo")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "acme/hub")

    def test_resolve_issues_repo_absent_prints_empty(self):
        root = Path(tempfile.mkdtemp())
        out = self._run_cli(root, "resolve", "issues-repo")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "")

    def test_resolve_project_uses_github_key(self):
        root = _write_config({"settings.yml": "github:\n  project: acme/12\n"})
        out = self._run_cli(root, "resolve", "project")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "acme/12")

    def test_resolve_epic_repo_falls_back_to_issues_repo(self):
        # STORY-121.05: /nxs.close resolves `epic-repo` (it targets the epic issue); with only
        # issues-repo declared, epic-repo resolves to it — today's behavior preserved.
        root = _write_config({"settings.yml": "github:\n  issues-repo: acme/hub\n"})
        out = self._run_cli(root, "resolve", "epic-repo")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "acme/hub")

    def test_resolve_epic_repo_prefers_specific(self):
        root = _write_config(
            {"settings.yml": "github:\n  issues-repo: acme/hub\n  epic-repo: acme/epics\n"}
        )
        out = self._run_cli(root, "resolve", "epic-repo")
        self.assertEqual(out.stdout.strip(), "acme/epics")


class SeedCli(unittest.TestCase):
    """STORY-121.06: the CLIs /nxs.setup uses to detect classification and surgically seed the
    github block. `write-github` is the thin CLI over write_github_block; `detect-classification`
    prints the setup-time probe result."""

    def _run_cli(self, root, *cli_args):
        return subprocess.run(
            [sys.executable, str(_MODULE), *cli_args, "--root", str(root)],
            capture_output=True,
            text=True,
        )

    def test_write_github_seeds_block_and_preserves_cross_ref(self):
        root = _write_config({"settings.yml": "cross-ref:\n  docs-root: https://x/docs\n"})
        out = self._run_cli(root, "write-github", "--classification", "labels", "--project", "none")
        self.assertEqual(out.returncode, 0, out.stderr)
        text = (root / ".nexus" / "config" / "settings.yml").read_text(encoding="utf-8")
        self.assertIn("cross-ref:", text)
        self.assertIn("  classification: labels", text)
        self.assertIn("  project: none", text)

    def test_write_github_reports_no_changes_when_declared(self):
        root = _write_config({"settings.yml": "github:\n  classification: types\n  project: auto\n"})
        out = self._run_cli(root, "write-github", "--classification", "labels", "--project", "none")
        self.assertEqual(out.returncode, 0, out.stderr)
        text = (root / ".nexus" / "config" / "settings.yml").read_text(encoding="utf-8")
        self.assertIn("  classification: types", text)
        self.assertIn("  project: auto", text)
        self.assertNotIn("labels", text)

    def test_write_github_records_fallback_comment(self):
        root = _write_config({"settings.yml": "cross-ref:\n  docs-root: x\n"})
        out = self._run_cli(
            root, "write-github", "--classification", "labels", "--project", "none",
            "--comment", "gh unavailable at setup",
        )
        self.assertEqual(out.returncode, 0, out.stderr)
        text = (root / ".nexus" / "config" / "settings.yml").read_text(encoding="utf-8")
        self.assertIn("# gh unavailable at setup", text)

    def test_detect_classification_prints_a_valid_token(self):
        # Hermetic smoke: whatever the gh state, the verb must print one of the three tokens and
        # exit 0 (gh-unavailable degrades to 'unavailable', never a crash — AC3).
        root = Path(tempfile.mkdtemp())
        out = self._run_cli(root, "detect-classification")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn(out.stdout.strip(), {"types", "labels", "unavailable"})


class SingleSourceOfTruth(unittest.TestCase):
    """STORY-121.01 AC1: a search finds zero duplicate definitions of the resolver."""

    def test_scripts_do_not_redefine_the_resolver(self):
        for script in (_EPIC_SCRIPT, _STORY_SCRIPT):
            src = script.read_text(encoding="utf-8")
            self.assertNotIn("def read_delivery_config", src, f"{script.name} redefines the resolver")
            self.assertNotIn("def _parse_simple_yaml", src, f"{script.name} redefines the YAML parser")

    def test_scripts_do_not_redefine_the_issues_repo_reader(self):
        # STORY-121.04: issues-repo resolution lives once in the shared module; neither script
        # carries a private read_issues_repo_from_config copy that could drift from the chain.
        for script in (_EPIC_SCRIPT, _STORY_SCRIPT):
            src = script.read_text(encoding="utf-8")
            self.assertNotIn(
                "def read_issues_repo_from_config", src,
                f"{script.name} redefines the issues-repo reader",
            )

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
