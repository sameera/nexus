#!/usr/bin/env bash
#
# close-epic.sh — take a merged epic pull request from close through an unattended distillation
# run in one command, with nobody at the terminal: check the pull request, run `nexus close`,
# verify what close left behind, then run /nxs.distill --unattended in the worktree close prepared.
#
# Close is the plain command `nexus close` (decision record #872, D16). It runs no model and asks
# nothing, so the script reads its outcome from its exit status. On a stop it prints close's
# reason and remedy again and starts no distill. On success it still checks the hand-off note
# against GitHub and git before distill starts.
#
# There is no analyze stage (decision record #849, D9). The pull request was analyzed before the
# merge, with /nxs.analyze --pr; close's own evidence gate decides whether that analysis still
# holds. Answers and waivers must already be on the pull request and recorded by analyze.
#
# Usage:
#   utils/close-epic.sh <PR> [--merge] [--background] [extra harness args...]
#   HARNESS=codex utils/close-epic.sh <PR> [--merge] [--background] [extra codex exec args...]
#
# Extra harness arguments go to the distill stage only; close takes none.
#
# Environment:
#   HARNESS          claude (default) or codex, the harness distill runs under; install Nexus for
#                    that harness first
#   CODEX_SANDBOX    Codex sandbox mode (default workspace-write)
#   PERMISSION_MODE  claude permission mode for the headless stage (default bypassPermissions —
#                    required for unattended runs; tool calls cannot be approved interactively)
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
# --background detaches the distill stage once close is verified: this command returns at once,
# and distill's log and outcome record land in the run folder this command names
# (.nexus/tmp/close-epic-<PR>/), which is gitignored and never looks like a queue entry.
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
CODEX_SANDBOX="${CODEX_SANDBOX:-workspace-write}"
PERMISSION_MODE="${PERMISSION_MODE:-bypassPermissions}"
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

FORMATTER='
import readline from "node:readline";
const tty = process.stdout.isTTY;
const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const cyan = (s) => (tty ? `\x1b[36m${s}\x1b[0m` : s);
const clip = (s, n) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const toolLabel = (block) => {
    const i = block.input ?? {};
    const detail = i.command ?? i.file_path ?? i.path ?? i.pattern ?? i.url ?? i.skill ?? i.description ?? "";
    return `${block.name}(${clip(detail, 120)})`;
};
// FINAL_OUT, when set, receives the final message of the stage word for word — the outcome record
// quotes it when a distill run stops.
import fs from "node:fs";
const keepFinal = (text) => {
    if (process.env.FINAL_OUT && text) fs.writeFileSync(process.env.FINAL_OUT, text.trim() + "\n");
};
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
    let ev;
    try { ev = JSON.parse(line); } catch { return; }
    switch (ev.type) {
        case "thread.started": console.log(dim(`session ${ev.thread_id}`)); break;
        case "item.started":
            if (ev.item?.type === "command_execution") console.log(cyan(`  ● ${clip(ev.item.command, 120)}`));
            break;
        case "item.completed":
            if (ev.item?.type === "agent_message") { console.log("\n" + ev.item.text); keepFinal(ev.item.text); }
            else if (ev.item?.aggregated_output) console.log(dim(`    ⎿ ${clip(ev.item.aggregated_output, 200)}`));
            break;
        case "turn.completed": console.log(bold("\n=== Codex turn completed ===")); break;
        case "turn.failed": console.error(ev.error?.message ?? "Codex turn failed"); process.exitCode = 1; break;
        case "error": console.error(ev.message ?? "Codex stream error"); process.exitCode = 1; break;
        case "system":
            if (ev.subtype === "init") console.log(dim(`session ${ev.session_id} | model ${ev.model}`));
            break;
        case "assistant":
            for (const block of ev.message?.content ?? []) {
                if (block.type === "text" && block.text.trim()) console.log("\n" + block.text.trim());
                else if (block.type === "tool_use") console.log(cyan(`  ● ${toolLabel(block)}`));
            }
            break;
        case "user":
            for (const block of ev.message?.content ?? []) {
                if (block.type !== "tool_result") continue;
                const parts = Array.isArray(block.content)
                    ? block.content.filter((c) => c.type === "text").map((c) => c.text)
                    : [String(block.content ?? "")];
                const text = parts.join(" ").trim();
                if (text) console.log(dim(`    ⎿ ${clip(text, 200)}`));
            }
            break;
        case "result": {
            const mins = (ev.duration_ms / 60000).toFixed(1);
            const cost = ev.total_cost_usd != null ? ` | $${ev.total_cost_usd.toFixed(2)}` : "";
            console.log(bold(`\n=== ${ev.subtype} | ${ev.num_turns} turns | ${mins} min${cost} ===`));
            if (ev.result) { console.log(ev.result); keepFinal(ev.result); }
            if (ev.is_error) process.exitCode = 1;
            break;
        }
    }
});
'

# The headless (nobody-watching) stage: distill. Every fresh context carries this
# clause — an omitted answer never approves an action, on either harness (D1).
UNATTENDED="

You are running unattended inside a headless script. Nobody can answer a question, so never end by \
asking which option to take, and never wait for a decision. If the stage cannot proceed, state in \
your final message what blocked it and stop."

run_headless() {
    local prompt="$1${UNATTENDED}"
    shift
    if [[ "$HARNESS" == "codex" ]]; then
        prompt="${prompt//\/nxs.distill/\$nxs-distill}"
        codex exec --sandbox "$CODEX_SANDBOX" --json "$@" -- "$prompt" \
            | node --input-type=module -e "$FORMATTER"
    else
        claude -p "$prompt" \
            --permission-mode "$PERMISSION_MODE" \
            --output-format stream-json \
            --verbose \
            "$@" \
            | node --input-type=module -e "$FORMATTER"
    fi
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
    echo "!!! close-epic.sh runs in a single-repo checkout only. In a hub, run /nxs.analyze --pr, nexus close --pr and /nxs.distill by hand." >&2
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

# Absolute, so the note's place does not depend on close's working directory.
RUN_DIR="${PWD}/.nexus/tmp/close-epic-${PR}"
mkdir -p "$RUN_DIR"
HANDOFF="${RUN_DIR}/handoff.txt"
LOG="${RUN_DIR}/distill.log"
OUTCOME="${RUN_DIR}/outcome.txt"
FINAL="${RUN_DIR}/distill-final.txt"
CLOSE_ERR="${RUN_DIR}/close.err"
rm -f "$HANDOFF" "$LOG" "$OUTCOME" "$FINAL" "$CLOSE_ERR"

# --- Phase 3: close, unattended — the plain command, read through its exit status (#872, D16) -----
# Close's output streams to the terminal as it runs; its error stream is also kept in the run
# folder, so a stop's reason and remedy can be repeated where the lead looks last.
echo "" >&2
echo ">>> stage 1: nexus close --pr ${PR} --handoff ${HANDOFF}" >&2
set +e
{ nexus close --pr "$PR" --handoff "$HANDOFF" 2>&1 1>&3 3>&- | tee "$CLOSE_ERR" >&2; } 3>&1
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

# --- Phase 4: verify the hand-off note against GitHub and git --------------------------------------
echo "" >&2
echo ">>> verifying the hand-off note" >&2
if [[ ! -f "$HANDOFF" ]]; then
    echo "!!! nexus close succeeded but left no hand-off note at ${HANDOFF} — distill was not started." >&2
    exit 1
fi
NOTE_EPIC="$(sed -n 's/^epic: *//p' "$HANDOFF" | head -1)"
DISTILL_BRANCH="$(sed -n 's/^branch: *//p' "$HANDOFF" | head -1)"
WTPATH="$(sed -n 's/^worktree: *//p' "$HANDOFF" | head -1)"
if [[ -z "$NOTE_EPIC" || -z "$DISTILL_BRANCH" || -z "$WTPATH" ]]; then
    echo "!!! hand-off note at ${HANDOFF} is incomplete — distill was not started." >&2
    exit 1
fi
EPIC_STATE="$(gh issue view "$NOTE_EPIC" --json state --jq .state)"
if [[ "$EPIC_STATE" != "CLOSED" ]]; then
    echo "!!! epic issue #${NOTE_EPIC} is not closed (${EPIC_STATE}) — distill was not started." >&2
    exit 1
fi
# The note must name a worktree git has registered, checked out on the note's branch (D5).
if ! git worktree list --porcelain | WTPATH="$WTPATH" BRANCH="$DISTILL_BRANCH" node -e '
const fs = require("fs");
const path = require("path");
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const want = real(process.env.WTPATH);
const blocks = fs.readFileSync(0, "utf8").split(/\n\n+/);
const hit = blocks.some((b) => {
    const wt = /^worktree (.+)$/m.exec(b)?.[1];
    const br = /^branch (.+)$/m.exec(b)?.[1];
    return wt !== undefined && real(wt) === want && br === `refs/heads/${process.env.BRANCH}`;
});
process.exit(hit ? 0 : 1);
'; then
    echo "!!! ${WTPATH} named in the hand-off note is not a registered worktree on ${DISTILL_BRANCH} — distill was not started." >&2
    exit 1
fi
if ! git ls-remote --exit-code --heads origin "$DISTILL_BRANCH" >/dev/null 2>&1; then
    echo "!!! branch ${DISTILL_BRANCH} is not pushed — distill was not started." >&2
    exit 1
fi

# --- Phase 5: distill, unattended, in the worktree close left ---------------------------------------
# Distill commits inside the worktree, and git writes those commits into the main checkout's git
# folder, outside the worktree. Codex's workspace-write sandbox gets that folder as an extra
# writable place (R2).
DISTILL_ARGS=(${ARGS[@]+"${ARGS[@]}"})
if [[ "$HARNESS" == "codex" ]]; then
    DISTILL_ARGS+=(--add-dir "$(git rev-parse --path-format=absolute --git-common-dir)")
fi

# Distill's output always lands in the run folder's log. Success is read from GitHub (an open pull
# request from the distill branch), never from distill's own words (D9).
run_distill_and_record() {
    ( cd "$WTPATH" && FINAL_OUT="$FINAL" run_headless "/nxs.distill --unattended" \
        ${DISTILL_ARGS[@]+"${DISTILL_ARGS[@]}"} ) || true
    local pr_url
    pr_url="$(gh pr list --head "$DISTILL_BRANCH" --state open --json url --jq '.[0].url // empty' 2>/dev/null || true)"
    {
        if [[ -n "$pr_url" ]]; then
            echo "distillation pull request: ${pr_url}"
        else
            echo "stopped — no distillation pull request opened. Distill's final message:"
            echo ""
            if [[ -s "$FINAL" ]]; then cat "$FINAL"; else echo "(none — see ${LOG})"; fi
        fi
        echo ""
        echo "Remove the worktree once you no longer need it: nexus pr-worktree remove ${WTPATH}"
    } >"$OUTCOME"
}

if [[ "$BACKGROUND" == "1" ]]; then
    echo "" >&2
    echo ">>> stage 2: /nxs.distill --unattended, in the background (log: ${LOG})" >&2
    ( run_distill_and_record ) >"$LOG" 2>&1 </dev/null &
    disown
    echo ">>> close-epic.sh returns now; outcome will land in ${OUTCOME}" >&2
    exit 0
fi

echo "" >&2
echo ">>> stage 2: /nxs.distill --unattended (fresh context, in ${WTPATH})" >&2
run_distill_and_record 2>&1 | tee "$LOG"
echo "" >&2
cat "$OUTCOME" >&2
