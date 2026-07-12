#!/usr/bin/env python3
"""
Create GitHub issues from STORY-*.md work-item files in a target folder.

Two passes: pass 1 creates one issue per story (frontmatter: ref, title, blocked_by,
labels, parent, project), links it as a sub-issue of the parent epic, and adds it to a
project; pass 2 wires native GitHub `blocked_by` dependencies from the story refs.

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

# --- Retry / robustness controls -------------------------------------------------
# Tuned from CLI args in main(); module-level so the low-level gh wrappers can read them.
RETRIES: int = 3              # extra attempts after the first try, for transient failures
RETRY_BASE_DELAY: float = 1.0  # seconds; exponential backoff base (delay = base * 2**attempt + jitter)

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
        result = subprocess.run(cmd, capture_output=True, text=True)
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


def _parse_simple_yaml(content: str) -> dict[str, dict[str, str]]:
    """Parse the 2-level nested config.yml format without external dependencies."""
    result: dict[str, dict[str, str]] = {}
    current_section: str | None = None
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not line[0].isspace() and ":" in line:
            key = line.split(":")[0].strip()
            result[key] = {}
            current_section = key
        elif current_section and ":" in line:
            key, _, value = line.partition(":")
            result[current_section][key.strip()] = value.strip()
    return result


def read_delivery_config(project_root: Path) -> dict[str, str]:
    """Read delivery config from settings.yml (canonical), falling back to the legacy
    config.yml / config.json names.

    Returns a normalized dict with keys: docRoot, project, epicType, issuesRepo.
    """
    delivery_dir = project_root / ".nexus" / "config"

    # settings.yml is the committed config file this repo actually writes. config.yml is
    # kept only as a legacy name: prior versions read config.yml (which never existed), so
    # any github: config placed in settings.yml was silently dropped.
    for yml_name in ("settings.yml", "config.yml"):
        yml_path = delivery_dir / yml_name
        if not yml_path.exists():
            continue
        try:
            with open(yml_path, encoding="utf-8") as f:
                raw = _parse_simple_yaml(f.read())
            result: dict[str, str] = {}
            cross_ref = raw.get("cross-ref", {})
            github = raw.get("github", {})
            if cross_ref.get("docs-root"):
                result["docRoot"] = cross_ref["docs-root"]
            if github.get("project"):
                result["project"] = github["project"]
            if github.get("epic-type"):
                result["epicType"] = github["epic-type"]
            if github.get("issues-repo"):
                result["issuesRepo"] = github["issues-repo"]
            return result
        except OSError:
            pass

    json_path = delivery_dir / "config.json"
    if json_path.exists():
        try:
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            # Support nested github object or flat keys
            if isinstance(data.get("github"), dict):
                if data["github"].get("issues-repo"):
                    data["issuesRepo"] = data["github"]["issues-repo"]
            return data
        except (json.JSONDecodeError, OSError):
            pass

    return {}


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
                capture_output=True, text=True, check=True
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
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
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
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
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
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
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
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
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


def get_repo_project_id() -> str | None:
    """Get the node ID of the first project associated with the current repository.
    
    Returns:
        The project node ID (e.g., "PVT_kwHOABC123") or None if no project found.
    """
    query = """
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            projectsV2(first: 1) {
                nodes {
                    id
                    title
                }
            }
        }
    }
    """

    try:
        name_result = subprocess.run(
            ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
            capture_output=True, text=True, check=True,
        )
        name_with_owner = name_result.stdout.strip()
        if "/" not in name_with_owner:
            print(f"Unexpected repository name format: {name_with_owner}", file=sys.stderr)
            return None
        owner, repo = name_with_owner.split("/", 1)

        cmd = [
            "gh", "api", "graphql",
            "-f", f"query={query}",
            "-f", f"owner={owner}",
            "-f", f"repo={repo}",
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        repository = (data.get("data") or {}).get("repository") or {}
        nodes = (repository.get("projectsV2") or {}).get("nodes") or []
        if nodes:
            project = nodes[0]
            print(f"Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except subprocess.CalledProcessError as e:
        print(f"Error fetching repository projects: {e.stderr}", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing project response: {e}", file=sys.stderr)
        return None


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


STORY_LABEL = "story"


def ensure_story_label(repo: str | None = None) -> None:
    """Create the canonical `story` label if it does not already exist.

    Idempotent: `gh label create --force` upserts, so re-running is harmless.
    Every issue this skill creates is a user story, so the label is always applied.

    Args:
        repo: Optional 'owner/repo' to target (passed as -R). Uses current repo if omitted.
    """
    cmd = ["gh", "label", "create", STORY_LABEL, "--color", "BFD4F2",
           "--description", "User story (created by nxs-gh-create-story)", "--force"]
    if repo:
        cmd.extend(["-R", repo])
    try:
        run_gh(cmd)
    except GhError as e:
        # Non-fatal: issue creation still works if the label already exists with a
        # different color, or if the token lacks label-write scope but the label exists.
        print(f"Warning: could not ensure '{STORY_LABEL}' label: {e.stderr}", file=sys.stderr)


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


def find_project_root(start_path: Path) -> Path:
    """Find the project root by looking for CLAUDE.md or .git."""
    current = start_path.resolve()

    while current != current.parent:
        if (current / "CLAUDE.md").exists() or (current / ".git").exists():
            return current
        current = current.parent

    return Path.cwd()


def read_project_from_config(project_root: Path) -> str:
    """Read the GitHub project name from delivery config (config.yml or config.json)."""
    return read_delivery_config(project_root).get("project", "")


def read_issues_repo_from_config(project_root: Path) -> str:
    """Read the target issues repository from delivery config (config.yml or config.json).

    Returns the 'owner/repo' string from github.issues-repo, or empty string if not set.
    """
    return read_delivery_config(project_root).get("issuesRepo", "")


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
        return {"ref": ref, "number": number, "db_id": db_id, "blocked_by": blocked_by, "reused": True}

    # Ensure labels is a list
    if isinstance(labels, str):
        labels = [labels] if labels else []

    # Every issue this skill creates is a story — apply the canonical label.
    if STORY_LABEL not in labels:
        labels = [STORY_LABEL, *labels]

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

        return {"ref": ref, "number": issue_number, "db_id": db_id, "blocked_by": blocked_by, "reused": False}

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
    manifest_path: str,
    target_folder: str,
    extra_args: list[str],
) -> bool:
    """Render the end-of-run summary. Returns True if the run is fully complete."""
    incomplete = bool(create_failed or dep_unresolved or dep_failed)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Issues:       {len(created_new)} created, {len(reused)} reused, "
          f"{len(create_failed)} FAILED  (of {total})")
    print(f"Dependencies: {dep_wired} wired, {dep_present} already present, "
          f"{len(dep_unresolved)} unresolved, {len(dep_failed)} FAILED")

    if not incomplete:
        print("\n✅ Complete — every story issue created and every dependency wired.")
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

    project_root = find_project_root(Path(target_folder))

    # Read issues-repo from config (if set, all gh issue commands target that repo)
    issues_repo: str | None = read_issues_repo_from_config(project_root) or None
    if issues_repo:
        print(f"Issues repo (from config): {issues_repo}")

    # Ensure the canonical `story` label exists on the target repo before any
    # `gh issue create --label story` call (skipped on dry runs).
    if not args.dry_run:
        ensure_story_label(repo=issues_repo)

    # Resolve project from config.json (priority between frontmatter and repo auto-discovery)
    config_project_id = None
    if not args.no_project and not args.dry_run:
        config_project = read_project_from_config(project_root)
        if config_project:
            print(f"Looking up project from config: {config_project}")
            config_project_id = get_project_id_by_name(config_project)
            if not config_project_id:
                print(f"Warning: Project '{config_project}' from config.json not found", file=sys.stderr)

    # Get fallback repo project ID unless disabled
    repo_project_id = None
    if not args.no_project and not args.dry_run:
        print("Looking for repository project (fallback)...")
        repo_project_id = get_repo_project_id()
        if not repo_project_id:
            print("No repository project found (will use frontmatter or config project if available)")

    if args.dry_run:
        print("\nDry run - would process:")
        for f in task_files:
            content = f.read_text()
            fm, _ = parse_frontmatter(content)
            labels = fm.get("labels", [])
            if isinstance(labels, str):
                labels = [labels] if labels else []
            if STORY_LABEL not in labels:
                labels = [STORY_LABEL, *labels]
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
            blocker_db_id = ref_to_db_id.get(dep_ref)
            if not blocker_db_id:
                print(f"  Unresolved: blocked_by ref '{dep_ref}' for #{number} not among created issues",
                      file=sys.stderr)
                dep_unresolved.append((number, dep_ref))
                continue
            if existing is not None and str(blocker_db_id) in existing:
                dep_present += 1
                continue
            if add_blocked_by(number, blocker_db_id, repo=issues_repo):
                print(f"  #{number} blocked_by ref '{dep_ref}'")
                dep_wired += 1
            else:
                dep_failed.append((number, dep_ref))

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
