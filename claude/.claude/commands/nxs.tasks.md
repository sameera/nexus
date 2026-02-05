---
description: Break down a High-Level Design into implementable GitHub issues
model: sonnet
tools: Read, Write, Glob, Grep, Task, Skill, Bash
---

# Role

Act as an experienced senior engineer performing technical decomposition and task planning.

# Context

- **HLD Source**: Resolved in priority order:
    1. Explicit file path provided in `$ARGUMENTS`
    2. The file currently open in the editor (passed as context)
- **User Input**: $ARGUMENTS

# Input Resolution

**CRITICAL**: Do NOT search for HLD files. Resolve the input source as follows:

1. **If `$ARGUMENTS` contains a path to `task-review.md`**: Treat as **resume mode** — skip to Step 7
2. **If `$ARGUMENTS` contains a file path to HLD.md**: Use that path directly
3. **If a file is provided in context** (open in editor): Use that file as the HLD
4. **Otherwise**: Stop and ask the user to either:
    - Open the HLD file in their editor and re-run the command, OR
    - Provide the file path as an argument: `/nxs.tasks path/to/HLD.md`
    - Resume from review: `/nxs.tasks path/to/tasks/task-review.md`

**Never** run `find`, `ls`, or search commands to locate HLD files.

# Resume Mode

When `task-review.md` is provided as input, the command enters **resume mode** to continue from a previous session that stopped at the Review Checkpoint.

## Validation

1. **Verify directory structure**:
    - Parent directory (of `tasks/`) must contain `epic.md` with `link` attribute (GitHub issue number)
    - Parent directory must contain `HLD.md`
    - `tasks/` folder must contain `TASK-*.md` files
    - If any missing, report error and exit with guidance

2. **Extract epic context**:
    - Parse `epic.md` frontmatter for `link` attribute → extract issue number
    - Count existing `TASK-*.md` files in `tasks/` folder

3. **Parse task-review.md for metrics**:
    - Extract summary metrics (tasks merged, terminology fixes)
    - Extract severity counts (critical/high/medium/low remaining issues)
    - Extract coverage percentages if available

4. **Skip to Step 6** (Review Checkpoint) with reconstructed metrics

5. **On user approval**, proceed to Step 7 (Create GitHub Issues)

# Workflow

## 1. Create Epic Issue

Before analyzing the HLD, create a GitHub issue for the parent epic:

1. Locate the `epic.md` file in the same directory as the HLD file
2. Invoke the `nxs-gh-create-epic` skill with the path to the epic.md file as an argument
3. Verify the `epic.md` frontmatter now contains a `link` attribute (e.g., `link: "#42"`)
4. Extract and store the issue number from the `link` attribute for use in task generation

If no `epic.md` exists in the HLD directory, warn the user and proceed without a parent issue.

## 2. Load & Analyze HLD

Read the High-Level Design document and extract:

- System components and their responsibilities
- Data models and relationships
- API contracts/interfaces
- Integration points
- Non-functional requirements (performance, security, etc.)
- Technology stack and constraints

## 3. Decompose into Tasks

Delegate HLD decomposition to `nxs-decomposer`:

1. Invoke `nxs-decomposer` with:
    - HLD file path
    - Epic issue number from Step 1
    - Request: "Decompose into implementation tasks"

2. The decomposer will return structured JSON with:
    - Sequenced tasks (≤2 days each, effort-sized)
    - Phase/category assignments (Infrastructure, Data Layer, Core Logic, API, Integration, Polish)
    - Dependency relationships (blocked_by/blocks)
    - Mermaid dependency graph
    - Parallelization opportunities

3. Validate response:
    - All tasks have required fields (sequence, title, category, summary, effort, labels)
    - Dependencies form valid DAG (no cycles)
    - No task exceeds M size (≤2 days)

**Fallback**: If decomposer fails or returns invalid JSON, report error and stop.

## 4. Generate Task Files

Generate task files by invoking the architect for LLD content, then running the task generation script.

### 4.1 Generate LLD Content

For each task from the decomposer, invoke `nxs-architect` in LLD-elaboration mode:

```
Invoke: nxs-architect
Mode: LLD-elaboration (HLD is authoritative)
Topic: Low-Level Design for TASK-{epic_number}.{sequence}: {title}
HLD Content: [relevant sections from HLD]
Task Context:
  - Category: {category}
  - Summary: {summary}
  - Blocked by: {blocked_by}
  - Blocks: {blocks}
Request:
  - FILES: List files to create/modify with purposes
  - INTERFACES: Key TypeScript interfaces/types
  - KEY_DECISIONS: Table of decisions with rationale (extract from HLD)
  - IMPLEMENTATION_NOTES: Patterns, edge cases, testing guidance
  - ACCEPTANCE_CRITERIA: Checklist items for this specific task
```

Store each architect response in the task object as `architect_response`.

### 4.2 Prepare Input JSON

Assemble all data into a JSON structure:

```json
{
  "epic_number": {epic issue number from Step 1},
  "epic_title": "{epic title from epic.md}",
  "epic_type": "{enhancement|bug from epic.md}",
  "output_dir": "{HLD directory}/tasks",
  "tasks": [
    {
      "sequence": 1,
      "title": "Task title",
      "category": "Category",
      "summary": "One paragraph summary",
      "effort": "S",
      "labels": ["frontend"],
      "blocked_by": [],
      "blocks": [2, 3],
      "architect_response": "### Files\n\n- `path/to/file.ts`..."
    }
  ]
}
```

Write this JSON to a temporary file (e.g., `/tmp/tasks-input-{epic_number}.json`).

### 4.3 Run Generation Script

Execute the task file generation script:

```bash
python .claude/skills/nxs-generate-tasks/scripts/generate_task_files.py /tmp/tasks-input-{epic_number}.json
```

### Expected Response

```json
{
  "status": "success",
  "tasks_generated": N,
  "output_dir": "path/to/tasks",
  "files": ["TASK-7.01.md", "TASK-7.02.md", ...],
  "fallbacks_used": N
}
```

### Error Handling

- If architect fails for a task, set `architect_response` to `null` (script uses fallbacks)
- If script returns error, report to user and stop
- If `fallbacks_used > 0`, warn user that some tasks have placeholder LLD content

## 5. Run Consistency Analysis & Auto-Remediation

**MANDATORY**: After generating task files, invoke the `nxs-analyzer` agent to validate consistency.

```
Invoke: nxs-analyzer
Context:
  - Epic directory: {epic-directory}
  - Mode: auto-remediate
Request:
  - Run consistency analysis on epic.md, HLD.md, and tasks/*.md
  - Apply auto-remediation for AUTO-classified findings
  - Generate tasks/task-review.md
  - Return metrics summary
```

The agent will:

1. Identify coverage gaps, inconsistencies, and superfluous tasks
2. Automatically fix AUTO-classified findings: merge superfluous tasks (barrel/export-only, verification-only, <1hr effort), normalize terminology, renumber sequentially, update dependencies
3. Generate `tasks/task-review.md` with remediation log and remaining manual issues
4. Return metrics: remediated count, remaining issues (CRITICAL/HIGH/MEDIUM/LOW), final task count, coverage %

**Expected Response** (JSON):

```json
{
    "task_review_path": "tasks/task-review.md",
    "metrics": {
        "total_findings": N,
        "auto_remediated": N,
        "remaining": { "critical": N, "high": N, "medium": N, "low": N },
        "coverage": { "user_stories": N, "hld_components": N, "nfrs": N },
        "final_task_count": N
    },
    "remediation_applied": { "tasks_merged": N, "terminology_fixes": N },
    "blocking_issues": boolean
}
```

Use these metrics in the Review Checkpoint (Step 6).

## 6. Review Checkpoint

**MANDATORY STOP** — Wait for user confirmation before creating GitHub issues.

**For fresh runs** (steps 1-5 completed):
Present summary: {N} tasks generated in `{path}/tasks/`, auto-remediation applied ({X} tasks merged, {Y} terminology fixes), remaining issues ({critical}/{high}/{medium}/{low}), coverage ({X}%). See `task-review.md` for full analysis.

**For resume mode** (task-review.md provided):
Present summary: "Resuming from previous session. {N} task files found in `{path}/tasks/`."
Parse and display metrics from `task-review.md` (remediation stats, remaining issues, coverage).

Display severity indicator:

- Critical > 0: "⛔ **CRITICAL ISSUES** — Resolve before proceeding"
- High > 0: "⚠️ **HIGH priority issues** — Review recommended"
- Otherwise: "✅ **No blocking issues**"

Prompt: "Review task files and `task-review.md`, then reply: `continue` (create all issues) | `skip 03, 05` (exclude specified) | `abort` (cancel to address findings)"

**Handle response** (same for both modes):

- `continue`: Proceed to Step 7
- `skip [numbers]`: Exclude specified, proceed to Step 7
- `abort`: Preserve files, inform user they can re-run `/nxs.analyze` or `/nxs.tasks`, exit

## 7. Create Task Issues

After receiving user confirmation to proceed, create GitHub issues for each approved task:

1. Invoke the `nxs-gh-create-task` skill with the path to the tasks folder as an argument
2. This will:
    - Create a GitHub issue for each `TASK-{EPIC}.{NN}.md` file
    - Apply the labels from frontmatter
    - Link each task issue to the parent epic via the `parent` attribute
3. Generate `./tasks.md` with the following structure:

```markdown
# {Epic Title}

**Epic**: {GitHub issue link}

## Tasks

### Phase 1: Infrastructure/Setup

- [#101](link) - TASK-{EPIC}.01: {Title}
- [#102](link) - TASK-{EPIC}.02: {Title}

### Phase 2: Data Layer

- [#103](link) - TASK-{EPIC}.03: {Title}

{Continue for each applicable phase...}

## Task Dependency Graph

\`\`\`mermaid
{Dependency flowchart}
\`\`\`

## Parallelization Opportunities

{Tasks that can be worked on simultaneously}

## Effort Estimate

{Total estimated effort range}
```

Group tasks into phases based on the Task Categories defined in Step 3. Only include phases that have tasks assigned to them.

## 8. Update Epic

After generating `tasks.md`, update the `epic.md` file:

1. Locate or create an `## Implementation Plan` section in `epic.md` immediately after the `## Open Questions` section.
2. Add a relative link to the generated `tasks.md` file:

    ```markdown
    ## Implementation Plan

    See [tasks.md](./tasks.md) for the detailed task breakdown and dependency graph.
    ```

## 9. Next Steps

After all GitHub issues are created, `tasks.md` is generated, and `epic.md` is updated:

1. Inform the user that the task breakdown is complete
2. Remind them to run `/nxs.close` when implementation is finished to:
    - Generate a Post-Implementation Report (PIR.md)
    - Close the epic's GitHub issue
    - Clean up the `tasks/` subfolder

# Constraints

**Critical Rules**:

- **DO NOT** search for HLD files - use provided context/arguments only
- **DO NOT** explore the codebase - the HLD is authoritative
- **MANDATORY STOP** at Review Checkpoint - require explicit user confirmation
- Prefer smaller tasks over larger when uncertain
- Ensure first task creates buildable/runnable skeleton

**Project Configuration**: On first run, if template contains `{{PROJECT}}`, prompt user for GitHub project name (e.g., `org/repo`), update template file directly, then proceed. On subsequent runs, use existing value.
