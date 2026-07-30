#!/usr/bin/env bash
#
# implement-epic.sh — run the /goal epic-implementation loop headlessly, push
# the branch, open a draft PR, then /nxs.analyze in a fresh context.
#
# Usage:
#   utils/implement-epic.sh <epic-issue-number> [extra claude args...]
#
# Environment:
#   TURNS            turn cap in the goal condition (default 40)
#   PERMISSION_MODE  claude permission mode (default bypassPermissions —
#                    required for unattended runs; tool calls cannot be
#                    approved interactively in -p mode)
#   ANALYZE          set to 0 to skip the /nxs.analyze stage (default 1)
#   BASE             PR base branch (default main)
#
# Streams each assistant message, tool call, and tool result to the console
# as the run progresses, then prints a result summary per stage.

set -euo pipefail

if [[ $# -lt 1 || ! "$1" =~ ^[0-9]+$ ]]; then
    echo "usage: $(basename "$0") <epic-issue-number> [extra claude args...]" >&2
    exit 1
fi

N="$1"
shift
TURNS="${TURNS:-40}"
PERMISSION_MODE="${PERMISSION_MODE:-bypassPermissions}"
ANALYZE="${ANALYZE:-1}"
BASE="${BASE:-main}"

FORMATTER='
import readline from "node:readline";

const tty = process.stdout.isTTY;
const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const cyan = (s) => (tty ? `\x1b[36m${s}\x1b[0m` : s);

const clip = (s, n) => {
    s = String(s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n) + "…" : s;
};

const toolLabel = (block) => {
    const i = block.input ?? {};
    const detail =
        i.command ?? i.file_path ?? i.path ?? i.pattern ?? i.url ?? i.skill ??
        i.description ?? "";
    return `${block.name}(${clip(detail, 120)})`;
};

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
    let ev;
    try { ev = JSON.parse(line); } catch { return; }

    switch (ev.type) {
        case "system":
            if (ev.subtype === "init") {
                console.log(dim(`session ${ev.session_id} | model ${ev.model}`));
            }
            break;
        case "assistant":
            for (const block of ev.message?.content ?? []) {
                if (block.type === "text" && block.text.trim()) {
                    console.log("\n" + block.text.trim());
                } else if (block.type === "tool_use") {
                    console.log(cyan(`  ● ${toolLabel(block)}`));
                }
            }
            break;
        case "user":
            for (const block of ev.message?.content ?? []) {
                if (block.type !== "tool_result") continue;
                const parts = Array.isArray(block.content)
                    ? block.content.filter((c) => c.type === "text").map((c) => c.text)
                    : [String(block.content ?? "")];
                const text = parts.join(" ").trim();
                if (text) {
                    console.log(dim(`    ⎿ ${clip(text, 200)}`));
                }
            }
            break;
        case "result": {
            const mins = (ev.duration_ms / 60000).toFixed(1);
            const cost = ev.total_cost_usd != null ? ` | $${ev.total_cost_usd.toFixed(2)}` : "";
            console.log(bold(`\n=== ${ev.subtype} | ${ev.num_turns} turns | ${mins} min${cost} ===`));
            if (ev.result) {
                console.log(ev.result);
            }
            if (ev.is_error) {
                process.exitCode = 1;
            }
            break;
        }
    }
});
'

# One claude -p invocation = one fresh session/context. pipefail propagates
# a failure from either claude or the formatter (is_error → exit 1).
run_claude() {
    local prompt="$1"
    shift
    claude -p "$prompt" \
        --permission-mode "$PERMISSION_MODE" \
        --output-format stream-json \
        --verbose \
        "$@" \
        | node --input-type=module -e "$FORMATTER"
}

GOAL="/goal Every story sub-issue of epic #${N} is implemented on a new branch — \
one commit per story, in blocked_by order, each commit body ending with a line \
reading exactly 'Closes #<that story's issue number>' — and the full test suite \
passes. Prove it: git log shows one commit per story, each with its Closes line, \
test command exits 0. Start by running /nxs-epic-resolve ${N}; the \
decision-record sub-issue's invariants are binding; re-read the story's epic.md \
section before starting each story. Do not push and do not open a PR — the \
calling script does both. Stop after ${TURNS} turns."

echo ">>> stage 1: implement epic #${N} | permission mode: ${PERMISSION_MODE} | turn cap: ${TURNS}" >&2
run_claude "$GOAL" "$@"

# The loop neither pushes nor opens a PR, so nothing has left the machine yet.
# Both steps below are needed for issue linkage: GitHub records a commit → issue
# reference only once the commit reaches the default branch or becomes part of a
# pull request, so a bare pushed branch still links nothing. The draft PR gives
# the story issues their commit references now; the Closes lines in the commit
# bodies close those issues when it merges into ${BASE}.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" || "$BRANCH" == "$BASE" ]]; then
    echo "!!! refusing to push from '${BRANCH}' — expected the loop's story branch" >&2
    exit 1
fi
echo "" >&2
echo ">>> pushing ${BRANCH} to origin" >&2
git push -u origin "$BRANCH"

PR_URL="$(gh pr list --head "$BRANCH" --state open --json url --jq '.[0].url // empty')"
if [[ -n "$PR_URL" ]]; then
    echo ">>> PR already open: ${PR_URL}" >&2
else
    echo ">>> opening draft PR against ${BASE}" >&2
    EPIC_TITLE="$(gh issue view "$N" --json title --jq .title)"
    gh pr create --draft \
        --base "$BASE" \
        --head "$BRANCH" \
        --title "epic #${N}: ${EPIC_TITLE}" \
        --body "$(cat <<EOF
Implements the story sub-issues of #${N}, one commit per story in blocked_by order.

Each commit body carries its own \`Closes #<story>\` line, so merging this PR
into \`${BASE}\` closes the stories it implements. The epic itself closes through
\`/nxs.close\`, not by merge.

Draft opened by \`utils/implement-epic.sh\`; \`/nxs.analyze\` runs against it next.
EOF
)"
fi

if [[ "$ANALYZE" == "1" ]]; then
    echo "" >&2
    echo ">>> stage 2: /nxs.analyze #${N} (fresh context)" >&2
    run_claude "/nxs.analyze ${N}"
fi
