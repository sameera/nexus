#!/usr/bin/env bash
#
# implement-epic.sh — Codex entry point for the epic implementation pipeline.
#
# Usage:
#   utils/codex/implement-epic.sh <epic-issue-number> [extra codex exec args...]
#
# Configure Codex with CODEX_SANDBOX (default: workspace-write). The shared
# pipeline implementation lives in utils/implement-epic.sh; pinning HARNESS
# here keeps this entry point Codex-specific while sharing its analyze,
# conformance, and PR-certification behavior.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec env HARNESS=codex "${SCRIPT_DIR}/../implement-epic.sh" "$@"
