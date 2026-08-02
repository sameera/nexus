#!/usr/bin/env python3
"""Promotion populates the stub issue in place (epic #185, STORY #188).

A stub is an epic born unplanned, so promoting it is not a create-and-close hop: the epic body,
the planning meta block and the classification land on the issue that already exists, and the
unplanned label comes off. That is what makes the issue number durable — every dependency edge,
body mention and sequencing line written when the scope was deferred stays valid for the life of
the work (decision-record Invariants 4 and 11).

Legality is a separate question from the operation: `--promote` means "plan this epic", and it is
legal only while the target still carries the unplanned label (Invariants 12 and 13).

Run with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
"""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

_SHARED = Path(__file__).resolve().parent
_EPIC_SCRIPT = _SHARED.parent / "nxs-gh-create-epic" / "scripts" / "nxs_gh_create_epic.py"

#: A `gh` that reports whatever labels FAKE_GH_LABELS names on the target issue, and records every
#: call. `FAKE_GH_MISSING` makes `issue view` fail, standing in for a number that does not resolve.
_FAKE_GH = """#!/usr/bin/env python3
import json, os, sys
argv = sys.argv[1:]
log = os.environ.get("FAKE_GH_LOG")
if log:
    with open(log, "a", encoding="utf-8") as f:
        f.write(" ".join(argv) + "\\n")
if "auth" in argv and "status" in argv:
    sys.exit(0)
if "repo" in argv and "view" in argv:
    print("acme/repo")
    sys.exit(0)
if "issue" in argv and "view" in argv:
    if os.environ.get("FAKE_GH_MISSING"):
        sys.stderr.write("GraphQL: Could not resolve to an Issue\\n")
        sys.exit(1)
    labels = [l for l in os.environ.get("FAKE_GH_LABELS", "").split(",") if l]
    print(json.dumps({"number": 42, "title": "A deferred goal",
                      "labels": [{"name": n} for n in labels]}))
    sys.exit(0)
if "api" in argv and "graphql" in argv:
    print('{"data": {"repository": {"projectsV2": {"nodes": []}}}}')
    sys.exit(0)
if "issue" in argv and "create" in argv:
    print("https://github.com/acme/repo/issues/7")
    sys.exit(0)
sys.exit(0)
"""

_EPIC_MD = """---
feature: "Demo"
epic: "The Promoted Epic"
type: ""
complexity: {complexity}
---

# Epic: The Promoted Epic

## Description

The epic a backlog stub was planned into.
"""


class StubPromotionTests(unittest.TestCase):
    def setUp(self):
        self.repo = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.repo, ignore_errors=True))
        (self.repo / ".nexus" / "config").mkdir(parents=True)
        (self.repo / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  classification: labels\n  project: none\n", encoding="utf-8"
        )
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)

        self.bin = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.bin, ignore_errors=True))
        gh = self.bin / "gh"
        gh.write_text(_FAKE_GH, encoding="utf-8")
        gh.chmod(0o755)
        self.log = self.repo / "gh-calls.log"
        self.epic = self.repo / "epic.md"

    def _promote(self, issue="42", complexity="S", labels="backlog", missing=False):
        self.epic.write_text(_EPIC_MD.format(complexity=complexity), encoding="utf-8")
        env = dict(os.environ)
        env["PATH"] = f"{self.bin}{os.pathsep}{env['PATH']}"
        env["FAKE_GH_LOG"] = str(self.log)
        env["FAKE_GH_LABELS"] = labels
        if missing:
            env["FAKE_GH_MISSING"] = "1"
        out = subprocess.run(
            [sys.executable, str(_EPIC_SCRIPT), str(self.epic), "--promote", issue],
            cwd=self.repo, capture_output=True, text=True, env=env,
        )
        calls = self.log.read_text(encoding="utf-8").splitlines() if self.log.exists() else []
        return out, calls

    def test_promotion_populates_the_existing_issue_and_creates_no_second_one(self):
        out, calls = self._promote()

        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertFalse([c for c in calls if c.startswith("issue create")],
                         f"promotion must never create an issue; calls were {calls}")
        self.assertTrue(any(c.startswith("issue edit 42") and "--body-file" in c for c in calls),
                        calls)
        self.assertTrue(any("--title The Promoted Epic" in c for c in calls), calls)

    def test_promotion_removes_the_unplanned_label(self):
        _, calls = self._promote()

        self.assertTrue(any("--remove-label backlog" in c for c in calls), calls)

    def test_promotion_never_closes_the_stub(self):
        _, calls = self._promote()

        self.assertFalse([c for c in calls if c.startswith("issue close")], calls)

    def test_the_epic_file_is_linked_to_the_issue_that_already_existed(self):
        self._promote()

        self.assertIn('link: "#42"', self.epic.read_text(encoding="utf-8"))

    def test_an_already_planned_epic_is_refused_and_the_flag_is_named(self):
        out, calls = self._promote(labels="epic")

        self.assertNotEqual(out.returncode, 0)
        self.assertIn("--from", out.stdout + out.stderr)
        self.assertFalse([c for c in calls if c.startswith("issue create")], calls)
        self.assertFalse([c for c in calls if c.startswith("issue edit")], calls)

    def test_an_unresolvable_number_is_refused_and_nothing_is_written(self):
        out, calls = self._promote(missing=True)

        self.assertNotEqual(out.returncode, 0)
        self.assertFalse([c for c in calls if c.startswith("issue create")], calls)
        self.assertFalse([c for c in calls if c.startswith("issue edit")], calls)
        self.assertNotIn("link:", self.epic.read_text(encoding="utf-8"))

    def test_the_needs_design_gate_still_runs_on_a_promoted_epic(self):
        _, calls = self._promote(complexity="M")

        self.assertTrue(any("issue edit 42 --add-label needs-design" in c for c in calls), calls)

    def test_a_declared_unplanned_label_is_the_one_removed(self):
        (self.repo / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  classification: labels\n  project: none\n  unplanned-label: icebox\n",
            encoding="utf-8",
        )
        _, calls = self._promote(labels="icebox")

        self.assertTrue(any("--remove-label icebox" in c for c in calls), calls)


if __name__ == "__main__":
    unittest.main()
