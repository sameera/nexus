#!/usr/bin/env bash
#
# Bulk delete Github Issues
# Deletes GitHub issues sequentially from a start number to an end number.
#

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

usage() {
    cat <<EOF
Bulk delete Github Issues

Usage: $SCRIPT_NAME <start> <end> [options]

Arguments:
    start   First issue number to delete (inclusive)
    end     Last issue number to delete (inclusive)

Options:
    -h, --help    Show this help message and exit

Examples:
    $SCRIPT_NAME 10 20       Delete issues #10 through #20
    $SCRIPT_NAME 5 5         Delete only issue #5

Note: Requires the GitHub CLI (gh) to be installed and authenticated.
      Each deletion will prompt for confirmation unless --yes is passed to gh.
EOF
}

die() {
    echo "Error: $1" >&2
    exit 1
}

is_number() {
    [[ "$1" =~ ^[0-9]+$ ]]
}

# Handle help flag anywhere in arguments
for arg in "$@"; do
    case "$arg" in
        -h|--help)
            usage
            exit 0
            ;;
    esac
done

# Validate argument count
if [[ $# -lt 2 ]]; then
    usage >&2
    exit 1
fi

START="$1"
END="$2"

# Validate arguments are numbers
is_number "$START" || die "Start value '$START' is not a valid number"
is_number "$END" || die "End value '$END' is not a valid number"

# Validate range
if [[ "$START" -gt "$END" ]]; then
    die "Start ($START) cannot be greater than end ($END)"
fi

# Confirm action
echo "This will delete issues #$START through #$END ($(( END - START + 1 )) issues total)"
read -rp "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Delete issues sequentially
for ((i = START; i <= END; i++)); do
    echo "Deleting issue #$i..."
    if gh issue delete "$i" --yes; then
        echo "  ✓ Issue #$i deleted"
    else
        echo "  ✗ Failed to delete issue #$i" >&2
    fi
done

echo "Done."