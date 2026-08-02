#!/usr/bin/env python3
"""The dry run that precedes an irreversible bulk filing (epic #185, STORY #189).

Migrating the committed backlogs is twenty-four irreversible creations in one run: a wrong body
shape or a wrong classification is twenty-four corrections after the fact, not a revert. The
decision record's mitigation is to render the whole batch first and compare it against a stub
already filed — so the dry run has to survive the classification becoming a caller argument.

Run from anywhere with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "nxs-gh-create-story" / "scripts"))

import create_gh_issues  # noqa: E402

_STUB = """---
ref: "STUB-1"
title: "Retire the member close-and-migrate path"
blocked_by: none
labels: [backlog]
---

Retire the member close-and-migrate path once the hub-born flow is proven.
"""


class RecordingGh:
    def __init__(self):
        self.calls: list[list[str]] = []

    def __call__(self, cmd, **kwargs):
        self.calls.append(list(cmd))
        return subprocess.CompletedProcess(cmd, 0, "", "")

    def created(self):
        return [c for c in self.calls if c[:3] == ["gh", "issue", "create"]]


class MigrationDryRun(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(self.tmp, ignore_errors=True))
        (self.tmp / ".nexus" / "config").mkdir(parents=True)
        (self.tmp / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  classification: labels\n  project: none\n  epic-label: epic\n",
            encoding="utf-8",
        )
        (self.tmp / ".git").mkdir()
        self.items = self.tmp / "stubs"
        self.items.mkdir()
        (self.items / "STORY-STUB-1.md").write_text(_STUB, encoding="utf-8")

    def _dry_run(self, gh, extra_args=()):
        argv = ["create_gh_issues.py", str(self.items), "--dry-run", *extra_args]
        out = []
        with mock.patch.object(create_gh_issues.subprocess, "run", gh), \
             mock.patch.object(sys, "argv", argv), \
             mock.patch("builtins.print", lambda *a, **k: out.append(" ".join(str(x) for x in a))):
            try:
                create_gh_issues.main()
            except SystemExit as exc:
                return exc.code, "\n".join(out)
        return 0, "\n".join(out)

    def test_a_stub_batch_renders_without_creating_anything(self):
        gh = RecordingGh()

        code, report = self._dry_run(gh, ["--classification-label", "epic"])

        self.assertEqual(code, 0, report)
        self.assertEqual(gh.created(), [], "a dry run must create no issue")
        self.assertIn("Retire the member close-and-migrate path", report)

    def test_the_rendered_labels_are_the_ones_that_would_be_applied(self):
        gh = RecordingGh()

        _, report = self._dry_run(gh, ["--classification-label", "epic"])

        self.assertIn("'epic'", report)
        self.assertIn("'backlog'", report)
        self.assertNotIn("'story'", report)

    def test_the_default_classification_still_renders_as_a_story(self):
        gh = RecordingGh()

        _, report = self._dry_run(gh)

        self.assertIn("'story'", report)


if __name__ == "__main__":
    unittest.main()
