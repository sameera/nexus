#!/usr/bin/env python3
"""
Create GitHub issues from STORY-*.md work-item files in a target folder.

Three passes: pass 1 creates one issue per story (frontmatter: ref, title, blocked_by,
labels, parent, project), links it as a sub-issue of the parent epic, and adds it to a
project; pass 2 wires native GitHub `blocked_by` dependencies from the story refs; pass 3
rewrites any `STORY-<EPIC>.<SEQ>` ref left in an issue *body* (story or epic) to the
`#<number>` it now resolves to, so a filed story carries exactly one name.

Robust to partial failure: transient gh errors are retried with backoff, progress is
recorded to a `.nxs-created.json` resume ledger, linking is idempotent, and the run ends
with an actionable SUMMARY. Re-running the same command resumes without duplicating issues.
"""

import argparse
import glob
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# The config resolver and shared gh helpers are defined once, in the shared module beside these
# skills, and imported here — never re-copied (epic #121, decision-record Invariant 2). The path
# is relative to this file so it resolves both in-repo and inside the vendored `.claude/` tree.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "nxs-gh-shared"))
from delivery_config import (  # noqa: E402
    _find_config_root,
    ensure_label,
    ensure_labels,
    label_exists,
    lookup_issue_type_id,
    read_delivery_config,
    read_hub_defaults,
    resolve_classification,
    resolve_project_target,
    resolve_story_label,
    resolve_story_repo,
    resolve_unplanned_label,
    set_issue_type,
    write_github_block,
)


def _run_plain(cmd: list[str]) -> subprocess.CompletedProcess:
    """A non-retrying runner for the shared gh helpers, which expect a call that returns a
    CompletedProcess rather than raising (unlike run_gh). Type/label decoration is best-effort."""
    return subprocess.run(cmd, cwd=TARGET_CWD, capture_output=True, text=True)

# --- Retry / robustness controls -------------------------------------------------
# Tuned from CLI args in main(); module-level so the low-level gh wrappers can read them.
RETRIES: int = 3              # extra attempts after the first try, for transient failures
RETRY_BASE_DELAY: float = 1.0  # seconds; exponential backoff base (delay = base * 2**attempt + jitter)
TARGET_CWD: str | None = None  # resolved target root (Invariant 5); subprocess cwd for every gh call

# Substrings that mark a *transient* gh/GitHub failure worth retrying. Deterministic
# failures (validation 4xx, auth, not-found) are NOT retried — retrying can't fix them.
_TRANSIENT_MARKERS = (
    "http 500", "http 502", "http 503", "http 504",
    "internal server error", "bad gateway", "service unavailable", "gateway timeout",
    "rate limit", "secondary rate", "abuse detection",
    "timeout", "timed out", "connection reset", "connection refused",
    "could not resolve host", "temporary failure", "eof", "tls handshake",
)


class GhError(Exception):
    """A gh command that failed after exhausting retries (or failed deterministically)."""

    def __init__(self, cmd: list[str], returncode: int, stderr: str, attempts: int):
        self.cmd = cmd
        self.returncode = returncode
        self.stderr = (stderr or "").strip()
        self.attempts = attempts
        super().__init__(f"gh failed after {attempts} attempt(s) (exit {returncode}): {self.stderr}")


def _is_transient(stderr: str) -> bool:
    s = (stderr or "").lower()
    return any(marker in s for marker in _TRANSIENT_MARKERS)


def run_gh(cmd: list[str]) -> subprocess.CompletedProcess:
    """Run a gh command, retrying transient failures with exponential backoff + jitter.

    Returns the successful CompletedProcess. Raises GhError once retries are exhausted,
    or immediately on a non-transient (deterministic) failure.
    """
    attempt = 0
    while True:
        result = subprocess.run(cmd, cwd=TARGET_CWD, capture_output=True, text=True)
        if result.returncode == 0:
            return result
        stderr = result.stderr or ""
        if attempt >= RETRIES or not _is_transient(stderr):
            raise GhError(cmd, result.returncode, stderr, attempts=attempt + 1)
        delay = RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, RETRY_BASE_DELAY)
        print(
            f"  Transient gh failure (attempt {attempt + 1}/{RETRIES + 1}), retrying in {delay:.1f}s: "
            f"{stderr.strip()[:140]}",
            file=sys.stderr,
        )
        time.sleep(delay)
        attempt += 1


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown content.
    
    Returns:
        Tuple of (frontmatter dict, body without frontmatter)
    """
    frontmatter = {}
    body = content
    
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            yaml_content = parts[1].strip()
            body = parts[2].strip()
            
            for line in yaml_content.split("\n"):
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip()
                    value = value.strip()
                    
                    # Handle array format [item1, item2, ...]
                    if value.startswith("[") and value.endswith("]"):
                        array_content = value[1:-1]
                        items = [item.strip().strip('"').strip("'") for item in array_content.split(",")]
                        frontmatter[key] = [item for item in items if item]
                    else:
                        frontmatter[key] = value.strip('"').strip("'")
    
    return frontmatter, body


def find_task_files(target_folder: str) -> list[Path]:
    """Find all STORY-*.md work-item files in the target folder."""
    files = glob.glob(os.path.join(target_folder, "STORY-*.md"))
    return sorted([Path(f) for f in files])


def get_project_id_by_name(project_name: str) -> str | None:
    """Get the node ID of a project by its name.
    
    The project_name can be in format:
    - "owner/project-number" (e.g., "my-org/1")
    - "project-number" (uses current repo's owner)
    - "project-title" (searches by title)
    
    Args:
        project_name: The project identifier
        
    Returns:
        The project node ID (e.g., "PVT_kwHOABC123") or None if not found.
    """
    # Parse project name to extract owner and number/title
    if "/" in project_name:
        owner, project_ref = project_name.rsplit("/", 1)
    else:
        # Get owner from current repo
        try:
            result = subprocess.run(
                ["gh", "repo", "view", "--json", "owner", "--jq", ".owner.login"],
                cwd=TARGET_CWD, capture_output=True, text=True, check=True
            )
            owner = result.stdout.strip()
            project_ref = project_name
        except subprocess.CalledProcessError as e:
            print(f"Error getting repo owner: {e.stderr}", file=sys.stderr)
            return None

    # Try to parse as a number for project lookup
    try:
        project_number = int(project_ref)
        return get_project_id_by_number(owner, project_number)
    except ValueError:
        # Not a number, try to find project by title
        return get_project_id_by_title(owner, project_ref)


def get_project_id_by_number(owner: str, project_number: int) -> str | None:
    """Get the node ID of a project by owner and number.
    
    Args:
        owner: The organization or user login
        project_number: The project number
        
    Returns:
        The project node ID or None if not found.
    """
    # Query for project by number (try org first)
    query = """
    query($owner: String!, $number: Int!) {
        organization(login: $owner) {
            projectV2(number: $number) {
                id
                title
            }
        }
    }
    """
    
    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-F", f"number={project_number}"
    ]
    
    try:
        result = subprocess.run(cmd, cwd=TARGET_CWD, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        project = data.get("data", {}).get("organization", {}).get("projectV2")
        if project:
            print(f"Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        pass  # Try user query below
    
    # If org query fails, try user query
    query = """
    query($owner: String!, $number: Int!) {
        user(login: $owner) {
            projectV2(number: $number) {
                id
                title
            }
        }
    }
    """
    
    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-F", f"number={project_number}"
    ]
    
    try:
        result = subprocess.run(cmd, cwd=TARGET_CWD, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        project = data.get("data", {}).get("user", {}).get("projectV2")
        if project:
            print(f"Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(f"Error fetching project by number: {e}", file=sys.stderr)
    
    return None


def get_project_id_by_title(owner: str, title: str) -> str | None:
    """Get the node ID of a project by searching for its title.
    
    Args:
        owner: The organization or user login
        title: The project title to search for
        
    Returns:
        The project node ID or None if not found.
    """
    # Try org first
    query = """
    query($owner: String!, $title: String!) {
        organization(login: $owner) {
            projectsV2(first: 100, query: $title) {
                nodes {
                    id
                    title
                }
            }
        }
    }
    """
    
    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-f", f"title={title}"
    ]
    
    nodes = []
    try:
        result = subprocess.run(cmd, cwd=TARGET_CWD, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        nodes = data.get("data", {}).get("organization", {}).get("projectsV2", {}).get("nodes", [])
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        pass  # Try user query below
    
    # If org query fails or returns no results, try user query
    if not nodes:
        query = """
        query($owner: String!, $title: String!) {
            user(login: $owner) {
                projectsV2(first: 100, query: $title) {
                    nodes {
                        id
                        title
                    }
                }
            }
        }
        """
        
        cmd = [
            "gh", "api", "graphql",
            "-f", f"query={query}",
            "-f", f"owner={owner}",
            "-f", f"title={title}"
        ]
        
        try:
            result = subprocess.run(cmd, cwd=TARGET_CWD, capture_output=True, text=True, check=True)
            data = json.loads(result.stdout)
            nodes = data.get("data", {}).get("user", {}).get("projectsV2", {}).get("nodes", [])
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            print(f"Error searching for project by title: {e}", file=sys.stderr)
            return None
    
    if not nodes:
        return None
    
    # Find exact match first
    for node in nodes:
        if node.get("title", "").lower() == title.lower():
            print(f"Found project: {node.get('title', 'Unknown')}")
            return node.get("id")
    
    # If no exact match, use first result
    project = nodes[0]
    print(f"Found project: {project.get('title', 'Unknown')}")
    return project.get("id")


def get_repo_project_id() -> tuple[str | None, str | None]:
    """Discover the first project associated with the current repository.

    Returns:
        `(project_node_id, "owner/number")` — the node id used to add issues, and a concrete
        `owner/number` reference write-back (STORY-121.07) can persist so a later run reads that
        exact project instead of re-discovering. `(None, None)` when no project is found.
    """
    query = """
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            projectsV2(first: 1) {
                nodes {
                    id
                    number
                    title
                }
            }
        }
    }
    """

    try:
        name_result = subprocess.run(
            ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
            cwd=TARGET_CWD, capture_output=True, text=True, check=True,
        )
        name_with_owner = name_result.stdout.strip()
        if "/" not in name_with_owner:
            print(f"Unexpected repository name format: {name_with_owner}", file=sys.stderr)
            return (None, None)
        owner, repo = name_with_owner.split("/", 1)

        cmd = [
            "gh", "api", "graphql",
            "-f", f"query={query}",
            "-f", f"owner={owner}",
            "-f", f"repo={repo}",
        ]

        result = subprocess.run(cmd, cwd=TARGET_CWD, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        repository = (data.get("data") or {}).get("repository") or {}
        nodes = (repository.get("projectsV2") or {}).get("nodes") or []
        if nodes:
            project = nodes[0]
            print(f"Found project: {project.get('title', 'Unknown')}")
            number = project.get("number")
            ref = f"{owner}/{number}" if number is not None else None
            return (project.get("id"), ref)
        return (None, None)
    except subprocess.CalledProcessError as e:
        print(f"Error fetching repository projects: {e.stderr}", file=sys.stderr)
        return (None, None)
    except json.JSONDecodeError as e:
        print(f"Error parsing project response: {e}", file=sys.stderr)
        return (None, None)


def add_issue_to_project(project_id: str, issue_id: str) -> bool:
    """Add an issue to a project using the GraphQL API.
    
    Args:
        project_id: The project's node ID (e.g., "PVT_kwHOABC123")
        issue_id: The issue's node ID (e.g., "I_kwDOABC123")
        
    Returns:
        True if successful, False otherwise.
    """
    mutation = f"""
    mutation {{
        addProjectV2ItemById(input: {{
            projectId: "{project_id}",
            contentId: "{issue_id}"
        }}) {{
            item {{
                id
            }}
        }}
    }}
    """
    
    cmd = ["gh", "api", "graphql", "-f", f"query={mutation}"]

    try:
        run_gh(cmd)
        return True
    except GhError as e:
        print(f"Error adding issue to project: {e.stderr}", file=sys.stderr)
        return False


# The canonical classification this run applies to everything it creates. main() resolves it from
# the caller's `--classification-label` / `--classification-type`, defaulting to the repo's story
# label and story issue-type — so a caller that says nothing gets today's behavior unchanged.
# Callers filing something that is NOT a story pass their own: `/nxs.epic` files backlog stubs
# through here with the *epic* classification, because a stub is an epic born unplanned (epic #185,
# decision-record Invariant 1). Module-level (mirroring the RETRIES globals) so process_task_file
# reads them without threading extra params.
CLASSIFICATION_LABEL = "story"
CLASSIFICATION = "legacy-auto"
CLASSIFICATION_TYPE_ID: str | None = None


def create_github_issue(title: str, labels: list[str], body_file: str, repo: str | None = None) -> str | None:
    """Create a GitHub issue using gh CLI.

    Args:
        title: Issue title
        labels: List of label names to apply
        body_file: Path to file containing the issue body
        repo: Optional 'owner/repo' to create the issue in (passed as -R). Uses current repo if omitted.

    Returns:
        The issue URL if successful, None otherwise.
    """
    cmd = ["gh", "issue", "create", "--title", title, "--body-file", body_file]

    for label in labels:
        cmd.extend(["--label", label])

    if repo:
        cmd.extend(["-R", repo])

    try:
        result = run_gh(cmd)
        # gh issue create outputs the issue URL on success
        return result.stdout.strip()
    except GhError as e:
        print(f"Error creating issue: {e.stderr}", file=sys.stderr)
        return None


def extract_issue_number(issue_url: str) -> str | None:
    """Extract issue number from GitHub issue URL."""
    match = re.search(r"/issues/(\d+)$", issue_url)
    if match:
        return match.group(1)
    return None


def get_issue_id(issue_ref: str, repo: str | None = None) -> str | None:
    """Get the GitHub GraphQL node ID for an issue.

    Args:
        issue_ref: Issue number, #number format, or full URL
        repo: Optional 'owner/repo' to query (passed as -R flag). Uses current repo if omitted.

    Returns:
        The GraphQL node ID (e.g., "I_kwDOABC123") or None if not found.
    """
    # Extract issue number from various formats
    issue_number = issue_ref
    if issue_ref.startswith("#"):
        issue_number = issue_ref[1:]
    elif "/issues/" in issue_ref:
        match = re.search(r"/issues/(\d+)", issue_ref)
        if match:
            issue_number = match.group(1)

    cmd = ["gh", "issue", "view", issue_number, "--json", "id", "--jq", ".id"]
    if repo:
        cmd = ["gh", "issue", "view", issue_number, "-R", repo, "--json", "id", "--jq", ".id"]

    try:
        result = run_gh(cmd)
        return result.stdout.strip()
    except GhError as e:
        print(f"Error getting issue ID for {issue_ref}: {e.stderr}", file=sys.stderr)
        return None


def assign_parent_issue(child_issue_number: str, parent_issue_ref: str, repo: str | None = None) -> bool:
    """Create a sub-issue relationship using GitHub's GraphQL API.

    This creates an actual parent-child (sub-issue) relationship, not just a comment.

    Args:
        child_issue_number: The child issue number
        parent_issue_ref: The parent issue reference (#number or URL)
        repo: Optional 'owner/repo' passed as -R when resolving issue IDs.
    """
    # Get GraphQL node IDs for both issues
    parent_id = get_issue_id(parent_issue_ref, repo=repo)
    child_id = get_issue_id(child_issue_number, repo=repo)
    
    if not parent_id or not child_id:
        print(f"Error: Could not resolve issue IDs (parent={parent_id}, child={child_id})", file=sys.stderr)
        return False
    
    # GraphQL mutation to add sub-issue relationship
    mutation = f"""
    mutation {{
        addSubIssue(input: {{
            issueId: "{parent_id}",
            subIssueId: "{child_id}"
        }}) {{
            issue {{ title }}
            subIssue {{ title }}
        }}
    }}
    """
    
    cmd = [
        "gh", "api", "graphql",
        "-H", "GraphQL-Features: sub_issues",
        "-f", f"query={mutation}"
    ]

    try:
        run_gh(cmd)
        return True
    except GhError as e:
        # Idempotent on resume: an already-linked sub-issue is success, not failure.
        if "already" in e.stderr.lower():
            return True
        print(f"Error creating sub-issue relationship: {e.stderr}", file=sys.stderr)
        return False


def _issue_api_path(issue_number: str, repo: str | None) -> str:
    """Build the gh-api path for an issue. Uses gh's {owner}/{repo} placeholders for the current repo."""
    base = f"repos/{repo}" if repo else "repos/{owner}/{repo}"
    return f"{base}/issues/{issue_number}"


def get_issue_db_id(issue_number: str, repo: str | None = None) -> str | None:
    """Get an issue's REST database id (the numeric `.id`).

    This is required by the dependencies API and is distinct from the issue number and
    from the GraphQL node id (`gh issue view --json id` returns the node id, not this).
    """
    cmd = ["gh", "api", _issue_api_path(issue_number, repo), "-q", ".id"]
    try:
        result = run_gh(cmd)
        return result.stdout.strip()
    except GhError as e:
        print(f"Error getting database id for #{issue_number}: {e.stderr}", file=sys.stderr)
        return None


def normalize_ref(ref: str) -> str:
    """Normalize a story ref for map lookup: drop the optional `STORY-` prefix, lowercase."""
    return ref.strip().removeprefix("STORY-").removeprefix("story-").strip().lower()


# A dependency reference that names an issue that already exists, rather than one this batch is
# about to create. The `#` sigil is what says "issue number" — a bare `54` is indistinguishable
# from a batch ref, so it is deliberately not matched.
_LITERAL_REF_RE = re.compile(r"^#(\d+)$")


def resolve_literal_ref(dep_ref: str, repo: str | None = None) -> str | None:
    """Resolve a `#<n>` dependency reference to the blocker's REST database id.

    A batch wires its edges from refs because no issue numbers exist yet, but an edge can also
    point *out* of the batch — at work already filed, which a migration of historical dependencies
    can only express as a literal. Such a reference is resolved straight against the platform.
    Returns None when the reference is not a literal or does not resolve, so the caller reports it
    unresolved rather than dropping the ordering.
    """
    match = _LITERAL_REF_RE.match(dep_ref.strip())
    if not match:
        return None
    return get_issue_db_id(match.group(1), repo=repo)


# A story ref as it appears in issue *prose*, with or without the code-span backticks authors
# tend to wrap it in. The ref body must start and end alphanumeric, so a sentence-ending period
# ("see STORY-170.02.") stays outside the match. Only the `STORY-` prefixed form is a ref — a
# bare "170.02" is indistinguishable from a version number and is deliberately not matched.
_BODY_REF_RE = re.compile(
    r"`STORY-(?P<quoted>[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)`"
    r"|\bSTORY-(?P<plain>[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)",
    re.IGNORECASE,
)


def rewrite_story_refs(body: str, ref_to_number: dict[str, str]) -> tuple[str, list[str]]:
    """Replace every `STORY-<EPIC>.<SEQ>` ref in an issue body with its `#<number>`.

    The ref is an authoring key with the lifetime of the filing batch: it lets a story name a
    sibling before `gh issue create` has minted any issue numbers. Left in a filed body it is a
    dead string, since nothing downstream re-derives it. Rewriting it to the issue number turns
    it into a permanent, clickable GitHub autolink and keeps the issue number a story's only name.

    Backticks around a ref are dropped along with it — GitHub does not autolink inside a code
    span, so `#173` would render as literal text rather than a link.

    Args:
        body: The issue body as it currently stands on GitHub.
        ref_to_number: Normalized ref → issue number, spanning every issue known to exist.

    Returns:
        (rewritten body, refs that resolved to nothing). An unresolvable ref is left verbatim
        so the author can fix it at the source file rather than hunt a mangled body.
    """
    unresolved: list[str] = []

    def _replace(match: re.Match) -> str:
        raw = match.group("quoted") or match.group("plain")
        number = ref_to_number.get(normalize_ref(raw))
        if not number:
            unresolved.append(f"STORY-{raw}")
            return match.group(0)
        return f"#{number}"

    return _BODY_REF_RE.sub(_replace, body), unresolved


def get_issue_body(issue_number: str, repo: str | None = None) -> str | None:
    """Read an issue's current body from GitHub.

    Read-back rather than reuse of the local file: on a resumed run the issue may have been
    created hours earlier and edited by a human since, and pushing the local body would silently
    revert those edits. Only the ref tokens are ever changed.
    """
    cmd = ["gh", "issue", "view", str(issue_number).lstrip("#"), "--json", "body", "--jq", ".body"]
    if repo:
        cmd[3:3] = ["-R", repo]
    try:
        return run_gh(cmd).stdout
    except GhError as e:
        print(f"Error reading body of #{issue_number}: {e.stderr}", file=sys.stderr)
        return None


def set_issue_body(issue_number: str, body: str, repo: str | None = None) -> bool:
    """Overwrite an issue's body. Written via --body-file so no shell quoting can corrupt it."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as tmp:
        tmp.write(body)
        tmp_path = tmp.name
    cmd = ["gh", "issue", "edit", str(issue_number).lstrip("#"), "--body-file", tmp_path]
    if repo:
        cmd.extend(["-R", repo])
    try:
        run_gh(cmd)
        return True
    except GhError as e:
        print(f"Error rewriting body of #{issue_number}: {e.stderr}", file=sys.stderr)
        return False
    finally:
        os.unlink(tmp_path)


def get_blocked_by_db_ids(dependent_number: str, repo: str | None = None) -> set[str] | None:
    """Return the set of REST database ids the issue is already blocked_by.

    Used to make dependency wiring idempotent across resumed runs. Returns None if the
    existing set cannot be read (so the caller can fall back to attempting the link).
    """
    path = _issue_api_path(dependent_number, repo) + "/dependencies/blocked_by"
    try:
        result = run_gh(["gh", "api", path, "-q", ".[].id"])
    except GhError as e:
        print(f"Warning: could not read existing blocked_by for #{dependent_number}: {e.stderr}", file=sys.stderr)
        return None
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def add_blocked_by(dependent_number: str, blocker_db_id: str, repo: str | None = None) -> bool:
    """Mark `dependent_number` as blocked_by the issue with REST database id `blocker_db_id`.

    Uses the REST dependencies API (there is no GraphQL mutation for this).
    """
    path = _issue_api_path(dependent_number, repo) + "/dependencies/blocked_by"
    cmd = ["gh", "api", "--method", "POST", path, "-F", f"issue_id={blocker_db_id}"]
    try:
        run_gh(cmd)
        return True
    except GhError as e:
        # Idempotent on resume: an already-recorded dependency is success, not failure.
        if "already" in e.stderr.lower():
            return True
        print(f"Error adding blocked_by for #{dependent_number} (blocker id {blocker_db_id}): {e.stderr}", file=sys.stderr)
        return False


def resolve_project_id(project_attr: str | None, config_project_id: str | None, repo_project_id: str | None) -> str | None:
    """Resolve the project ID to use for an issue.

    Priority: frontmatter project > config.json project > repo auto-discovery.

    Args:
        project_attr: The project attribute from frontmatter (may be None)
        config_project_id: The project ID resolved from config.json (may be None)
        repo_project_id: The fallback repo project ID (may be None)

    Returns:
        The project node ID to use, or None if no project should be used.
    """
    if project_attr:
        # Use explicitly specified project from frontmatter
        project_id = get_project_id_by_name(project_attr)
        if not project_id:
            print(f"  Warning: Project '{project_attr}' not found", file=sys.stderr)
        return project_id
    elif config_project_id:
        # Fall back to config.json project
        return config_project_id
    else:
        # Fall back to repo project
        return repo_project_id


MANIFEST_NAME = ".nxs-created.json"


def manifest_path_for(target_folder: str) -> str:
    """Path to the resume ledger that records ref → created-issue across (re)runs."""
    return os.path.join(target_folder, MANIFEST_NAME)


def load_manifest(path: str) -> dict:
    """Load the resume ledger if present; a corrupt/unreadable ledger is treated as empty."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError) as e:
        print(f"Warning: ignoring unreadable manifest {path}: {e}", file=sys.stderr)
        return {}


def save_manifest(path: str, manifest: dict) -> None:
    """Persist the resume ledger atomically so a crash mid-run cannot corrupt it."""
    tmp = f"{path}.tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, sort_keys=True)
        os.replace(tmp, path)
    except OSError as e:
        print(f"Warning: could not persist manifest {path}: {e}", file=sys.stderr)


def process_task_file(
    task_file: Path,
    config_project_id: str | None = None,
    repo_project_id: str | None = None,
    skip_project: bool = False,
    issues_repo: str | None = None,
    manifest: dict | None = None,
    manifest_path: str | None = None,
) -> dict | None:
    """Process a single STORY file and create a GitHub issue.

    Args:
        task_file: Path to the STORY-???.md file
        config_project_id: Project node ID from config.json (used if frontmatter has no project)
        repo_project_id: Fallback project node ID from repository auto-discovery
        skip_project: If True, skip adding to any project
        issues_repo: Optional 'owner/repo' to create the issue in (from github.issues-repo config).
        manifest: Resume ledger (ref → {number, db_id, url, title}). If a ref is already present,
            creation is skipped and the existing issue is reused (idempotent re-run).
        manifest_path: Where to persist the ledger after each successful create.

    Returns:
        A record dict {ref, number, db_id, blocked_by, reused} on success, or None on failure.
        The record feeds the second dependency-wiring pass in main().
    """
    print(f"Processing: {task_file}")

    content = task_file.read_text()
    frontmatter, body = parse_frontmatter(content)

    title = frontmatter.get("title", "")
    labels = frontmatter.get("labels", [])
    parent = frontmatter.get("parent", "")
    project_attr = frontmatter.get("project", "")

    # Story ref (internal authoring key) — explicit `ref:` or derived from the filename.
    # Not surfaced on the issue; used only to resolve the blocked_by graph in pass 2.
    ref = normalize_ref(frontmatter.get("ref", "") or task_file.stem)

    # blocked_by: a list of story refs, or the string "none"/absent.
    blocked_by_raw = frontmatter.get("blocked_by", [])
    if isinstance(blocked_by_raw, str):
        blocked_by_raw = [] if blocked_by_raw.strip().lower() in ("", "none") else [blocked_by_raw]
    blocked_by = [normalize_ref(r) for r in blocked_by_raw if normalize_ref(r) not in ("", "none")]

    # Resume: if this ref was already created in a prior run, reuse it — never create a duplicate.
    if manifest is not None and ref in manifest:
        entry = manifest[ref]
        number = entry.get("number")
        db_id = entry.get("db_id")
        if not db_id and number:  # backfill an older manifest missing the db id
            db_id = get_issue_db_id(number, repo=issues_repo)
            if db_id:
                entry["db_id"] = db_id
                if manifest_path:
                    save_manifest(manifest_path, manifest)
        print(f"  Resuming: ref '{ref}' already created as #{number} — skipping creation")
        return {"ref": ref, "number": number, "db_id": db_id, "blocked_by": blocked_by,
                "parent": parent, "reused": True}

    # Ensure labels is a list
    if isinstance(labels, str):
        labels = [labels] if labels else []

    # Apply the caller's canonical classification label, unless the repo is in `types` mode (then
    # the issue-type classifies it instead; STORY-121.02). The per-item `labels:` frontmatter rides
    # alongside it — that is where a stub's unplanned-state label comes from (epic #185).
    if CLASSIFICATION != "types" and CLASSIFICATION_LABEL not in labels:
        labels = [CLASSIFICATION_LABEL, *labels]

    if not title:
        print(f"  Warning: No title in frontmatter, using filename", file=sys.stderr)
        title = task_file.stem

    # Create temporary file with body content (without frontmatter)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as tmp:
        tmp.write(body)
        tmp_path = tmp.name

    try:
        # Create the GitHub issue
        issue_url = create_github_issue(title, labels, tmp_path, repo=issues_repo)

        if not issue_url:
            print(f"  Failed to create issue for {task_file}", file=sys.stderr)
            return None

        print(f"  Created issue: {issue_url}")

        issue_number = extract_issue_number(issue_url)

        # Resolve the REST database id now — pass 2 needs it to wire dependencies.
        db_id = get_issue_db_id(issue_number, repo=issues_repo) if issue_number else None

        # Persist to the ledger IMMEDIATELY: the issue now exists on GitHub, so a later
        # crash must not cause a duplicate on re-run. Linking (below) is best-effort.
        if manifest is not None and issue_number:
            manifest[ref] = {"number": issue_number, "db_id": db_id, "url": issue_url, "title": title}
            if manifest_path:
                save_manifest(manifest_path, manifest)

        # In `types` mode, classify the issue by its GitHub issue-type (STORY-121.02).
        # Best-effort decoration: the issue already exists, so a failure only warns.
        if CLASSIFICATION == "types" and CLASSIFICATION_TYPE_ID and issue_number:
            type_issue_id = get_issue_id(issue_number, repo=issues_repo)
            if type_issue_id and set_issue_type(type_issue_id, CLASSIFICATION_TYPE_ID, _run_plain):
                print(f"  Issue type set")
            else:
                print(f"  Warning: could not set issue type on #{issue_number}", file=sys.stderr)

        # Add to project unless skipped
        if not skip_project and issue_number:
            project_id = resolve_project_id(project_attr if project_attr else None, config_project_id, repo_project_id)
            if project_id:
                issue_id = get_issue_id(issue_number, repo=issues_repo)
                if issue_id:
                    if add_issue_to_project(project_id, issue_id):
                        print(f"  Added to project")
                    else:
                        print(f"  Warning: Failed to add issue to project", file=sys.stderr)

        # If there's a parent, assign it
        if parent and issue_number:
            if assign_parent_issue(issue_number, parent, repo=issues_repo):
                print(f"  Linked as sub-issue of: {parent}")
            else:
                print(f"  Warning: Failed to create sub-issue relationship", file=sys.stderr)

        return {"ref": ref, "number": issue_number, "db_id": db_id, "blocked_by": blocked_by,
                "parent": parent, "reused": False}

    finally:
        # Clean up temporary file
        os.unlink(tmp_path)


def print_final_report(
    *,
    total: int,
    created_new: list[dict],
    reused: list[dict],
    create_failed: list[str],
    dep_wired: int,
    dep_present: int,
    dep_unresolved: list[tuple[str, str]],
    dep_failed: list[tuple[str, str]],
    body_rewritten: int,
    body_unresolved: list[tuple[str, str]],
    body_failed: list[str],
    manifest_path: str,
    target_folder: str,
    extra_args: list[str],
) -> bool:
    """Render the end-of-run summary. Returns True if the run is fully complete."""
    incomplete = bool(create_failed or dep_unresolved or dep_failed or body_unresolved or body_failed)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Issues:       {len(created_new)} created, {len(reused)} reused, "
          f"{len(create_failed)} FAILED  (of {total})")
    print(f"Dependencies: {dep_wired} wired, {dep_present} already present, "
          f"{len(dep_unresolved)} unresolved, {len(dep_failed)} FAILED")
    print(f"Body refs:    {body_rewritten} bod(ies) rewritten, "
          f"{len(body_unresolved)} unresolved, {len(body_failed)} FAILED")

    if not incomplete:
        print("\n✅ Complete — every story issue created, every dependency wired, "
              "every body ref resolved.")
        print("=" * 60)
        return True

    rerun = "python <this-script> " + " ".join([f'"{target_folder}"', *extra_args]).strip()

    print("\n⚠️  INCOMPLETE — action required")

    if create_failed:
        print(f"\n  Failed to create ({len(create_failed)}) — see errors above for the cause:")
        for name in create_failed:
            print(f"    - {name}")

    if dep_unresolved:
        print(f"\n  Unresolved blocked_by ({len(dep_unresolved)}) — blocker not created yet:")
        for dependent, dep_ref in dep_unresolved:
            print(f"    - #{dependent} blocked_by '{dep_ref}'")

    if dep_failed:
        print(f"\n  Failed dependency links after retries ({len(dep_failed)}):")
        for dependent, dep_ref in dep_failed:
            print(f"    - #{dependent} blocked_by '{dep_ref}'")

    if body_unresolved:
        print(f"\n  Unresolved body refs ({len(body_unresolved)}) — named story not in this batch;")
        print("  fix the ref in the source STORY-*.md (or replace it with the issue number), then re-run:")
        for number, bad_ref in body_unresolved:
            print(f"    - #{number} references '{bad_ref}'")

    if body_failed:
        print(f"\n  Failed body rewrites after retries ({len(body_failed)}):")
        for number in body_failed:
            print(f"    - #{number}")

    print(f"\n  Progress saved to: {manifest_path}")
    print("  Re-run the SAME command to resume — already-created issues are skipped and")
    print("  dependencies are re-checked (both idempotent). Nothing will be duplicated:")
    print(f"    {rerun}")
    print("=" * 60)
    return False


def main():
    parser = argparse.ArgumentParser(
        description="Create GitHub issues from STORY-*.md work-item files"
    )
    parser.add_argument(
        "target_folder",
        help="Folder containing STORY-*.md files"
    )
    parser.add_argument(
        "--root",
        default=None,
        help="Target repo root to file the stories into (default: the current working directory). "
             "Outranks the target folder's own location — the folder must resolve inside this root."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without creating issues"
    )
    parser.add_argument(
        "--no-project",
        action="store_true",
        help="Skip adding issues to any project"
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="Retries for transient gh/GitHub failures (per call). Default: 3."
    )
    parser.add_argument(
        "--retry-base-delay",
        type=float,
        default=1.0,
        help="Base seconds for exponential backoff between retries. Default: 1.0."
    )
    parser.add_argument(
        "--keep-manifest",
        action="store_true",
        help="Keep the resume ledger even after a fully successful run (default: delete it)."
    )
    parser.add_argument(
        "--classification-label",
        default=None,
        help="Canonical label applied to every issue this run creates (labels / legacy-auto mode). "
             "Defaults to the resolved github.story-label. Pass the epic label to file backlog stubs."
    )
    parser.add_argument(
        "--classification-type",
        default=None,
        help="Canonical GitHub issue-type applied in `types` mode. Defaults to github.story-type."
    )

    args = parser.parse_args()

    global RETRIES, RETRY_BASE_DELAY
    RETRIES = max(0, args.retries)
    RETRY_BASE_DELAY = max(0.0, args.retry_base_delay)

    target_folder = os.path.abspath(args.target_folder)

    if not os.path.isdir(target_folder):
        print(f"Error: {target_folder} is not a directory", file=sys.stderr)
        sys.exit(1)

    task_files = find_task_files(target_folder)

    if not task_files:
        print(f"No STORY-*.md files found in {target_folder}")
        sys.exit(0)

    print(f"Found {len(task_files)} story file(s)")

    # The target root is operator-supplied (default: cwd), never derived from the target folder's
    # own location (decision record #283) — an artifact resolving outside the root is rejected
    # rather than silently re-rooting the run around it, since this root selects the publishing
    # configuration that decides which upstream repository receives the issues.
    root_arg = Path(args.root).resolve() if args.root else Path.cwd()
    project_root = _find_config_root(root_arg)
    resolved_target_folder = Path(target_folder).resolve()
    if project_root != resolved_target_folder and project_root not in resolved_target_folder.parents:
        print(f"Error: {resolved_target_folder} resolves outside the target root {project_root}; pass --root to point at the correct repo.", file=sys.stderr)
        sys.exit(1)

    global TARGET_CWD
    TARGET_CWD = str(project_root)

    # Read config once; every resolution goes through the one shared resolver, so this script,
    # the epic script, /nxs.epic, and /nxs.close cannot disagree on any key (STORY-121.04).
    global CLASSIFICATION_LABEL, CLASSIFICATION, CLASSIFICATION_TYPE_ID
    config = read_delivery_config(project_root)
    # Workspace hub defaults are the `hub` layer of the precedence chain (STORY-121.05): a member
    # inherits each key it does not declare. `merged` is repo-over-hub for the single-dict
    # resolvers; the chain-based resolvers take `hub=` directly. Empty {} in single-repo mode.
    hub = read_hub_defaults(project_root)
    merged = {**hub, **{k: v for k, v in config.items() if v not in (None, "")}}

    # Story issues are filed into the story-repo (specific), falling back to issues-repo, then the
    # hub default (STORY-121.05). If set, all gh issue commands target that repo.
    issues_repo: str | None = resolve_story_repo(config, hub=hub) or None
    if issues_repo:
        print(f"Story repo (from config): {issues_repo}")

    # Resolve the classification mode once (STORY-121.02), then the canonical label/type this run
    # applies. The caller's `--classification-*` wins; absent it the resolved story values are used,
    # so today's behavior is unchanged for every existing call site (epic #185).
    CLASSIFICATION = resolve_classification(merged)
    CLASSIFICATION_LABEL = args.classification_label or resolve_story_label(merged)
    classification_type = args.classification_type or merged.get("storyType")

    # A stub is never a sub-issue of anything (decision-record Invariant 6). `/nxs.close` hard-blocks
    # until every sub-issue of the epic is closed, with no exemptions by kind — so a deferred-scope
    # stub filed beneath the epic being closed would deadlock the stage that filed it, and outlive
    # that close by design. The filer refuses the relationship here rather than trusting each writer
    # to omit it, and refuses it before anything irreversible happens.
    unplanned_label = resolve_unplanned_label(config, hub=hub)
    parented_stubs: list[tuple[str, str]] = []
    for task_file in task_files:
        fm, _ = parse_frontmatter(task_file.read_text())
        declared = fm.get("labels", [])
        if isinstance(declared, str):
            declared = [declared] if declared else []
        parent_ref = str(fm.get("parent", "") or "").strip()
        if parent_ref and unplanned_label in declared:
            parented_stubs.append((task_file.name, parent_ref))
    if parented_stubs:
        for name, parent_ref in parented_stubs:
            print(
                f"Error: {name} carries the '{unplanned_label}' label and asks to be a sub-issue "
                f"of {parent_ref}. A backlog stub is never a sub-issue — its link to the epic that "
                f"spawned it is a body mention. Remove the `parent:` key and re-run.",
                file=sys.stderr,
            )
        print("Nothing was created.", file=sys.stderr)
        sys.exit(1)

    if not args.dry_run:
        if CLASSIFICATION == "types":
            # Typed repo: resolve the issue-type id once (applied per issue after creation);
            # no canonical label is forced, parallel to the epic path.
            if classification_type:
                CLASSIFICATION_TYPE_ID = lookup_issue_type_id(classification_type, _run_plain, repo=issues_repo)
                if CLASSIFICATION_TYPE_ID:
                    print(f"Classification: types — issue-type '{classification_type}'")
                else:
                    print(f"Warning: classification: types but type '{classification_type}' not found — issues filed untyped", file=sys.stderr)
            else:
                print("Warning: classification: types but no issue-type configured — issues filed untyped", file=sys.stderr)

        # Every label that will be applied — the canonical one plus each label declared in a
        # work-item's frontmatter — is upserted BEFORE any issue is created, so filing never fails
        # on a label the repository has never seen (decision-record Invariant 3). A stub's
        # unplanned-state label reaches GitHub through exactly this path.
        wanted_labels: list[str] = []
        if CLASSIFICATION != "types":
            wanted_labels.append(CLASSIFICATION_LABEL)
        for task_file in task_files:
            fm, _ = parse_frontmatter(task_file.read_text())
            declared = fm.get("labels", [])
            if isinstance(declared, str):
                declared = [declared] if declared else []
            wanted_labels.extend(declared)

        # The story label keeps the colour it has always been created with; everything else — a
        # stub's unplanned marker included — takes ensure_label's default grey.
        label_styles = {
            resolve_story_label(merged): ("BFD4F2", "User story (created by nxs-gh-create-story)"),
        }
        missing = ensure_labels(wanted_labels, _run_plain, repo=issues_repo, styles=label_styles)
        if missing:
            # A label that is neither creatable nor present is a permission gap, and it is reported
            # BEFORE any creation — half a filed batch is far worse than a run that did nothing
            # (Invariant 19). Grant the token label scope, or create the label by hand, then re-run.
            print(
                "Error: cannot apply label(s) " + ", ".join(f"'{name}'" for name in missing)
                + " — they do not exist in the target repository and could not be created "
                  "(the token likely lacks label scope). Nothing was created; create the label(s) "
                  "or grant the scope, then re-run.",
                file=sys.stderr,
            )
            sys.exit(1)

    # Resolve the Project V2 target (STORY-121.03) once for all stories. A per-story frontmatter
    # `project` still overrides this (resolve_project_id); the declared target decides the fallback:
    #   none     → no config lookup, no repo auto-discovery, no warning (the personal-repo case)
    #   explicit → look up exactly that project; no repo auto-discovery fallback
    #   auto     → today's repo auto-discovery (the built-in default when the key is absent)
    project_mode, project_target = resolve_project_target(merged)
    config_project_id = None
    repo_project_id = None
    # Write-back (STORY-121.07) state: only the auto-discovery path yields a concrete project value
    # to persist ("owner/number" when found, else "none").
    ran_auto_discovery = False
    discovered_project_ref: str | None = None
    if not args.no_project and not args.dry_run:
        if project_mode == "explicit":
            print(f"Looking up project from config: {project_target}")
            config_project_id = get_project_id_by_name(project_target)
            if not config_project_id:
                print(f"Warning: Project '{project_target}' from config not found", file=sys.stderr)
        elif project_mode == "auto":
            print("Looking for repository project (fallback)...")
            ran_auto_discovery = True
            repo_project_id, discovered_project_ref = get_repo_project_id()
            if not repo_project_id:
                print("No repository project found (will use frontmatter project if available)")
        # project_mode == "none": deliberate absence — no config lookup, no auto-discovery, no warning.

    if args.dry_run:
        print("\nDry run - would process:")
        for f in task_files:
            content = f.read_text()
            fm, _ = parse_frontmatter(content)
            labels = fm.get("labels", [])
            if isinstance(labels, str):
                labels = [labels] if labels else []
            # The canonical classification is the caller's (STORY #186), so the preview has to
            # read the same name pass 1 applies — a dry run that renders `story` on a stub batch
            # is not the rehearsal an irreversible bulk filing needs.
            if CLASSIFICATION != "types" and CLASSIFICATION_LABEL not in labels:
                labels = [CLASSIFICATION_LABEL, *labels]
            project = fm.get("project", "(auto)")
            ref = fm.get("ref", f.stem)
            blocked_by = fm.get("blocked_by", "none")
            print(f"  {f.name}: ref='{ref}', title='{fm.get('title', 'N/A')}', labels={labels}, parent='{fm.get('parent', 'N/A')}', project='{project}', blocked_by={blocked_by}")
        sys.exit(0)

    # Resume ledger: records ref → created issue, so a re-run after a partial failure
    # completes the remainder without ever creating a duplicate.
    manifest_path = manifest_path_for(target_folder)
    manifest = load_manifest(manifest_path)
    if manifest:
        print(f"Resuming from manifest ({len(manifest)} issue(s) already created): {manifest_path}")

    # Pass 1: create (or reuse) every issue, collecting a record per success.
    created: list[dict] = []
    create_failed: list[str] = []
    for task_file in task_files:
        record = process_task_file(
            task_file, config_project_id, repo_project_id,
            skip_project=args.no_project, issues_repo=issues_repo,
            manifest=manifest, manifest_path=manifest_path,
        )
        if record:
            created.append(record)
        else:
            create_failed.append(task_file.name)

    created_new = [r for r in created if not r.get("reused")]
    reused = [r for r in created if r.get("reused")]
    print(f"\nPass 1: {len(created_new)} created, {len(reused)} reused, {len(create_failed)} failed "
          f"(of {len(task_files)})")

    # Pass 2: wire blocked_by dependencies. The map spans every issue known to exist
    # (this run + prior runs via the manifest), so cross-run resume resolves blockers too.
    ref_to_db_id = {r["ref"]: r["db_id"] for r in created if r.get("db_id")}
    for ref, entry in manifest.items():
        if entry.get("db_id"):
            ref_to_db_id.setdefault(ref, entry["db_id"])

    dep_wired = 0
    dep_present = 0
    dep_unresolved: list[tuple[str, str]] = []
    dep_failed: list[tuple[str, str]] = []
    for record in created:
        number = record["number"]
        existing = get_blocked_by_db_ids(number, repo=issues_repo) if record["blocked_by"] else set()
        for dep_ref in record["blocked_by"]:
            blocker_db_id = ref_to_db_id.get(dep_ref) or resolve_literal_ref(dep_ref, repo=issues_repo)
            if not blocker_db_id:
                print(f"  Unresolved: blocked_by ref '{dep_ref}' for #{number} not among created issues",
                      file=sys.stderr)
                dep_unresolved.append((number, dep_ref))
                continue
            ref_to_db_id.setdefault(dep_ref, blocker_db_id)
            if existing is not None and str(blocker_db_id) in existing:
                dep_present += 1
                continue
            if add_blocked_by(number, blocker_db_id, repo=issues_repo):
                print(f"  #{number} blocked_by ref '{dep_ref}'")
                dep_wired += 1
            else:
                dep_failed.append((number, dep_ref))

    # Pass 3: rewrite story refs left in issue bodies to the issue numbers they now resolve to.
    # It has to be its own pass, after pass 1 has minted every number: a story may name a sibling
    # that is created later in the batch, so no number exists for it at creation time.
    ref_to_number = {r["ref"]: r["number"] for r in created if r.get("number")}
    for ref, entry in manifest.items():
        if entry.get("number"):
            ref_to_number.setdefault(ref, entry["number"])

    # The epic is filed before any story exists, so its body carries the same exposure. Every
    # story in a batch shares one parent; take the first that declares it.
    body_targets = [r["number"] for r in created if r.get("number")]
    epic_ref = next((r.get("parent") for r in created if r.get("parent")), None)
    epic_number = re.sub(r"^.*?(\d+)$", r"\1", epic_ref.strip()) if epic_ref else None
    if epic_number and epic_number.isdigit() and epic_number not in body_targets:
        body_targets.append(epic_number)

    body_rewritten = 0
    body_unresolved: list[tuple[str, str]] = []
    body_failed: list[str] = []
    for number in body_targets:
        body = get_issue_body(number, repo=issues_repo)
        if body is None:
            body_failed.append(number)
            continue
        new_body, unresolved = rewrite_story_refs(body, ref_to_number)
        for bad_ref in unresolved:
            print(f"  Unresolved: body ref '{bad_ref}' in #{number} not among created issues",
                  file=sys.stderr)
            body_unresolved.append((number, bad_ref))
        # No refs left to resolve means no write — this is what makes a re-run a no-op, since a
        # rewritten body no longer contains the tokens that would trigger another edit.
        if new_body == body:
            continue
        if set_issue_body(number, new_body, repo=issues_repo):
            print(f"  #{number} body refs rewritten to issue numbers")
            body_rewritten += 1
        else:
            body_failed.append(number)

    print(f"\nPass 3: {body_rewritten} bod(ies) rewritten, {len(body_unresolved)} unresolved ref(s), "
          f"{len(body_failed)} failed")

    # Write-back (STORY-121.07): persist the decisions this run reached once, so a repo with no
    # github block never re-probes. Add-only — declared keys (incl. explicit auto/none) are never
    # overwritten (Invariant 5); story-repo/issues-repo is not written here (an absent target means
    # "the current repo" and is never pinned; a hub-inherited value stays inherited — Invariant 6).
    decided = {"classification": "types" if CLASSIFICATION == "types" else "labels"}
    if ran_auto_discovery:
        decided["project"] = discovered_project_ref or "none"
    seeded = write_github_block(project_root, decided)
    if seeded["added"]:
        print(
            f"\n🌱 Seeded github config ({', '.join(seeded['added'])}) into "
            ".nexus/config/settings.yml — review and commit"
        )

    # Reconstruct the flags to echo in the resume hint (target_folder is added by the reporter).
    extra_args: list[str] = []
    if args.no_project:
        extra_args.append("--no-project")
    if args.retries != 3:
        extra_args.append(f"--retries {args.retries}")

    complete = print_final_report(
        total=len(task_files),
        created_new=created_new,
        reused=reused,
        create_failed=create_failed,
        dep_wired=dep_wired,
        dep_present=dep_present,
        dep_unresolved=dep_unresolved,
        dep_failed=dep_failed,
        body_rewritten=body_rewritten,
        body_unresolved=body_unresolved,
        body_failed=body_failed,
        manifest_path=manifest_path,
        target_folder=target_folder,
        extra_args=extra_args,
    )

    if complete:
        # Clean run: drop the ledger unless the caller asked to keep it.
        if not args.keep_manifest and os.path.exists(manifest_path):
            try:
                os.remove(manifest_path)
            except OSError as e:
                print(f"Warning: could not remove manifest {manifest_path}: {e}", file=sys.stderr)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
