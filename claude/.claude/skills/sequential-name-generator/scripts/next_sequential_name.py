#!/usr/bin/env python3
"""Generate the next sequential file or folder name given a path and target name.

Usage:
    python next_sequential_name.py <path> <target_name>

Arguments:
    path        - Directory path to scan for existing sequential files/folders
    target_name - The unnumbered target name (e.g., "cleanup.md" or "chapter")

Output:
    Prints the generated sequential name (e.g., "05-cleanup.md")

Examples:
    # For files (has extension)
    python next_sequential_name.py ./docs cleanup.md
    # Output: 05-cleanup.md (if 01-setup.md, 02-init.md, 04-teardown.md exist)

    # For folders (no extension)
    python next_sequential_name.py ./chapters chapter
    # Output: 03-chapter (if 01-chapter, 02-chapter exist)
"""

import os
import re
import sys
from pathlib import Path


def has_extension(name: str) -> bool:
    """Determine if a name has a file extension."""
    return '.' in name and not name.startswith('.')


def get_numbered_prefix(name: str) -> int | None:
    """Extract the numeric prefix from a name like '01-setup.md' or '05-chapter'.
    
    Returns the number or None if no valid prefix found.
    """
    match = re.match(r'^(\d+)-', name)
    if match:
        return int(match.group(1))
    return None


def find_highest_prefix(path: Path, is_file: bool) -> int:
    """Find the highest numbered prefix among files or folders at the given path.
    
    Args:
        path: Directory to scan
        is_file: True to scan files, False to scan folders
    
    Returns:
        The highest numbered prefix found, or 0 if none found.
    """
    if not path.exists() or not path.is_dir():
        return 0
    
    highest = 0
    for item in path.iterdir():
        # Check if item is the correct type (file or directory)
        if is_file and not item.is_file():
            continue
        if not is_file and not item.is_dir():
            continue
        
        prefix = get_numbered_prefix(item.name)
        if prefix is not None and prefix > highest:
            highest = prefix
    
    return highest


def generate_sequential_name(path: str, target_name: str) -> str:
    """Generate the next sequential file or folder name.
    
    Args:
        path: Directory path to scan
        target_name: The unnumbered target name (e.g., "cleanup.md" or "chapter")
    
    Returns:
        The generated name with sequential prefix (e.g., "05-cleanup.md")
    """
    directory = Path(path)
    is_file = has_extension(target_name)
    
    highest = find_highest_prefix(directory, is_file)
    next_number = highest + 1
    
    # Pad to 2 digits minimum
    prefix = f"{next_number:02d}"
    
    return f"{prefix}-{target_name}"


def main():
    if len(sys.argv) != 3:
        print("Usage: python next_sequential_name.py <path> <target_name>", file=sys.stderr)
        print("Example: python next_sequential_name.py ./docs cleanup.md", file=sys.stderr)
        sys.exit(1)
    
    path = sys.argv[1]
    target_name = sys.argv[2]
    
    result = generate_sequential_name(path, target_name)
    print(result)


if __name__ == "__main__":
    main()