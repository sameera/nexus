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

4. **Skip to Step 7** (Review Checkpoint) with reconstructed metrics

5. **On user approval**, proceed to Step 8 (Create Task Issues)

# Workflow

## 1. Resolve Epic Issue

Before analyzing the HLD, ensure a GitHub issue exists for the parent epic:

1. Locate the `epic.md` file in the same directory as the HLD file
2. Parse the `epic.md` YAML frontmatter and check for a `link` attribute

    a. **If `link` exists** (e.g., `link: "#42"`):
    - Extract the issue number from the `link` value
    - Log: `Epic issue already exists: #{issue-number} — skipping creation`
    - Store the issue number for use in task generation

    b. **If `link` is missing**:
    - Invoke the `nxs-gh-create-epic` skill:
      ```bash
      python ./.claude/skills/nxs-gh-create-epic/scripts/nxs_gh_create_epic.py "<path-to-epic.md>"
      ```
    - Verify the `epic.md` frontmatter now contains a `link` attribute
    - Extract and store the issue number from the `link` attribute for use in task generation

3. If no `epic.md` exists in the HLD directory, warn the user and proceed without a parent issue.

## 2. Load & Analyze HLD

Read the High-Level Design document and extract:

- System components and their responsibilities
- Data models and relationships
- API contracts/interfaces
- Integration points
- Non-functional requirements (performance, security, etc.)
- Technology stack and constraints

## 3. Epic Scope Validation

After loading the HLD, validate the current epic's scope against sibling epics in the same feature directory.

1. **Identify sibling epics** (path scan only — do NOT read any files yet):
    - Determine the parent feature directory (parent of the current epic's directory)
    - List `*/epic.md` paths in sibling directories (e.g., `01-epic-a/epic.md`, `02-epic-b/epic.md`)
    - **If the list is empty → skip this step entirely and proceed to Step 4**

2. **Load sibling epic context** (only reached if siblings exist):
    - For each sibling epic, parse:
        - Frontmatter only: `epic` (title), `link` (issue number, if exists), `complexity`, `status`
        - User Stories section: story titles only (not full body)
        - Out of Scope section

3. **Cross-reference HLD scope with sibling epics**:
    - Compare the HLD's scope (Requirements Analysis, Architecture Overview) against sibling epic scopes
    - Check for:
        - **Scope overlap**: HLD addresses functionality already covered by a sibling epic's user stories
        - **Superfluous siblings**: A sibling epic's scope is entirely subsumed by the current HLD
        - **Scope drift**: The HLD significantly expands beyond the current epic's user stories into sibling territory

4. **If no scope issues detected**, proceed to Step 4.

5. **If scope issues detected**, present findings to the user:

    ```markdown
    ## Epic Scope Validation Findings

    The HLD for **[Current Epic Title]** has scope implications for sibling epics:

    | Finding | Affected Epic | Details |
    |---------|--------------|---------|
    | [Overlap/Superfluous/Drift] | [Sibling Epic Title] (#[issue-number]) | [Description] |

    ### Recommended Actions

    | # | Action | Impact |
    |---|--------|--------|
    | 1 | [e.g., "Close #45 (02-private-tags) as superfluous"] | [Scope fully covered by current HLD] |
    | 2 | [e.g., "Modify 03-tag-inheritance epic to exclude X"] | [Reduces overlap] |
    | 3 | No changes — proceed as-is | [Accept overlap] |

    **Your choice**: _[approve actions / modify / skip]_
    ```

    **MANDATORY STOP**: Do NOT proceed until the user responds.

6. **Handle user response**:

    a. **Approve actions**: Execute the recommended actions:
    - **Close superfluous epic issues**: For each epic to close that has a `link` attribute:
      ```bash
      gh issue close {issue-number} --reason "not planned" --comment "Closed as superfluous: scope fully covered by #{current-epic-issue-number} ([Current Epic Title]). Determined during HLD/task planning."
      ```
    - **Modify epic documents**: Update the affected `epic.md` files (adjust scope, out-of-scope sections, user stories as needed)
    - **Record modifications**: Store a list of all modifications made (affected epic titles, issue numbers, description of changes) for use in Step 7 (Review Checkpoint)

    b. **Modify**: User provides alternative actions. Execute those instead and record modifications.

    c. **Skip**: Proceed without changes. Log that scope validation was performed but no action was taken.

## 4. Decompose into Tasks

**Pre-step — load valid labels**: Read `common/docs/system/delivery/task-labels.md` and extract the valid label names (e.g., `infrastructure`, `backend`, `frontend`, `database`, `performance`, `integration`). Pass the path to the decomposer so it selects only valid labels.

Delegate HLD decomposition to `nxs-decomposer`:

1. Invoke `nxs-decomposer` with:
    - HLD file path
    - Epic issue number from Step 1
    - Labels path: `common/docs/system/delivery/task-labels.md`
    - Request: "Decompose into implementation tasks targeting 4–7 tasks; merge trivial items; each task must touch ≥3 files or contain meaningful logic changes"

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

## 5. Generate Task Files

Generate and write task files **one at a time** — do not accumulate all architect responses in memory before writing. Each task is written to disk immediately after its LLD is generated.

### 5.1 Prepare Common Envelope

Build the shared metadata JSON once and store it in memory (not on disk):

```json
{
  "epic_number": {epic issue number from Step 1},
  "epic_title": "{epic title from epic.md}",
  "epic_type": "{enhancement|bug from epic.md}",
  "output_dir": "{HLD directory}/tasks"
}
```

Ensure the output directory exists:

```bash
mkdir -p "{HLD directory}/tasks"
```

### 5.2 Incremental Per-Task Generation Loop

For each task from the decomposer output, in sequence order:

**Step A — Generate LLD** (invoke `nxs-architect` in LLD-elaboration mode):

```
Invoke: nxs-architect
Mode: LLD-elaboration (HLD is authoritative)
Topic: Low-Level Design for TASK-{epic_number}.{sequence}: {title}
HLD Content: [only the sections directly relevant to this task's category and summary]
Task Context:
  - Category: {category}
  - Summary: {summary}
  - Blocked by: {blocked_by}
  - Blocks: {blocks}
Request: Return ONLY these five sections as structured markdown — no preamble, no summary prose:
  - FILES: List files to create/modify with purposes (must be ≥3 files or contain meaningful logic)
  - INTERFACES: Key TypeScript interfaces/types
  - KEY_DECISIONS: Table of decisions with rationale (extract from HLD)
  - IMPLEMENTATION_NOTES: Patterns, edge cases, testing guidance
  - ACCEPTANCE_CRITERIA: Checklist items for this specific task
```

**Step B — Write single-task JSON** to `/tmp/task-input-{epic_number}-{seq:02d}.json`:

```json
{
  "epic_number": {epic_number},
  "epic_title": "{epic_title}",
  "epic_type": "{epic_type}",
  "output_dir": "{HLD directory}/tasks",
  "tasks": [
    {
      "sequence": {sequence},
      "title": "{title}",
      "category": "{category}",
      "summary": "{summary}",
      "effort": "{effort}",
      "labels": ["{label1}", "{label2}"],
      "blocked_by": [{...}],
      "blocks": [{...}],
      "architect_response": "{architect response markdown}"
    }
  ]
}
```

**Step C — Run generation script**:

```bash
python .claude/skills/nxs-generate-tasks/scripts/generate_task_files.py /tmp/task-input-{epic_number}-{seq:02d}.json
```

**Step D — Confirm, report, and release**: On success, log `✓ TASK-{epic_number}.{seq:02d}.md written`, then **release** the architect response and JSON blob from working memory — the content is now on disk and no longer needed. On failure, report error and stop.

Repeat Steps A–D for every task before proceeding to Step 6. **Do not retain prior iterations' architect responses between tasks.**

### Error Handling

- If `nxs-architect` fails for a task, set `architect_response` to `null` and continue (script uses fallbacks)
- If the generation script returns an error, report it immediately and stop — do not continue to the next task
- If `fallbacks_used > 0` in any response, warn the user that those tasks have placeholder LLD content

## 6. Run Consistency Analysis & Auto-Remediation

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

Use these metrics in the Review Checkpoint (Step 7).

## 7. Review Checkpoint

**MANDATORY STOP** — Wait for user confirmation before creating GitHub issues.

**For fresh runs** (steps 1-6 completed), present the summary table then the severity indicator:

| Metric | Value |
|--------|-------|
| Tasks generated | {N} |
| Effort distribution | {count-S} × S (half–full day), {count-M} × M (1–2 days) |
| HLD component coverage | {X}% |
| User story coverage | {Y}% |
| NFR coverage | {Z}% |
| Auto-remediated | {tasks_merged} tasks merged, {terminology_fixes} terminology fixes |
| Remaining issues | Critical: {C} · High: {H} · Medium: {M} · Low: {L} |

**For resume mode** (task-review.md provided), present the equivalent table:

| Metric | Value |
|--------|-------|
| Task files found | {N} |
| HLD component coverage | {X}% (from task-review.md) |
| User story coverage | {Y}% (from task-review.md) |
| Remaining issues | Critical: {C} · High: {H} · Medium: {M} · Low: {L} |

Display severity indicator:

- Critical > 0: "⛔ **CRITICAL ISSUES** — Resolve before proceeding"
- High > 0: "⚠️ **HIGH priority issues** — Review recommended"
- Otherwise: "✅ **No blocking issues**"

Prompt: "Review task files and `task-review.md`, then reply: `continue` (create all issues) | `skip 03, 05` (exclude specified) | `abort` (cancel to address findings)"

**Handle response** (same for both modes):

- `continue`: Proceed to post-approval actions, then Step 8
- `skip [numbers]`: Exclude specified, proceed to post-approval actions, then Step 8
- `abort`: Preserve files, inform user they can re-run `/nxs.analyze` or `/nxs.tasks`, exit

**Post-approval epic modification handling** (only if Step 3 resulted in in-place epic modifications — skip this if epics were only closed, since those already received a comment at close time):

After user confirms `continue` or `skip`:

1. **Comment on modified epic issues**: For each epic that was modified (not closed) in Step 3:
   ```bash
   gh issue comment {issue-number} --body "## Epic Modified During Task Planning

   **Modified by**: Task planning for #{current-epic-issue-number}
   **Date**: {YYYY-MM-DD}

   ### Changes Made
   {description of scope changes made to this epic}

   ### Reason
   {explanation of why the modification was needed, referencing HLD analysis}"
   ```

2. **Commit modified epic files**:
   ```bash
   git add <path-to-modified-epic.md> [<additional-modified-epics> ...]
   git commit -m "epics: scope adjustments from task planning for #{current-epic-issue-number}"
   ```

## 8. Create Task Issues

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

Group tasks into phases based on the Task Categories defined in Step 4. Only include phases that have tasks assigned to them.

## 9. Update Epic

After generating `tasks.md`, update the `epic.md` file:

1. Locate or create an `## Implementation Plan` section in `epic.md` immediately after the `## Open Questions` section.
2. Add a relative link to the generated `tasks.md` file:

    ```markdown
    ## Implementation Plan

    See [tasks.md](./tasks.md) for the detailed task breakdown and dependency graph.
    ```

## 10. Next Steps

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
- **DO NOT** create a new epic issue if `epic.md` already has a `link` attribute in frontmatter
- **DO** check sibling epics for scope overlap before decomposing tasks
- **DO** use `gh issue close --reason "not planned"` (not `--reason completed`) when closing superfluous epics
- **MANDATORY STOP** at Review Checkpoint - require explicit user confirmation
- Prefer smaller tasks over larger when uncertain
- Ensure first task creates buildable/runnable skeleton

**Project Configuration**: On first run, if `docs/system/delivery/config.json` does not contain a `project` attribute, prompt user for GitHub project name (e.g., `org/repo`), add it to `config.json`, then proceed. On subsequent runs, use existing value. The `generate_task_files.py` script reads `project` from this config file to populate the `{{PROJECT}}` template variable.
