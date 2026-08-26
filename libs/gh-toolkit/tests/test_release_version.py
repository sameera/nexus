#!/usr/bin/env python3
"""The Python toolkit reports the release's version, not one of its own (story #305).

One semantic version covers the executable, this toolkit and the component payload, because they
ship as one artifact. So the toolkit carries no version literal: it reads the single declaration
at the release root, found by walking up from its own position.

Run from anywhere with:  python3 -m unittest discover -s libs/gh-toolkit/tests
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nexus_gh.cli import CAPABILITIES, TOOLKIT_NAME  # noqa: E402
from nexus_gh.release import (  # noqa: E402
    RELEASE_VERSION_FILE,
    release_version,
    resolve_release_version,
)

_TOOLKIT_ROOT = Path(__file__).resolve().parent.parent
_REPO_ROOT = _TOOLKIT_ROOT.parent.parent


class OneDeclarationReachedByWalkingUp(unittest.TestCase):
    def test_the_release_root_declares_one_semantic_version(self):
        declared = (_REPO_ROOT / RELEASE_VERSION_FILE).read_text(encoding="utf-8").strip()
        self.assertRegex(declared, r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")

    def test_the_toolkit_reports_that_declaration(self):
        declared = (_REPO_ROOT / RELEASE_VERSION_FILE).read_text(encoding="utf-8").strip()
        self.assertEqual(release_version(), declared)

    def test_resolution_walks_up_from_a_nested_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / RELEASE_VERSION_FILE).write_text("2.3.4\n", encoding="utf-8")
            nested = root / "a" / "b" / "c"
            nested.mkdir(parents=True)
            self.assertEqual(resolve_release_version(nested), "2.3.4")

    def test_an_unresolved_declaration_is_reported_as_unknown_not_guessed(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIsNone(resolve_release_version(Path(tmp)))


class TheToolkitCarriesNoVersionOfItsOwn(unittest.TestCase):
    def test_no_module_declares_a_version_literal(self):
        for source in sorted((_TOOLKIT_ROOT / "nexus_gh").glob("*.py")):
            with self.subTest(source=source.name):
                for line in source.read_text(encoding="utf-8").splitlines():
                    self.assertFalse(line.startswith("__version__"), source.name)


class TheVersionCapability(unittest.TestCase):
    def test_it_is_a_registered_capability(self):
        self.assertIn("version", CAPABILITIES)

    def test_it_prints_exactly_one_json_object_carrying_the_release(self):
        out = subprocess.run(
            [sys.executable, str(_TOOLKIT_ROOT / "bin" / TOOLKIT_NAME), "version"],
            capture_output=True, text=True, cwd=str(_REPO_ROOT))
        self.assertEqual(out.returncode, 0, out.stderr)
        reported = json.loads(out.stdout)
        self.assertEqual(reported["version"], release_version())


if __name__ == "__main__":
    unittest.main()
