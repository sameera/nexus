#!/usr/bin/env python3
"""
Create GitHub issues from TASK-???.md files in a target folder.

Extracts frontmatter (title, label, parent), creates GitHub issues,
and assigns parent issues using gh CLI.
"""

import argparse
import glob
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
    
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            yaml_content = parts[1].strip()
            body = parts[2].strip()
            
            for line in yaml_content.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip()
                    
                    # Handle array format [item1, item2, ...]
                    if value.startswith('[') and value.endswith(']'):
                        array_content = value[1:-1]
                        items = [item.strip().strip('"').strip("'") for item in array_content.split(',')]
                        frontmatter[key] = [item for item in items if item]
                    else:
                        frontmatter[key] = value.strip('"').strip("'")
    
    return frontmatter, body


def find_task_files(target_folder: str) -> list[Path]:
    """Find all TASK-???.md files in the target folder."""
    pattern = os.path.join(target_folder, 'TASK-???.md')
    files = glob.glob(pattern)
    return sorted([Path(f) for f in files])


def create_github_issue(title: str, labels: list[str], body_file: str) -> str | None:
    """Create a GitHub issue using gh CLI.
    
    Returns:
        The issue URL if successful, None otherwise.
    """
    cmd = ['gh', 'issue', 'create', '--title', title, '--body-file', body_file]
    
    for label in labels:
        cmd.extend(['--label', label])
    
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
    match = re.search(r'/issues/(\d+)$', issue_url)
    if match:
        return match.group(1)
    return None


def assign_parent_issue(child_issue_number: str, parent_issue_ref: str) -> bool:
    """Assign a parent issue to a child issue using gh api.
    
    Note: GitHub doesn't have native parent-child relationships for issues.
    This adds a comment linking to the parent issue.
    """
    # Extract parent issue number if it's a URL or #number format
    parent_number = parent_issue_ref
    if parent_issue_ref.startswith('#'):
        parent_number = parent_issue_ref[1:]
    elif '/issues/' in parent_issue_ref:
        match = re.search(r'/issues/(\d+)', parent_issue_ref)
        if match:
            parent_number = match.group(1)
    
    # Add a comment to the child issue referencing the parent
    comment_body = f"Parent issue: #{parent_number}"
    
    cmd = [
        'gh', 'api',
        '-X', 'POST',
        f'/repos/{{owner}}/{{repo}}/issues/{child_issue_number}/comments',
        '-f', f'body={comment_body}'
    ]
    
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error assigning parent issue: {e.stderr}", file=sys.stderr)
        return False


def process_task_file(task_file: Path) -> bool:
    """Process a single TASK file and create a GitHub issue.
    
    Returns:
        True if successful, False otherwise.
    """
    print(f"Processing: {task_file}")
    
    content = task_file.read_text()
    frontmatter, body = parse_frontmatter(content)
    
    title = frontmatter.get('title', '')
    labels = frontmatter.get('labels', [])
    parent = frontmatter.get('parent', '')
    
    # Ensure labels is a list
    if isinstance(labels, str):
        labels = [labels] if labels else []
    
    if not title:
        print(f"  Warning: No title in frontmatter, using filename", file=sys.stderr)
        title = task_file.stem
    
    # Create temporary file with body content (without frontmatter)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as tmp:
        tmp.write(body)
        tmp_path = tmp.name
    
    try:
        # Create the GitHub issue
        issue_url = create_github_issue(title, labels, tmp_path)
        
        if not issue_url:
            print(f"  Failed to create issue for {task_file}", file=sys.stderr)
            return False
        
        print(f"  Created issue: {issue_url}")
        
        # If there's a parent, assign it
        if parent:
            issue_number = extract_issue_number(issue_url)
            if issue_number:
                if assign_parent_issue(issue_number, parent):
                    print(f"  Linked to parent: {parent}")
                else:
                    print(f"  Warning: Failed to link parent issue", file=sys.stderr)
        
        return True
        
    finally:
        # Clean up temporary file
        os.unlink(tmp_path)


def main():
    parser = argparse.ArgumentParser(
        description='Create GitHub issues from TASK-???.md files'
    )
    parser.add_argument(
        'target_folder',
        help='Folder containing TASK-???.md files'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without creating issues'
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
    
    if args.dry_run:
        print("\nDry run - would process:")
        for f in task_files:
            content = f.read_text()
            fm, _ = parse_frontmatter(content)
            labels = fm.get('labels', [])
            if isinstance(labels, str):
                labels = [labels] if labels else []
            print(f"  {f.name}: title='{fm.get('title', 'N/A')}', labels={labels}, parent='{fm.get('parent', 'N/A')}'")
        sys.exit(0)
    
    success_count = 0
    for task_file in task_files:
        if process_task_file(task_file):
            success_count += 1
    
    print(f"\nProcessed {success_count}/{len(task_files)} task files successfully")
    
    if success_count < len(task_files):
        sys.exit(1)


if __name__ == '__main__':
    main()