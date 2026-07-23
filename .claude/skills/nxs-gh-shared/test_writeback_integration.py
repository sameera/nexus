#!/usr/bin/env python3
"""End-to-end write-back tests for the creation scripts (epic #121, STORY-121.07).

These drive the real `nxs_gh_create_epic.py` as a subprocess against a fake `gh` on PATH, in a
throwaway git repo whose settings.yml has NO `github:` block — the write-back trigger. They pin the
user-visible outcome the unit tests cannot reach on their own: a first fallback run persists the
decided classification/project into settings.yml (leaving the filed issue untouched), and a second
run reads that block and performs no issue-type probe and no project auto-discovery (AC1/AC2).

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

# A fake `gh` that dispatches on argv, returns canned success, and appends every invocation's argv
# to $FAKE_GH_LOG so a test can assert which subcommands ran (e.g. that no probe re-ran).
_FAKE_GH = """#!/usr/bin/env python3
import os, sys
argv = sys.argv[1:]
log = os.environ.get("FAKE_GH_LOG")
if log:
    with open(log, "a", encoding="utf-8") as f:
        f.write(" ".join(argv) + "\\n")
joined = " ".join(argv)
if "auth" in argv and "status" in argv:
    sys.exit(0)
if "repo" in argv and "view" in argv:
    # nameWithOwner (project discovery / owner resolution)
    print("acme/repo")
    sys.exit(0)
if "api" in argv and "graphql" in argv:
    # Only the project-discovery query reaches here in these scenarios: return no projects.
    print('{"data": {"repository": {"projectsV2": {"nodes": []}}}}')
    sys.exit(0)
if "label" in argv and "create" in argv:
    sys.exit(0)
if "issue" in argv and "create" in argv:
    print("https://github.com/acme/repo/issues/1")
    sys.exit(0)
sys.exit(0)
"""

_EPIC_MD = """---
feature: "Demo"
epic: "Demo Epic"
type: ""
---

# Epic: Demo Epic

## Description

A demo epic used to exercise write-back.
"""


class WriteBackEndToEnd(unittest.TestCase):
    def setUp(self):
        self.repo = Path(tempfile.mkdtemp())
        (self.repo / ".nexus" / "config").mkdir(parents=True)
        # settings.yml with a cross-ref block but NO github block → the write-back trigger.
        (self.repo / ".nexus" / "config" / "settings.yml").write_text(
            "cross-ref:\n  docs-root: https://example/docs\n", encoding="utf-8"
        )
        (self.repo / "epic.md").write_text(_EPIC_MD, encoding="utf-8")
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)

        # Fake gh on a temp bin dir, prepended to PATH.
        self.bin = Path(tempfile.mkdtemp())
        gh = self.bin / "gh"
        gh.write_text(_FAKE_GH, encoding="utf-8")
        gh.chmod(0o755)
        self.log = self.repo / "gh-calls.log"

    def _env(self):
        env = dict(os.environ)
        env["PATH"] = f"{self.bin}{os.pathsep}{env['PATH']}"
        env["FAKE_GH_LOG"] = str(self.log)
        return env

    def _run_epic(self, *extra):
        return subprocess.run(
            [sys.executable, str(_EPIC_SCRIPT), str(self.repo / "epic.md"), *extra],
            cwd=self.repo,
            capture_output=True,
            text=True,
            env=self._env(),
        )

    def _settings(self):
        return (self.repo / ".nexus" / "config" / "settings.yml").read_text(encoding="utf-8")

    def test_fallback_run_seeds_block_and_preserves_cross_ref_and_issue(self):
        out = self._run_epic()
        self.assertEqual(out.returncode, 0, out.stderr)

        text = self._settings()
        # The pre-existing section survives; the decided values are persisted concretely.
        self.assertIn("cross-ref:\n  docs-root: https://example/docs", text)
        self.assertIn("github:", text)
        self.assertIn("classification: labels", text)  # legacy-auto, no type applied → labels
        self.assertIn("project: none", text)  # auto-discovery found nothing → none, never "auto"
        self.assertNotIn("issues-repo", text)  # current repo is never pinned
        # The filed issue's link was still written to the epic (the write left it untouched).
        self.assertIn('link: "#1"', (self.repo / "epic.md").read_text(encoding="utf-8"))

    def test_second_run_reads_block_and_does_not_re_probe(self):
        self.assertEqual(self._run_epic().returncode, 0)
        before = self._settings()

        # Second run: the block now exists. Isolate this run's gh calls.
        self.log.write_text("", encoding="utf-8")
        out = self._run_epic("-y")
        self.assertEqual(out.returncode, 0, out.stderr)

        calls = self.log.read_text(encoding="utf-8")
        # No project auto-discovery and no issue-type probe: project:none and classification:labels
        # are read from the seeded block, so neither GraphQL query runs.
        self.assertNotIn("graphql", calls)
        self.assertNotIn("issueTypes", calls)
        # Add-only: the seeded block is unchanged (declared keys never rewritten).
        self.assertEqual(self._settings(), before)


if __name__ == "__main__":
    unittest.main()
