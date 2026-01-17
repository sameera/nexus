#!/usr/bin/env python3
import argparse
import shutil
import sys
from pathlib import Path
from typing import List

# Default patterns to search for
DEFAULT_PATTERNS = [
    ".env",
    ".env.*",
    ".claude/settings.local.json",
    "*/.env",      # .env in immediate subfolders
    "*/.env.*"     # .env.* in immediate subfolders
]


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Copy essential local dev files (e.g., .env) between git worktrees/directories."
    )

    parser.add_argument(
        "other_path",
        type=Path,
        help="The path to the other worktree/directory to copy to or from."
    )

    parser.add_argument(
        "--mode",
        choices=["import", "export"],
        required=True,
        help="Direction of copy: 'import' (from OTHER to CURRENT) or 'export' (from CURRENT to OTHER)."
    )

    parser.add_argument(
        "--patterns",
        nargs="+",
        default=[],
        help="Additional glob patterns to search for (e.g., 'config/*.secret.json')."
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be copied without actually copying."
    )

    return parser.parse_args()


def main():
    args = parse_arguments()

    # Resolve paths
    current_path = Path.cwd()
    other_path = args.other_path.resolve()

    if not other_path.exists():
        print(f"Error: The path '{other_path}' does not exist.")
        sys.exit(1)

    # Determine Source and Destination based on mode
    if args.mode == "import":
        src_root = other_path
        dst_root = current_path
        direction_msg = f"Importing from {src_root} -> {dst_root}"
    else:  # export
        src_root = current_path
        dst_root = other_path
        direction_msg = f"Exporting from {src_root} -> {dst_root}"

    print(f"--- {direction_msg} ---")

    # Combine patterns
    patterns = DEFAULT_PATTERNS + args.patterns

    files_copied = 0
    files_skipped = 0

    # We use a set to avoid duplicates if patterns overlap
    files_to_process = set()

    for pattern in patterns:
        # glob is relative to the source root
        for src_file in src_root.glob(pattern):
            if src_file.is_file():
                # Get path relative to the source root to maintain structure
                rel_path = src_file.relative_to(src_root)
                files_to_process.add(rel_path)

    if not files_to_process:
        print("No matching files found in source.")
        return

    for rel_path in sorted(files_to_process):
        src_file = src_root / rel_path
        dst_file = dst_root / rel_path

        # Check if destination already exists
        if dst_file.exists():
            print(f"[SKIP] {rel_path} (already exists)")
            files_skipped += 1
            continue

        print(f"[COPY] {rel_path}")

        if not args.dry_run:
            try:
                # Ensure parent directory exists in destination
                dst_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_file, dst_file)
                files_copied += 1
            except Exception as e:
                print(f"  ERROR copying {rel_path}: {e}")

    print("-" * 30)
    if args.dry_run:
        print(f"Dry run complete. Found {len(files_to_process)} candidate(s).")
    else:
        print(f"Complete. Copied: {files_copied}, Skipped: {files_skipped}")


if __name__ == "__main__":
    main()
