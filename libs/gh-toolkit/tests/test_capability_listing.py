#!/usr/bin/env python3
"""The toolkit reports its capability names in a machine-readable shape (story #301).

The build gate that checks component invocations must read each toolkit's declared surface from
that surface itself, never from a copy and never by parsing human usage prose (decision record
#325, "The Python toolkit exposes a dedicated machine-readable capability listing"). The human
diagnostic stays exactly as it was; this is a second, separately-shaped answer beside it.

Run from anywhere with:  python3 -m unittest discover -s libs/gh-toolkit/tests
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nexus_gh.cli import CAPABILITIES, TOOLKIT_NAME  # noqa: E402

_ENTRY_POINT = Path(__file__).resolve().parent.parent / "bin" / TOOLKIT_NAME


class TheListingIsMachineReadable(unittest.TestCase):
    def setUp(self):
        self.bindir = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.bindir, ignore_errors=True))
        (self.bindir / TOOLKIT_NAME).symlink_to(_ENTRY_POINT)
        self.env = {**os.environ, "PATH": f"{self.bindir}{os.pathsep}{os.environ['PATH']}"}
        self.elsewhere = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.elsewhere, ignore_errors=True))

    def _run(self, *args):
        return subprocess.run(
            [TOOLKIT_NAME, *args], capture_output=True, text=True, env=self.env,
            cwd=str(self.elsewhere),
        )

    def test_the_listing_prints_exactly_the_declared_capability_names(self):
        out = self._run("--capabilities")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(json.loads(out.stdout), {"capabilities": sorted(CAPABILITIES)})

    def test_the_listing_carries_no_prose(self):
        # Nothing a reader would reword: no summaries, no usage line, no toolkit banner.
        out = self._run("--capabilities")
        self.assertNotIn("usage:", out.stdout)
        for summary, _ in CAPABILITIES.values():
            self.assertNotIn(summary, out.stdout)

    def test_the_listing_does_not_replace_the_human_diagnostic(self):
        # Invoked with no capability the toolkit still reports for a person, on stderr, non-zero.
        out = self._run()
        self.assertNotEqual(out.returncode, 0)
        self.assertIn("usage:", out.stderr)

    def test_the_listing_is_reachable_in_process_as_well(self):
        from nexus_gh.cli import capability_listing

        self.assertEqual(json.loads(capability_listing()), {"capabilities": sorted(CAPABILITIES)})


if __name__ == "__main__":
    unittest.main()
