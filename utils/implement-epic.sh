#!/usr/bin/env bash
#
# implement-epic.sh — run the /goal epic-implementation loop headlessly, push
# the branch, open a draft PR, run /nxs.analyze in a fresh context, then drive
# fix → re-analyze rounds until the conformance gate is clean. Once clean, one
# /nxs.analyze --pr run certifies the result to the PR, its body is refreshed,
# and it is taken out of draft.
#
# Usage:
#   utils/implement-epic.sh <epic-issue-number> [extra harness args...]
#   HARNESS=codex utils/implement-epic.sh <epic-issue-number> [extra codex exec args...]
#
# Environment:
#   HARNESS          claude (default) or codex; install Nexus for that harness first
#   CODEX_SANDBOX    Codex sandbox mode (default workspace-write)
#   TURNS            turn cap in the goal condition (default 40)
#   PERMISSION_MODE  claude permission mode (default bypassPermissions —
#                    required for unattended runs; tool calls cannot be
#                    approved interactively in -p mode)
#   ANALYZE          set to 0 to skip the /nxs.analyze stage (default 1)
#   CONFORM          set to 0 to stop after the first analyze instead of
#                    running fix → re-analyze rounds (default 1; needs
#                    ANALYZE=1). A blocking result still exits nonzero.
#   CONFORM_ROUNDS   maximum fix → re-analyze rounds (default 5)
#   FIX_TURNS        turn cap inside one fix round (default 30)
#   TEST_CMD         suite the fix round must leave green
#                    (default 'npx nx run-many -t test --all')
#   BASE             PR base branch (default main)
#
# Streams each assistant message, tool call, and tool result to the console
# as the run progresses, then prints a result summary per stage.
#
# Local mode while iterating, --pr mode once to certify: rounds 1..k run
# `/nxs.analyze <N>` against the checkout already on disk — no worktree
# spin-up, no PR traffic. A local run writes no file (record #871, D12): its
# terminal report ends with one fixed result line, and the script captures each
# run's final report into its own scratch, .nexus/tmp/implement-epic-<N>/, to
# read straight back — a directory no Nexus stage reads as an entry.
# Publishing every round as a PR review (or, since this identity is the PR's
# own author, the near-certain self-review fallback comment) bought nothing
# most of those rounds would use, at the cost of a worktree fetch/teardown and
# a review or comment landing on the PR per round. Only the *terminal* state
# has to be a PR review — that is what `/nxs.close --pr` reads afterward — so
# the moment local analyze goes clean, one `/nxs.analyze --pr <PR>` run
# certifies that same commit to GitHub and the script reads that block back,
# rather than trusting the local run to stand in for it.
#
# Unattended discipline: every analyze invocation carries a clause saying nobody can answer a
# question, and a stage-4 failure annotates the pull request before exiting. A `-p` run that ends
# by asking which option to take produces nothing, and a draft PR with an untouched body looks
# exactly like a run that never reached stage 4 — both happened, five epics in a row. A fix round
# must also never answer an item on the pull request, since it posts as the lead: the prompt forbids
# it, and the script stops the run, naming the comment, if one holding an answer line appears during
# the round (read with `nexus pr-answers`, so the `nexus` executable must be on PATH).
#
# Context discipline: every stage — and every half of every conformance round
# — is its own `claude -p` or `codex exec` invocation, so no context is carried between them.
# The state that crosses a round boundary is on disk (the branch, the captured
# analyze report) until the loop goes clean, then on GitHub (the certifying review) —
# never a growing conversation. A late round reads as little as the first one
# did, and the certifying run costs exactly one extra worktree, not one per
# round.

set -euo pipefail

# Keep the harness-specific entry point in charge of Codex invocations. It
# pins HARNESS=codex and re-enters this shared pipeline without the selector.
if [[ "${1:-}" == "--harness" && "${2:-}" == "codex" ]]; then
    shift 2
    SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
    exec "${SCRIPT_DIR}/codex/implement-epic.sh" "$@"
fi

if [[ $# -lt 1 || ! "$1" =~ ^[0-9]+$ ]]; then
    echo "usage: $(basename "$0") <epic-issue-number> [extra harness args...]" >&2
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
HARNESS="${HARNESS:-claude}"
CODEX_SANDBOX="${CODEX_SANDBOX:-workspace-write}"
if [[ "$HARNESS" != "claude" && "$HARNESS" != "codex" ]]; then
    echo "HARNESS must be claude or codex" >&2
    exit 1
fi

FORMATTER='
import fs from "node:fs";
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

// The final report of a local analyze run, captured for the conformance loop (record #871, D12):
// each agent message (Codex) or the run result (Claude) overwrites the file, so it ends holding
// the final report.
const reportFile = process.env.ANALYZE_REPORT_FILE;
const capture = (text) => {
    if (reportFile && typeof text === "string") fs.writeFileSync(reportFile, text + "\n");
};

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
    let ev;
    try { ev = JSON.parse(line); } catch { return; }

    switch (ev.type) {
        case "thread.started":
            console.log(dim(`session ${ev.thread_id}`));
            break;
        case "item.started":
            if (ev.item?.type === "command_execution") console.log(cyan(`  ● ${clip(ev.item.command, 120)}`));
            break;
        case "item.completed":
            if (ev.item?.type === "agent_message") {
                console.log("\n" + ev.item.text);
                capture(ev.item.text);
            }
            else if (ev.item?.aggregated_output) console.log(dim(`    ⎿ ${clip(ev.item.aggregated_output, 200)}`));
            break;
        case "turn.completed":
            console.log(bold("\n=== Codex turn completed ==="));
            break;
        case "turn.failed":
            console.error(ev.error?.message ?? "Codex turn failed");
            process.exitCode = 1;
            break;
        case "error":
            console.error(ev.message ?? "Codex stream error");
            process.exitCode = 1;
            break;
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
                capture(ev.result);
            }
            if (ev.is_error) {
                process.exitCode = 1;
            }
            break;
        }
    }
});
'

# One invocation = one fresh context. pipefail propagates CLI and stream failures.
run_agent() {
    local prompt="$1"
    shift
    if [[ "$HARNESS" == "codex" ]]; then
        # Codex has skills, not Claude slash commands or its /goal extension. The turn caps in
        # these prompts remain instructions, not a CLI-enforced budget, on either harness.
        prompt="${prompt/#\/goal /}"
        prompt="${prompt//\/nxs.analyze/\$nxs-analyze}"
        prompt="${prompt//\/nxs.close/\$nxs-close}"
        prompt="${prompt//\/nxs.decision-record/\$nxs-decision-record}"
        prompt="${prompt//\/nxs.distill/\$nxs-distill}"
        prompt="${prompt//\/nxs-epic-resolve/\$nxs-epic-resolve}"
        codex exec --sandbox "$CODEX_SANDBOX" --json "$@" -- "$prompt" \
            | node --input-type=module -e "$FORMATTER"
        return
    fi
    claude -p "$prompt" \
        --permission-mode "$PERMISSION_MODE" \
        --output-format stream-json \
        --verbose \
        "$@" \
        | node --input-type=module -e "$FORMATTER"
}

# Every stage here runs headless: nobody can answer a question, and a run that ends by asking one
# has produced nothing. Five consecutive runs of this script certified nothing because the
# certifying stage stopped on an unresolvable scope and asked which option to take — a reasonable
# thing to do interactively, and a dead end in `-p` mode.
UNATTENDED="

You are running unattended inside a headless script. Nobody can answer a question, so never end by \
asking which option to take, and never wait for a decision. If the stage cannot proceed — scope \
will not resolve, a precondition fails, anything else — state in your final message what blocked \
it, what you would have needed, and stop. Otherwise carry the stage through to its documented \
output."

# One analyze invocation, always carrying the unattended clause.
run_analyze() {
    run_agent "$1${UNATTENDED}" ${ANALYZE_ARGS[@]+"${ANALYZE_ARGS[@]}"}
}

# A local analyze run writes no file (record #871, D12), so each run's final terminal report is
# captured into this script's own scratch, one file per run. The directory sits under the
# gitignored .nexus/tmp/ but is not named epic-<n>, fix-<n> or intake-<n>, so no stage reads it.
REPORT_DIR=".nexus/tmp/implement-epic-${N}"
ANALYZE_RUN=0
LAST_REPORT=""
run_local_analyze() {
    ANALYZE_RUN=$(( ANALYZE_RUN + 1 ))
    mkdir -p "$REPORT_DIR"
    LAST_REPORT="${REPORT_DIR}/analyze-${ANALYZE_RUN}.md"
    : > "$LAST_REPORT"
    export ANALYZE_REPORT_FILE="$LAST_REPORT"
    run_analyze "/nxs.analyze ${N}"
    unset ANALYZE_REPORT_FILE
}

GOAL="/goal Every story sub-issue of epic #${N} is implemented on a new branch — \
one commit per story, in blocked_by order, each commit body ending with a line \
reading exactly 'Closes #<that story's issue number>' — and the full test suite \
passes. Prove it: git log shows one commit per story, each with its Closes line, \
test command exits 0. Start by running /nxs-epic-resolve ${N}, then read the \
decision-record sub-issue it names with gh issue view. The record is binding: \
every guarantee (G<n>) under Guarantees must hold, including those under \
'Existing behaviour to preserve'. Each decision (D<n>) under 'Design rationale \
and mechanism' → 'Decisions and reasons' is built in the commit of the story \
its 'Delivered by' line names, the way Mechanism describes; a decision \
delivered by an issue outside this epic is not yours to build. Do the Approval \
brief's 'Before implementation' items before the first story; if one cannot be \
done from this checkout, name it and stop. Leave 'Committed follow-up' items \
and Concept-store changes alone — other issues and /nxs.distill deliver them. \
Before starting each story, re-read its epic.md section and the decisions it \
delivers. Do not push and do not open a PR — the calling script does both. \
Stop after ${TURNS} turns."

ANALYZE_ARGS=("$@")

echo ">>> stage 1: implement epic #${N} | harness: ${HARNESS} | turn cap: ${TURNS}" >&2
run_agent "$GOAL" "$@"

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

# GitHub links an issue to a pull request only from closing words in the pull
# request *body*; a commit's Closes line closes the issue on merge but links no
# pull request. Close reads that link, so every body below repeats the branch's
# own Closes lines, each once, in commit order, exactly as the commits wrote them.
BASE_REF="$BASE"
git rev-parse --verify --quiet "origin/${BASE}" >/dev/null && BASE_REF="origin/${BASE}"
STORY_CLOSES="$(git log --reverse --format=%B "${BASE_REF}..HEAD" \
    | sed -nE 's/^[[:space:]]*Closes[[:space:]]+(([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#[0-9]+)[[:space:]]*$/Closes \1/p' \
    | awk '!seen[$0]++')"
if [[ -z "$STORY_CLOSES" ]]; then
    echo "!!! no commit on ${BRANCH} closes a story with a 'Closes #<n>' line — close will report every story as unshipped until the PR body names them" >&2
fi

pr_body_intro() {
    echo "Implements the story sub-issues of #${N}, one commit per story in blocked_by order."
    if [[ -n "$STORY_CLOSES" ]]; then
        echo ""
        echo "$STORY_CLOSES"
    fi
    echo ""
    echo "Each commit body carries its own \`Closes #<story>\` line too. The lines above make"
    echo "GitHub link each story to this PR, which close reads. The epic itself closes through"
    echo "\`/nxs.close\`, not by merge."
}

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
$(pr_body_intro)

Draft opened by \`utils/implement-epic.sh\`; \`/nxs.analyze\` runs against it next.
EOF
)"
fi

# Resolved once — used only once conformance goes clean, to certify the result
# to this PR by number.
PR_NUM="$(gh pr view "$BRANCH" --json number --jq .number)"

if [[ "$ANALYZE" != "1" ]]; then
    exit 0
fi

echo "" >&2
echo ">>> stage 2: /nxs.analyze #${N} (fresh context)" >&2
rm -rf "$REPORT_DIR"
run_local_analyze

# --- stage 3: conformance rounds (local mode) -------------------------------
#
# /nxs.analyze run without a pull request writes no file; its terminal report
# ends with one fixed line (record #871, D12):
#
#   Analyze result: critical=<C> high=<H> medium=<M> low=<L> head=<full HEAD>
#
# A critical or high count means the code does not yet do what the planning
# said. One round is two fresh contexts — a fix context that works only from
# the captured report, then an analyze context that writes the next one —
# repeated until the counts are clean, the round cap is reached, or a round
# changes nothing. Open story issues are a note in the report, not a finding,
# so they never keep this loop spinning. A run that stopped before judging (a
# blocked record, a redirect to a pull request once a story has merged, a
# failure) prints no result line, and the loop stops on it. The branch this
# script implements on has no merged story, so analyze by epic number runs
# its local check rather than redirecting.

# The last result line of a captured report → CRIT / HIGH (the gating counts)
# and RHEAD (the commit analyzed). The last one, so a report that quotes the
# line's form earlier is still read by its own result.
read_result() {
    local f="$1" line
    line="$(grep -oE 'Analyze result: critical=[0-9]+ high=[0-9]+ medium=[0-9]+ low=[0-9]+ head=[0-9a-f]{7,40}' "$f" 2>/dev/null | tail -1 || true)"
    [[ -n "$line" ]] || return 1
    CRIT="$(sed -E 's/.*critical=([0-9]+).*/\1/' <<<"$line")"
    HIGH="$(sed -E 's/.* high=([0-9]+).*/\1/' <<<"$line")"
    RHEAD="$(sed -E 's/.*head=([0-9a-f]+).*/\1/' <<<"$line")"
}

# The fix half of a round. Everything it needs is in the text: the report path,
# the round, the suite. Nothing is inherited from an earlier context, which is
# the whole point — a late round reads as little as the first one did.
fix_prompt() {
    local report="$1" round="$2"
    cat <<EOF
/goal Every critical and high finding listed in ${report} is fixed in the code on this branch, the fixes are committed, and \`${TEST_CMD}\` exits 0. This is round ${round} of ${CONFORM_ROUNDS} on epic #${N}.

Work from the report, not from the epic. \`${report}\` is the terminal report of the /nxs.analyze run just before this round, and the whole work list: read it first and restate each critical and high finding as one line — the file, what is wrong, and what the planning asked for. Then read only what a finding names: the acceptance criterion, or the record guarantee (G<n>) or decision (D<n>) it cites, and the files it points at. Do not re-derive the analysis, do not read the epic or the decision record end to end, and do not run /nxs.analyze — the calling script re-runs it in a fresh context the moment you stop.

Fix critical findings first, then high, then any medium or low finding whose fix stays inside a file you have already touched. Each fix is the smallest change that satisfies the criterion the finding cites. Test first: write or amend the test that pins the behaviour before the code that satisfies it.

Never make a finding disappear instead of fixing it. Do not edit ${report}, do not weaken, skip or delete a test, and do not edit epic.md or the decision record so that the code matches. If a finding is wrong, or the only honest fix is a planning change — a revised guarantee or decision, a re-filed acceptance criterion — leave the code as it is, name the finding in your final message, and stop. That is the lead's decision, taken through /nxs.decision-record --revise.

Story issues that are still open are a note in the report, not a finding. Leave them open and do not act on them; the lead closes them before /nxs.close.

Never answer a departure, a finding or a deferred-scope proposal. Post no comment on the pull request, and above all no answer line (\`<ID> — accepted: <reason>\`, \`<ID> — waived: <reason>\`, \`<ID> — approved\`): this run posts as a person who can speak for the repository, so an answer it posts would count as theirs, and only that person may accept, waive or approve. The calling script stops the run if a comment holding an answer line appears on the pull request during this round.

Before committing, run the tests your change touches, then \`${TEST_CMD}\` once. Commit on this branch with a subject naming what now holds. Leave the per-story commits and their \`Closes #<n>\` lines alone — this is a follow-up commit, never an amend and never a rebase. Append a decision stub per CLAUDE.md for any non-obvious choice. Do not push and do not touch the pull request; the calling script does both.

Finish with one line per finding: fixed, or left alone with the reason. Stop after ${FIX_TURNS} turns.
EOF
}

# The comments on the pull request that hold an answer line, one link per line, read through the
# same reader analyze applies answers with (`nexus pr-answers`), never a second one. A failed read
# stops the run: it is never "no answer".
answer_comments() {
    local out
    if ! out="$(nexus pr-answers --pr "$PR_NUM" --urls)"; then
        echo "!!! cannot read the comments on PR #${PR_NUM} to check for answers — stopping" >&2
        exit 1
    fi
    printf '%s' "$out"
}

# An unattended run must never answer (record #871, D13). The trusted-author filter trusts the
# account, and this run posts as the lead, so an answer it posted would count as the lead's own.
# The fix prompt forbids it; this check is what holds when the prompt is not followed: any comment
# holding an answer line that appeared during the round stops the run, named.
stop_on_new_answers() {
    local before="$1" round="$2" after posted
    after="$(answer_comments)"
    posted="$(comm -13 <(sort <<<"$before") <(sort <<<"$after") | sed '/^$/d')"
    if [[ -n "$posted" ]]; then
        echo "!!! fix round ${round} posted a comment answering an ID on PR #${PR_NUM} — an unattended run" >&2
        echo "!!! must never accept, waive or approve; a person must review and delete it. Stopping:" >&2
        while IFS= read -r url; do echo "!!!   ${url}" >&2; done <<<"$posted"
        exit 1
    fi
}

ROUND=1
LAST_STATE=""
while :; do
    if ! read_result "$LAST_REPORT"; then
        echo "!!! /nxs.analyze ${N} printed no result line (${LAST_REPORT}) — it stopped before judging:" >&2
        echo "!!! a blocked record, a redirect to a pull request, or a failure. See its report there." >&2
        exit 1
    fi

    if (( CRIT == 0 && HIGH == 0 )); then
        echo "" >&2
        echo ">>> conformance clean at ${RHEAD} — 0 critical, 0 high (${LAST_REPORT})" >&2
        break
    fi

    if [[ "$CONFORM" != "1" ]]; then
        echo "!!! conformance blocked: ${CRIT} critical, ${HIGH} high (${LAST_REPORT})" >&2
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
    ANSWERS_BEFORE="$(answer_comments)"
    run_agent "$(fix_prompt "$LAST_REPORT" "$ROUND")" "$@"
    stop_on_new_answers "$ANSWERS_BEFORE" "$ROUND"

    echo "" >&2
    echo ">>> pushing ${BRANCH} to origin" >&2
    git push

    echo "" >&2
    echo ">>> stage 3.${ROUND}b: /nxs.analyze #${N} (fresh context)" >&2
    run_local_analyze

    ROUND=$(( ROUND + 1 ))
done

# --- stage 4: certify to the PR, then finalize it ---------------------------
#
# Local analyze just went clean, but a local run leaves nothing /nxs.close --pr
# reads — it reads a PR review. One `/nxs.analyze --pr` run, in its
# own worktree and its own context, publishes that review (or, when this
# identity is the PR's own author and GitHub refuses a self-review, the
# documented fallback comment) for the same commit local mode just cleared.
# The script then reads that block back itself, rather than assuming it
# agrees with the local run — a diff-exclusion or worktree-checkout
# difference between the two modes should fail loudly here, not get papered
# over.

# A stage-4 failure has to leave a trace on the PR itself. Until it does, a draft PR whose body
# still reads "analyze runs against it next" is indistinguishable from a run that never got this
# far — which is exactly how five consecutive runs of this script failed unnoticed.
note_pr_uncertified() {
    local reason="$1"
    echo "!!! ${reason}" >&2
    gh pr edit "$PR_NUM" --body "$(cat <<EOF
$(pr_body_intro)

> [!WARNING]
> **Conformance is not certified.** \`utils/implement-epic.sh\` reached the certifying
> \`/nxs.analyze --pr ${PR_NUM}\` stage and stopped:
>
> ${reason}
>
> Local analyze last reported ${LAST_LOCAL:-no result}. This PR stays in draft until a
> \`/nxs.analyze --pr ${PR_NUM}\` run publishes a clean machine block for its head commit.
EOF
)" >/dev/null || echo "!!! could not annotate PR #${PR_NUM} with the failure" >&2
    exit 1
}

# What the local loop last saw, for the annotation above.
LAST_LOCAL="${CRIT:-?} critical / ${HIGH:-?} high at ${RHEAD:-unknown} (${LAST_REPORT:-no report})"

echo "" >&2
echo ">>> stage 4: certifying via /nxs.analyze --pr ${PR_NUM} (fresh context)" >&2
if ! run_analyze "/nxs.analyze --pr ${PR_NUM}"; then
    note_pr_uncertified "the certifying run itself failed — see the stage 4 output above."
fi

# Pull the trusted analyze machine block off the PR that the certifying run
# just published — a review body, or (self-authored-PR fallback) a comment
# body, either way carrying `<!-- nexus:analyze-receipt -->` — the same read
# /nxs.close --pr does (components/commands/nxs.close.md §1.2): newest first,
# restricted to OWNER/MEMBER/COLLABORATOR authorship, the marker anchored at
# start-of-line so a quoted copy inside a reply can't be mistaken for a fresh
# block, and the block's own `pr:` field checked against this PR.
read_pr_receipt() {
    local body block
    body="$(gh pr view "$PR_NUM" --json reviews,comments --jq '
        ( [.reviews[]  | {body, at: .submittedAt, assoc: .authorAssociation}]
        + [.comments[] | {body, at: .createdAt,   assoc: .authorAssociation}] )
        | map(select(.assoc == "OWNER" or .assoc == "MEMBER" or .assoc == "COLLABORATOR"))
        | map(select(.body | test("(?m)^<!-- nexus:analyze-receipt -->$")))
        | sort_by(.at)
        | last
        | .body // empty
    ')"
    [[ -n "$body" ]] || return 1

    block="$(awk '/^```yaml$/{f=1;next} /^```$/{f=0} f' <<<"$body")"
    [[ -n "$block" ]] || return 1
    grep -q "^pr: ${PR_NUM}\$" <<<"$block" || return 1

    CRIT="$(sed -n 's/.*critical: *\([0-9][0-9]*\).*/\1/p' <<<"$block")"
    HIGH="$(sed -n 's/.*high: *\([0-9][0-9]*\).*/\1/p' <<<"$block")"
    RHEAD="$(sed -n 's/^head: *\([^ ]*\).*/\1/p' <<<"$block" | head -1)"
    [[ -n "$CRIT" && -n "$HIGH" && -n "$RHEAD" ]]
}

if ! read_pr_receipt; then
    note_pr_uncertified "\`/nxs.analyze --pr ${PR_NUM}\` published no trusted machine block. It \
most often means the run could not resolve which epic and stories this PR implements, and stopped \
rather than certify the wrong ones."
fi
if (( CRIT != 0 || HIGH != 0 )); then
    note_pr_uncertified "\`/nxs.analyze --pr ${PR_NUM}\` reported ${CRIT} critical / ${HIGH} high \
at \`${RHEAD}\`, disagreeing with the local run, which was clean. The PR-mode verdict is the one \
that counts: fix what it names, then re-run."
fi

echo "" >&2
echo ">>> certified clean at ${RHEAD} — refreshing PR #${PR_NUM} and taking it off draft" >&2

EPIC_TITLE="$(gh issue view "$N" --json title --jq .title)"
gh pr edit "$PR_NUM" \
    --title "epic #${N}: ${EPIC_TITLE}" \
    --body "$(cat <<EOF
$(pr_body_intro)

Conformance is clean at \`${RHEAD}\` — 0 critical, 0 high; see the latest
analyze review above for the full report. Ready for review.
EOF
)"

if [[ "$(gh pr view "$PR_NUM" --json isDraft --jq .isDraft)" == "true" ]]; then
    echo ">>> marking PR #${PR_NUM} ready for review" >&2
    gh pr ready "$PR_NUM"
fi
