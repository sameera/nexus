---
description: Analyze epic, HLD, and task files for consistency, coverage gaps, and redundancies
model: sonnet
tools: Task
---

# Consistency Analysis

This command delegates to the `nxs-analyzer` agent for full analysis.

# User Input

```text
$ARGUMENTS
```

# Input Resolution

Resolve the analysis context in priority order:

1. **Explicit path in `$ARGUMENTS`**: Use the provided directory path
2. **File open in editor**: Infer the epic/HLD directory from the open file
3. **Otherwise**: Stop and ask the user to provide the path to the epic directory

# Execution

Invoke the `nxs-analyzer` agent with the resolved context:

```
Invoke: nxs-analyzer
Context:
  - Epic directory: {resolved-path}
  - Mode: {auto-remediate if $ARGUMENTS contains "--remediate", else analysis-only}
Request:
  - Run full consistency analysis
  - {If remediate mode: Apply auto-remediation for AUTO-classified findings}
  - Generate tasks/task-review.md
  - Return metrics summary
```

# Output

Display the agent's returned metrics to the user:

```
✅ Analysis complete: {epic-directory}/tasks/task-review.md

📊 Summary:
   - {N} findings ({critical} critical, {high} high, {medium} medium, {low} low)
   - User story coverage: {X}%
   - HLD coverage: {X}%
   - Superfluous tasks identified: {N}

{If --remediate was used}
🔧 Auto-remediation applied:
   - {N} tasks merged
   - {N} terminology fixes
   - Tasks renumbered: {yes/no}

{Severity indicator from agent response}
```

# Usage

```
/nxs.analyze                           # Use open file context, analysis-only
/nxs.analyze path/to/epic-folder       # Explicit path, analysis-only
/nxs.analyze --remediate               # Auto-remediate mode
/nxs.analyze path/to/epic --remediate  # Explicit path with remediation
```
