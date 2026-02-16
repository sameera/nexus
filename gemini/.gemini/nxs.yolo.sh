#!/bin/bash
# nxs.yolo.sh - Streamlined YOLO mode for issue implementation
# This is a thin wrapper that invokes the Python implementation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="${SCRIPT_DIR}/nxs_yolo.py"

if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "Error: Python script not found: $PYTHON_SCRIPT" >&2
    exit 1
fi

exec python3 "$PYTHON_SCRIPT" "$@"
