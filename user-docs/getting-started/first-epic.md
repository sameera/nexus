# Your First Epic

This tutorial walks through creating your first feature specification using Nexus, from initial idea to ready-to-implement tasks.

## Scenario

We'll specify a simple feature: **User Tagging System** - allowing users to create and manage custom tags for content organization.

## Prerequisites

- Nexus installed ([Installation](installation.md))
- Project initialized ([Setup](setup.md))
- GitHub repository configured in `config.json`

## Step 1: Create Feature README

Every epic starts with a Feature README that provides context.

### Create Feature Directory

```bash
mkdir -p docs/product/features/01
cd docs/product/features/01
```

**Naming convention**: Sequential numbering (01, 02, 03...) for easy ordering.

### Write Feature README

Create `README.md` with frontmatter and description:

```markdown
---
feature: "User Tagging System"
status: "proposed"
priority: "high"
target_release: "v1.2.0"
---

# User Tagging System

## Overview
Allow users to create custom tags and apply them to content for better organization and discovery.

## Business Context
- **Problem**: Users struggle to organize growing content libraries
- **Opportunity**: Tagging improves content discovery and user engagement
- **Success**: 60% of active users create at least one tag

## User Needs
- Create custom tags with names and colors
- Apply multiple tags to content items
- Filter content by tags
- Manage (edit/delete) existing tags

## Constraints
- Max 50 tags per user
- Tag names must be unique per user
- No nested tags (flat hierarchy)

## Out of Scope
- Tag sharing across users
- Tag suggestions/auto-complete (future)
- Tag analytics (future)
```

**Key elements**:
- `feature:` frontmatter field (required for `/nxs.epic`)
- Business context explaining "why"
- User needs (what users want to accomplish)
- Explicit constraints and out-of-scope items

### Open in Editor

Open `docs/product/features/01/README.md` in your editor. This provides context for `/nxs.epic`.

## Step 2: Generate Epic (User Stories)

Run the epic generation command:

```bash
/nxs.epic
```

### What Happens

1. **Context Loading**: Reads Feature README, product context, stack info
2. **Complexity Assessment**: Analyzes scope and estimates effort
3. **Right-Sizing Check**: Ensures epic fits in ~10 day sprint
4. **User Story Generation**: Creates persona-based stories with acceptance criteria
5. **Absolute Path Linking**: Converts relative links to GitHub URLs

### Expected Output

The command creates `epic.md` in the same directory:

```
docs/product/features/01/
├── README.md
└── epic.md (new)
```

### Review epic.md

Open `docs/product/features/01/epic.md`:

```markdown
---
feature: "User Tagging System"
epic: "Tag Management Core"
status: "design"
complexity: "M"
effort_estimate: "8 days"
link: "https://github.com/your-org/your-repo/blob/main/docs/product/features/01/epic.md"
---

# Epic: Tag Management Core

## Executive Summary
Enable users to create and manage custom tags for content organization...

## User Stories

### 1. User can create a tag
**As a** content organizer
**I want to** create custom tags with names and colors
**So that** I can organize my content meaningfully

**Acceptance Criteria**:
- [ ] User can enter tag name (1-30 chars)
- [ ] User can select color from predefined palette
- [ ] System prevents duplicate tag names per user
- [ ] System enforces 50-tag limit per user
- [ ] UI shows success confirmation

### 2. User can apply tags to content
...
```

**Key sections**:
- **Frontmatter**: Metadata including complexity (S/M/L/XL) and effort estimate
- **User Stories**: Persona-based stories in "As a... I want... So that..." format
- **Acceptance Criteria**: Testable requirements for each story

### Complexity Assessment

If epic is too large (>10 days), `/nxs.epic` offers to decompose it:

```
⚠️ EPIC TOO LARGE FOR SINGLE SPRINT

Estimated effort: 14 days (target: ≤10 days)

Options:
1. Decompose into 2 smaller epics
2. Reduce scope (mark items as future work)
3. Proceed anyway (may span multiple sprints)
```

Choose option 1 or 2 to right-size the epic.

## Step 3: Generate High-Level Design

With user stories defined, create the technical design:

```bash
/nxs.hld
```

### What Happens

1. **Epic Analysis**: Reads `epic.md` for requirements
2. **Agent Delegation**: Invokes `nxs-architect` agent
3. **Design Generation**: Creates 16-section HLD document
4. **Technical Decisions**: Database schema, API design, architecture

### Expected Output

Creates `HLD.md` in the same directory:

```
docs/product/features/01/
├── README.md
├── epic.md
└── HLD.md (new)
```

### Review HLD.md

Open `docs/product/features/01/HLD.md`:

```markdown
# High-Level Design: Tag Management Core

## 1. Executive Summary
This design implements a user-scoped tagging system with CRUD operations...

## 2. Complexity Assessment
- **Complexity**: Medium
- **Rationale**: Standard CRUD with unique constraints
- **Risk Areas**: Tag limit enforcement, duplicate prevention

## 3. System Context
Tags integrate with existing content system via many-to-many relationship...

## 4. Technology Stack
- **Frontend**: React components (TagManager, TagPicker)
- **Backend**: Express REST API
- **Database**: PostgreSQL with junction table

## 5. Requirements Analysis

### Functional Requirements
- FR-1: Create tags with name and color
- FR-2: Apply tags to content items
...

## 6. Architecture Overview
```
┌─────────────┐
│ TagManager  │ (React)
│ Component   │
└──────┬──────┘
       │
       v
┌─────────────┐
│   /api/tags │ (Express)
└──────┬──────┘
       │
       v
┌─────────────┐
│   tags      │ (PostgreSQL)
│   content_tags
└─────────────┘
```

## 7. Data Model
```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(30) NOT NULL,
    color VARCHAR(7) NOT NULL,
    created_at TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE TABLE content_tags (
    content_id UUID,
    tag_id UUID,
    PRIMARY KEY (content_id, tag_id)
);
```
...
```

**Key sections**:
- **Data Model**: Database schema
- **API Design**: Endpoint specifications
- **Architecture**: Component relationships
- **Implementation Phases**: Suggested build order
- **Testing Strategy**: How to verify the system

## Step 4: Generate Implementation Tasks

Decompose the HLD into implementable tasks:

```bash
/nxs.tasks
```

### What Happens

1. **HLD Analysis**: Reads design document
2. **Task Decomposition**: Breaks work into ≤2 day chunks
3. **Dependency Mapping**: Determines task order
4. **Consistency Check**: Auto-runs `/nxs.analyze` to validate
5. **Review Checkpoint**: Presents task list for approval

### Expected Output

Creates `tasks/` folder with numbered task files:

```
docs/product/features/01/
├── README.md
├── epic.md
├── HLD.md
└── tasks/
    ├── TASK-01.01.md
    ├── TASK-01.02.md
    ├── TASK-01.03.md
    ├── TASK-01.04.md
    ├── TASK-01.05.md
    └── task-review.md
```

### Review Checkpoint

The command presents a summary:

```
🔄 CHECKPOINT: Task Review

Generated 5 implementation tasks:

TASK-01.01: Create tags database schema (2h)
TASK-01.02: Implement Tag model and repository (4h)
TASK-01.03: Create tag CRUD API endpoints (6h)
TASK-01.04: Build TagManager UI component (8h)
TASK-01.05: Add tag filtering to content views (4h)

Analysis: 0 critical, 0 high, 2 medium issues
See tasks/task-review.md for details.

Options:
- continue - Create GitHub issues for all tasks
- skip 03, 05 - Create issues excluding specified tasks
- abort - Cancel to address findings

Your choice?
```

**Review** `tasks/task-review.md` for consistency findings, then respond:
- **`continue`** - Proceed with issue creation
- **`skip 03, 05`** - Exclude tasks 3 and 5
- **`abort`** - Make manual edits first

### Example Task File

Open `docs/product/features/01/tasks/TASK-01.01.md`:

```markdown
---
title: "TASK-01.01: Create tags database schema"
labels: [database, migration]
parent: "https://github.com/.../epic.md"
project: "User Tagging System"
---

## Summary
Create PostgreSQL schema for tags and content_tags tables with appropriate constraints.

## Dependencies
- Blocked by: None
- Blocks: TASK-01.02

## Git Workspace
- Worktree: `../your-project-worktrees/01`
- Branch: `feat/epic-01-tags`

## Low-Level Design

### Files
- `migrations/001_create_tags.sql`
- `migrations/002_create_content_tags.sql`

### Interfaces/Types
```typescript
// Not applicable for migration task
```

### Implementation Notes
- Use UUID for IDs
- Add unique constraint on (user_id, name)
- Add foreign keys with CASCADE delete
- Include created_at/updated_at timestamps

## Acceptance Criteria
- [ ] tags table created with all columns
- [ ] content_tags junction table created
- [ ] Unique constraint prevents duplicate tag names per user
- [ ] Foreign keys enforce referential integrity
- [ ] Migration runs successfully on clean database
- [ ] All existing tests pass
- [ ] New functionality has test coverage (if applicable)

## Estimated Effort
2 hours
```

**Key elements**:
- **Dependencies**: Blocked by / Blocks relationships
- **Git Workspace**: Pre-configured worktree path and branch
- **Low-Level Design**: Files to create, implementation notes
- **Acceptance Criteria**: Definition of "done"

### Issue Creation

When you choose `continue`, the command uses the `nxs-gh-create-task` skill to:
1. Create GitHub issues for each task
2. Set labels and relationships
3. Link to epic and HLD

```
✅ Created 5 GitHub issues:

#42: TASK-01.01: Create tags database schema
#43: TASK-01.02: Implement Tag model and repository
#44: TASK-01.03: Create tag CRUD API endpoints
#45: TASK-01.04: Build TagManager UI component
#46: TASK-01.05: Add tag filtering to content views

Tasks are ready for implementation with /nxs.dev.
```

## Step 5: Implement a Task

Pick a task (start with the first unblocked one) and implement it:

```bash
/nxs.dev 42
```

### What Happens

1. **Fetch Issue**: Retrieves GitHub issue #42
2. **Workspace Setup**: Creates worktree or prompts for branch strategy
3. **Agent Delegation**: Hands off to `nxs-dev` agent
4. **Test-First Implementation**: Writes tests, then implementation
5. **Commit & Close**: Commits changes and closes issue on success

See [/nxs.dev Command](../commands/nxs-dev.md) for detailed workflow.

### Example Output

```
✅ ISSUE #42 COMPLETE

Title: TASK-01.01: Create tags database schema
Worktree: ../your-project-worktrees/01
Branch: feat/epic-01-tags
Commit: a3f8d91
Status: Implemented and closed

Files Changed: 2
Tests Added: 1

Comment posted: https://github.com/.../issues/42#comment-123
```

## Step 6: Continue Implementation

Repeat `/nxs.dev <issue>` for each task, working in dependency order.

## Step 7: Close the Epic

When all tasks are complete, generate a post-implementation review:

```bash
/nxs.close
```

Creates a PIR (Post-Implementation Review) documenting:
- What was built
- What went well
- What could improve
- Lessons learned

See [/nxs.close Command](../commands/nxs-close.md) for details.

## Summary

You've completed the full Nexus workflow:

1. ✅ Created Feature README with context
2. ✅ Generated epic with `/nxs.epic`
3. ✅ Created HLD with `/nxs.hld`
4. ✅ Decomposed into tasks with `/nxs.tasks`
5. ✅ Implemented tasks with `/nxs.dev`
6. ✅ Closed epic with `/nxs.close`

## Next Steps

- [Epic to Implementation Flow](../workflow/epic-to-implementation.md) - Detailed workflow guide
- [Command Reference](../commands/nxs-epic.md) - Deep dive on each command
- [Task Decomposition](../concepts/task-decomposition.md) - Best practices for breaking down work

## Tips for Success

**Start Small**: Your first epic should be simple (S or M complexity) to learn the workflow.

**Read the HLD**: Don't skip reading the generated HLD before task decomposition. It's your blueprint.

**Review Tasks**: Always review generated tasks before creating issues. The AI can make mistakes.

**Iterate Standards**: As you work, refine `docs/system/standards/` to improve future generations.

**Trust the Process**: The upfront work pays off during implementation with fewer surprises.
