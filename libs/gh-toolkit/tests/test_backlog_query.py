#!/usr/bin/env python3
"""The cross-feature backlog query (epic #185, STORY #190).

A stub carries exactly one label, and that label is what makes the whole backlog one query
and its exclusion one negated filter (decision-record Invariant 2). These tests pin the three
forms of that query — the CLI listing, the issue-search fragment a link carries, and the
negation every epic-enumerating query wears — and that all three read the label through the
shared resolver rather than spelling it out (Invariant 18).

Run from anywhere with:  python3 -m unittest discover -s libs/gh-toolkit/tests
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nexus_gh.delivery_config import (  # noqa: E402
    BACKLOG_QUERY_FORMS,
    backlog_query,
    read_delivery_config,
    read_hub_defaults,
)

#: The resolver is driven the way a caller reaches it — by name, through the entry point.
_NEXUS_GH = Path(__file__).resolve().parent.parent / "bin" / "nexus-gh"


def _write_config(settings: str | None = None) -> Path:
    """A throwaway project root, optionally carrying a `.nexus/config/settings.yml`."""
    root = Path(tempfile.mkdtemp())
    cfg = root / ".nexus" / "config"
    cfg.mkdir(parents=True)
    if settings is not None:
        (cfg / "settings.yml").write_text(settings, encoding="utf-8")
    return root


def _query(root: Path, form: str) -> str:
    config = read_delivery_config(root)
    return backlog_query(config, hub=read_hub_defaults(root), form=form)


class BacklogQueryForms(unittest.TestCase):
    """One query returns the whole backlog; one negation removes it."""

    def test_the_listing_is_open_issues_carrying_the_one_label(self):
        root = _write_config()

        self.assertEqual(
            _query(root, "list"),
            "gh issue list --state open --label backlog",
        )

    def test_the_search_fragment_is_open_issues_carrying_the_one_label(self):
        root = _write_config()

        self.assertEqual(_query(root, "search"), "is:issue is:open label:backlog")

    def test_exclusion_costs_exactly_one_negated_label_filter(self):
        root = _write_config()

        exclude = _query(root, "exclude")
        self.assertEqual(exclude, "-label:backlog")
        self.assertEqual(exclude.count("-label:"), 1)

    def test_every_form_is_offered(self):
        self.assertEqual(sorted(BACKLOG_QUERY_FORMS), ["exclude", "list", "search"])

    def test_an_unknown_form_is_refused(self):
        root = _write_config()

        with self.assertRaises(ValueError):
            _query(root, "closed")


class BacklogQueryReadsTheResolvedLabel(unittest.TestCase):
    """The label is resolved, never spelled out — a repo that renames it renames the query."""

    def test_a_declared_label_reaches_all_three_forms(self):
        root = _write_config("github:\n  unplanned-label: deferred\n")

        self.assertIn("--label deferred", _query(root, "list"))
        self.assertIn("label:deferred", _query(root, "search"))
        self.assertEqual(_query(root, "exclude"), "-label:deferred")
        for form in BACKLOG_QUERY_FORMS:
            self.assertNotIn("backlog", _query(root, form))

    def test_a_label_carrying_whitespace_stays_one_filter(self):
        root = _write_config('github:\n  unplanned-label: "not planned"\n')

        self.assertEqual(
            _query(root, "list"),
            'gh issue list --state open --label "not planned"',
        )
        self.assertEqual(_query(root, "search"), 'is:issue is:open label:"not planned"')
        self.assertEqual(_query(root, "exclude"), '-label:"not planned"')


class BacklogQueryRepoTarget(unittest.TestCase):
    """Stubs are epic issues, so the listing targets wherever epics are filed."""

    def test_the_declared_epic_repo_is_targeted(self):
        root = _write_config("github:\n  epic-repo: acme/docs-hub\n")

        self.assertEqual(
            _query(root, "list"),
            "gh issue list --repo acme/docs-hub --state open --label backlog",
        )

    def test_an_undeclared_target_means_the_current_repo(self):
        root = _write_config()

        self.assertNotIn("--repo", _query(root, "list"))

    def test_the_repo_target_never_leaks_into_a_search_fragment(self):
        root = _write_config("github:\n  epic-repo: acme/docs-hub\n")

        self.assertNotIn("acme/docs-hub", _query(root, "search"))
        self.assertNotIn("acme/docs-hub", _query(root, "exclude"))


class BacklogQueryCli(unittest.TestCase):
    """Stage reports print the query by asking for it, the same way they resolve a label."""

    def _run_cli(self, root, *cli_args):
        return subprocess.run(
            [sys.executable, str(_NEXUS_GH), "config", *cli_args, "--root", str(root)],
            capture_output=True,
            text=True,
        )

    def test_the_listing_is_the_default_form(self):
        root = _write_config()

        out = self._run_cli(root, "backlog-query")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "gh issue list --state open --label backlog")

    def test_each_form_is_selectable(self):
        root = _write_config()

        for form, expected in (
            ("search", "is:issue is:open label:backlog"),
            ("exclude", "-label:backlog"),
        ):
            out = self._run_cli(root, "backlog-query", "--form", form)
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertEqual(out.stdout.strip(), expected)

    def test_an_unknown_form_is_a_usage_error(self):
        root = _write_config()

        out = self._run_cli(root, "backlog-query", "--form", "closed")
        self.assertEqual(out.returncode, 2)
        self.assertEqual(out.stdout.strip(), "")


if __name__ == "__main__":
    unittest.main()
