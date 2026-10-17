#!/usr/bin/env bash
#
# close-epic.sh — take a merged epic pull request from close through an unattended distillation
# run in one command, with nobody at the terminal: check the pull request, run `nexus close`, then
# run `nexus distill --pr <PR>`, which distills in the worktree close prepared.
#
# Close is the plain command `nexus close` (decision record #872, D16). It runs no model and asks
# nothing, so the script reads its outcome from its exit status. On a stop it prints close's
# reason and remedy again and starts no distill. The distill stage is the shipped command (epic
# #909, D13): its checks, its session and its outcome are that command's, never a copy here.
#
# There is no analyze stage (decision record #849, D9). The pull request was analyzed before the
# merge, with /nxs.analyze --pr; close's own evidence gate decides whether that analysis still
# holds. Answers and waivers must already be on the pull request and recorded by analyze.
#
# Usage:
#   utils/close-epic.sh <PR> [--merge] [--background] [extra harness args...]
#   HARNESS=codex utils/close-epic.sh <PR> [--merge] [--background] [extra codex exec args...]
#
# Extra harness arguments go to the distill stage only, after `--`; close takes none.
#
# Environment:
#   HARNESS          claude (default) or codex, the harness distill runs under; install Nexus for
#                    that harness first
#   CODEX_SANDBOX    Codex sandbox mode, passed to nexus distill as --permission-mode (its default
#                    is workspace-write)
#   PERMISSION_MODE  claude permission mode, passed to nexus distill as --permission-mode (its
#                    default is bypassPermissions — tool calls cannot be approved unattended)
#   MERGE_METHOD     merge | squash | rebase, used only with --merge (default merge)
#   BASE             trunk branch name (default main)
#
# --merge merges an open pull request before continuing, but only when it is not a draft, GitHub
# reports it mergeable, and the merge pre-check passes: its analyze receipt is trusted, analyzed the
# pull request's current head, and reports 0 critical and 0 high findings. The pre-check reports no
# receipt, an unreadable or untrusted receipt, a moved head and blocking findings each in its own
# words. Without --merge, an open pull request is refused — this command never merges without being
# asked to.
#
# --background detaches the distill stage once close succeeds: this command returns at once, and
# the stage's output lands in the run folder this command names (.nexus/tmp/close-epic-<PR>/),
# which is gitignored and never looks like a queue entry.
#
# Single-repo checkouts only (decision record #818, D10) — a hub or member checkout is refused
# before anything else runs, through the same role check close itself uses.

set -euo pipefail

# Keep the harness-specific entry point in charge of Codex invocations, exactly as
# utils/implement-epic.sh does.
if [[ "${1:-}" == "--harness" && "${2:-}" == "codex" ]]; then
    shift 2
    SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
    exec "${SCRIPT_DIR}/codex/close-epic.sh" "$@"
fi

if [[ $# -lt 1 || ! "$1" =~ ^[0-9]+$ ]]; then
    echo "usage: $(basename "$0") <PR> [--merge] [--background] [extra harness args...]" >&2
    exit 1
fi
PR="$1"
shift

MERGE=0
BACKGROUND=0
ARGS=()
for a in "$@"; do
    case "$a" in
        --merge) MERGE=1 ;;
        --background) BACKGROUND=1 ;;
        *) ARGS+=("$a") ;;
    esac
done

HARNESS="${HARNESS:-claude}"
MERGE_METHOD="${MERGE_METHOD:-merge}"
BASE="${BASE:-main}"
if [[ "$HARNESS" != "claude" && "$HARNESS" != "codex" ]]; then
    echo "HARNESS must be claude or codex" >&2
    exit 1
fi

# Read one dotted field out of JSON on stdin. Missing at any level prints "". Written as a plain
# string: console.log would colour a boolean or number when FORCE_COLOR is set.
json_get() {
    node -e '
const v = JSON.parse(require("fs").readFileSync(0, "utf8"));
const path = process.argv[1].split(".");
let c = v;
for (const k of path) c = c == null ? undefined : c[k];
process.stdout.write((c === undefined || c === null ? "" : String(c)) + "\n");
' "$1"
}

# --- Phase 1: single-repo checkouts only (D10) — refuse hub and member, the same check
# close itself uses for member ----------------------------------------------------------------
ROLE_OUT="$(nexus close-role)"
ROLE="$(sed -n 's/^role: //p' <<<"$ROLE_OUT")"
if [[ "$ROLE" == "member" ]]; then
    echo "!!! close-epic.sh does not run inside a member repository. Run it from the hub." >&2
    exit 1
fi
if [[ "$ROLE" == "hub" ]]; then
    echo "!!! close-epic.sh runs in a single-repo checkout only. In a hub, run /nxs.analyze --pr, nexus close --epic <N> and /nxs.distill by hand." >&2
    exit 1
fi

# --- Phase 2: the pull request's state -----------------------------------------------------------
PR_JSON="$(gh pr view "$PR" --json state,isDraft,mergeable,number)"
STATE="$(json_get state <<<"$PR_JSON")"

if [[ "$STATE" == "OPEN" ]]; then
    if [[ "$MERGE" != "1" ]]; then
        echo "!!! PR #${PR} is open, not merged. Re-run with --merge to merge it first, or merge it yourself and re-run." >&2
        exit 1
    fi
    IS_DRAFT="$(json_get isDraft <<<"$PR_JSON")"
    MERGEABLE="$(json_get mergeable <<<"$PR_JSON")"
    if [[ "$IS_DRAFT" == "true" ]]; then
        echo "!!! PR #${PR} is a draft — refusing to merge it." >&2
        exit 1
    fi
    if [[ "$MERGEABLE" != "MERGEABLE" ]]; then
        echo "!!! PR #${PR} is not mergeable (GitHub reports '${MERGEABLE}') — refusing to merge it." >&2
        exit 1
    fi
    # The merge pre-check (decision record #849, D10): the pull request's analyze receipt, read
    # through the one trusted reader and nothing else. It never runs analyze and never reads the
    # shipped record. A receipt at the current head with no blocking findings is the only result
    # that merges; every other result is printed as the pre-check words it.
    REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
    if ! PRECHECK_JSON="$(nexus merge-precheck --pr "$PR" --repo "$REPO")"; then
        echo "!!! PR #${PR}: its analyze receipt could not be read (see the error above) — refusing to merge it. Re-run once the read succeeds." >&2
        exit 1
    fi
    PRECHECK_MESSAGE="$(json_get message <<<"$PRECHECK_JSON")"
    if [[ "$(json_get merge <<<"$PRECHECK_JSON")" != "true" ]]; then
        echo "!!! ${PRECHECK_MESSAGE}" >&2
        exit 1
    fi
    echo ">>> ${PRECHECK_MESSAGE}" >&2
    echo ">>> merging PR #${PR} (--${MERGE_METHOD})" >&2
    gh pr merge "$PR" "--${MERGE_METHOD}"
elif [[ "$STATE" != "MERGED" ]]; then
    echo "!!! PR #${PR} is ${STATE} — refusing; not merged and --merge was not given." >&2
    exit 1
fi

echo ">>> fetching trunk" >&2
git fetch "$(nexus trunk --form remote)" "$BASE"

RUN_DIR="${PWD}/.nexus/tmp/close-epic-${PR}"
mkdir -p "$RUN_DIR"
CLOSE_ERR="${RUN_DIR}/close.err"
LOG="${RUN_DIR}/distill.log"
rm -f "$CLOSE_ERR" "$LOG"

# --- Phase 3: close, unattended — the plain command, read through its exit status (#872, D16) -----
# Close's output streams to the terminal as it runs; its error stream is also kept in the run
# folder, so a stop's reason and remedy can be repeated where the lead looks last.
echo "" >&2
echo ">>> stage 1: nexus close --pr ${PR}" >&2
set +e
{ nexus close --pr "$PR" 2>&1 1>&3 3>&- | tee "$CLOSE_ERR" >&2; } 3>&1
CLOSE_STATUS="${PIPESTATUS[0]}"
set -e
if [[ "$CLOSE_STATUS" != "0" ]]; then
    echo "" >&2
    echo "!!! nexus close stopped (exit ${CLOSE_STATUS}) — distill was not started. Close's stop:" >&2
    if grep -qE '^  (reason|item|remedy):' "$CLOSE_ERR"; then
        grep -E '^(STOP$|  (reason|item|remedy):)' "$CLOSE_ERR" >&2
    else
        cat "$CLOSE_ERR" >&2
    fi
    echo "Fix what it names, then re-run this command." >&2
    exit 1
fi

# --- Phase 4: distill, through the shipped command (epic #909, D13) ---------------------------------
# nexus distill finds the worktree close prepared from the pull request, checks close's result
# still holds, runs /nxs.distill --unattended there and reads success from GitHub.
DISTILL=(nexus distill --pr "$PR")
if [[ "$HARNESS" == "codex" ]]; then
    DISTILL+=(--harness codex)
    if [[ -n "${CODEX_SANDBOX:-}" ]]; then DISTILL+=(--permission-mode "$CODEX_SANDBOX"); fi
elif [[ -n "${PERMISSION_MODE:-}" ]]; then
    DISTILL+=(--permission-mode "$PERMISSION_MODE")
fi
if [[ ${#ARGS[@]} -gt 0 ]]; then DISTILL+=(-- "${ARGS[@]}"); fi

echo "" >&2
if [[ "$BACKGROUND" == "1" ]]; then
    echo ">>> stage 2: ${DISTILL[*]}, in the background (log: ${LOG})" >&2
    ( "${DISTILL[@]}" ) >"$LOG" 2>&1 </dev/null &
    disown
    echo ">>> close-epic.sh returns now; the outcome will be at the end of ${LOG}" >&2
    exit 0
fi
echo ">>> stage 2: ${DISTILL[*]}" >&2
exec "${DISTILL[@]}"
