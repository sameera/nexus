#!/usr/bin/env bash
#
# implement-epic.sh — run the /goal epic-implementation loop headlessly, push
# the branch, open a draft PR, run /nxs.analyze in a fresh context, then drive
# fix → re-analyze rounds until the conformance gate is clean. Once clean, the
# receipt is posted to the PR, the PR is taken out of draft, and its body is
# refreshed to say so.
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
#   CONFORM          set to 0 to stop after the first analyze instead of
#                    running fix → re-analyze rounds (default 1; needs
#                    ANALYZE=1). A blocking receipt still exits nonzero.
#   CONFORM_ROUNDS   maximum fix → re-analyze rounds (default 5)
#   FIX_TURNS        turn cap inside one fix round (default 30)
#   TEST_CMD         suite the fix round must leave green
#                    (default 'npx nx run-many -t test --all')
#   BASE             PR base branch (default main)
#
# Streams each assistant message, tool call, and tool result to the console
# as the run progresses, then prints a result summary per stage.
#
# Context discipline: every stage — and every half of every conformance round —
# is its own `claude -p` invocation, so no context is carried between them. The
# only state that crosses a boundary is on disk: the branch, and the receipt
# `/nxs.analyze` writes. A round therefore costs a fresh, short context instead
# of appending to one that has already read the whole epic, which is what makes
# a five-round run behave like the first round rather than degrading into it.

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
CONFORM="${CONFORM:-1}"
CONFORM_ROUNDS="${CONFORM_ROUNDS:-5}"
FIX_TURNS="${FIX_TURNS:-30}"
TEST_CMD="${TEST_CMD:-npx nx run-many -t test --all}"
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

# Resolved once, used by both the receipt-posting stage below and (were
# ANALYZE=0) by nothing — the PR exists either way by this point.
PR_NUM="$(gh pr view "$BRANCH" --json number --jq .number)"

if [[ "$ANALYZE" != "1" ]]; then
    exit 0
fi

echo "" >&2
echo ">>> stage 2: /nxs.analyze #${N} (fresh context)" >&2
run_claude "/nxs.analyze ${N}" "$@"

# --- stage 3: conformance rounds --------------------------------------------
#
# /nxs.analyze writes analyze-receipt.md and gates on its tally: a critical or
# high finding means the code does not yet do what the planning said. One round
# is two fresh contexts — a fix context that works only from the receipt, then
# an analyze context that rewrites it — repeated until the tally is clean, the
# round cap is reached, or a round changes nothing. Open story issues are a note
# in the receipt, not a finding, so they never keep this loop spinning.

# The receipt sits beside the resolved epic.md: under .nexus/tmp/ for an
# issue-sourced epic (the norm), inside the committed entry for an old-contract
# one, which need not be named for the epic — hence the front-matter search.
receipt_path() {
    local p
    for p in ".nexus/tmp/epic-${N}/analyze-receipt.md" \
             ".nexus/queue/epic-${N}/analyze-receipt.md"; do
        if [[ -f "$p" ]]; then
            echo "$p"
            return 0
        fi
    done
    # `|| true`: no match must leave the caller's assignment succeeding, or
    # `set -e` would kill the run before the missing-receipt message below.
    grep -l "^epic: \"#${N}\"" .nexus/queue/*/analyze-receipt.md 2>/dev/null | head -1 || true
}

# Front matter → CRIT / HIGH (the gating tally) and RHEAD (the commit analyzed).
read_receipt() {
    local f="$1" line
    line="$(grep -m1 '^findings:' "$f" || true)"
    CRIT="$(sed -n 's/.*critical: *\([0-9][0-9]*\).*/\1/p' <<<"$line")"
    HIGH="$(sed -n 's/.*high: *\([0-9][0-9]*\).*/\1/p' <<<"$line")"
    RHEAD="$(sed -n 's/^head: *\([^ ]*\).*/\1/p' "$f" | head -1)"
    [[ -n "$CRIT" && -n "$HIGH" ]]
}

# The fix half of a round. Everything it needs is in the text: the receipt path,
# the round, the suite. Nothing is inherited from an earlier context, which is
# the whole point — a late round reads as little as the first one did.
fix_prompt() {
    local receipt="$1" round="$2"
    cat <<EOF
/goal Every critical and high finding listed in ${receipt} is fixed in the code on this branch, the fixes are committed, and \`${TEST_CMD}\` exits 0. This is round ${round} of ${CONFORM_ROUNDS} on epic #${N}.

Work from the receipt, not from the epic. \`${receipt}\` is the whole work list: read it first and restate each critical and high finding as one line — the file, what is wrong, and what the planning asked for. Then read only what a finding names: the acceptance criterion or the record invariant it cites, and the files it points at. Do not re-derive the analysis, do not read the epic or the decision record end to end, and do not run /nxs.analyze — the calling script re-runs it in a fresh context the moment you stop.

Fix critical findings first, then high, then any medium or low finding whose fix stays inside a file you have already touched. Each fix is the smallest change that satisfies the criterion the finding cites. Test first: write or amend the test that pins the behaviour before the code that satisfies it.

Never make a finding disappear instead of fixing it. Do not edit ${receipt}, do not weaken, skip or delete a test, and do not edit epic.md or the decision record so that the code matches. If a finding is wrong, or the only honest fix is a planning change — a revised invariant, a re-filed acceptance criterion — leave the code as it is, name the finding in your final message, and stop. That is the lead's decision, taken through /nxs.decision-record --revise.

Story issues that are still open are a note in the receipt, not a finding. Leave them open and do not act on them; the lead closes them before /nxs.close.

Before committing, run the tests your change touches, then \`${TEST_CMD}\` once. Commit on this branch with a subject naming what now holds. Leave the per-story commits and their \`Closes #<n>\` lines alone — this is a follow-up commit, never an amend and never a rebase. Append a decision stub per CLAUDE.md for any non-obvious choice. Do not push and do not touch the pull request; the calling script does both.

Finish with one line per finding: fixed, or left alone with the reason. Stop after ${FIX_TURNS} turns.
EOF
}

# Stage 4, on a clean receipt: post it to the PR, refresh the body off its
# stale "draft opened / analyze runs next" wording, and take the PR out of
# draft. Runs once, from whichever round actually reached clean.
publish_clean_pr() {
    local receipt="$1" rhead="$2" epic_title

    echo "" >&2
    echo ">>> stage 4: posting the analyze receipt to PR #${PR_NUM}" >&2
    gh pr comment "$PR_NUM" --body-file "$receipt"

    epic_title="$(gh issue view "$N" --json title --jq .title)"
    gh pr edit "$PR_NUM" \
        --title "epic #${N}: ${epic_title}" \
        --body "$(cat <<EOF
Implements the story sub-issues of #${N}, one commit per story in blocked_by order.

Each commit body carries its own \`Closes #<story>\` line, so merging this PR
into \`${BASE}\` closes the stories it implements. The epic itself closes through
\`/nxs.close\`, not by merge.

Conformance is clean at \`${rhead}\` — 0 critical, 0 high; see the analyze
receipt comment below for the full report. Ready for review.
EOF
)"

    if [[ "$(gh pr view "$PR_NUM" --json isDraft --jq .isDraft)" == "true" ]]; then
        echo ">>> stage 4: marking PR #${PR_NUM} ready for review" >&2
        gh pr ready "$PR_NUM"
    fi
}

ROUND=1
LAST_STATE=""
while :; do
    RECEIPT="$(receipt_path)"
    if [[ -z "$RECEIPT" ]]; then
        echo "!!! no analyze-receipt.md for epic #${N} — analyze blocked, or never wrote one" >&2
        exit 1
    fi
    if ! read_receipt "$RECEIPT"; then
        echo "!!! cannot read the findings tally from ${RECEIPT}" >&2
        exit 1
    fi

    if (( CRIT == 0 && HIGH == 0 )); then
        echo "" >&2
        echo ">>> conformance clean at ${RHEAD} — 0 critical, 0 high (${RECEIPT})" >&2
        publish_clean_pr "$RECEIPT" "$RHEAD"
        break
    fi

    if [[ "$CONFORM" != "1" ]]; then
        echo "!!! conformance blocked: ${CRIT} critical, ${HIGH} high (${RECEIPT})" >&2
        exit 1
    fi

    STATE="${RHEAD}:${CRIT}:${HIGH}"
    if [[ "$STATE" == "$LAST_STATE" ]]; then
        echo "!!! round $(( ROUND - 1 )) left ${STATE} unchanged — nothing moved, stopping" >&2
        exit 1
    fi
    if (( ROUND > CONFORM_ROUNDS )); then
        echo "!!! ${CRIT} critical / ${HIGH} high still open after ${CONFORM_ROUNDS} rounds — stopping" >&2
        exit 1
    fi
    LAST_STATE="$STATE"

    echo "" >&2
    echo ">>> stage 3.${ROUND}a: fix ${CRIT} critical / ${HIGH} high (fresh context)" >&2
    run_claude "$(fix_prompt "$RECEIPT" "$ROUND")" "$@"

    echo "" >&2
    echo ">>> pushing ${BRANCH} to origin" >&2
    git push

    echo "" >&2
    echo ">>> stage 3.${ROUND}b: /nxs.analyze #${N} (fresh context)" >&2
    run_claude "/nxs.analyze ${N}" "$@"

    ROUND=$(( ROUND + 1 ))
done
