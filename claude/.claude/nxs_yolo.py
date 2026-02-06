#!/usr/bin/env python3
"""
nxs_yolo.py - Streamlined YOLO mode for issue implementation

Converts GitHub issues into implemented code through automated worktree management,
environment syncing, and Claude-powered development.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# Colors for terminal output
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    NC = "\033[0m"  # No Color


def die(message: str) -> None:
    """Print error message and exit."""
    print(f"{Colors.RED}Error: {message}{Colors.NC}", file=sys.stderr)
    sys.exit(1)


def info(message: str) -> None:
    """Print info message."""
    print(f"{Colors.BLUE}→{Colors.NC} {message}")


def success(message: str) -> None:
    """Print success message."""
    print(f"{Colors.GREEN}✓{Colors.NC} {message}")


def warn(message: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠{Colors.NC} {message}")


def header(message: str) -> None:
    """Print header message."""
    print()
    print(f"{Colors.CYAN}═══════════════════════════════════════════════════════════{Colors.NC}")
    print(f"{Colors.CYAN}  {message}{Colors.NC}")
    print(f"{Colors.CYAN}═══════════════════════════════════════════════════════════{Colors.NC}")
    print()


def run_command(
    cmd: list[str],
    capture_output: bool = True,
    check: bool = True,
    cwd: Optional[Path] = None,
) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture_output,
            text=True,
            check=check,
            cwd=cwd,
        )
        return result
    except subprocess.CalledProcessError as e:
        if check:
            die(f"Command failed: {' '.join(cmd)}\n{e.stderr}")
        raise


def get_repo_root() -> Path:
    """Get the git repository root."""
    result = run_command(["git", "rev-parse", "--show-toplevel"])
    return Path(result.stdout.strip())


# ------------------------------------------------------------------------------
# State Management
# ------------------------------------------------------------------------------


@dataclass
class YoloState:
    """State tracking for YOLO batch processing."""

    original_args: str
    start_issue: int
    end_issue: int
    current_issue: int
    last_success: Optional[int]
    started_at: str
    status: str


class StateManager:
    """Manages persistent state for batch processing."""

    def __init__(self, repo_root: Path):
        self.state_file = repo_root / ".tmp" / "nxs_yolo_state.json"

    def init_state(self, original_args: str, start_issue: int, end_issue: int) -> None:
        """Initialize state for a new batch run."""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)

        state = {
            "original_args": original_args,
            "start_issue": start_issue,
            "end_issue": end_issue,
            "current_issue": start_issue,
            "last_success": None,
            "started_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "status": "in_progress",
        }

        self.state_file.write_text(json.dumps(state, indent=4))
        info(f"State initialized: issues #{start_issue}-#{end_issue}")

    def update_current(self, issue_number: int) -> None:
        """Update the current issue being processed."""
        if not self.state_file.exists():
            return

        state = json.loads(self.state_file.read_text())
        state["current_issue"] = issue_number
        self.state_file.write_text(json.dumps(state, indent=4))

    def update_success(self, issue_number: int) -> None:
        """Mark an issue as successfully completed."""
        if not self.state_file.exists():
            return

        state = json.loads(self.state_file.read_text())
        state["last_success"] = issue_number
        self.state_file.write_text(json.dumps(state, indent=4))

    def complete(self) -> None:
        """Mark the batch as completed."""
        if not self.state_file.exists():
            return

        state = json.loads(self.state_file.read_text())
        state["status"] = "completed"
        self.state_file.write_text(json.dumps(state, indent=4))
        success("State marked as completed")

    def read_state(self) -> YoloState:
        """Read and return the current state."""
        if not self.state_file.exists():
            die("No state file found. Nothing to resume.")

        state = json.loads(self.state_file.read_text())

        if state["status"] == "completed":
            die("Previous run completed successfully. Nothing to resume.")

        info(f"Loaded state: resuming from issue #{state['current_issue']}")
        info(f"Original range: #{state['start_issue']}-#{state['end_issue']}")
        if state["last_success"] is not None:
            info(f"Last successful: #{state['last_success']}")

        return YoloState(
            original_args=state["original_args"],
            start_issue=state["start_issue"],
            end_issue=state["end_issue"],
            current_issue=state["current_issue"],
            last_success=state["last_success"],
            started_at=state["started_at"],
            status=state["status"],
        )

    def clear(self) -> None:
        """Clear the state file."""
        if self.state_file.exists():
            self.state_file.unlink()
            info("State file cleared")


# ------------------------------------------------------------------------------
# Workspace Management
# ------------------------------------------------------------------------------


class WorkspaceManager:
    """Manages git worktrees and workspace setup."""

    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.setup_script = (
            repo_root
            / ".claude"
            / "skills"
            / "nxs-workspace-setup"
            / "scripts"
            / "setup_workspace.py"
        )

    def setup_from_issue(
        self, issue_number: int, issue_title: str, issue_body: str
    ) -> dict:
        """Set up workspace for an issue using the workspace setup script."""
        if not self.setup_script.exists():
            die(f"Workspace setup script not found: {self.setup_script}")

        result = run_command(
            [
                "python3",
                str(self.setup_script),
                "--issue-number",
                str(issue_number),
                "--issue-title",
                issue_title,
                "--issue-body",
                issue_body,
                "--yolo-mode",
                "true",
            ],
            check=False,
        )

        if result.returncode != 0:
            die(f"Workspace setup script failed: {result.stderr}")

        workspace_result = json.loads(result.stdout)
        action_taken = workspace_result.get("action_taken")

        workspace_path = workspace_result.get("workspace_path")
        workspace_branch = workspace_result.get("workspace_branch")

        if action_taken == "reused":
            warn(f"Reusing existing worktree at {workspace_path}")
        elif action_taken == "created":
            success(f"Created worktree at {workspace_path} (branch: {workspace_branch})")
        elif action_taken == "skipped":
            info(f"Already on feature branch {workspace_branch}, using current directory")
            workspace_result["workspace_path"] = str(Path.cwd())
        elif action_taken == "conflict":
            conflict_msg = workspace_result.get("checkpoint_data", {}).get("message", "Unknown conflict")
            die(f"Branch conflict: {conflict_msg}. Please resolve manually.")
        elif action_taken == "error":
            error_msg = workspace_result.get("checkpoint_data", {}).get("message", "Unknown error")
            die(f"Workspace setup failed: {error_msg}")
        else:
            die(f"Unexpected action_taken: {action_taken}")

        return workspace_result

    def revert_worktree(self, worktree_path: Path) -> None:
        """Revert worktree to last commit (clean slate)."""
        if not worktree_path.exists():
            warn("Worktree does not exist, will be created fresh")
            return

        info("Reverting worktree to last commit (clean slate)...")

        # Discard all uncommitted changes
        run_command(["git", "checkout", "--", "."], cwd=worktree_path, check=False)
        run_command(["git", "clean", "-fd"], cwd=worktree_path, check=False)

        success("Worktree reverted to clean state")

    def _detect_package_manager(self, worktree_path: Path) -> str:
        """Detect the package manager used by the project."""
        if (worktree_path / "pnpm-lock.yaml").exists():
            return "pnpm"
        return "npm"

    def sync_environment(self, worktree_path: Path) -> None:
        """Sync environment in the worktree."""
        info(f"Syncing environment in {worktree_path}...")

        # Ensure .tmp is gitignored
        gitignore = worktree_path / ".gitignore"
        if gitignore.exists():
            content = gitignore.read_text()
            if ".tmp/" not in content:
                with gitignore.open("a") as f:
                    f.write("\n.tmp/\n")

        # Check for package.json and run the appropriate package manager
        package_json = worktree_path / "package.json"
        if package_json.exists():
            pm = self._detect_package_manager(worktree_path)
            if pm == "pnpm":
                run_command(["pnpm", "install", "--silent"], cwd=worktree_path)
            else:
                run_command(["npm", "install", "--silent"], cwd=worktree_path)
            success(f"{pm} dependencies installed")

        # Check for .env.example and create .env if needed
        env_example = worktree_path / ".env.example"
        env_file = worktree_path / ".env"
        if env_example.exists() and not env_file.exists():
            env_file.write_text(env_example.read_text())
            success("Created .env from .env.example")

    def cleanup_worktree(self, worktree_path: Path, keep: bool = False) -> None:
        """Clean up the worktree."""
        if keep:
            info(f"Keeping worktree at {worktree_path}")
            return

        info("Cleaning up worktree...")
        run_command(
            ["git", "worktree", "remove", str(worktree_path), "--force"],
            check=False,
        )
        success("Worktree removed")


# ------------------------------------------------------------------------------
# GitHub Integration
# ------------------------------------------------------------------------------


class GitHubManager:
    """Manages GitHub issue interactions."""

    def fetch_issue(self, issue_number: int) -> dict:
        """Fetch issue details from GitHub."""
        result = run_command(
            ["gh", "issue", "view", str(issue_number), "--json", "number,title,body,url,state"],
            check=False,
        )

        if result.returncode != 0:
            die(f"Failed to fetch issue #{issue_number}")

        issue_json = json.loads(result.stdout)

        # Check if issue is closed
        if issue_json.get("state") == "CLOSED":
            warn(f"Issue #{issue_number} is already CLOSED")
            response = input("Continue anyway? [y/N] ")
            if response.lower() != "y":
                die("Aborted by user")

        return issue_json

    def commit_and_close(
        self,
        worktree_path: Path,
        issue_number: int,
        issue_title: str,
        branch_name: str,
    ) -> Optional[str]:
        """Commit changes and close the issue."""
        info("Staging changes...")
        run_command(["git", "add", "-A"], cwd=worktree_path)

        # Check if there are changes to commit
        result = run_command(
            ["git", "diff", "--cached", "--quiet"],
            cwd=worktree_path,
            check=False,
        )
        if result.returncode == 0:
            warn("No changes to commit")
            return None

        info("Committing changes...")
        commit_msg = f"feat: implement #{issue_number} - {issue_title}"
        run_command(["git", "commit", "-m", commit_msg], cwd=worktree_path)

        # Get commit hash
        result = run_command(["git", "rev-parse", "--short", "HEAD"], cwd=worktree_path)
        commit_hash = result.stdout.strip()
        success(f"Committed: {commit_hash}")

        # Get changed files
        result = run_command(
            ["git", "diff", "--name-only", "HEAD~1"],
            cwd=worktree_path,
        )
        changed_files = "\n".join(f"- {f}" for f in result.stdout.strip().split("\n") if f)

        # Post implementation comment
        info("Posting implementation summary to GitHub...")
        comment = f"""## Implementation Complete

Implemented in commit `{commit_hash}` on branch `{branch_name}`.

### Changes
{changed_files}

---
*Automated via nxs.yolo.sh*"""

        run_command(["gh", "issue", "comment", str(issue_number), "--body", comment])
        success(f"Posted comment to issue #{issue_number}")

        # Close the issue
        info(f"Closing issue #{issue_number}...")
        run_command(["gh", "issue", "close", str(issue_number)])
        success(f"Issue #{issue_number} closed")

        return commit_hash


# ------------------------------------------------------------------------------
# Main Processing
# ------------------------------------------------------------------------------


class YoloProcessor:
    """Main processor for YOLO mode."""

    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.state_manager = StateManager(repo_root)
        self.workspace_manager = WorkspaceManager(repo_root)
        self.github_manager = GitHubManager()

    def process_issue(self, issue_number: int, is_resume: bool = False) -> None:
        """Process a single issue."""
        header(f"Processing Issue #{issue_number}")

        # Update state: mark current issue
        self.state_manager.update_current(issue_number)

        # Phase 1: Fetch issue
        info(f"Fetching issue #{issue_number}...")
        issue_json = self.github_manager.fetch_issue(issue_number)

        issue_title = issue_json["title"]
        issue_body = issue_json["body"] or ""
        issue_url = issue_json["url"]

        success(f"Fetched: {issue_title}")

        # Phase 2: Create or revert worktree using workspace setup script
        if is_resume:
            info("Resuming workspace...")
            workspace_result = self.workspace_manager.setup_from_issue(
                issue_number, issue_title, issue_body
            )
            worktree_path = Path(workspace_result["workspace_path"])
            branch_name = workspace_result["workspace_branch"]
            self.workspace_manager.revert_worktree(worktree_path)
        else:
            info("Setting up workspace...")
            workspace_result = self.workspace_manager.setup_from_issue(
                issue_number, issue_title, issue_body
            )
            worktree_path = Path(workspace_result["workspace_path"])
            branch_name = workspace_result["workspace_branch"]

        success(f"Workspace ready: {worktree_path} (branch: {branch_name})")

        # Phase 3: Sync environment
        self.workspace_manager.sync_environment(worktree_path)

        # Phase 4: Write context file for the command
        tmp_dir = worktree_path / ".tmp"
        context_filename = f"nxs_yolo_{issue_number}.md"
        context_file = tmp_dir / context_filename

        tmp_dir.mkdir(parents=True, exist_ok=True)
        context_file.write_text(f"""# YOLO Context

## Workspace
- **Path**: `{worktree_path}`
- **Branch**: `{branch_name}`
- **Issue**: #{issue_number}

## GitHub Issue #{issue_number}: {issue_title}

**URL**: {issue_url}

### Description

{issue_body}
""")

        success(f"Context written to {context_file}")

        # Phase 5: Invoke the streamlined YOLO command
        header(f"Invoking /nxs.yolo.dev {context_filename}")

        # Run command from worktree directory, passing context filename
        result = subprocess.run(
            ["claude", "-p", f"/nxs.yolo.dev {context_filename}", "--dangerously-skip-permissions"],
            cwd=worktree_path,
        )

        if result.returncode != 0:
            die(f"Implementation failed for issue #{issue_number}")

        # Phase 6: Commit and close
        header("Shipping Implementation")
        self.github_manager.commit_and_close(worktree_path, issue_number, issue_title, branch_name)

        # Update state: mark success
        self.state_manager.update_success(issue_number)

        # Phase 7: Cleanup (keep worktree by default in YOLO for inspection)
        self.workspace_manager.cleanup_worktree(worktree_path, keep=True)

        success(f"Issue #{issue_number} complete!")

    def run_batch(
        self,
        start: int,
        end: int,
        resume_from: Optional[int] = None,
        is_resume: bool = False,
    ) -> None:
        """Run batch processing of issues."""
        if resume_from is None:
            resume_from = start

        total = end - start + 1

        for i in range(resume_from, end + 1):
            position = i - start + 1
            print()
            print(f"{Colors.YELLOW}[{position}/{total}]{Colors.NC}")

            # Only pass is_resume for the first issue in a resume operation
            if is_resume and i == resume_from:
                self.process_issue(i, is_resume=True)
            else:
                self.process_issue(i, is_resume=False)

            print()


# ------------------------------------------------------------------------------
# CLI Entry Point
# ------------------------------------------------------------------------------


def validate_environment() -> None:
    """Validate that we have all required tools."""
    # Validate we're in a git repo
    result = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        die("Not in a git repository")

    # Validate gh CLI is available and authenticated
    if subprocess.run(["which", "gh"], capture_output=True).returncode != 0:
        die("GitHub CLI (gh) is not installed")

    result = subprocess.run(["gh", "auth", "status"], capture_output=True)
    if result.returncode != 0:
        die("GitHub CLI is not authenticated. Run: gh auth login")

    # Validate claude CLI is available
    if subprocess.run(["which", "claude"], capture_output=True).returncode != 0:
        die("Claude CLI is not installed")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Streamlined YOLO mode for issue implementation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s 123          Process single issue #123
    %(prog)s 42-45        Process issues #42 through #45 sequentially
    %(prog)s --resume     Resume interrupted batch processing

Workflow:
    1. Creates dedicated worktree for the issue
    2. Syncs environment (npm install, etc.)
    3. Invokes streamlined nxs.yolo.dev command
    4. Commits changes and closes issue on success
    5. Cleans up worktree

Resume behavior:
    - Reverts failed issue's worktree to last commit (clean slate)
    - Continues from failed issue through end of original range
    - State is tracked in .tmp/nxs_yolo_state.json

Note: Technical decisions and conflicts still require user input.
""",
    )

    parser.add_argument(
        "issue",
        nargs="?",
        help="Issue number (e.g., 123) or range (e.g., 42-45)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last failed issue in a previous run",
    )

    return parser.parse_args()


def main() -> None:
    """Main entry point."""
    args = parse_args()

    # Validate environment
    validate_environment()

    repo_root = get_repo_root()
    processor = YoloProcessor(repo_root)

    if args.resume:
        # Resume mode
        header("Resuming Previous Run")

        state = processor.state_manager.read_state()
        processor.run_batch(
            state.start_issue,
            state.end_issue,
            resume_from=state.current_issue,
            is_resume=True,
        )
        processor.state_manager.complete()
        header(f"Batch Complete: Resumed and finished #{state.current_issue}-#{state.end_issue}")

    elif args.issue is None:
        die("No issue specified. Use --help for usage information.")

    elif match := re.match(r"^(\d+)-(\d+)$", args.issue):
        # Range mode
        start = int(match.group(1))
        end = int(match.group(2))

        if start > end:
            die(f"Start ({start}) cannot be greater than end ({end})")

        total = end - start + 1

        # Initialize state tracking
        processor.state_manager.init_state(args.issue, start, end)

        header(f"Processing {total} Issues: #{start} through #{end}")
        processor.run_batch(start, end)
        processor.state_manager.complete()
        header(f"Batch Complete: {total} Issues Processed")

    elif match := re.match(r"^#?(\d+)$", args.issue):
        # Single issue mode (strip optional # prefix)
        issue_number = int(match.group(1))

        # Initialize state for single issue (allows resume even for single)
        processor.state_manager.init_state(str(issue_number), issue_number, issue_number)

        processor.process_issue(issue_number)
        processor.state_manager.complete()

    else:
        die("Invalid format. Expected: <number>, <start>-<end>, or --resume")


if __name__ == "__main__":
    main()
