#!/usr/bin/env python3
"""A stub never enters an epic's sub-issue set (epic #185, STORY #187).

`/nxs.close` hard-blocks until every sub-issue of the epic is closed, deliberately with no
exemptions by kind. A deferred-scope stub filed as a sub-issue of the epic being closed would
deadlock the very stage that filed it — and under this design that stub outlives the close, since
it is the epic the deferred work will eventually be planned as (decision-record Invariant 6).

So the filer refuses the relationship rather than trusting each writer to omit it, and refuses it
in the preflight, before anything irreversible happens.

Run from anywhere with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
"""

import io
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "nxs-gh-create-story" / "scripts"))

import create_gh_issues  # noqa: E402
from test_backlog_stubs import FakeGh  # noqa: E402

DEFERRED_STUB = """---
ref: STUB-1
title: "Retire the sequencing table"
labels: [backlog]
blocked_by: none
---

- **goal:** decide the fate of the hand-maintained wave ordering
- **estimate:** S
- **source:** deferred from epic Backlog Stubs Become GitHub Issues (#185) (2026-08-01)
"""

PLAIN_STORY = """---
ref: STORY-1
title: "A story that really is a sub-issue"
parent: "#185"
blocked_by: none
---

An ordinary story, which is a sub-issue of its epic.
"""


class StubIsNeverASubIssueTests(unittest.TestCase):
    """The filer refuses a parent on any work-item carrying the unplanned label."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.tmp, ignore_errors=True))
        (self.tmp / ".nexus" / "config").mkdir(parents=True)
        (self.tmp / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  classification: labels\n  project: none\n  epic-label: epic\n",
            encoding="utf-8",
        )
        (self.tmp / ".git").mkdir()
        self.items = self.tmp / "stubs"
        self.items.mkdir()

    def _file(self, gh, extra_args=()):
        """Run the filer against the work-item folder; return (exit code, stderr)."""
        argv = ["create_gh_issues.py", str(self.items), *extra_args]
        err = io.StringIO()
        code = 0
        with mock.patch.object(create_gh_issues.subprocess, "run", gh), \
             mock.patch.object(sys, "argv", argv), redirect_stderr(err):
            try:
                create_gh_issues.main()
            except SystemExit as exc:
                code = exc.code
        return code, err.getvalue()

    def test_a_stub_declaring_a_parent_is_refused_before_anything_is_created(self):
        (self.items / "STORY-STUB-1.md").write_text(
            DEFERRED_STUB.replace("blocked_by: none\n", 'blocked_by: none\nparent: "#185"\n'),
            encoding="utf-8",
        )
        gh = FakeGh(existing_labels={"epic", "backlog"})

        code, _ = self._file(gh, ["--classification-label", "epic"])

        self.assertNotEqual(code, 0)
        self.assertEqual(gh.commands("gh", "issue", "create"), [])

    def test_the_refusal_names_the_work_item_and_the_parent_it_asked_for(self):
        (self.items / "STORY-STUB-1.md").write_text(
            DEFERRED_STUB.replace("blocked_by: none\n", 'blocked_by: none\nparent: "#185"\n'),
            encoding="utf-8",
        )
        gh = FakeGh(existing_labels={"epic", "backlog"})

        _, stderr = self._file(gh, ["--classification-label", "epic"])

        self.assertIn("STORY-STUB-1.md", stderr)
        self.assertIn("#185", stderr)
        self.assertIn("backlog", stderr)

    def test_a_deferred_scope_stub_without_a_parent_files_and_links_nothing(self):
        (self.items / "STORY-STUB-1.md").write_text(DEFERRED_STUB, encoding="utf-8")
        gh = FakeGh(existing_labels={"epic", "backlog"})

        code, _ = self._file(gh, ["--classification-label", "epic"])

        self.assertEqual(code, 0)
        self.assertEqual(gh.created_titles(), ["Retire the sequencing table"])
        graphql = " ".join(" ".join(c) for c in gh.commands("gh", "api", "graphql"))
        self.assertNotIn("addSubIssue", graphql)

    def test_an_ordinary_story_may_still_declare_a_parent(self):
        (self.items / "STORY-1.md").write_text(PLAIN_STORY, encoding="utf-8")
        gh = FakeGh(existing_labels={"story"})

        code, _ = self._file(gh)

        self.assertEqual(code, 0)
        self.assertEqual(gh.created_titles(), ["A story that really is a sub-issue"])
        graphql = " ".join(" ".join(c) for c in gh.commands("gh", "api", "graphql"))
        self.assertIn("addSubIssue", graphql)

    def test_one_offending_stub_stops_the_whole_batch(self):
        (self.items / "STORY-STUB-1.md").write_text(DEFERRED_STUB, encoding="utf-8")
        (self.items / "STORY-STUB-2.md").write_text(
            DEFERRED_STUB.replace("ref: STUB-1", "ref: STUB-2").replace(
                "blocked_by: none\n", 'blocked_by: none\nparent: "#185"\n'
            ),
            encoding="utf-8",
        )
        gh = FakeGh(existing_labels={"epic", "backlog"})

        code, _ = self._file(gh, ["--classification-label", "epic"])

        self.assertNotEqual(code, 0)
        self.assertEqual(gh.commands("gh", "issue", "create"), [])


if __name__ == "__main__":
    unittest.main()
