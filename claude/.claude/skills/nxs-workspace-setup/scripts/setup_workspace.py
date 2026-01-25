#!/usr/bin/env python3
"""Workspace setup automation for nxs.dev command.

Handles git workspace creation (worktree or in-place branch) with support for:
- Auto-detection of current branch state
- Issue-embedded workspace configuration
- YOLO mode auto-approval
- Branch conflict resolution
- Environment file synchronization

Usage:
    python setup_workspace.py \\
        --issue-number <number> \\
        --issue-title <title> \\
        --issue-body <body> \\
        --yolo-mode <true|false> \\
        [--workspace-config <path>:<branch>]

Output:
    JSON object with workspace metadata and checkpoint requirements
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Tuple


def run_command(cmd: list[str], cwd: Optional[str] = None, check: bool = True) -> subprocess.CompletedProcess:
    """Execute a shell command and return the result.

    Args:
        cmd: Command and arguments as list
        cwd: Working directory for command execution
        check: Whether to raise exception on non-zero exit

    Returns:
        CompletedProcess instance with stdout, stderr, returncode
    """
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False
    )

    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{result.stderr}")

    return result


def get_current_branch() -> str:
    """Get the current git branch name.

    Returns:
        Current branch name or empty string if detached HEAD
    """
    result = run_command(["git", "branch", "--show-current"])
    return result.stdout.strip()


def is_main_branch(branch: str) -> bool:
    """Check if branch is a main/master branch.

    Args:
        branch: Branch name to check

    Returns:
        True if branch is main or master
    """
    return branch in ["main", "master"]


def branch_exists(branch_name: str) -> bool:
    """Check if a git branch exists.

    Args:
        branch_name: Name of branch to check

    Returns:
        True if branch exists
    """
    result = run_command(
        ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch_name}"],
        check=False
    )
    return result.returncode == 0


def parse_workspace_config(issue_body: str) -> Optional[Tuple[str, str]]:
    """Extract workspace configuration from issue body.

    Looks for pattern:
    ## Git Workspace
    - Worktree: <path>
    - Branch: `<branch-name>`

    Args:
        issue_body: Full issue body text

    Returns:
        Tuple of (worktree_path, branch_name) or None if not found
    """
    # Look for Git Workspace section
    workspace_pattern = r'## Git Workspace\s*\n\s*-\s*Worktree:\s*([^\n]+)\s*\n\s*-\s*Branch:\s*`([^`]+)`'
    match = re.search(workspace_pattern, issue_body, re.MULTILINE)

    if match:
        worktree_path = match.group(1).strip()
        branch_name = match.group(2).strip()
        return (worktree_path, branch_name)

    return None


def generate_workspace_suggestion(issue_number: str, issue_title: str) -> Tuple[str, str]:
    """Generate suggested worktree path and branch name from issue.

    Args:
        issue_number: GitHub issue number
        issue_title: Issue title

    Returns:
        Tuple of (worktree_path, branch_name)
    """
    # Get repository name
    repo_root = run_command(["git", "rev-parse", "--show-toplevel"]).stdout.strip()
    repo_name = os.path.basename(repo_root)

    # Create slug from issue title (lowercase, alphanumeric + hyphens, max 50 chars)
    slug = issue_title.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')[:50]

    # Generate paths
    worktree_path = f"../{repo_name}-worktrees/{issue_number}"
    branch_name = f"feat/issue-{issue_number}-{slug}"

    return (worktree_path, branch_name)


def create_worktree(path: str, branch: str, exists_ok: bool = False) -> bool:
    """Create a git worktree.

    Args:
        path: Path for new worktree
        branch: Branch name to create/checkout
        exists_ok: If True, checkout existing branch instead of creating new

    Returns:
        True if worktree was created successfully
    """
    try:
        if exists_ok and branch_exists(branch):
            # Checkout existing branch in new worktree
            run_command(["git", "worktree", "add", path, branch])
        else:
            # Create new branch in worktree
            run_command(["git", "worktree", "add", path, "-b", branch])
        return True
    except RuntimeError as e:
        print(f"Error creating worktree: {e}", file=sys.stderr)
        return False


def create_branch_in_place(branch: str) -> bool:
    """Create and checkout a new branch in the current directory.

    Args:
        branch: Branch name to create

    Returns:
        True if branch was created successfully
    """
    try:
        run_command(["git", "checkout", "-b", branch])
        return True
    except RuntimeError as e:
        print(f"Error creating branch: {e}", file=sys.stderr)
        return False


def worktree_exists(path: str) -> bool:
    """Check if a worktree already exists at the given path.

    Args:
        path: Path to check

    Returns:
        True if worktree exists
    """
    result = run_command(["git", "worktree", "list"], check=True)
    worktree_paths = [line.split()[0] for line in result.stdout.strip().split('\n')]
    abs_path = str(Path(path).resolve())
    return abs_path in worktree_paths


def setup_workspace(
    issue_number: str,
    issue_title: str,
    issue_body: str,
    yolo_mode: bool,
    workspace_config: Optional[str] = None
) -> Dict[str, Any]:
    """Main workspace setup logic.

    Args:
        issue_number: GitHub issue number
        issue_title: Issue title
        issue_body: Full issue body
        yolo_mode: If True, auto-approve workspace creation
        workspace_config: Optional explicit workspace config "path:branch"

    Returns:
        Dictionary with workspace metadata and checkpoint info
    """
    # Step 1: Check current branch
    current_branch = get_current_branch()

    # If already on a feature branch, use in-place mode
    if current_branch and not is_main_branch(current_branch):
        return {
            "workspace_path": os.getcwd(),
            "workspace_branch": current_branch,
            "workspace_mode": "in-place",
            "action_taken": "skipped",
            "env_sync_performed": False,
            "checkpoint_required": False,
            "checkpoint_data": None
        }

    # Step 2: Check for explicit workspace config (from CLI arg or issue body)
    worktree_path = None
    branch_name = None

    if workspace_config:
        # Parse CLI argument "path:branch"
        parts = workspace_config.split(':', 1)
        if len(parts) == 2:
            worktree_path, branch_name = parts
    else:
        # Try to extract from issue body
        config = parse_workspace_config(issue_body)
        if config:
            worktree_path, branch_name = config

    # If config found, create worktree without prompting
    if worktree_path and branch_name:
        # Check if worktree already exists
        if worktree_exists(worktree_path):
            return {
                "workspace_path": str(Path(worktree_path).resolve()),
                "workspace_branch": branch_name,
                "workspace_mode": "worktree",
                "action_taken": "reused",
                "env_sync_performed": False,
                "checkpoint_required": False,
                "checkpoint_data": None
            }

        # Create worktree (handling existing branches)
        success = create_worktree(worktree_path, branch_name, exists_ok=True)
        if success:
            return {
                "workspace_path": str(Path(worktree_path).resolve()),
                "workspace_branch": branch_name,
                "workspace_mode": "worktree",
                "action_taken": "created",
                "env_sync_performed": False,
                "checkpoint_required": True,
                "checkpoint_data": {
                    "type": "env_sync_confirm",
                    "message": "Worktree created from issue config. Sync environment files?",
                    "worktree_path": str(Path(worktree_path).resolve())
                }
            }

    # Step 3: Generate suggestions and handle YOLO vs normal mode
    suggested_path, suggested_branch = generate_workspace_suggestion(issue_number, issue_title)

    # Check for branch conflict
    if branch_exists(suggested_branch):
        # Branch conflict - ALWAYS prompt user (even in YOLO mode)
        return {
            "workspace_path": None,
            "workspace_branch": None,
            "workspace_mode": None,
            "action_taken": "conflict",
            "env_sync_performed": False,
            "checkpoint_required": True,
            "checkpoint_data": {
                "type": "branch_conflict",
                "message": f"Branch '{suggested_branch}' already exists",
                "suggested_branch": suggested_branch,
                "options": [
                    {"label": "Use existing branch", "value": "use_existing"},
                    {"label": f"Create with suffix: {suggested_branch}-v2", "value": "add_suffix"},
                    {"label": "Custom branch name", "value": "custom"}
                ]
            }
        }

    # YOLO mode - auto-create worktree
    if yolo_mode:
        success = create_worktree(suggested_path, suggested_branch)
        if success:
            return {
                "workspace_path": str(Path(suggested_path).resolve()),
                "workspace_branch": suggested_branch,
                "workspace_mode": "worktree",
                "action_taken": "created",
                "env_sync_performed": False,
                "checkpoint_required": True,
                "checkpoint_data": {
                    "type": "env_sync_yolo",
                    "message": "Auto-created worktree (YOLO mode). Auto-sync environment?",
                    "worktree_path": str(Path(suggested_path).resolve())
                }
            }
        else:
            return {
                "workspace_path": None,
                "workspace_branch": None,
                "workspace_mode": None,
                "action_taken": "error",
                "env_sync_performed": False,
                "checkpoint_required": False,
                "checkpoint_data": {
                    "type": "error",
                    "message": "Failed to create worktree"
                }
            }

    # Normal mode - present workspace choice checkpoint
    return {
        "workspace_path": None,
        "workspace_branch": None,
        "workspace_mode": None,
        "action_taken": "pending",
        "env_sync_performed": False,
        "checkpoint_required": True,
        "checkpoint_data": {
            "type": "workspace_choice",
            "message": f"You're on '{current_branch}'. Choose workspace setup approach.",
            "issue_number": issue_number,
            "issue_title": issue_title,
            "suggested_path": suggested_path,
            "suggested_branch": suggested_branch,
            "options": [
                {
                    "label": "Create isolated worktree (recommended)",
                    "value": "worktree",
                    "description": f"Creates worktree at {suggested_path}"
                },
                {
                    "label": "Switch this directory to new branch",
                    "value": "in_place",
                    "description": f"Creates branch {suggested_branch} in current directory"
                },
                {
                    "label": "Custom worktree path and/or branch name",
                    "value": "custom",
                    "description": "Specify custom path and branch"
                }
            ]
        }
    }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Set up git workspace for issue implementation"
    )
    parser.add_argument(
        "--issue-number",
        required=True,
        help="GitHub issue number"
    )
    parser.add_argument(
        "--issue-title",
        required=True,
        help="Issue title"
    )
    parser.add_argument(
        "--issue-body",
        required=True,
        help="Full issue body text"
    )
    parser.add_argument(
        "--yolo-mode",
        required=True,
        choices=["true", "false"],
        help="Enable auto-approval mode"
    )
    parser.add_argument(
        "--workspace-config",
        required=False,
        help="Optional explicit workspace config 'path:branch'"
    )

    args = parser.parse_args()

    # Convert string bool to actual bool
    yolo_mode = args.yolo_mode.lower() == "true"

    # Execute workspace setup
    result = setup_workspace(
        issue_number=args.issue_number,
        issue_title=args.issue_title,
        issue_body=args.issue_body,
        yolo_mode=yolo_mode,
        workspace_config=args.workspace_config
    )

    # Output JSON result
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
