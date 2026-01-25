#!/bin/bash

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

usage() {
    cat <<EOF
nxs.yolo.sh - Run /nxs.dev in YOLO mode (auto-approve all checkpoints)

Usage: $SCRIPT_NAME <issue-number>
   or: $SCRIPT_NAME <start>-<end>

Arguments:
    issue-number    Single GitHub issue number (e.g., 123)
    start-end       Range of issues to process (e.g., 42-45)

Examples:
    $SCRIPT_NAME 123          Process single issue #123
    $SCRIPT_NAME 42-45        Process issues #42 through #45 sequentially

Note: In YOLO mode, all workspace setup, environment sync, chunk
      progression, and commit checkpoints are auto-approved.
      Technical decisions still require user input.
EOF
}

die() {
    echo "Error: $1" >&2
    exit 1
}

# Handle help flag
for arg in "$@"; do
    case "$arg" in
        -h|--help)
            usage
            exit 0
            ;;
    esac
done

# Validate input
args="$@"
if [ -z "$args" ]; then
    usage >&2
    exit 1
fi

# Parse argument: range vs single issue
if [[ "$args" =~ ^([0-9]+)-([0-9]+)$ ]]; then
    # Range mode
    START="${BASH_REMATCH[1]}"
    END="${BASH_REMATCH[2]}"

    # Validate range
    if [[ "$START" -gt "$END" ]]; then
        die "Start ($START) cannot be greater than end ($END)"
    fi

    # Calculate total
    TOTAL=$((END - START + 1))

    echo "=========================================="
    echo "Processing $TOTAL issues: #$START through #$END"
    echo "=========================================="
    echo ""

    # Execute range
    for ((i = START; i <= END; i++)); do
        echo "=========================================="
        echo "[$((i - START + 1))/$TOTAL] Processing issue #$i..."
        echo "=========================================="

        # Execute with output visible (no redirection)
        # Exit immediately on failure
        claude -p "/nxs.dev --yolo $i" --dangerously-skip-permissions || exit 1

        echo ""
    done

    # All issues completed successfully
    echo "=========================================="
    echo "Successfully completed all $TOTAL issues (#$START - #$END)"
    echo "=========================================="

elif [[ "$args" =~ ^[0-9]+$ ]]; then
    # Single issue mode (backward compatible)
    claude -p "/nxs.dev --yolo $args" --dangerously-skip-permissions
else
    die "Invalid format. Expected: <number> or <start>-<end>"
fi
