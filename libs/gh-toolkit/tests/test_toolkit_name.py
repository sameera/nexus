#!/usr/bin/env python3
"""The Python capabilities answer to one name (story #297).

These drive the toolkit the way a caller reaches it — as a program named `nexus-gh` on the
path — rather than as a file at a known location, because "reachable by name, from anywhere"
is the whole of what the story adds.

Run from anywhere with:  python3 -m unittest discover -s libs/gh-toolkit/tests
"""

import contextlib
import io
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
_ENTRY_POINT = _TOOLKIT_ROOT / "bin" / TOOLKIT_NAME


def _repo_with_declared_label(label: str) -> Path:
    """A checkout that declares one resolvable github key, and nothing else."""
    root = Path(tempfile.mkdtemp())
    (root / ".nexus" / "config").mkdir(parents=True)
    (root / ".nexus" / "config" / "settings.yml").write_text(
        f"github:\n  unplanned-label: {label}\n", encoding="utf-8"
    )
    return root


class TheNameIsOnThePath(unittest.TestCase):
    """AC1/AC2 — the capabilities run through the name, from any working directory."""

    def setUp(self):
        # An install: the entry point placed on PATH under its own name, exactly as a package
        # manager would place it, and reached with no reference to where the toolkit lives.
        self.bindir = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.bindir, ignore_errors=True))
        link = self.bindir / TOOLKIT_NAME
        link.symlink_to(_ENTRY_POINT)
        self.env = {**os.environ, "PATH": f"{self.bindir}{os.pathsep}{os.environ['PATH']}"}
        self.elsewhere = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.elsewhere, ignore_errors=True))

    def _run(self, *args, cwd=None):
        return subprocess.run(
            [TOOLKIT_NAME, *args], capture_output=True, text=True, env=self.env,
            cwd=str(cwd if cwd is not None else self.elsewhere),
        )

    def test_the_resolver_capability_runs_through_the_name(self):
        root = _repo_with_declared_label("icebox")
        self.addCleanup(lambda: shutil.rmtree(root, ignore_errors=True))
        out = self._run("config", "resolve", "unplanned-label", "--root", str(root))
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "icebox")

    def test_each_capability_is_reachable_by_its_name(self):
        # `--help` is the cheapest invocation that proves a capability's own argument parser ran.
        for capability in CAPABILITIES:
            with self.subTest(capability=capability):
                out = self._run(capability, "--help")
                self.assertEqual(out.returncode, 0, out.stderr)
                self.assertIn("usage:", out.stdout)

    def test_the_working_directory_does_not_change_the_answer(self):
        root = _repo_with_declared_label("deferred")
        self.addCleanup(lambda: shutil.rmtree(root, ignore_errors=True))
        args = ("config", "resolve", "unplanned-label", "--root", str(root))
        from_nowhere = self._run(*args, cwd=self.elsewhere)
        from_the_toolkit = self._run(*args, cwd=_TOOLKIT_ROOT)
        from_a_checkout = self._run(*args, cwd=root)
        self.assertEqual(from_nowhere.stdout, from_the_toolkit.stdout)
        self.assertEqual(from_nowhere.stdout, from_a_checkout.stdout)
        self.assertEqual(from_nowhere.stdout.strip(), "deferred")

    def test_an_unknown_capability_reports_the_available_names_and_fails(self):
        out = self._run("resolve-everything")
        self.assertNotEqual(out.returncode, 0)
        for capability in CAPABILITIES:
            self.assertIn(capability, out.stderr)

    def test_no_capability_reports_the_available_names_and_fails(self):
        out = self._run()
        self.assertNotEqual(out.returncode, 0)
        for capability in CAPABILITIES:
            self.assertIn(capability, out.stderr)


class TheInterpreterIsPython3(unittest.TestCase):
    """AC3 — the toolkit selects `python3`, never a bare `python`."""

    def test_the_entry_point_shebang_names_python3(self):
        first_line = _ENTRY_POINT.read_text(encoding="utf-8").splitlines()[0]
        self.assertEqual(first_line, "#!/usr/bin/env python3")

    def test_the_entry_point_is_executable(self):
        self.assertTrue(os.access(_ENTRY_POINT, os.X_OK))


class TheNameIsOneLiteral(unittest.TestCase):
    """AC5 — one literal string, which #250 and #252 will both name."""

    def test_the_entry_point_file_is_named_for_the_toolkit(self):
        self.assertEqual(TOOLKIT_NAME, "nexus-gh")
        self.assertEqual(_ENTRY_POINT.name, TOOLKIT_NAME)

    def test_the_usage_text_is_rendered_from_the_capability_registry(self):
        from nexus_gh.cli import usage

        text = usage()
        for capability in CAPABILITIES:
            self.assertIn(capability, text)


class TheCapabilityIsToldItsArguments(unittest.TestCase):
    """AC1/AC4 — a capability parses what the dispatcher hands it, not the process's own argv.

    The arguments reach a capability as an ordinary parameter, so the toolkit answers the same way
    however it was entered. Driving `main` in-process with a deliberately wrong `sys.argv` is what
    tells the two apart: reading the global would resolve the wrong key, or fail outright.
    """

    def test_arguments_come_from_the_dispatcher_not_the_process(self):
        from nexus_gh import cli

        root = _repo_with_declared_label("icebox")
        self.addCleanup(lambda: shutil.rmtree(root, ignore_errors=True))
        saved = sys.argv
        sys.argv = ["some-other-program", "resolve", "record-label"]
        try:
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                code = cli.main(["config", "resolve", "unplanned-label", "--root", str(root)])
        finally:
            sys.argv = saved
        self.assertEqual(code, 0)
        self.assertEqual(buffer.getvalue().strip(), "icebox")

    def test_every_capability_reads_the_arguments_it_is_handed(self):
        # `--help` asks a capability to print and stop. A capability reading the process global
        # instead would see the plausible-looking work below and try to do it.
        for capability, (_, entry) in CAPABILITIES.items():
            with self.subTest(capability=capability):
                saved = sys.argv
                sys.argv = [f"{TOOLKIT_NAME} {capability}", "work-it-was-never-asked-to-do"]
                try:
                    buffer = io.StringIO()
                    with contextlib.redirect_stdout(buffer):
                        code = entry(["--help"])
                finally:
                    sys.argv = saved
                self.assertEqual(code, 0)
                self.assertIn("usage:", buffer.getvalue())

    def test_the_process_argv_is_left_as_it_was_found(self):
        from nexus_gh import cli

        saved = sys.argv
        sys.argv = ["some-other-program"]
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                cli.main(["config", "--help"])
        except SystemExit:
            pass
        finally:
            observed = sys.argv
            sys.argv = saved
        self.assertEqual(observed, ["some-other-program"])


class TheUsageTextNamesTheToolkit(unittest.TestCase):
    """AC1 — the one name reaches the user-facing text, not the filename the capability moved from."""

    def setUp(self):
        self.bindir = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.bindir, ignore_errors=True))
        (self.bindir / TOOLKIT_NAME).symlink_to(_ENTRY_POINT)
        self.env = {**os.environ, "PATH": f"{self.bindir}{os.pathsep}{os.environ['PATH']}"}

    def test_each_capability_reports_itself_under_the_toolkit_name(self):
        for capability in CAPABILITIES:
            with self.subTest(capability=capability):
                out = subprocess.run(
                    [TOOLKIT_NAME, capability, "--help"],
                    capture_output=True, text=True, env=self.env, cwd=str(Path(tempfile.gettempdir())),
                )
                self.assertEqual(out.returncode, 0, out.stderr)
                self.assertIn(f"usage: {TOOLKIT_NAME} {capability}", out.stdout)


if __name__ == "__main__":
    unittest.main()
