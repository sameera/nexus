#!/usr/bin/env python3
"""Tests for pass 3 of `create_gh_issues.py` — rewriting story refs in issue bodies.

`blocked_by` refs are resolved to issue numbers by pass 2, but a `STORY-<EPIC>.<SEQ>` ref
written into a story's *prose* was never resolved, so it orphaned on the filed issue the
moment the batch ended (issue #171 carries exactly that: "Story `STORY-170.02`"). Pass 3
closes the gap: once every issue number is known, each body's refs are rewritten to
`#<number>` — a permanent, clickable GitHub autolink — so a story keeps exactly one name.

The unit tests pin the substitution itself; the end-to-end test drives the real script as a
subprocess against a fake `gh` on PATH, so it pins what a user actually sees on the issues.

Run with:  python3 -m unittest discover -s .claude/skills/nxs-gh-shared
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

_SHARED = Path(__file__).resolve().parent
_STORY_SCRIPT = _SHARED.parent / "nxs-gh-create-story" / "scripts" / "create_gh_issues.py"

sys.path.insert(0, str(_STORY_SCRIPT.parent))
from create_gh_issues import rewrite_story_refs  # noqa: E402


# A fake `gh` that keeps an issue store on disk, so a body written by `issue create` can be
# read back by `issue view` and overwritten by `issue edit` — the round-trip pass 3 depends on.
_FAKE_GH = """#!/usr/bin/env python3
import json, os, re, sys

argv = sys.argv[1:]
state_path = os.environ["FAKE_GH_STATE"]
log_path = os.environ.get("FAKE_GH_LOG")

with open(state_path, encoding="utf-8") as f:
    state = json.load(f)

if log_path:
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(" ".join(argv) + "\\n")


def save():
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state, f)


def flag(name):
    return argv[argv.index(name) + 1] if name in argv else None


def read_body_file():
    with open(flag("--body-file"), encoding="utf-8") as f:
        return f.read()


if argv[:2] == ["issue", "create"]:
    number = str(state["next"])
    state["next"] += 1
    state["issues"][number] = {"title": flag("--title"), "body": read_body_file()}
    save()
    print(f"https://github.com/acme/repo/issues/{number}")
    sys.exit(0)

if argv[:2] == ["issue", "edit"]:
    number = argv[2]
    if number not in state["issues"]:
        print(f"issue {number} not found", file=sys.stderr)
        sys.exit(1)
    state["issues"][number]["body"] = read_body_file()
    save()
    sys.exit(0)

if argv[:2] == ["issue", "view"]:
    number = argv[2].lstrip("#")
    if number not in state["issues"]:
        print(f"issue {number} not found", file=sys.stderr)
        sys.exit(1)
    if "id" in argv:
        print(f"I_kw{number}")
    elif "body" in argv:
        print(state["issues"][number]["body"])
    sys.exit(0)

if argv[:1] == ["api"]:
    path = next((a for a in argv if a.startswith("repos/")), "")
    match = re.search(r"/issues/(\\d+)", path)
    if "graphql" in argv:
        print("{}")
        sys.exit(0)
    if match and path.endswith("/dependencies/blocked_by"):
        sys.exit(0)          # POST wire, or GET of an empty existing set
    if match:
        print(9000 + int(match.group(1)))   # the REST database id
        sys.exit(0)

sys.exit(0)
"""

_STORY_TEMPLATE = """---
ref: "STORY-170.{seq}"
title: "{title}"
blocked_by: {blocked_by}
labels: [story]
parent: "#900"
---

{body}
"""


class RewriteStoryRefs(unittest.TestCase):
    """The substitution itself: which tokens are refs, and what they become."""

    def test_plain_ref_becomes_an_issue_autolink(self):
        body, unresolved = rewrite_story_refs("Blocked on STORY-170.02 for now.", {"170.02": "173"})
        self.assertEqual(body, "Blocked on #173 for now.")
        self.assertEqual(unresolved, [])

    def test_backticks_are_dropped_so_the_link_resolves(self):
        # A ref inside a code span would render as literal `#173` — GitHub does not autolink
        # inside code spans, so the backticks must not survive the rewrite.
        body, _ = rewrite_story_refs("Story `STORY-170.02`/`STORY-170.03` depend on this.",
                                     {"170.02": "173", "170.03": "174"})
        self.assertEqual(body, "Story #173/#174 depend on this.")

    def test_trailing_punctuation_is_not_swallowed(self):
        body, unresolved = rewrite_story_refs("See STORY-170.02.", {"170.02": "173"})
        self.assertEqual(body, "See #173.")
        self.assertEqual(unresolved, [])

    def test_prefix_case_is_ignored(self):
        body, _ = rewrite_story_refs("see story-170.02", {"170.02": "173"})
        self.assertEqual(body, "see #173")

    def test_an_unknown_ref_is_reported_and_left_alone(self):
        body, unresolved = rewrite_story_refs("STORY-170.02 then STORY-170.99", {"170.02": "173"})
        self.assertEqual(body, "#173 then STORY-170.99")
        self.assertEqual(unresolved, ["STORY-170.99"])

    def test_a_body_without_refs_is_returned_unchanged(self):
        original = "Nothing to see. Version 170.02 is not a ref, nor is #173."
        body, unresolved = rewrite_story_refs(original, {"170.02": "173"})
        self.assertEqual(body, original)
        self.assertEqual(unresolved, [])

    def test_rewriting_an_already_rewritten_body_is_a_no_op(self):
        once, _ = rewrite_story_refs("Blocked on STORY-170.02.", {"170.02": "173"})
        twice, unresolved = rewrite_story_refs(once, {"170.02": "173"})
        self.assertEqual(twice, once)
        self.assertEqual(unresolved, [])


class BodyRefRewriteEndToEnd(unittest.TestCase):
    """What lands on GitHub after a real run of the script."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "CLAUDE.md").write_text("# fake project root\n")
        self.folder = root / "stories"
        self.folder.mkdir()

        self.state_path = root / "gh-state.json"
        self.log_path = root / "gh.log"

        bin_dir = root / "bin"
        bin_dir.mkdir()
        gh = bin_dir / "gh"
        gh.write_text(_FAKE_GH)
        gh.chmod(0o755)

        self.env = {
            **os.environ,
            "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
            "FAKE_GH_STATE": str(self.state_path),
            "FAKE_GH_LOG": str(self.log_path),
        }

    def tearDown(self):
        self.tmp.cleanup()

    def seed(self, epic_body: str = "The epic.") -> None:
        self.state_path.write_text(json.dumps({
            "next": 171,
            "issues": {"900": {"title": "Epic", "body": epic_body}},
        }))

    def write_story(self, seq: str, title: str, body: str, blocked_by: str = "none") -> None:
        (self.folder / f"STORY-170.{seq}.md").write_text(
            _STORY_TEMPLATE.format(seq=seq, title=title, blocked_by=blocked_by, body=body)
        )

    def run_script(self, *extra: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(_STORY_SCRIPT), str(self.folder), "--no-project", *extra],
            capture_output=True, text=True, env=self.env,
        )

    def issues(self) -> dict:
        return json.loads(self.state_path.read_text())["issues"]

    def test_a_prose_ref_lands_as_an_issue_number(self):
        self.seed()
        self.write_story("01", "Foundation", "The base.")
        self.write_story("02", "Dependent", "Extends `STORY-170.01`.", blocked_by="[STORY-170.01]")

        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        issues = self.issues()
        self.assertEqual(issues["171"]["title"], "Foundation")
        self.assertEqual(issues["172"]["body"].strip(), "Extends #171.")
        self.assertNotIn("STORY-", issues["172"]["body"])

    def test_a_forward_ref_to_a_later_story_resolves(self):
        # The whole reason this is a third pass: story 01 names story 02, which has no issue
        # number until pass 1 has finished every file.
        self.seed()
        self.write_story("01", "Foundation", "Completed by STORY-170.02.")
        self.write_story("02", "Dependent", "The rest.")

        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.issues()["171"]["body"].strip(), "Completed by #172.")

    def test_the_epic_body_is_rewritten_too(self):
        # The epic issue is filed before any story exists, so its body has the same exposure.
        self.seed(epic_body="Sequence: STORY-170.01 then STORY-170.02.")
        self.write_story("01", "Foundation", "The base.")
        self.write_story("02", "Dependent", "The rest.")

        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.issues()["900"]["body"].strip(), "Sequence: #171 then #172.")

    def test_an_unresolvable_ref_fails_the_run_closed(self):
        self.seed()
        self.write_story("01", "Foundation", "Depends on STORY-170.99 from another batch.")

        result = self.run_script()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("INCOMPLETE", result.stdout)
        self.assertIn("STORY-170.99", result.stdout)
        # The bad ref is left verbatim for the author to fix at the source.
        self.assertIn("STORY-170.99", self.issues()["171"]["body"])

    def test_a_ref_free_body_is_never_edited(self):
        self.seed()
        self.write_story("01", "Foundation", "No refs here at all.")

        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("issue edit", self.log_path.read_text())

    def test_a_resumed_run_rewrites_nothing_further(self):
        self.seed()
        self.write_story("01", "Foundation", "The base.")
        self.write_story("02", "Dependent", "Extends STORY-170.01.", blocked_by="[STORY-170.01]")

        first = self.run_script("--keep-manifest")
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)

        self.log_path.write_text("")
        second = self.run_script("--keep-manifest")
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertNotIn("issue edit", self.log_path.read_text())
        self.assertEqual(self.issues()["172"]["body"].strip(), "Extends #171.")


if __name__ == "__main__":
    unittest.main()
