---
description: Break down a High-Level Design into implementable GitHub issues
model: sonnet
tools: Read, Write, Glob, Grep, Task, Skill
---

# Role

Act as an experienced senior engineer performing technical decomposition and task planning.

# Context

- **HLD Source**: Resolved in priority order:
    1. Explicit file path provided in `$ARGUMENTS`
    2. The file currently open in the editor (passed as context)
- **User Input**: $ARGUMENTS

# Input Resolution

**CRITICAL**: Do NOT search for HLD files. Resolve the HLD source as follows:

1. **If `$ARGUMENTS` contains a file path**: Use that path directly
2. **If a file is provided in context** (open in editor): Use that file as the HLD
3. **Otherwise**: Stop and ask the user to either:
    - Open the HLD file in their editor and re-run the command, OR
    - Provide the file path as an argument: `/nxs.tasks path/to/HLD.md`

**Never** run `find`, `ls`, or search commands to locate HLD files.

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

## 4. Generate Low-Level Design per Task via Architect

For each task identified in Step 3, invoke `nxs-architect` to generate a detailed LLD:

```
Invoke: nxs-architect
Topic: Low-Level Design for TASK-{EPIC}.{SEQ}: {TASK_TITLE}
Context: [HLD path, task category, summary, dependencies, labels]
Request:
  - Determine analysis depth (Quick/Medium/Deep)
  - Identify files to create/modify
  - Define interfaces/types
  - Document key decisions with rationale and alternatives
  - Recommend implementation patterns from docs/system/standards/
  - Identify risks and edge cases
  - Ensure HLD alignment
```

Map architect response to template variables: Files → `{{FILES}}`, Interfaces → `{{INTERFACES}}`, Decisions → `{{KEY_DECISIONS}}`, Notes/Risks → `{{IMPLEMENTATION_NOTES}}`.

**Fallback**: If architect fails, use minimal LLD with placeholder content and flag task for manual review.

## 5. Output Format

Create a `tasks/` subfolder in the same directory as the HLD file.

### Template Location

Task files are generated using the template at `docs/system/delivery/task-template.md`.

**Before generating tasks**, read this template file to understand the output format. Users may customize this template — always use the current version, never a cached or assumed structure.

### Template Variables

The template uses `{{VARIABLE}}` placeholders. See the template file header at `docs/system/delivery/task-template.md` for complete variable documentation.

**Key runtime-derived variables**:

- `{{WORKSPACE_PATH}}`: Git worktree path format `../<repo-name>-worktrees/<epic-issue-number>`
- `{{BRANCH}}`: Git branch format `<feat|bug>/<epic-issue-number>-<kebab-case-title>`
    - Use `bug` type if epic has bug label, otherwise `feat`

### Label Requirements

**MANDATORY**: Read `docs/system/delivery/task-labels.md` to get the list of valid labels. Do not assume or guess labels—the file is the single source of truth.

**Label assignment rules** (after reading the labels file):

- Use 1-3 labels per task based on work areas involved
- Choose the primary architectural label first (e.g. `infrastructure`, `backend`, `frontend`, `database`)
- Add secondary labels (like `performance` or `integration`) when applicable
- **DO NOT** use any label not defined in `docs/system/delivery/task-labels.md`

### Task Numbering

Task numbers follow the format `TASK-{EPIC}.{NN}` where:

- `{EPIC}` is the parent epic's GitHub issue number
- `{NN}` is a zero-padded sequential number starting from 01

For example, if the epic issue number is 23, tasks would be numbered `TASK-23.01`, `TASK-23.02`, `TASK-23.03`, etc.

**Important**: The `parent` frontmatter attribute MUST be set to the epic's issue number extracted from the `epic.md` `link` attribute in Step 1 (e.g., `parent: #42`). This links each task issue to the parent epic issue.

## 6. Run Consistency Analysis & Auto-Remediation

**MANDATORY**: After generating task files, run `/nxs.analyze {epic-directory} --remediate` to:

1. Identify coverage gaps, inconsistencies, and superfluous tasks
2. Automatically fix AUTO-classified findings: merge superfluous tasks (barrel/export-only, verification-only, <1hr effort), normalize terminology, renumber sequentially, update dependencies
3. Generate `tasks/task-review.md` with remediation log and remaining manual issues
4. Capture metrics: remediated count, remaining issues (CRITICAL/HIGH/MEDIUM/LOW), final task count, coverage %

See `/nxs.analyze` command documentation for detailed remediation logic.

## 7. Review Checkpoint

**MANDATORY STOP** — Wait for user confirmation before creating GitHub issues.

Present summary: {N} tasks generated in `{path}/tasks/`, auto-remediation applied ({X} tasks merged, {Y} terminology fixes), remaining issues ({critical}/{high}/{medium}/{low}), coverage ({X}%). See `task-review.md` for full analysis.

Display severity indicator:

- Critical > 0: "⛔ **CRITICAL ISSUES** — Resolve before proceeding"
- High > 0: "⚠️ **HIGH priority issues** — Review recommended"
- Otherwise: "✅ **No blocking issues**"

Prompt: "Review task files and `task-review.md`, then reply: `continue` (create all issues) | `skip 03, 05` (exclude specified) | `abort` (cancel to address findings)"

**Handle response**:

- `continue`: Proceed to Step 8
- `skip [numbers]`: Exclude specified, proceed to Step 8
- `abort`: Preserve files, inform user they can re-run `/nxs.analyze` or `/nxs.tasks`, exit

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

Group tasks into phases based on the Task Categories defined in Step 3. Only include phases that have tasks assigned to them.

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
- **DO NOT** use labels other than those in `docs/system/delivery/task-labels.md`
- **MANDATORY STOP** at Review Checkpoint - require explicit user confirmation
- Prefer smaller tasks over larger when uncertain
- Ensure first task creates buildable/runnable skeleton

**Project Configuration**: On first run, if template contains `{{PROJECT}}`, prompt user for GitHub project name (e.g., `org/repo`), update template file directly, then proceed. On subsequent runs, use existing value.
