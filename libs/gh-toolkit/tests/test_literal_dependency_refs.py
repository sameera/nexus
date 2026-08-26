#!/usr/bin/env python3
"""A dependency reference may be a literal issue number (epic #185, STORY #189).

The historical backlog carries edges onto work promoted under the old create-and-close model,
whose issues exist already and are not part of the batch being filed. Those edges can only be
expressed as literals, so the filer resolves a `#<n>` reference straight against the platform
instead of looking it up in the batch map — and fails the reference closed when the issue does
not resolve, rather than dropping an ordering the migration must preserve.

Run from anywhere with:  python3 -m unittest discover -s libs/gh-toolkit/tests
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nexus_gh import create_story as create_gh_issues  # noqa: E402


class FakeGh:
    """A `gh` that answers every call the filer makes, and records what it was asked to wire.

    `unknown_issues` names issue numbers whose REST lookup 404s — a literal reference pointing
    at something that is not there.
    """

    def __init__(self, *, unknown_issues=()):
        self.calls: list[list[str]] = []
        self.unknown_issues = {str(n) for n in unknown_issues}
        self._next_issue = 900

    def __call__(self, cmd, **kwargs):
        self.calls.append(list(cmd))
        if cmd[:2] == ["gh", "api"] and self._looked_up_issue(cmd) in self.unknown_issues:
            return subprocess.CompletedProcess(cmd, 1, "", "gh: Not Found (HTTP 404)")
        return subprocess.CompletedProcess(cmd, 0, self._stdout(cmd), "")

    @staticmethod
    def _looked_up_issue(cmd):
        joined = " ".join(cmd)
        for token in cmd:
            if "/issues/" in token:
                return token.split("/issues/")[1].split("/")[0]
        return joined

    def _stdout(self, cmd):
        if cmd[:3] == ["gh", "issue", "create"]:
            self._next_issue += 1
            return f"https://github.com/acme/widgets/issues/{self._next_issue}\n"
        if cmd[:3] == ["gh", "label", "list"]:
            return "backlog\nepic\n"
        if cmd[:3] == ["gh", "issue", "view"]:
            return "stub body\n" if "body" in cmd else "I_node_id\n"
        if cmd[:2] == ["gh", "api"] and "/dependencies/blocked_by" in " ".join(cmd):
            return ""
        if cmd[:2] == ["gh", "api"] and cmd[-1] == ".id":
            return f"{7000 + len(self.calls)}\n"
        return ""

    # --- what the assertions read -------------------------------------------------
    def wired(self):
        """(dependent issue number, blocker database id) for each dependency POSTed."""
        pairs = []
        for cmd in self.calls:
            joined = " ".join(cmd)
            if "--method" in cmd and "POST" in cmd and "/dependencies/blocked_by" in joined:
                path = next(t for t in cmd if "/dependencies/blocked_by" in t)
                dependent = path.split("/issues/")[1].split("/")[0]
                blocker = next(t for t in cmd if t.startswith("issue_id=")).split("=")[1]
                pairs.append((dependent, blocker))
        return pairs

    def db_id_lookups(self):
        """Issue numbers whose REST database id was fetched."""
        return [
            self._looked_up_issue(cmd)
            for cmd in self.calls
            if cmd[:2] == ["gh", "api"] and cmd[-1] == ".id"
        ]


_IN_BATCH = """---
ref: STUB-1
title: "Cross-repo range recording"
labels: [backlog]
blocked_by: {deps}
---

- **goal:** record one range per touched repo
"""


class LiteralDependencyRefs(unittest.TestCase):
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

    def _write(self, deps: str):
        (self.items / "STORY-STUB-1.md").write_text(_IN_BATCH.format(deps=deps), encoding="utf-8")

    def _file(self, gh):
        argv = ["create_gh_issues.py", str(self.items), "--root", str(self.tmp), "--classification-label", "epic"]
        with mock.patch.object(create_gh_issues.subprocess, "run", gh), \
             mock.patch.object(sys, "argv", argv):
            try:
                create_gh_issues.main()
            except SystemExit as exc:
                return exc.code
        return 0

    def test_an_edge_onto_an_existing_issue_is_wired(self):
        self._write("[#54]")
        gh = FakeGh()

        code = self._file(gh)

        self.assertEqual(code, 0)
        self.assertIn("54", gh.db_id_lookups())
        self.assertEqual(len(gh.wired()), 1, "the edge onto #54 should be wired once")

    def test_an_edge_onto_a_missing_issue_fails_the_reference_closed(self):
        self._write("[#4242]")
        gh = FakeGh(unknown_issues=[4242])

        code = self._file(gh)

        self.assertNotEqual(code, 0, "an unresolvable literal must not pass silently")
        self.assertEqual(gh.wired(), [], "nothing is wired from a reference that did not resolve")

    def test_a_bare_number_is_not_a_literal_reference(self):
        """Only the `#` sigil says 'issue number' — a bare token stays a batch ref."""
        self._write("[54]")
        gh = FakeGh()

        code = self._file(gh)

        self.assertNotEqual(code, 0)
        self.assertNotIn("54", gh.db_id_lookups())
        self.assertEqual(gh.wired(), [])

    def test_a_literal_and_a_batch_ref_mix_in_one_edge_list(self):
        (self.items / "STORY-STUB-0.md").write_text(
            _IN_BATCH.replace("STUB-1", "STUB-0").format(deps="none"), encoding="utf-8"
        )
        self._write("[STUB-0, #54]")
        gh = FakeGh()

        code = self._file(gh)

        self.assertEqual(code, 0)
        self.assertEqual(len(gh.wired()), 2)


if __name__ == "__main__":
    unittest.main()
