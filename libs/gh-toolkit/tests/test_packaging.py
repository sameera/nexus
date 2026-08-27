#!/usr/bin/env python3
"""The toolkit finds its own files without the skill-directory layout (story #298).

The modules used to reach each other by walking three levels up and across — a description of
where the skill directories sat, not of how the files relate to one another. These tests pin the
replacement: the toolkit is a package, imports are package-relative, and the whole thing works
from a directory that is neither a Nexus checkout nor a `.claude/skills/` tree.

Run from anywhere with:  python3 -m unittest discover -s libs/gh-toolkit/tests
"""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nexus_gh.cli import CAPABILITIES, TOOLKIT_NAME  # noqa: E402

_TOOLKIT_ROOT = Path(__file__).resolve().parent.parent
_PACKAGE = _TOOLKIT_ROOT / "nexus_gh"

#: The one import hop this story removes, quoted exactly as story #298 names it.
_SKILL_LAYOUT_HOP = 'sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "nxs-gh-shared"))'


class InstalledAwayFromAnyCheckout(unittest.TestCase):
    """AC1 — the capabilities import the shared resolver from wherever the toolkit is installed."""

    def setUp(self):
        # An install with nothing around it: no .git, no .nexus, no .claude, no sibling skills.
        self.install = Path(tempfile.mkdtemp(prefix="nexus-gh-install-"))
        self.addCleanup(lambda: shutil.rmtree(self.install, ignore_errors=True))
        shutil.copytree(_PACKAGE, self.install / "nexus_gh",
                        ignore=shutil.ignore_patterns("__pycache__"))
        (self.install / "bin").mkdir()
        shutil.copy2(_TOOLKIT_ROOT / "bin" / TOOLKIT_NAME, self.install / "bin" / TOOLKIT_NAME)
        self.entry = self.install / "bin" / TOOLKIT_NAME
        self.elsewhere = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.elsewhere, ignore_errors=True))

    def _run(self, *args):
        return subprocess.run([sys.executable, str(self.entry), *args],
                              capture_output=True, text=True, cwd=str(self.elsewhere))

    def test_the_install_directory_is_not_a_checkout_and_carries_no_skill_tree(self):
        for marker in (".git", ".nexus", ".claude"):
            self.assertFalse((self.install / marker).exists())

    def test_every_capability_imports_the_shared_resolver_from_the_install(self):
        for capability in CAPABILITIES:
            with self.subTest(capability=capability):
                out = self._run(capability, "--help")
                self.assertEqual(out.returncode, 0, out.stderr)

    def test_the_resolver_answers_from_the_install(self):
        root = self.elsewhere / "repo"
        (root / ".nexus" / "config").mkdir(parents=True)
        (root / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  unplanned-label: icebox\n", encoding="utf-8")
        out = self._run("config", "resolve", "unplanned-label", "--root", str(root))
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "icebox")


class NoLayoutIsEncodedInTheSources(unittest.TestCase):
    """AC2 — neither occurrence of the skill-directory import hop remains."""

    def test_the_hop_is_absent_from_every_toolkit_source(self):
        for source in sorted(_PACKAGE.glob("*.py")) + [_TOOLKIT_ROOT / "bin" / TOOLKIT_NAME]:
            with self.subTest(source=source.name):
                self.assertNotIn(_SKILL_LAYOUT_HOP, source.read_text(encoding="utf-8"))

    def test_no_toolkit_module_manipulates_the_import_path(self):
        # Only the entry point may, and only to put its own root there; a module that did it
        # would be describing a layout again.
        for source in sorted(_PACKAGE.glob("*.py")):
            with self.subTest(source=source.name):
                self.assertNotIn("sys.path", source.read_text(encoding="utf-8"))

    def test_no_toolkit_module_offers_a_second_entry_point(self):
        # Byte-code suppression lives in the single declared entry point (record #334, invariant
        # 8). A module with its own `__main__` guard is a second door past it, and the first
        # sibling import through that door writes byte-code into whatever repository ran it.
        for source in sorted(_PACKAGE.glob("*.py")):
            with self.subTest(source=source.name):
                self.assertNotIn('__name__ == "__main__"', source.read_text(encoding="utf-8"))

    def test_the_filers_reach_the_resolver_by_package_relative_import(self):
        for name in ("create_epic.py", "create_story.py"):
            with self.subTest(source=name):
                self.assertIn("from .delivery_config import", (_PACKAGE / name).read_text(encoding="utf-8"))


class TheTargetRootFallbackSurvives(unittest.TestCase):
    """AC3 — a capability given no explicit target root still falls back to the working directory."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.root, ignore_errors=True))
        (self.root / ".nexus" / "config").mkdir(parents=True)
        (self.root / ".nexus" / "config" / "settings.yml").write_text(
            "github:\n  unplanned-label: from-the-cwd\n", encoding="utf-8")

    def test_the_resolver_reads_the_invoking_working_directory(self):
        entry = _TOOLKIT_ROOT / "bin" / TOOLKIT_NAME
        out = subprocess.run([sys.executable, str(entry), "config", "resolve", "unplanned-label"],
                             capture_output=True, text=True, cwd=str(self.root))
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "from-the-cwd")


if __name__ == "__main__":
    unittest.main()
