#!/usr/bin/env python3
"""
Create GitHub issues from TASK-???.md files in a target folder.

Extracts frontmatter (title, label, parent), creates GitHub issues,
assigns parent issues, and adds issues to a project using gh CLI.
"""

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


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
    """Find all TASK-???.md files in the target folder."""
    pattern = os.path.join(target_folder, "TASK-???.md")
    files = glob.glob(pattern)
    return sorted([Path(f) for f in files])


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
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        nodes = data.get("data", {}).get("repository", {}).get("projectsV2", {}).get("nodes", [])
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
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error adding issue to project: {e.stderr}", file=sys.stderr)
        return False


def create_github_issue(title: str, labels: list[str], body_file: str) -> str | None:
    """Create a GitHub issue using gh CLI.
    
    Returns:
        The issue URL if successful, None otherwise.
    """
    cmd = ["gh", "issue", "create", "--title", title, "--body-file", body_file]
    
    for label in labels:
        cmd.extend(["--label", label])
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        # gh issue create outputs the issue URL on success
        issue_url = result.stdout.strip()
        return issue_url
    except subprocess.CalledProcessError as e:
        print(f"Error creating issue: {e.stderr}", file=sys.stderr)
        return None


def extract_issue_number(issue_url: str) -> str | None:
    """Extract issue number from GitHub issue URL."""
    match = re.search(r"/issues/(\d+)$", issue_url)
    if match:
        return match.group(1)
    return None


def get_issue_id(issue_ref: str) -> str | None:
    """Get the GitHub GraphQL node ID for an issue.
    
    Args:
        issue_ref: Issue number, #number format, or full URL
        
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
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error getting issue ID for {issue_ref}: {e.stderr}", file=sys.stderr)
        return None


def assign_parent_issue(child_issue_number: str, parent_issue_ref: str) -> bool:
    """Create a sub-issue relationship using GitHub's GraphQL API.
    
    This creates an actual parent-child (sub-issue) relationship, not just a comment.
    """
    # Get GraphQL node IDs for both issues
    parent_id = get_issue_id(parent_issue_ref)
    child_id = get_issue_id(child_issue_number)
    
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
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error creating sub-issue relationship: {e.stderr}", file=sys.stderr)
        return False


def process_task_file(task_file: Path, project_id: str | None = None) -> bool:
    """Process a single TASK file and create a GitHub issue.
    
    Args:
        task_file: Path to the TASK-???.md file
        project_id: Optional project node ID to add the issue to
    
    Returns:
        True if successful, False otherwise.
    """
    print(f"Processing: {task_file}")
    
    content = task_file.read_text()
    frontmatter, body = parse_frontmatter(content)
    
    title = frontmatter.get("title", "")
    labels = frontmatter.get("labels", [])
    parent = frontmatter.get("parent", "")
    
    # Ensure labels is a list
    if isinstance(labels, str):
        labels = [labels] if labels else []
    
    if not title:
        print(f"  Warning: No title in frontmatter, using filename", file=sys.stderr)
        title = task_file.stem
    
    # Create temporary file with body content (without frontmatter)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as tmp:
        tmp.write(body)
        tmp_path = tmp.name
    
    try:
        # Create the GitHub issue
        issue_url = create_github_issue(title, labels, tmp_path)
        
        if not issue_url:
            print(f"  Failed to create issue for {task_file}", file=sys.stderr)
            return False
        
        print(f"  Created issue: {issue_url}")
        
        issue_number = extract_issue_number(issue_url)
        
        # Add to project if specified
        if project_id and issue_number:
            issue_id = get_issue_id(issue_number)
            if issue_id:
                if add_issue_to_project(project_id, issue_id):
                    print(f"  Added to project")
                else:
                    print(f"  Warning: Failed to add issue to project", file=sys.stderr)
        
        # If there's a parent, assign it
        if parent and issue_number:
            if assign_parent_issue(issue_number, parent):
                print(f"  Linked as sub-issue of: {parent}")
            else:
                print(f"  Warning: Failed to create sub-issue relationship", file=sys.stderr)
        
        return True
        
    finally:
        # Clean up temporary file
        os.unlink(tmp_path)


def main():
    parser = argparse.ArgumentParser(
        description="Create GitHub issues from TASK-???.md files"
    )
    parser.add_argument(
        "target_folder",
        help="Folder containing TASK-???.md files"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without creating issues"
    )
    parser.add_argument(
        "--no-project",
        action="store_true",
        help="Skip adding issues to the repository's project"
    )
    
    args = parser.parse_args()
    
    target_folder = os.path.abspath(args.target_folder)
    
    if not os.path.isdir(target_folder):
        print(f"Error: {target_folder} is not a directory", file=sys.stderr)
        sys.exit(1)
    
    task_files = find_task_files(target_folder)
    
    if not task_files:
        print(f"No TASK-???.md files found in {target_folder}")
        sys.exit(0)
    
    print(f"Found {len(task_files)} task file(s)")
    
    # Get project ID unless disabled
    project_id = None
    if not args.no_project and not args.dry_run:
        print("Looking for repository project...")
        project_id = get_repo_project_id()
        if not project_id:
            print("No project found for repository, issues will not be added to a project")
    
    if args.dry_run:
        print("\nDry run - would process:")
        for f in task_files:
            content = f.read_text()
            fm, _ = parse_frontmatter(content)
            labels = fm.get("labels", [])
            if isinstance(labels, str):
                labels = [labels] if labels else []
            print(f"  {f.name}: title='{fm.get('title', 'N/A')}', labels={labels}, parent='{fm.get('parent', 'N/A')}'")
        sys.exit(0)
    
    success_count = 0
    for task_file in task_files:
        if process_task_file(task_file, project_id):
            success_count += 1
    
    print(f"\nProcessed {success_count}/{len(task_files)} task files successfully")
    
    if success_count < len(task_files):
        sys.exit(1)


if __name__ == "__main__":
    main()