#!/usr/bin/env python3
"""End-to-end tests for the needs-design gate at epic filing (epic #139, STORY-139.03).

These drive the real `nxs_gh_create_epic.py` as a subprocess against a fake `gh` on PATH, so they
pin the user-visible outcome: an epic whose complexity rollup is M or larger leaves the filing run
carrying the `needs-design` label, an S epic does not, and the label is always created before it is
applied (a repo that has never seen the label must not fail the run half-way).

Run with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

_SHARED = Path(__file__).resolve().parent
_EPIC_SCRIPT = _SHARED.parent / "nxs-gh-create-epic" / "scripts" / "nxs_gh_create_epic.py"

_FAKE_GH = """#!/usr/bin/env python3
import os, sys
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
if "api" in argv and "graphql" in argv:
    print('{"data": {"repository": {"projectsV2": {"nodes": []}}}}')
    sys.exit(0)
if "label" in argv and "create" in argv:
    sys.exit(0)
if "issue" in argv and "create" in argv:
    print("https://github.com/acme/repo/issues/7")
    sys.exit(0)
sys.exit(0)
"""

_EPIC_MD = """---
feature: "Demo"
epic: "Demo Epic"
type: ""
complexity: {complexity}
---

# Epic: Demo Epic

## Description

An epic used to exercise the needs-design gate.
"""


class NeedsDesignLabelAtFiling(unittest.TestCase):
    def setUp(self):
        self.repo = Path(tempfile.mkdtemp())
        (self.repo / ".nexus" / "config").mkdir(parents=True)
        (self.repo / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  classification: labels\n  project: none\n", encoding="utf-8"
        )
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)

        self.bin = Path(tempfile.mkdtemp())
        gh = self.bin / "gh"
        gh.write_text(_FAKE_GH, encoding="utf-8")
        gh.chmod(0o755)
        self.log = self.repo / "gh-calls.log"

    def _file_epic(self, complexity):
        (self.repo / "epic.md").write_text(_EPIC_MD.format(complexity=complexity), encoding="utf-8")
        env = dict(os.environ)
        env["PATH"] = f"{self.bin}{os.pathsep}{env['PATH']}"
        env["FAKE_GH_LOG"] = str(self.log)
        out = subprocess.run(
            [sys.executable, str(_EPIC_SCRIPT), str(self.repo / "epic.md")],
            cwd=self.repo,
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(out.returncode, 0, out.stderr)
        self.stdout = out.stdout
        return self.log.read_text(encoding="utf-8").splitlines()

    def test_m_or_larger_is_filed_with_the_needs_design_label(self):
        for rollup in ("M", "L"):
            self.log.write_text("", encoding="utf-8")
            calls = self._file_epic(rollup)
            self.assertTrue(
                any("issue edit 7 --add-label needs-design" in c for c in calls),
                f"{rollup}: expected the needs-design label to be applied; calls were {calls}",
            )

    def test_small_epic_is_filed_without_the_label(self):
        calls = self._file_epic("S")
        self.assertFalse(any("--add-label needs-design" in c for c in calls), calls)

    def test_an_exempt_epic_is_told_which_rollup_exempted_it(self):
        # S and XS both skip the record. Reporting "S epic" for an XS one tells the lead the wrong
        # reason for a gate that was skipped — they cannot check a decision they were misinformed of.
        for rollup in ("S", "XS"):
            self.log.write_text("", encoding="utf-8")
            self._file_epic(rollup)
            self.assertIn(f"no record needed ({rollup} epic)", self.stdout)

    def test_the_label_is_created_before_it_is_applied(self):
        calls = self._file_epic("L")
        created = next(i for i, c in enumerate(calls) if c.startswith("label create needs-design"))
        applied = next(i for i, c in enumerate(calls) if "--add-label needs-design" in c)
        self.assertLess(created, applied, calls)


if __name__ == "__main__":
    unittest.main()
