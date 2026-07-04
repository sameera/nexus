#!/usr/bin/env bash
# Nexus plan-capture hook (PostToolUse on ExitPlanMode).
# Opt-in: registered per-engineer in .claude/settings.local.json — never in a
# committed settings file. Writes the approved plan to gitignored scratch:
# .nexus/plans/<branch>/NN-plan.md. /nxs.close consumes these as hints.
# Always exits 0 — capture must never block the tool call.
set -u
payload="$(cat)"
plan="$(printf '%s' "$payload" | jq -r '.tool_input.plan // empty' 2>/dev/null)"
[ -z "$plan" ] && exit 0
branch="$(git branch --show-current 2>/dev/null)"
[ -z "$branch" ] && branch="detached"
dir=".nexus/plans/${branch//\//-}"
mkdir -p "$dir" || exit 0
n=$(ls "$dir"/*-plan.md 2>/dev/null | wc -l)
printf '# Plan captured %s\n\n%s\n' "$(date +%Y-%m-%dT%H:%M:%S)" "$plan" \
    > "$dir/$(printf '%02d' $((n + 1)))-plan.md"
exit 0
