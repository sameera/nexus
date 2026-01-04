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
    query = """
    query {
        repository(owner: "{owner}", name: "{repo}") {
            projectsV2(first: 1) {
                nodes {
                    id
                    title
                }
            }
        }
    }
    """
    
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    
    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error fetching repository projects: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        nodes = data.get("data", {}).get("repository", {}).get("projectsV2", {}).get("nodes", [])
        if nodes:
            project = nodes[0]
            print(f"📊 Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing project response: {e}")
        return None


def get_issue_id(issue_number: str) -> str | None:
    """Get the GitHub GraphQL node ID for an issue.
    
    Args:
        issue_number: The issue number
        
    Returns:
        The GraphQL node ID (e.g., "I_kwDOABC123") or None if not found.
    """
    cmd = ["gh", "issue", "view", issue_number, "--json", "id", "--jq", ".id"]
    
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


def create_github_issue(title: str, label: str, body_file: Path) -> tuple[str, str]:
    """
    Create a GitHub issue and return (issue_url, issue_number).
    Raises RuntimeError on failure.
    """
    cmd = [
        "gh", "issue", "create",
        "--title", title,
        "--label", label,
        "--body-file", str(body_file)
    ]

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

    # Extract epic title (required)
    epic_title = frontmatter.get("epic", "")
    if not epic_title:
        error("No 'epic' field found in frontmatter")
        print("Expected format in frontmatter:")
        print('  epic: "Your Epic Title"')
        return 1

    # Extract type for label (optional, defaults to "epic")
    epic_type = frontmatter.get("type", "")
    if not epic_type:
        epic_type = "epic"
        warn("No 'type' field in frontmatter, using default label: epic")

    # Check if link already exists
    existing_link = frontmatter.get("link", "")
    if existing_link and not args.yes:
        warn(f"Epic already has a link: {existing_link}")
        response = input("Do you want to create a new issue anyway? (y/N) ").strip().lower()
        if response != "y":
            print("Aborted.")
            return 0

    print(f"📋 Epic Title: {epic_title}")
    print(f"🏷️  Label: {epic_type}")

    # Verify we have body content
    if not body.strip():
        error("No content found after frontmatter")
        return 1

    # Resolve project ID
    project_id = None
    if not args.no_project:
        if args.project:
            # Use explicitly provided project
            print(f"🔍 Looking up project: {args.project}")
            project_id = get_project_id_by_name(args.project)
            if not project_id:
                warn(f"Project '{args.project}' not found, issue will not be added to a project")
        else:
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

        issue_url, issue_num = create_github_issue(epic_title, epic_type, temp_file)

        # Add to project if available
        if project_id:
            issue_id = get_issue_id(issue_num)
            if issue_id:
                if add_issue_to_project(project_id, issue_id):
                    print("📊 Added to project")
                else:
                    warn("Failed to add issue to project")

        print("📝 Updating epic frontmatter with link...")

        # Update frontmatter with link
        updated_content = update_frontmatter_with_link(content, issue_num)
        epic_file.write_text(updated_content, encoding="utf-8")

        # Success output
        print()
        success("GitHub Issue Created")
        print()
        print(f"   Issue:  #{issue_num}")
        print(f"   Title:  {epic_title}")
        print(f"   Label:  {epic_type}")
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