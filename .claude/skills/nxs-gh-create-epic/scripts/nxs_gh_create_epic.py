#!/usr/bin/env python3
"""
nxs_gh_create_epic.py

Creates a GitHub issue from an Epic document, adds it to a GitHub project,
and updates its frontmatter with the issue link.

Usage: python nxs_gh_create_epic.py [--project "<project-name>"] <path-to-epic.md>

Prerequisites:
    - GitHub CLI (gh) must be installed and authenticated
    - For project integration: gh auth login --scopes 'project'
    - Must be run from within a git repository connected to GitHub
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


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


class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"  # No Color


def error(msg: str) -> None:
    print(f"{Colors.RED}❌ {msg}{Colors.NC}", file=sys.stderr)


def success(msg: str) -> None:
    print(f"{Colors.GREEN}✅ {msg}{Colors.NC}")


def warn(msg: str) -> None:
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.NC}")


def run_command(cmd: list[str], capture_output: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    return subprocess.run(cmd, capture_output=capture_output, text=True)


def check_prerequisites() -> bool:
    """Verify gh CLI is installed, authenticated, and we're in a git repo."""
    # Check for gh CLI
    if not shutil.which("gh"):
        error("GitHub CLI (gh) is not installed")
        print("Install with: brew install gh (macOS) or see https://cli.github.com")
        return False

    # Check gh authentication
    result = run_command(["gh", "auth", "status"])
    if result.returncode != 0:
        error("Not authenticated with GitHub CLI")
        print("Run: gh auth login")
        return False

    # Check if in a git repository
    result = run_command(["git", "rev-parse", "--is-inside-work-tree"])
    if result.returncode != 0:
        error("Not in a git repository")
        return False

    return True


def parse_frontmatter(content: str) -> tuple[dict[str, str], str]:
    """
    Parse YAML frontmatter from markdown content.
    Returns (frontmatter_dict, body_content).
    """
    frontmatter_pattern = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
    match = frontmatter_pattern.match(content)

    if not match:
        return {}, content

    frontmatter_text = match.group(1)
    body = content[match.end():]

    # Simple YAML parsing for key: value pairs
    frontmatter = {}
    for line in frontmatter_text.split("\n"):
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip("\"'")
            if key:
                frontmatter[key] = value

    return frontmatter, body


def strip_non_durable_refs(body: str) -> str:
    """Remove preamble/pointer lines that bake the transient queue location into the issue.

    The queue path (.nexus/queue/<epic-slug>-<local-id>/) is committed-transient — the
    distiller drains it — so any `Queue entry:` / `Full epic:` / `Feature: … · docs/…`
    pointer written into the issue body rots. Drop them; the GitHub issue carries the
    epic content (its `# Epic:` title onward) only.
    """
    queue_ref = re.compile(r"\.nexus/queue/")
    pointer = re.compile(r"^\s*\**\s*(Feature|Queue entry|Full epic)\b", re.IGNORECASE)

    lines = body.split("\n")
    first_h1 = next(
        (i for i, line in enumerate(lines) if line.lstrip().startswith("# ")),
        len(lines),
    )

    kept: list[str] = []
    for i, line in enumerate(lines):
        # Queue-path references are never durable, wherever they appear.
        if queue_ref.search(line):
            continue
        # Pointer preamble only counts before the epic's H1 title.
        if i < first_h1 and pointer.match(line):
            continue
        kept.append(line)

    return "\n".join(kept).lstrip("\n")


def strip_story_bodies(body: str) -> str:
    """Remove the `## User Stories` section from the epic issue body.

    Each story is filed as its own GitHub sub-issue of the epic (see /nxs.epic Phase 6),
    which is the durable, editable working surface for the story text and its acceptance
    criteria. Repeating the full story bodies in the epic issue would duplicate that content
    and let it drift. The stories stay in the queue `epic.md` (the digest, /nxs.hld,
    /nxs.analyze and /nxs.distill read them there); GitHub renders the sub-issues under the
    epic. So drop the section here.

    Removes from the `## User Stories` H2 up to (but not including) the next H2 heading, or
    end of body. Only level-2 headings terminate the section; the `###`/`####` story
    subsections do not.
    """
    h2 = re.compile(r"^##\s")  # matches `## `, not `### ` (no space after the 3rd #)
    lines = body.split("\n")

    start = next(
        (i for i, line in enumerate(lines) if re.match(r"^##\s+User Stories\s*$", line)),
        None,
    )
    if start is None:
        return body

    end = next(
        (j for j in range(start + 1, len(lines)) if h2.match(lines[j])),
        len(lines),
    )

    kept = lines[:start] + lines[end:]
    return "\n".join(kept).strip("\n") + "\n"


def update_frontmatter_with_link(content: str, issue_num: str) -> str:
    """Update or add link field in frontmatter."""
    lines = content.split("\n")
    in_frontmatter = False
    frontmatter_end_idx = -1
    link_line_idx = -1

    for i, line in enumerate(lines):
        if line.strip() == "---":
            if not in_frontmatter:
                in_frontmatter = True
            else:
                frontmatter_end_idx = i
                break
        elif in_frontmatter and line.startswith("link:"):
            link_line_idx = i

    if frontmatter_end_idx == -1:
        error("Could not find frontmatter boundaries")
        return content

    link_value = f'link: "#{issue_num}"'

    if link_line_idx != -1:
        # Update existing link
        lines[link_line_idx] = link_value
    else:
        # Insert link before closing ---
        lines.insert(frontmatter_end_idx, link_value)

    return "\n".join(lines)


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


def read_epic_type_from_config(project_root: Path) -> str:
    """Read the default epic issue type from delivery config (config.yml or config.json)."""
    return read_delivery_config(project_root).get("epicType", "")


def read_issues_repo_from_config(project_root: Path) -> str:
    """Read the target issues repository from delivery config (config.yml or config.json).

    Returns the 'owner/repo' string from github.issues-repo, or empty string if not set.
    """
    return read_delivery_config(project_root).get("issuesRepo", "")


def get_project_id_by_name(project_name: str) -> str | None:
    """Get the node ID of a project by its name.
    
    The project_name can be in format:
    - "owner/project-number" (e.g., "my-org/1")
    - "project-number" (uses current repo's owner)
    
    Args:
        project_name: The project identifier
        
    Returns:
        The project node ID (e.g., "PVT_kwHOABC123") or None if not found.
    """
    # Parse project name to extract owner and number
    if "/" in project_name:
        owner, project_num = project_name.rsplit("/", 1)
    else:
        # Get owner from current repo
        result = run_command(["gh", "repo", "view", "--json", "owner", "--jq", ".owner.login"])
        if result.returncode != 0:
            warn(f"Error getting repo owner: {result.stderr}")
            return None
        owner = result.stdout.strip()
        project_num = project_name

    # Try to parse as a number for project lookup
    try:
        project_number = int(project_num)
    except ValueError:
        # Not a number, try to find project by title
        return get_project_id_by_title(owner, project_num)

    # Query for project by number
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
    
    result = run_command(cmd)
    
    # If org query fails, try user query
    if result.returncode != 0 or "organization" not in result.stdout:
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
        result = run_command(cmd)
    
    if result.returncode != 0:
        warn(f"Error fetching project: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        # Check both org and user responses
        project = (
            data.get("data", {}).get("organization", {}).get("projectV2") or
            data.get("data", {}).get("user", {}).get("projectV2")
        )
        if project:
            print(f"📊 Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing project response: {e}")
        return None


def get_project_id_by_title(owner: str, title: str) -> str | None:
    """Get the node ID of a project by searching for its title.
    
    Args:
        owner: The organization or user login
        title: The project title to search for
        
    Returns:
        The project node ID or None if not found.
    """
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
    
    result = run_command(cmd)
    
    # If org query fails, try user query
    if result.returncode != 0:
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
        result = run_command(cmd)
    
    if result.returncode != 0:
        warn(f"Error searching for project: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        nodes = (
            data.get("data", {}).get("organization", {}).get("projectsV2", {}).get("nodes", []) or
            data.get("data", {}).get("user", {}).get("projectsV2", {}).get("nodes", [])
        )
        # Find exact match
        for node in nodes:
            if node.get("title", "").lower() == title.lower():
                print(f"📊 Found project: {node.get('title', 'Unknown')}")
                return node.get("id")
        # If no exact match, use first result
        if nodes:
            project = nodes[0]
            print(f"📊 Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing project response: {e}")
        return None


def get_repo_project_id() -> str | None:
    """Get the node ID of the first project associated with the current repository.
    
    Returns:
        The project node ID (e.g., "PVT_kwHOABC123") or None if no project found.
    """
    result = run_command(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
    if result.returncode != 0:
        warn(f"Could not determine repository name: {result.stderr}")
        return None

    name_with_owner = result.stdout.strip()
    if "/" not in name_with_owner:
        warn(f"Unexpected repository name format: {name_with_owner}")
        return None
    owner, repo = name_with_owner.split("/", 1)

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

    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-f", f"repo={repo}",
    ]

    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error fetching repository projects: {result.stderr}")
        return None

    try:
        data = json.loads(result.stdout)
        repository = (data.get("data") or {}).get("repository") or {}
        nodes = (repository.get("projectsV2") or {}).get("nodes") or []
        if nodes:
            project = nodes[0]
            print(f"📊 Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing project response: {e}")
        return None


def get_issue_id(issue_number: str, repo: str | None = None) -> str | None:
    """Get the GitHub GraphQL node ID for an issue.

    Args:
        issue_number: The issue number
        repo: Optional 'owner/repo' to query (passed as -R flag). Uses current repo if omitted.

    Returns:
        The GraphQL node ID (e.g., "I_kwDOABC123") or None if not found.
    """
    cmd = ["gh", "issue", "view", issue_number, "--json", "id", "--jq", ".id"]
    if repo:
        cmd = ["gh", "issue", "view", issue_number, "-R", repo, "--json", "id", "--jq", ".id"]

    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error getting issue ID: {result.stderr}")
        return None

    return result.stdout.strip()


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
    
    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error adding issue to project: {result.stderr}")
        return False
    
    return True


def get_repo_issue_type_id(type_name: str) -> str | None:
    """Look up the GraphQL node ID for a named issue type in the current repository.

    Returns the type ID string, or None if the type is not found or the query fails.
    """
    result = run_command(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
    if result.returncode != 0:
        warn(f"Could not determine repository name: {result.stderr}")
        return None

    name_with_owner = result.stdout.strip()
    if "/" not in name_with_owner:
        warn(f"Unexpected repository name format: {name_with_owner}")
        return None
    owner, repo = name_with_owner.split("/", 1)

    query = """
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            issueTypes(first: 50) {
                nodes {
                    id
                    name
                }
            }
        }
    }
    """

    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-f", f"repo={repo}",
    ]
    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Could not fetch repository issue types: {result.stderr}")
        return None

    try:
        data = json.loads(result.stdout)
        # Repos without the issue-types feature return "issueTypes": null —
        # .get(key, default) does not apply the default to an explicit null.
        repository = (data.get("data") or {}).get("repository") or {}
        nodes = (repository.get("issueTypes") or {}).get("nodes") or []
        for node in nodes:
            if node.get("name", "").lower() == type_name.lower():
                return node.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing issue types response: {e}")
        return None


def set_issue_type(issue_id: str, type_id: str) -> bool:
    """Set the issue type on a GitHub issue via the updateIssue GraphQL mutation.

    Returns True if successful, False otherwise.
    """
    mutation = """
    mutation($issueId: ID!, $typeId: ID!) {
        updateIssue(input: {id: $issueId, issueTypeId: $typeId}) {
            issue {
                number
                issueType {
                    name
                }
            }
        }
    }
    """

    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={mutation}",
        "-f", f"issueId={issue_id}",
        "-f", f"typeId={type_id}",
    ]
    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error setting issue type: {result.stderr}")
        return False
    return True


def create_github_issue(
    title: str,
    body_file: Path,
    fallback_label: str | None = None,
    repo: str | None = None,
) -> tuple[str, str]:
    """
    Create a GitHub issue and return (issue_url, issue_number).

    When fallback_label is provided it is passed as --label (used when no
    issue type was resolved). When repo is provided it is passed as -R (creates
    the issue in that repository instead of the current one). Raises RuntimeError on failure.
    """
    cmd = [
        "gh", "issue", "create",
        "--title", title,
        "--body-file", str(body_file),
    ]
    if fallback_label:
        cmd.extend(["--label", fallback_label])
    if repo:
        cmd.extend(["-R", repo])

    result = run_command(cmd)

    if result.returncode != 0:
        raise RuntimeError(f"Failed to create GitHub issue: {result.stderr}")

    issue_url = result.stdout.strip()

    # Extract issue number from URL
    match = re.search(r"/issues/(\d+)$", issue_url)
    if not match:
        # Try just finding trailing digits
        match = re.search(r"(\d+)$", issue_url)

    if not match:
        raise RuntimeError(f"Could not extract issue number from: {issue_url}")

    return issue_url, match.group(1)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a GitHub issue from an Epic document"
    )
    parser.add_argument(
        "epic_file",
        type=Path,
        help="Path to the epic.md file"
    )
    parser.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Skip confirmation if link already exists"
    )
    parser.add_argument(
        "--project",
        type=str,
        default=None,
        help="GitHub project to add the issue to (e.g., 'my-org/1' or 'my-project-title'). If omitted, auto-discovers from repository."
    )
    parser.add_argument(
        "--no-project",
        action="store_true",
        help="Skip adding the issue to any project"
    )

    args = parser.parse_args()
    epic_file: Path = args.epic_file

    # Validate epic file exists
    if not epic_file.is_file():
        error(f"Epic file not found: {epic_file}")
        return 1

    # Check prerequisites
    if not check_prerequisites():
        return 1

    print(f"📄 Processing: {epic_file}")

    # Read and parse the epic file
    content = epic_file.read_text(encoding="utf-8")
    frontmatter, body = parse_frontmatter(content)

    # Strip non-durable queue/feature pointers so they never land in the issue body.
    body = strip_non_durable_refs(body)

    # Drop the `## User Stories` section — each story is filed as its own sub-issue, so
    # keeping the full story bodies here would duplicate them and let the copies drift.
    body = strip_story_bodies(body)

    # Extract epic title (required)
    epic_title = frontmatter.get("epic", "")
    if not epic_title:
        error("No 'epic' field found in frontmatter")
        print("Expected format in frontmatter:")
        print('  epic: "Your Epic Title"')
        return 1

    # Resolve project root once — used for all config reads below
    project_root = find_project_root(epic_file)

    # Read issues-repo from config (if set, all gh issue commands target that repo)
    issues_repo: str | None = read_issues_repo_from_config(project_root) or None
    if issues_repo:
        print(f"📦 Issues repo (from config): {issues_repo}")

    # Resolve issue type (priority: frontmatter 'type' > config.json 'epicType').
    # If neither is set, fall back to adding the "enhancement" label instead.
    issue_type: str | None = frontmatter.get("type", "") or None
    fallback_label: str | None = None
    if not issue_type:
        issue_type = read_epic_type_from_config(project_root) or None
        if issue_type:
            print(f"🏷️  No 'type' in frontmatter, using epicType from config.json: {issue_type}")
        else:
            fallback_label = "enhancement"
            warn("No 'type' in frontmatter or config.json, falling back to label: enhancement")

    # Check if link already exists
    existing_link = frontmatter.get("link", "")
    if existing_link and not args.yes:
        warn(f"Epic already has a link: {existing_link}")
        response = input("Do you want to create a new issue anyway? (y/N) ").strip().lower()
        if response != "y":
            print("Aborted.")
            return 0

    print(f"📋 Epic Title: {epic_title}")
    if issue_type:
        print(f"🏷️  Type: {issue_type}")
    else:
        print(f"🏷️  Label (fallback): {fallback_label}")

    # Verify we have body content
    if not body.strip():
        error("No content found after frontmatter")
        return 1

    # Resolve project ID (priority: --project flag > config.json > repo auto-discovery)
    project_id = None
    if not args.no_project:
        if args.project:
            # Use explicitly provided project
            print(f"🔍 Looking up project: {args.project}")
            project_id = get_project_id_by_name(args.project)
            if not project_id:
                warn(f"Project '{args.project}' not found, issue will not be added to a project")
        else:
            # Check delivery config for project name
            config_project = read_project_from_config(project_root)
            if config_project:
                print(f"🔍 Looking up project from config: {config_project}")
                project_id = get_project_id_by_name(config_project)
                if not project_id:
                    warn(f"Project '{config_project}' from config.json not found, falling back to auto-discovery")

            if not project_id:
                # Auto-discover from repository
                print("🔍 Looking for repository project...")
                project_id = get_repo_project_id()
                if not project_id:
                    warn("No project found for repository, issue will not be added to a project")

    # Create temp file with body content
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as tmp:
        tmp.write(body)
        temp_file = Path(tmp.name)

    try:
        print("🚀 Creating GitHub issue...")

        issue_url, issue_num = create_github_issue(
            epic_title, temp_file, fallback_label=fallback_label, repo=issues_repo
        )

        # Record the link immediately — the project/type steps below are
        # best-effort decoration and must not be able to lose the issue number.
        print("📝 Updating epic frontmatter with link...")
        updated_content = update_frontmatter_with_link(content, issue_num)
        epic_file.write_text(updated_content, encoding="utf-8")

        # Fetch the issue node ID once — needed for both project and type operations
        issue_id: str | None = None
        if project_id or issue_type:
            issue_id = get_issue_id(issue_num, repo=issues_repo)

        # Add to project if available
        if project_id:
            if issue_id:
                if add_issue_to_project(project_id, issue_id):
                    print("📊 Added to project")
                else:
                    warn("Failed to add issue to project")

        # Set GitHub issue type when resolved from frontmatter or config
        if issue_type:
            print(f"🏷️  Setting issue type: {issue_type}...")
            type_id = get_repo_issue_type_id(issue_type)
            type_set = bool(type_id and issue_id and set_issue_type(issue_id, type_id))
            if type_set:
                print(f"🏷️  Issue type set: {issue_type}")
            else:
                if type_id:
                    warn(f"Failed to set issue type '{issue_type}' on issue #{issue_num}")
                else:
                    warn(f"Issue type '{issue_type}' not found in repository — type not set")
                # Without a type the issue would carry no classification at all —
                # fall back to the type name as a label.
                label = issue_type.lower()
                label_cmd = ["gh", "issue", "edit", issue_num, "--add-label", label]
                if issues_repo:
                    label_cmd.extend(["-R", issues_repo])
                if run_command(label_cmd).returncode == 0:
                    print(f"🏷️  Fallback label added: {label}")
                else:
                    warn(f"Could not add fallback label '{label}' to issue #{issue_num}")

        # Success output
        print()
        success("GitHub Issue Created")
        print()
        print(f"   Issue:  #{issue_num}")
        print(f"   Title:  {epic_title}")
        if issue_type:
            print(f"   Type:   {issue_type}")
        else:
            print(f"   Label:  {fallback_label}")
        print(f"   URL:    {issue_url}")
        if project_id:
            print("   Project: Added ✓")
        print()
        print(f'   Epic frontmatter updated with: link: "#{issue_num}"')

        return 0

    except RuntimeError as e:
        error(str(e))
        return 1

    finally:
        # Cleanup temp file
        temp_file.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())