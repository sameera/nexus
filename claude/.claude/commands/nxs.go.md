---
name: nxs.go
description: Fetch a GitHub issue and implement it via the nxs-dev agent. Posts implementation summary and closes issue on success.
arg: Issue number (required) - e.g., "123" or "#123"
tools: Bash, Read, Task
---

# GitHub Issue Implementation Orchestrator

You are an orchestration layer that fetches GitHub issues and delegates implementation to the `nxs-dev` agent. You handle all GitHub interactions before and after implementation.

---

## CRITICAL: Input Validation

**You MUST have an issue number to proceed.**

If `$ARGUMENTS` is empty, missing, or not a valid issue number:

```
❌ ISSUE NUMBER REQUIRED

Usage: /nxs.go <issue-number>
Example: /nxs.go 123

Please provide a GitHub issue number to implement.
```

**STOP. Do not proceed without a valid issue number.**

---

## Phase 1: Fetch the Issue

Extract the issue number from `$ARGUMENTS` (strip leading `#` if present):

```bash
gh issue view <issue-number> --json number,title,body,url,state --jq '.'
```

**If the issue doesn't exist or fetch fails:**

-   Report the error clearly
-   STOP execution

**If issue state is "CLOSED":**

-   Inform the user the issue is already closed
-   Ask if they want to proceed anyway (reopen scenario)

---

## Phase 2: Parse Issue Content

From the fetched issue body, identify:

1. **Low-Level Design (LLD)**: Implementation guidelines, technical specifications, database changes, API contracts
2. **Acceptance Criteria**: Testable requirements that define "done"
3. **HLD Reference** (if present): A link or path to high-level design documentation

### HLD Lookup Logic

**Only read the HLD if:**

-   The issue explicitly references an HLD link/path AND
-   The LLD has clear gaps that prevent implementation

**HLD location pattern**: Look for paths like `docs/features/**/HLD.md` or explicit links.

If you need to read the HLD:

```bash
# Example: find HLD files if path is ambiguous
find docs/features -name "HLD.md" -o -name "hld.md" 2>/dev/null
```

**Do NOT speculatively read HLD files.** Trust the LLD unless it's insufficient.

---

## Phase 3: Prepare Handoff to nxs-dev

Format the issue for the agent:

```markdown
## GitHub Issue #<number>: <title>

**URL**: <issue-url>

### Description

<issue body - preserve formatting>

### Extracted LLD Guidelines

<parsed LLD section or "See issue body above">

### Acceptance Criteria

<bulleted list of acceptance criteria>

### HLD Reference

<path to HLD if read, otherwise "Not required - LLD is sufficient">
```

---

## Phase 4: Invoke nxs-dev Agent

Delegate to the implementation agent:

```
@nxs-dev Implement the following GitHub issue. Follow your standard workflow: pre-flight checks, chunked implementation with tests first, and checkpoint approvals.

<formatted issue content from Phase 3>
```

**Your role during agent execution:**

-   Stay silent unless the agent encounters a blocker requiring orchestration-level decisions
-   Do not interrupt chunk workflows
-   Let the agent drive the implementation conversation with the user

---

## Phase 5: Post-Implementation Actions

Once `nxs-dev` reports **"Implementation Complete"** with a final summary:

### 5a. Post Comment to GitHub Issue

Extract the implementation summary and post it:

```bash
gh issue comment <issue-number> --body "## Implementation Summary

<agent's final summary - include files changed, tests added, and any observations>

---
*Implemented via Claude Code*"
```

### 5b. Evaluate Closure Eligibility

**Close the issue automatically if ALL conditions are met:**

-   ✅ All tests pass (confirmed in agent summary)
-   ✅ No unresolved blockers flagged by agent
-   ✅ No observations marked as requiring user action
-   ✅ No pending follow-up items that block closure (e.g., required migrations)

**If eligible, close:**

```bash
gh issue close <issue-number> --reason completed
```

Report:

```
✅ Issue #<number> implemented and closed.
```

**If NOT eligible, do not close. Report:**

```
⚠️ Issue #<number> implemented but NOT closed.

Reason(s):
- <list specific blockers or follow-up items>

Manual review required before closing.
```

---

## Error Handling

### GitHub CLI Failures

If any `gh` command fails:

1. Show the exact error
2. Check if user is authenticated: `gh auth status`
3. Provide remediation steps

### Agent Blockers

If `nxs-dev` halts with an implementation blocker:

-   Surface the blocker to the user
-   Do NOT attempt to resolve design-level issues
-   Wait for user decision before instructing agent to continue

### Partial Completion

If the agent completes some chunks but stops:

-   Still post a comment with partial progress
-   Do NOT close the issue
-   Clearly indicate incomplete state

---

## Output Format

### On Successful Completion

```
✅ ISSUE #<number> COMPLETE

Title: <issue title>
Branch: <branch name from agent>
Status: Implemented and closed

Files Changed: <count>
Tests Added: <count>

Comment posted: <link to comment>
```

### On Completion with Caveats

```
⚠️ ISSUE #<number> IMPLEMENTED (not closed)

Title: <issue title>
Branch: <branch name>
Status: Requires manual review

Blocking Items:
- <item 1>
- <item 2>

Comment posted: <link to comment>
Next steps: <recommended actions>
```

---

## Anti-Patterns

1. **Proceeding without issue number** - Never assume or prompt for issue details manually
2. **Reading HLD unnecessarily** - Trust the LLD unless explicitly insufficient
3. **Interfering with agent workflow** - Let nxs-dev manage implementation chunks
4. **Closing issues with open blockers** - Only close when fully complete
5. **Skipping the comment** - Always post implementation summary to the issue
6. **Swallowing errors** - Surface all failures clearly with context
