#!/bin/bash

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="$(dirname "$REPO_ROOT")"
STATE_FILE="${REPO_ROOT}/.tmp/nxs_yolo_state.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usage() {
    cat <<EOF
nxs.yolo.sh - Streamlined YOLO mode for issue implementation

Usage: $SCRIPT_NAME <issue-number>
   or: $SCRIPT_NAME <start>-<end>
   or: $SCRIPT_NAME --resume

Arguments:
    issue-number    Single GitHub issue number (e.g., 123)
    start-end       Range of issues to process (e.g., 42-45)
    --resume        Resume from last failed issue in a previous run

Examples:
    $SCRIPT_NAME 123          Process single issue #123
    $SCRIPT_NAME 42-45        Process issues #42 through #45 sequentially
    $SCRIPT_NAME --resume     Resume interrupted batch processing

Workflow:
    1. Creates dedicated worktree for the issue
    2. Syncs environment (npm install, etc.)
    3. Invokes streamlined nxs.yolo.dev command
    4. Commits changes and closes issue on success
    5. Cleans up worktree

Resume behavior:
    - Reverts failed issue's worktree to last commit (clean slate)
    - Continues from failed issue through end of original range
    - State is tracked in .tmp/nxs_yolo_state.json

Note: Technical decisions and conflicts still require user input.
EOF
}

die() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

info() {
    echo -e "${BLUE}→${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

#------------------------------------------------------------------------------
# State Management Functions
#------------------------------------------------------------------------------

init_state() {
    local original_args="$1"
    local start_issue="$2"
    local end_issue="$3"
    
    mkdir -p "$(dirname "$STATE_FILE")"
    
    cat > "$STATE_FILE" <<EOF
{
    "original_args": "${original_args}",
    "start_issue": ${start_issue},
    "end_issue": ${end_issue},
    "current_issue": ${start_issue},
    "last_success": null,
    "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "status": "in_progress"
}
EOF
    info "State initialized: issues #${start_issue}-#${end_issue}"
}

update_state_current() {
    local issue_number="$1"
    
    if [ ! -f "$STATE_FILE" ]; then
        return 0
    fi
    
    local tmp_file="${STATE_FILE}.tmp"
    jq --argjson issue "$issue_number" '.current_issue = $issue' "$STATE_FILE" > "$tmp_file"
    mv "$tmp_file" "$STATE_FILE"
}

update_state_success() {
    local issue_number="$1"
    
    if [ ! -f "$STATE_FILE" ]; then
        return 0
    fi
    
    local tmp_file="${STATE_FILE}.tmp"
    jq --argjson issue "$issue_number" '.last_success = $issue' "$STATE_FILE" > "$tmp_file"
    mv "$tmp_file" "$STATE_FILE"
}

complete_state() {
    if [ ! -f "$STATE_FILE" ]; then
        return 0
    fi
    
    local tmp_file="${STATE_FILE}.tmp"
    jq '.status = "completed"' "$STATE_FILE" > "$tmp_file"
    mv "$tmp_file" "$STATE_FILE"
    
    success "State marked as completed"
}

read_state() {
    if [ ! -f "$STATE_FILE" ]; then
        die "No state file found. Nothing to resume."
    fi
    
    local status
    status=$(jq -r '.status' "$STATE_FILE")
    
    if [ "$status" = "completed" ]; then
        die "Previous run completed successfully. Nothing to resume."
    fi
    
    # Export state values
    STATE_ORIGINAL_ARGS=$(jq -r '.original_args' "$STATE_FILE")
    STATE_START_ISSUE=$(jq -r '.start_issue' "$STATE_FILE")
    STATE_END_ISSUE=$(jq -r '.end_issue' "$STATE_FILE")
    STATE_CURRENT_ISSUE=$(jq -r '.current_issue' "$STATE_FILE")
    STATE_LAST_SUCCESS=$(jq -r '.last_success' "$STATE_FILE")
    
    info "Loaded state: resuming from issue #${STATE_CURRENT_ISSUE}"
    info "Original range: #${STATE_START_ISSUE}-#${STATE_END_ISSUE}"
    if [ "$STATE_LAST_SUCCESS" != "null" ]; then
        info "Last successful: #${STATE_LAST_SUCCESS}"
    fi
}

clear_state() {
    if [ -f "$STATE_FILE" ]; then
        rm "$STATE_FILE"
        info "State file cleared"
    fi
}

#------------------------------------------------------------------------------
# Workspace Management Functions
#------------------------------------------------------------------------------

setup_workspace_from_issue() {
    local issue_number="$1"
    local issue_title="$2"
    local issue_body="$3"

    local script_path="${REPO_ROOT}/claude/.claude/skills/nxs-workspace-setup/scripts/setup_workspace.py"

    if [ ! -f "$script_path" ]; then
        die "Workspace setup script not found: $script_path"
    fi

    # Call the Python script which handles:
    # 1. Parsing ## Git Workspace section from issue body
    # 2. Reusing existing worktrees
    # 3. Creating new worktrees with proper naming
    local result
    result=$(python3 "$script_path" \
        --issue-number "$issue_number" \
        --issue-title "$issue_title" \
        --issue-body "$issue_body" \
        --yolo-mode "true") || die "Workspace setup script failed"

    # Parse JSON result
    local action_taken
    action_taken=$(echo "$result" | jq -r '.action_taken')

    local workspace_path
    workspace_path=$(echo "$result" | jq -r '.workspace_path')

    local workspace_branch
    workspace_branch=$(echo "$result" | jq -r '.workspace_branch')

    case "$action_taken" in
        "reused")
            warn "Reusing existing worktree at $workspace_path"
            ;;
        "created")
            success "Created worktree at $workspace_path (branch: $workspace_branch)"
            ;;
        "skipped")
            info "Already on feature branch $workspace_branch, using current directory"
            workspace_path=$(pwd)
            ;;
        "conflict")
            local conflict_msg
            conflict_msg=$(echo "$result" | jq -r '.checkpoint_data.message')
            die "Branch conflict: $conflict_msg. Please resolve manually."
            ;;
        "error")
            local error_msg
            error_msg=$(echo "$result" | jq -r '.checkpoint_data.message')
            die "Workspace setup failed: $error_msg"
            ;;
        *)
            die "Unexpected action_taken: $action_taken"
            ;;
    esac

    # Return JSON for caller to parse
    echo "$result"
}

revert_worktree() {
    local worktree_path="$1"
    
    if [ ! -d "$worktree_path" ]; then
        warn "Worktree does not exist, will be created fresh"
        return 0
    fi
    
    info "Reverting worktree to last commit (clean slate)..."
    
    # Discard all uncommitted changes
    (cd "$worktree_path" && git checkout -- . 2>/dev/null || true)
    (cd "$worktree_path" && git clean -fd 2>/dev/null || true)
    
    success "Worktree reverted to clean state"
}

sync_environment() {
    local worktree_path="$1"
    
    info "Syncing environment in $worktree_path..."
    
    # Ensure .tmp is gitignored
    local gitignore="${worktree_path}/.gitignore"
    if [ -f "$gitignore" ]; then
        if ! grep -q "^\.tmp/$" "$gitignore" 2>/dev/null; then
            echo ".tmp/" >> "$gitignore"
        fi
    fi
    
    # Check for package.json and run npm install
    if [ -f "${worktree_path}/package.json" ]; then
        (cd "$worktree_path" && npm install --silent)
        success "npm dependencies installed"
    fi
    
    # Check for other common setup files
    if [ -f "${worktree_path}/.env.example" ] && [ ! -f "${worktree_path}/.env" ]; then
        cp "${worktree_path}/.env.example" "${worktree_path}/.env"
        success "Created .env from .env.example"
    fi
}

fetch_issue() {
    local issue_number="$1"
    
    # Fetch issue as JSON
    local issue_json
    issue_json=$(gh issue view "$issue_number" --json number,title,body,url,state) || die "Failed to fetch issue #$issue_number"
    
    # Check if issue is closed
    local state
    state=$(echo "$issue_json" | jq -r '.state')
    if [ "$state" = "CLOSED" ]; then
        warn "Issue #$issue_number is already CLOSED"
        read -rp "Continue anyway? [y/N] " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            die "Aborted by user"
        fi
    fi
    
    echo "$issue_json"
}

commit_and_close() {
    local worktree_path="$1"
    local issue_number="$2"
    local issue_title="$3"
    local branch_name="$4"

    info "Staging changes..."
    (cd "$worktree_path" && git add -A)

    # Check if there are changes to commit
    if (cd "$worktree_path" && git diff --cached --quiet); then
        warn "No changes to commit"
        return 0
    fi

    info "Committing changes..."
    local commit_msg="feat: implement #${issue_number} - ${issue_title}"
    (cd "$worktree_path" && git commit -m "$commit_msg")

    local commit_hash
    commit_hash=$(cd "$worktree_path" && git rev-parse --short HEAD)
    success "Committed: $commit_hash"

    # Post implementation comment
    info "Posting implementation summary to GitHub..."
    local comment="## Implementation Complete

Implemented in commit \`${commit_hash}\` on branch \`${branch_name}\`.

### Changes
$(cd "$worktree_path" && git diff --name-only HEAD~1 | sed 's/^/- /')

---
*Automated via nxs.yolo.sh*"
    
    gh issue comment "$issue_number" --body "$comment"
    success "Posted comment to issue #$issue_number"
    
    # Close the issue
    info "Closing issue #$issue_number..."
    gh issue close "$issue_number"
    success "Issue #$issue_number closed"
    
    echo "$commit_hash"
}

cleanup_worktree() {
    local worktree_path="$1"
    local keep_worktree="${2:-false}"
    
    if [ "$keep_worktree" = "true" ]; then
        info "Keeping worktree at $worktree_path"
        return 0
    fi
    
    info "Cleaning up worktree..."
    git worktree remove "$worktree_path" --force 2>/dev/null || true
    success "Worktree removed"
}

#------------------------------------------------------------------------------
# Main Processing Function
#------------------------------------------------------------------------------

process_issue() {
    local issue_number="$1"
    local is_resume="${2:-false}"
    
    header "Processing Issue #$issue_number"
    
    # Update state: mark current issue
    update_state_current "$issue_number"
    
    # Phase 1: Fetch issue
    info "Fetching issue #$issue_number..."
    local issue_json
    issue_json=$(fetch_issue "$issue_number")
    
    local issue_title
    issue_title=$(echo "$issue_json" | jq -r '.title')
    local issue_body
    issue_body=$(echo "$issue_json" | jq -r '.body')
    local issue_url
    issue_url=$(echo "$issue_json" | jq -r '.url')
    
    success "Fetched: $issue_title"
    
    # Phase 2: Create or revert worktree using workspace setup script
    local workspace_result
    local worktree_path
    local branch_name

    if [ "$is_resume" = "true" ]; then
        # For resume, call setup which will reuse existing worktree
        info "Resuming workspace..."
        workspace_result=$(setup_workspace_from_issue "$issue_number" "$issue_title" "$issue_body")
        worktree_path=$(echo "$workspace_result" | jq -r '.workspace_path')
        branch_name=$(echo "$workspace_result" | jq -r '.workspace_branch')
        revert_worktree "$worktree_path"
    else
        info "Setting up workspace..."
        workspace_result=$(setup_workspace_from_issue "$issue_number" "$issue_title" "$issue_body")
        worktree_path=$(echo "$workspace_result" | jq -r '.workspace_path')
        branch_name=$(echo "$workspace_result" | jq -r '.workspace_branch')
    fi
    success "Workspace ready: $worktree_path (branch: $branch_name)"
    
    # Phase 3: Sync environment
    sync_environment "$worktree_path"
    
    # Phase 4: Write context file for the command
    local tmp_dir="${worktree_path}/.tmp"
    local context_filename="nxs_yolo_${issue_number}.md"
    local context_file="${tmp_dir}/${context_filename}"
    
    mkdir -p "$tmp_dir"
    cat > "$context_file" <<EOF
# YOLO Context

## Workspace
- **Path**: \`${worktree_path}\`
- **Branch**: \`${branch_name}\`
- **Issue**: #${issue_number}

## GitHub Issue #${issue_number}: ${issue_title}

**URL**: ${issue_url}

### Description

${issue_body}
EOF
    
    success "Context written to $context_file"
    
    # Phase 5: Invoke the streamlined YOLO command
    header "Invoking /nxs.yolo.dev ${context_filename}"
    
    # Run command from worktree directory, passing context filename
    if ! (cd "$worktree_path" && claude -p "/nxs.yolo.dev ${context_filename}" --dangerously-skip-permissions); then
        die "Implementation failed for issue #$issue_number"
    fi
    
    # Phase 6: Commit and close
    header "Shipping Implementation"
    commit_and_close "$worktree_path" "$issue_number" "$issue_title" "$branch_name"
    
    # Update state: mark success
    update_state_success "$issue_number"
    
    # Phase 7: Cleanup (keep worktree by default in YOLO for inspection)
    cleanup_worktree "$worktree_path" "true"
    
    success "Issue #$issue_number complete!"
}

run_batch() {
    local start="$1"
    local end="$2"
    local resume_from="${3:-$start}"
    local is_resume="${4:-false}"
    
    local total=$((end - start + 1))
    
    for ((i = resume_from; i <= end; i++)); do
        local position=$((i - start + 1))
        echo ""
        echo -e "${YELLOW}[${position}/${total}]${NC}"
        
        # Only pass is_resume for the first issue in a resume operation
        if [ "$is_resume" = "true" ] && [ "$i" -eq "$resume_from" ]; then
            process_issue "$i" "true"
        else
            process_issue "$i" "false"
        fi
        
        echo ""
    done
}

#------------------------------------------------------------------------------
# Entry Point
#------------------------------------------------------------------------------

# Handle help flag
for arg in "$@"; do
    case "$arg" in
        -h|--help)
            usage
            exit 0
            ;;
    esac
done

# Validate input
args="$*"
if [ -z "$args" ]; then
    usage >&2
    exit 1
fi

# Validate we're in a git repo
git rev-parse --git-dir > /dev/null 2>&1 || die "Not in a git repository"

# Validate gh CLI is available and authenticated
command -v gh > /dev/null 2>&1 || die "GitHub CLI (gh) is not installed"
gh auth status > /dev/null 2>&1 || die "GitHub CLI is not authenticated. Run: gh auth login"

# Validate claude CLI is available
command -v claude > /dev/null 2>&1 || die "Claude CLI is not installed"

# Validate jq is available (needed for state management)
command -v jq > /dev/null 2>&1 || die "jq is not installed (required for state management)"

#------------------------------------------------------------------------------
# Mode Selection
#------------------------------------------------------------------------------

if [ "$args" = "--resume" ]; then
    # Resume mode
    header "Resuming Previous Run"
    
    read_state
    
    run_batch "$STATE_START_ISSUE" "$STATE_END_ISSUE" "$STATE_CURRENT_ISSUE" "true"
    
    complete_state
    header "Batch Complete: Resumed and finished #${STATE_CURRENT_ISSUE}-#${STATE_END_ISSUE}"

elif [[ "$args" =~ ^([0-9]+)-([0-9]+)$ ]]; then
    # Range mode
    START="${BASH_REMATCH[1]}"
    END="${BASH_REMATCH[2]}"

    # Validate range
    if [[ "$START" -gt "$END" ]]; then
        die "Start ($START) cannot be greater than end ($END)"
    fi

    # Calculate total
    TOTAL=$((END - START + 1))

    # Initialize state tracking
    init_state "$args" "$START" "$END"

    header "Processing $TOTAL Issues: #$START through #$END"

    run_batch "$START" "$END"

    complete_state
    header "Batch Complete: $TOTAL Issues Processed"

elif [[ "$args" =~ ^#?([0-9]+)$ ]]; then
    # Single issue mode (strip optional # prefix)
    issue_number="${BASH_REMATCH[1]}"
    
    # Initialize state for single issue (allows resume even for single)
    init_state "$issue_number" "$issue_number" "$issue_number"
    
    process_issue "$issue_number"
    
    complete_state

else
    die "Invalid format. Expected: <number>, <start>-<end>, or --resume"
fi