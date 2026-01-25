#!/bin/bash

# nxs.yolo.sh - Runs /nxs.dev in YOLO mode (auto-approve all checkpoints)
# Usage: ./nxs.yolo.sh <issue-number>

args="$@"

if [ -z "$args" ]; then
    echo "Usage: ./nxs.yolo.sh <issue-number>"
    echo "Example: ./nxs.yolo.sh 123"
    exit 1
fi

claude -p "/nxs.dev --yolo $args" --dangerously-skip-permissions
