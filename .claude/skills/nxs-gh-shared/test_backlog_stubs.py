#!/usr/bin/env python3
"""Filing backlog stubs through the shared batch path (epic #185, STORY #186).

A stub is an epic issue born unplanned: it carries the repository's declared epic
classification plus one label denoting the unplanned state (decision-record Invariant 1/2).
These tests drive the batch filer end to end against a fake `gh`, asserting what the lead
observes — which issues exist, what they carry, what was wired, and what was never called.

Run from anywhere with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
"""

import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "nxs-gh-create-story" / "scripts"))

import create_gh_issues  # noqa: E402
from delivery_config import (  # noqa: E402
    DEFAULT_UNPLANNED_LABEL,
    label_exists,
    resolve_unplanned_label,
)


class FakeGh:
    """A recording stand-in for `gh` that answers every call the filer makes.

    `missing_labels` names labels whose `gh label create` fails — the token-lacks-label-scope
    case. `existing_labels` is what `gh label list` reports, so the preflight can tell a
    permission gap from a label that was already there.
    """

    def __init__(self, *, missing_labels=(), existing_labels=()):
        self.calls: list[list[str]] = []
        self.missing_labels = set(missing_labels)
        self.existing_labels = set(existing_labels)
        self._next_issue = 900

    def __call__(self, cmd, **kwargs):
        self.calls.append(list(cmd))
        return subprocess.CompletedProcess(cmd, 0, self._stdout(cmd), "")

    # --- helpers the assertions read ---------------------------------------------
    def commands(self, *prefix):
        """Every recorded call whose argv starts with `prefix`."""
        return [c for c in self.calls if c[: len(prefix)] == list(prefix)]

    def created_titles(self):
        return [c[c.index("--title") + 1] for c in self.commands("gh", "issue", "create")]

    def labels_of(self, title):
        for c in self.commands("gh", "issue", "create"):
            if c[c.index("--title") + 1] == title:
                return [c[i + 1] for i, tok in enumerate(c) if tok == "--label"]
        raise AssertionError(f"no issue was created with title {title!r}")

    def _stdout(self, cmd):
        if cmd[:3] == ["gh", "issue", "create"]:
            self._next_issue += 1
            return f"https://github.com/acme/widgets/issues/{self._next_issue}\n"
        if cmd[:3] == ["gh", "label", "list"]:
            return "\n".join(sorted(self.existing_labels)) + "\n"
        if cmd[:3] == ["gh", "issue", "view"]:
            if "body" in cmd:
                return "stub body\n"
            return "I_node_id\n"
        if cmd[:2] == ["gh", "api"] and "/dependencies/blocked_by" in " ".join(cmd):
            return "" if "--method" in cmd else ""
        if cmd[:2] == ["gh", "api"] and cmd[-1] == ".id":
            return f"{7000 + len(self.calls)}\n"
        return ""

    def returncode_for(self, cmd):
        return 0


class FailingLabelGh(FakeGh):
    """A `gh` whose label upsert fails for the named labels (no label scope on the token)."""

    def __call__(self, cmd, **kwargs):
        self.calls.append(list(cmd))
        if cmd[:3] == ["gh", "label", "create"] and cmd[3] in self.missing_labels:
            return subprocess.CompletedProcess(cmd, 1, "", "HTTP 403: Resource not accessible")
        return subprocess.CompletedProcess(cmd, 0, self._stdout(cmd), "")


STUB_ONE = """---
ref: STUB-1
title: "Workspace status read-out"
labels: [backlog]
blocked_by: none
---

- **goal:** print the resolved workspace status
- **estimate:** S
"""

STUB_TWO = """---
ref: STUB-2
title: "Hub tooling install"
labels: [backlog]
blocked_by: [STUB-1]
---

- **goal:** install the portable tools into a hub
- **estimate:** M
"""


class StubFilingTests(unittest.TestCase):
    """The oversized-scope path files one issue per functional goal (STORY #186)."""

    def setUp(self):
        self.tmp = Path(self._make_tmp())
        (self.tmp / ".nexus" / "config").mkdir(parents=True)
        (self.tmp / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  classification: labels\n  project: none\n  epic-label: epic\n",
            encoding="utf-8",
        )
        (self.tmp / ".git").mkdir()
        self.items = self.tmp / "stubs"
        self.items.mkdir()
        (self.items / "STORY-STUB-1.md").write_text(STUB_ONE, encoding="utf-8")
        (self.items / "STORY-STUB-2.md").write_text(STUB_TWO, encoding="utf-8")

    def _make_tmp(self):
        import tempfile

        d = tempfile.mkdtemp()
        self.addCleanup(lambda: __import__("shutil").rmtree(d, ignore_errors=True))
        return d

    def _file(self, gh, extra_args=()):
        argv = ["create_gh_issues.py", str(self.items), "--root", str(self.tmp), *extra_args]
        with mock.patch.object(create_gh_issues.subprocess, "run", gh), \
             mock.patch.object(sys, "argv", argv):
            try:
                create_gh_issues.main()
            except SystemExit as exc:
                return exc.code
        return 0

    def test_each_goal_becomes_an_issue_carrying_the_epic_and_unplanned_labels(self):
        gh = FakeGh(existing_labels={"epic", "backlog"})
        self._file(gh, ["--classification-label", "epic"])

        self.assertEqual(
            sorted(gh.created_titles()),
            ["Hub tooling install", "Workspace status read-out"],
        )
        for title in gh.created_titles():
            labels = gh.labels_of(title)
            self.assertIn("epic", labels)
            self.assertIn("backlog", labels)
            self.assertNotIn("story", labels)

    def test_the_labels_are_upserted_before_any_issue_is_created(self):
        gh = FakeGh(existing_labels={"epic", "backlog"})
        self._file(gh, ["--classification-label", "epic"])

        first_create = next(i for i, c in enumerate(gh.calls) if c[:3] == ["gh", "issue", "create"])
        upserted = {
            c[3] for c in gh.calls[:first_create] if c[:3] == ["gh", "label", "create"]
        }
        self.assertLessEqual({"epic", "backlog"}, upserted)

    def test_a_stub_is_never_linked_as_a_sub_issue(self):
        gh = FakeGh(existing_labels={"epic", "backlog"})
        self._file(gh, ["--classification-label", "epic"])

        graphql = " ".join(" ".join(c) for c in gh.commands("gh", "api", "graphql"))
        self.assertNotIn("addSubIssue", graphql)

    def test_ordering_between_goals_is_wired_as_a_native_dependency(self):
        gh = FakeGh(existing_labels={"epic", "backlog"})
        self._file(gh, ["--classification-label", "epic"])

        posted = [c for c in gh.calls if "--method" in c and "POST" in c
                  and "/dependencies/blocked_by" in " ".join(c)]
        self.assertEqual(len(posted), 1, "the STUB-2 → STUB-1 ordering should be wired once")

    def test_no_project_is_touched_when_the_repository_declares_none(self):
        gh = FakeGh(existing_labels={"epic", "backlog"})
        self._file(gh, ["--classification-label", "epic"])

        graphql = " ".join(" ".join(c) for c in gh.commands("gh", "api", "graphql"))
        self.assertNotIn("addProjectV2ItemById", graphql)
        self.assertNotIn("projectsV2", graphql)

    def test_a_label_that_cannot_be_created_stops_the_run_before_any_issue_exists(self):
        gh = FailingLabelGh(missing_labels={"backlog"}, existing_labels={"epic"})
        code = self._file(gh, ["--classification-label", "epic"])

        self.assertNotEqual(code, 0)
        self.assertEqual(gh.commands("gh", "issue", "create"), [])

    def test_the_default_classification_is_still_the_story_label(self):
        (self.items / "STORY-STUB-2.md").unlink()
        (self.items / "STORY-STUB-1.md").write_text(
            STUB_ONE.replace("labels: [backlog]\n", ""), encoding="utf-8"
        )
        gh = FakeGh(existing_labels={"story"})
        self._file(gh)

        self.assertEqual(gh.labels_of("Workspace status read-out"), ["story"])


class UnplannedLabelResolutionTests(unittest.TestCase):
    """The unplanned-state label resolves through the one shared chain (Invariant 18)."""

    def test_the_built_in_default_is_backlog(self):
        self.assertEqual(resolve_unplanned_label({}), DEFAULT_UNPLANNED_LABEL)
        self.assertEqual(DEFAULT_UNPLANNED_LABEL, "backlog")

    def test_a_declared_value_wins_over_the_built_in(self):
        self.assertEqual(resolve_unplanned_label({"unplannedLabel": "deferred"}), "deferred")

    def test_an_empty_repo_value_falls_through_to_the_hub(self):
        resolved = resolve_unplanned_label({"unplannedLabel": ""}, hub={"unplannedLabel": "icebox"})
        self.assertEqual(resolved, "icebox")

    def test_the_key_resolves_through_the_read_only_cli(self):
        import tempfile

        root = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(root, ignore_errors=True))
        (root / ".nexus" / "config").mkdir(parents=True)
        (root / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  unplanned-label: icebox\n", encoding="utf-8"
        )
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parent / "delivery_config.py"),
             "resolve", "unplanned-label", "--root", str(root)],
            capture_output=True, text=True,
        )
        self.assertEqual(result.stdout.strip(), "icebox")


class LabelExistenceTests(unittest.TestCase):
    """`label_exists` is what turns a failed upsert into a diagnostic instead of a half-filed batch."""

    def test_reports_true_for_a_label_the_repository_already_carries(self):
        gh = FakeGh(existing_labels={"backlog", "epic"})
        self.assertTrue(label_exists("backlog", gh))

    def test_reports_false_for_a_label_the_repository_does_not_carry(self):
        gh = FakeGh(existing_labels={"epic"})
        self.assertFalse(label_exists("backlog", gh))

    def test_reports_none_when_the_query_itself_fails(self):
        def failing(cmd, **kwargs):
            return subprocess.CompletedProcess(cmd, 1, "", "network down")

        self.assertIsNone(label_exists("backlog", failing))


if __name__ == "__main__":
    unittest.main()
