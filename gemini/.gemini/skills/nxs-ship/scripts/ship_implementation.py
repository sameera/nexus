#!/usr/bin/env python3
"""Post-implementation shipping automation for nxs.dev command.

Handles the complete post-implementation workflow:
- Pre-commit review and git operations
- GitHub comment posting
- Closure eligibility evaluation
- Worktree cleanup

Supports YOLO mode for auto-approval and normal mode for user checkpoints.

Usage:
    python ship_implementation.py \\
        --workspace-path <path> \\
        --workspace-mode <worktree|in-place> \\
        --workspace-branch <branch> \\
        --issue-number <number> \\
        --issue-title <title> \\
        --agent-summary <summary-text> \\
        --tests-passed <true|false> \\
        --yolo-mode <true|false>

Output:
    JSON object with commit info, closure status, and checkpoint requirements
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple


def run_command(
    cmd: list[str],
    cwd: Optional[str] = None,
    check: bool = True
) -> subprocess.CompletedProcess:
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


def gather_changes(workspace_path: str) -> Tuple[str, str, int]:
    """Gather git status and diff information.

    Args:
        workspace_path: Path to workspace directory

    Returns:
        Tuple of (status_output, diff_stat, files_changed_count)
    """
    # Get git status
    status_result = run_command(
        ["git", "status", "--short"],
        cwd=workspace_path
    )
    status_output = status_result.stdout.strip()

    # Count changed files
    files_changed = len([line for line in status_output.split('\n') if line.strip()])

    # Get diff stat
    diff_result = run_command(
        ["git", "diff", "--stat"],
        cwd=workspace_path
    )
    diff_stat = diff_result.stdout.strip()

    return (status_output, diff_stat, files_changed)


def commit_changes(
    workspace_path: str,
    issue_number: str,
    issue_title: str
) -> str:
    """Stage and commit all changes.

    Args:
        workspace_path: Path to workspace directory
        issue_number: GitHub issue number
        issue_title: Issue title for commit message

    Returns:
        Short commit hash
    """
    # Stage all changes
    run_command(["git", "add", "-A"], cwd=workspace_path)

    # Create commit with issue reference
    commit_message = f"{issue_title}\n\nImplements #{issue_number}"
    run_command(
        ["git", "commit", "-m", commit_message],
        cwd=workspace_path
    )

    # Get commit hash
    hash_result = run_command(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=workspace_path
    )
    return hash_result.stdout.strip()


def post_github_comment(
    issue_number: str,
    agent_summary: str,
    branch_name: str,
    yolo_mode: bool
) -> str:
    """Post implementation summary to GitHub issue.

    Args:
        issue_number: GitHub issue number
        agent_summary: Implementation summary from agent
        branch_name: Git branch name
        yolo_mode: Whether YOLO mode was used

    Returns:
        URL of posted comment (or empty string if failed)
    """
    # Build comment body
    mode_tag = "YOLO mode" if yolo_mode else "Normal mode"
    footer = f"*Implemented via Claude Code ({mode_tag})*"

    comment_body = f"""## Implementation Summary

{agent_summary}

**Branch**: `{branch_name}`
**Mode**: {mode_tag}

---
{footer}"""

    try:
        # Post comment via gh CLI
        result = run_command([
            "gh", "issue", "comment", issue_number,
            "--body", comment_body
        ])

        # Get comment URL (gh doesn't return it, so construct it)
        # This is a best-effort URL construction
        repo_result = run_command(
            ["gh", "repo", "view", "--json", "url", "--jq", ".url"],
            check=False
        )

        if repo_result.returncode == 0:
            repo_url = repo_result.stdout.strip()
            return f"{repo_url}/issues/{issue_number}#issuecomment"

        return ""

    except RuntimeError as e:
        print(f"Warning: Failed to post GitHub comment: {e}", file=sys.stderr)
        return ""


def evaluate_closure(agent_summary: str, tests_passed: bool) -> Tuple[bool, List[str]]:
    """Evaluate whether issue can be closed automatically.

    Args:
        agent_summary: Implementation summary from agent
        tests_passed: Whether tests passed

    Returns:
        Tuple of (eligible, blockers) where blockers is list of reasons
    """
    blockers = []

    # Check test status
    if not tests_passed:
        blockers.append("Tests did not pass")

    # Check for explicit action items
    if "⚠️ REQUIRES ACTION:" in agent_summary:
        # Extract the action items section
        action_match = re.search(
            r'⚠️ REQUIRES ACTION:(.*?)(?=\n\n|\Z)',
            agent_summary,
            re.DOTALL
        )
        if action_match:
            action_items = action_match.group(1).strip()
            blockers.append(f"Action required: {action_items}")

    # Check for test failure mentions
    if re.search(r'\btest.*fail', agent_summary, re.IGNORECASE):
        if "Tests did not pass" not in blockers:
            blockers.append("Test failures mentioned in summary")

    # Check for blocker keywords
    blocker_patterns = [
        r'\bblocked\b',
        r'\bmanual.*(?:required|needed)\b',
        r'\bfollow-?up.*(?:required|needed)\b',
        r'\bpending\b.*\bresolution\b'
    ]

    for pattern in blocker_patterns:
        if re.search(pattern, agent_summary, re.IGNORECASE):
            match = re.search(pattern, agent_summary, re.IGNORECASE)
            context = agent_summary[max(0, match.start()-50):match.end()+50]
            blockers.append(f"Potential blocker found: ...{context}...")
            break  # Only report one pattern match to avoid duplicates

    eligible = len(blockers) == 0
    return (eligible, blockers)


def close_github_issue(issue_number: str) -> bool:
    """Close a GitHub issue as completed.

    Args:
        issue_number: GitHub issue number

    Returns:
        True if issue was closed successfully
    """
    try:
        run_command([
            "gh", "issue", "close", issue_number,
            "--reason", "completed"
        ])
        return True
    except RuntimeError as e:
        print(f"Warning: Failed to close issue: {e}", file=sys.stderr)
        return False


def cleanup_worktree(worktree_path: str) -> bool:
    """Remove a git worktree.

    Args:
        worktree_path: Path to worktree to remove

    Returns:
        True if worktree was removed successfully
    """
    try:
        run_command(["git", "worktree", "remove", worktree_path])
        return True
    except RuntimeError as e:
        print(f"Warning: Failed to remove worktree: {e}", file=sys.stderr)
        return False


def ship_implementation(
    workspace_path: str,
    workspace_mode: str,
    workspace_branch: str,
    issue_number: str,
    issue_title: str,
    agent_summary: str,
    tests_passed: bool,
    yolo_mode: bool
) -> Dict[str, Any]:
    """Main shipping workflow logic.

    Args:
        workspace_path: Path to workspace directory
        workspace_mode: "worktree" or "in-place"
        workspace_branch: Git branch name
        issue_number: GitHub issue number
        issue_title: Issue title
        agent_summary: Implementation summary from agent
        tests_passed: Whether tests passed
        yolo_mode: If True, auto-approve all checkpoints

    Returns:
        Dictionary with shipping results and checkpoint info
    """
    # Phase 1: Gather changes for pre-commit review
    status_output, diff_stat, files_changed = gather_changes(workspace_path)

    # Phase 2: Pre-commit review checkpoint or auto-commit
    if yolo_mode:
        # YOLO mode - auto-commit without review
        try:
            commit_hash = commit_changes(workspace_path, issue_number, issue_title)
        except RuntimeError as e:
            return {
                "commit_hash": None,
                "files_changed_count": files_changed,
                "issue_closed": False,
                "closure_blockers": [f"Commit failed: {str(e)}"],
                "worktree_action": "kept",
                "github_comment_url": "",
                "checkpoint_required": False,
                "checkpoint_data": {
                    "type": "error",
                    "message": f"Failed to commit changes: {str(e)}"
                }
            }
    else:
        # Normal mode - present pre-commit review checkpoint
        return {
            "commit_hash": None,
            "files_changed_count": files_changed,
            "issue_closed": False,
            "closure_blockers": [],
            "worktree_action": "pending",
            "github_comment_url": "",
            "checkpoint_required": True,
            "checkpoint_data": {
                "type": "pre_commit_review",
                "message": "Review changes before committing",
                "workspace_path": workspace_path,
                "workspace_branch": workspace_branch,
                "status_output": status_output,
                "diff_stat": diff_stat,
                "files_changed": files_changed
            }
        }

    # If we reach here, commit has been made (YOLO mode or after user approval)
    # Phase 3: Post GitHub comment
    comment_url = post_github_comment(
        issue_number,
        agent_summary,
        workspace_branch,
        yolo_mode
    )

    # Phase 4: Evaluate closure eligibility
    eligible, blockers = evaluate_closure(agent_summary, tests_passed)

    # Phase 5: Close issue if eligible
    issue_closed = False
    if eligible:
        issue_closed = close_github_issue(issue_number)

    # Phase 6: Worktree cleanup checkpoint or auto-keep
    worktree_action = "kept"  # Default for in-place mode
    checkpoint_required = False
    checkpoint_data = None

    if workspace_mode == "worktree":
        if yolo_mode:
            # YOLO mode - auto-keep worktree
            worktree_action = "kept"
        else:
            # Normal mode - present cleanup checkpoint
            checkpoint_required = True
            checkpoint_data = {
                "type": "worktree_cleanup",
                "message": "Implementation complete. Remove worktree?",
                "worktree_path": workspace_path,
                "workspace_branch": workspace_branch,
                "issue_closed": issue_closed
            }

    return {
        "commit_hash": commit_hash,
        "files_changed_count": files_changed,
        "issue_closed": issue_closed,
        "closure_blockers": blockers,
        "worktree_action": worktree_action,
        "github_comment_url": comment_url,
        "checkpoint_required": checkpoint_required,
        "checkpoint_data": checkpoint_data
    }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Ship implementation for GitHub issue"
    )
    parser.add_argument(
        "--workspace-path",
        required=True,
        help="Path to workspace directory"
    )
    parser.add_argument(
        "--workspace-mode",
        required=True,
        choices=["worktree", "in-place"],
        help="Workspace mode"
    )
    parser.add_argument(
        "--workspace-branch",
        required=True,
        help="Git branch name"
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
        "--agent-summary",
        required=True,
        help="Implementation summary from agent"
    )
    parser.add_argument(
        "--tests-passed",
        required=True,
        choices=["true", "false"],
        help="Whether tests passed"
    )
    parser.add_argument(
        "--yolo-mode",
        required=True,
        choices=["true", "false"],
        help="Enable auto-approval mode"
    )

    args = parser.parse_args()

    # Convert string bools to actual bools
    tests_passed = args.tests_passed.lower() == "true"
    yolo_mode = args.yolo_mode.lower() == "true"

    # Execute shipping workflow
    result = ship_implementation(
        workspace_path=args.workspace_path,
        workspace_mode=args.workspace_mode,
        workspace_branch=args.workspace_branch,
        issue_number=args.issue_number,
        issue_title=args.issue_title,
        agent_summary=args.agent_summary,
        tests_passed=tests_passed,
        yolo_mode=yolo_mode
    )

    # Output JSON result
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
