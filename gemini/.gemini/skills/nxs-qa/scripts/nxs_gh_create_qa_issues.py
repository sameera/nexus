#!/usr/bin/env python3
"""
nxs_gh_create_qa_issues.py

Creates GitHub issues for QA test cases from structured JSON input,
then writes qa_issues.json with the created issue metadata.

Usage:
    python nxs_gh_create_qa_issues.py <specs.json> [--dry-run]

Input JSON schema:
{
    "epic_number": 42,
    "epic_folder": "docs/features/login/01-org-resolution",
    "issues": [
        {
            "title": "QA: Happy path — single-org auto-select",
            "body": "## Test Case: Happy path..."
        }
    ]
}

Output:
    Writes <epic_folder>/qa_issues.json with created issue metadata.
    Prints JSON summary to stdout.

Prerequisites:
    - GitHub CLI (gh) must be installed and authenticated
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


# ---------------------------------------------------------------------------
# Shared utilities (mirrors pattern from nxs_gh_create_epic.py)
# ---------------------------------------------------------------------------

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
    """Read delivery config from config.yml (preferred) or config.json (fallback).

    Returns a normalized dict with keys: docRoot, project, epicType, issuesRepo.
    """
    delivery_dir = project_root / "docs" / "system" / "delivery"

    yml_path = delivery_dir / "config.yml"
    if yml_path.exists():
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
            if isinstance(data.get("github"), dict):
                if data["github"].get("issues-repo"):
                    data["issuesRepo"] = data["github"]["issues-repo"]
            return data
        except (json.JSONDecodeError, OSError):
            pass

    return {}


def find_project_root(start_path: Path) -> Path:
    """Find the project root by looking for CLAUDE.md or .git."""
    current = start_path.resolve()
    while current != current.parent:
        if (current / "CLAUDE.md").exists() or (current / ".git").exists():
            return current
        current = current.parent
    return Path.cwd()


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"


def error(msg: str) -> None:
    print(f"{Colors.RED}❌ {msg}{Colors.NC}", file=sys.stderr)


def success(msg: str) -> None:
    print(f"{Colors.GREEN}✅ {msg}{Colors.NC}")


def warn(msg: str) -> None:
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.NC}")


# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

def run_command(cmd: list[str], capture_output: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=capture_output, text=True)


def check_prerequisites() -> bool:
    if not shutil.which("gh"):
        error("GitHub CLI (gh) is not installed")
        print("Install with: brew install gh (macOS) or see https://cli.github.com")
        return False

    result = run_command(["gh", "auth", "status"])
    if result.returncode != 0:
        error("Not authenticated with GitHub CLI")
        print("Run: gh auth login")
        return False

    result = run_command(["git", "rev-parse", "--is-inside-work-tree"])
    if result.returncode != 0:
        error("Not in a git repository")
        return False

    return True


# ---------------------------------------------------------------------------
# GitHub issue creation
# ---------------------------------------------------------------------------

def create_github_issue(
    title: str,
    body_file: Path,
    label: str = "qa-test-case",
    repo: str | None = None,
) -> tuple[str, str]:
    """Create a GitHub issue and return (issue_url, issue_number).

    Raises RuntimeError on failure.
    """
    cmd = [
        "gh", "issue", "create",
        "--title", title,
        "--body-file", str(body_file),
        "--label", label,
    ]
    if repo:
        cmd.extend(["-R", repo])

    result = run_command(cmd)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to create issue '{title}': {result.stderr.strip()}")

    issue_url = result.stdout.strip()

    match = re.search(r"/issues/(\d+)$", issue_url) or re.search(r"(\d+)$", issue_url)
    if not match:
        raise RuntimeError(f"Could not extract issue number from: {issue_url}")

    return issue_url, match.group(1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create GitHub QA test case issues from structured JSON input"
    )
    parser.add_argument(
        "specs_json",
        type=Path,
        help="Path to JSON file containing epic metadata and issues array",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be created without calling the GitHub API",
    )
    parser.add_argument(
        "--label",
        type=str,
        default="qa-test-case",
        help="GitHub label to apply to all created issues (default: qa-test-case)",
    )

    args = parser.parse_args()
    specs_path: Path = args.specs_json

    if not specs_path.is_file():
        error(f"Specs file not found: {specs_path}")
        return 1

    # Parse input JSON
    try:
        with open(specs_path, encoding="utf-8") as f:
            input_data = json.load(f)
    except json.JSONDecodeError as e:
        error(f"Invalid JSON in specs file: {e}")
        return 1

    # Validate required fields
    required = ["epic_number", "epic_folder", "issues"]
    missing = [k for k in required if k not in input_data]
    if missing:
        error(f"Missing required fields in input: {missing}")
        return 1

    epic_number: int = input_data["epic_number"]
    epic_folder = Path(input_data["epic_folder"])
    issues: list[dict] = input_data["issues"]

    if not issues:
        error("No issues found in input data")
        return 1

    # Validate each issue has required fields and non-empty content
    for i, issue in enumerate(issues, 1):
        if not issue.get("title", "").strip():
            error(f"Issue {i}: missing or empty title")
            return 1
        if not issue.get("body", "").strip():
            error(f"Issue {i} ('{issue['title']}'): missing or empty body")
            return 1

    # Resolve project root and issues-repo config
    project_root = find_project_root(specs_path)
    config = read_delivery_config(project_root)
    issues_repo: str | None = config.get("issuesRepo") or None
    if issues_repo:
        print(f"📦 Issues repo (from config): {issues_repo}")

    # Make epic_folder absolute if relative
    if not epic_folder.is_absolute():
        epic_folder = project_root / epic_folder

    print(f"📋 Epic: #{epic_number}")
    print(f"📁 Epic folder: {epic_folder}")
    print(f"🧪 Issues to create: {len(issues)}")

    if args.dry_run:
        print("\n[DRY RUN] Would create the following issues:\n")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue['title']}")
        print(f"\n  Output: {epic_folder}/qa_issues.json")
        print(json.dumps({"status": "dry-run", "issues_would_create": len(issues)}, indent=2))
        return 0

    if not check_prerequisites():
        return 1

    # Ensure the label exists (create if missing)
    label_result = run_command(["gh", "label", "list", "--json", "name", "--jq", f'.[].name | select(. == "{args.label}")'])
    if label_result.returncode == 0 and not label_result.stdout.strip():
        warn(f"Label '{args.label}' not found in repository — attempting to create...")
        create_label = run_command(["gh", "label", "create", args.label, "--color", "0075ca", "--description", "QA test case specification"])
        if create_label.returncode != 0:
            warn(f"Could not create label '{args.label}': {create_label.stderr.strip()}")
            warn(f"Please create manually: gh label create '{args.label}' --color '#0075ca'")
        else:
            print(f"📌 Created label: {args.label}")
    elif label_result.returncode != 0:
        warn(f"Could not verify label '{args.label}': {label_result.stderr.strip()}")

    created: list[dict] = []
    failed: list[str] = []

    for i, issue in enumerate(issues, 1):
        title = issue.get("title", "").strip()
        body = issue.get("body", "").strip()

        if not title:
            warn(f"Issue {i}: missing title, skipping")
            failed.append(f"Issue {i}: missing title")
            continue

        print(f"  [{i}/{len(issues)}] Creating: {title}")

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as tmp:
            tmp.write(body)
            temp_file = Path(tmp.name)

        try:
            issue_url, issue_number = create_github_issue(
                title=title,
                body_file=temp_file,
                label=args.label,
                repo=issues_repo,
            )
            created.append({
                "number": int(issue_number),
                "title": title,
                "url": issue_url,
            })
            print(f"         ✓ #{issue_number}")
        except RuntimeError as e:
            warn(str(e))
            failed.append(title)
        finally:
            temp_file.unlink(missing_ok=True)

    if not created:
        error("No issues were created successfully")
        return 1

    # Write qa_issues.json
    epic_folder.mkdir(parents=True, exist_ok=True)
    qa_issues_path = epic_folder / "qa_issues.json"
    with open(qa_issues_path, "w", encoding="utf-8") as f:
        json.dump(created, f, indent=2)

    # Summary
    print()
    success(f"{len(created)} QA issue(s) created")
    if failed:
        warn(f"{len(failed)} issue(s) failed: {failed}")
    print(f"   Metadata: {qa_issues_path.as_posix()}")  # Normalize path for consistent output
    print()

    result = {
        "status": "success" if not failed else "partial",
        "issues_created": len(created),
        "issues_failed": len(failed),
        "qa_issues_file": str(qa_issues_path),
        "issues": created,
    }
    print(json.dumps(result, indent=2))
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
