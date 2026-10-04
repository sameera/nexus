#!/usr/bin/env bash
#
# close-epic.sh — Codex entry point for the close-and-distill pipeline.
#
# Usage:
#   utils/codex/close-epic.sh <PR> [--merge] [--background] [extra codex exec args...]
#
# Configure Codex with CODEX_SANDBOX (default: workspace-write). The shared pipeline
# implementation lives in utils/close-epic.sh; pinning HARNESS here runs distill under Codex while
# sharing its preflight, merge, close and distill behavior. Close is `nexus close` on either
# harness, so it runs unattended here too.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec env HARNESS=codex "${SCRIPT_DIR}/../close-epic.sh" "$@"
