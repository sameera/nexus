# /nxs.close

Close an epic by generating a Post-Implementation Report, updating documentation, closing the GitHub issue, and cleaning up.

## Purpose

Performs post-implementation documentation and cleanup. Creates a PIR (Post-Implementation Report) capturing what was built, key decisions, and lessons learned.

## When to Use

- After all epic tasks are implemented and merged
- When ready to officially close the epic
- To document what was learned for future reference

## Prerequisites

**Required**:
- `epic.md` with `link:` frontmatter (GitHub issue number)
- Epic GitHub issue exists
- Tasks completed (recommended)

**Optional**:
- `tasks/` folder with task files (for comprehensive PIR)

## Usage

### Option 1: With Open File
```bash
# Open epic.md in IDE, then run:
/nxs.close
```

### Option 2: With File Path
```bash
/nxs.close docs/product/features/03-space-scoped-tags/epic.md
```

## What It Does

### Phase 1: Validate Epic State

1. **Reads epic.md frontmatter**:
   - `epic`: Epic title
   - `link`: GitHub issue number (e.g., `"#42"`)
   - `feature`: Parent feature
   - `status`: Current status

2. **Validates `link` attribute**:
   - Must exist
   - Must contain valid issue number
   - If missing: Stops (epic not linked to GitHub)

3. **Checks for tasks/ folder**:
   - Verifies existence (optional but recommended)

### Phase 2: Load Task Files

If `tasks/` exists:

1. Reads all `TASK-*.md` files
2. Extracts from each:
   - Task ID and title
   - Summary
   - Key Decisions
   - Implementation Notes
   - Acceptance Criteria

3. Builds comprehensive context for PIR

### Phase 3: Generate PIR (Post-Implementation Report)

Creates `PIR.md` in epic directory with:

#### Structure

```markdown
---
epic: "Space-Scoped Tags"
created: 2026-01-23
type: post-implementation-report
---

# Post-Implementation Report: Space-Scoped Tags

## Executive Summary

Implemented space-scoped tagging system allowing users to create and manage tags within their spaces. All user stories completed successfully with clean data isolation and performant queries.

## Epic Objectives Achieved

| Objective | Implementation Summary |
|-----------|----------------------|
| User can create space-scoped tags | Implemented with unique constraint per space, 50-tag limit enforced |
| User can apply tags to content | Many-to-many junction table with efficient querying |
| User can filter by tags | Added indexed queries with <100ms response time |

## Key Decisions Made

| Decision | Rationale | Alternatives Considered |
|----------|-----------|----------------------|
| UUID for tag IDs | Distributed generation, no collisions | Auto-increment (rejected - migration complexity) |
| Composite unique constraint | Enforces business rule at DB level | App-level validation (rejected - race conditions) |
| Repository pattern | Separates data access from logic | Direct DB calls (rejected - tight coupling) |

## Technical Approach

### Data Layer
- PostgreSQL tables with space-scoped unique constraints
- Composite indexes for performance
- Foreign key cascades for referential integrity

### API Layer
- RESTful endpoints: GET, POST, PUT, DELETE
- Space-based authorization middleware
- Validation at controller level

### Frontend
- TagManager component with inline editing
- Real-time validation feedback
- Optimistic UI updates

## Implementation Notes

**What Went Well:**
- Test-first approach caught edge cases early
- Repository pattern made testing straightforward
- Space isolation worked as designed

**Challenges:**
- Tag limit enforcement required both DB and app validation
- Query optimization for spaces with many tags
- Concurrent tag operations required optimistic locking

**Unexpected Issues:**
- Migration rollback scripts initially missed
- Tag color validation had edge cases for invalid hex codes
- Performance degraded above 1000 tags per space (resolved with indexing)

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| API response time | <200ms | 85ms avg | ✅ Exceeded |
| Tag creation rate | 60% of spaces | 72% | ✅ Exceeded |
| Test coverage | >80% | 94% | ✅ Exceeded |

## Lessons Learned

**For Next Time:**
- Include rollback scripts from the start
- Plan for performance testing earlier
- Consider concurrent operations in initial design

**Process Improvements:**
- Right-sizing worked well (epic fit in 8 days)
- LLD detail saved time during implementation
- Test-first caught issues before production

**Technical Debt:**
- Tag search currently full-table scan (defer to analytics epic)
- No bulk operations (defer to admin tools epic)
- Tag colors limited to predefined palette (future enhancement)

## Delivered Artifacts

**Code:**
- 3 database migrations
- 4 backend files (service, repository, controller, types)
- 2 frontend components (TagManager, TagPicker)
- 18 unit tests, 6 integration tests

**Documentation:**
- Updated API documentation
- Added space-scoped tags to user guide

## Related Documents

- [Epic](https://github.com/org/repo/blob/main/docs/product/features/03-space-scoped-tags/epic.md)
- [HLD](https://github.com/org/repo/blob/main/docs/product/features/03-space-scoped-tags/HLD.md)
- [GitHub Issue](https://github.com/org/repo/issues/42)

## Status

**Epic Status**: Closed
**Completion Date**: 2026-01-23
**Final Review**: All acceptance criteria met, no blockers
```

### Phase 4: Close GitHub Issue

Posts PIR summary and closes issue:

```bash
gh issue comment 42 --body "## Epic Complete

See [Post-Implementation Report](../docs/product/features/03-space-scoped-tags/PIR.md) for details.

**Outcomes:**
- All 5 tasks completed
- All acceptance criteria met
- Success metrics exceeded targets

**Lessons Learned:**
- Test-first approach highly effective
- Right-sizing worked well (8-day estimate accurate)

Closing epic as complete."

gh issue close 42 --reason completed
```

### Phase 5: Update Epic Status

Updates `epic.md` frontmatter:

```yaml
---
feature: "User Tagging System"
epic: "Space-Scoped Tags"
status: closed  # Changed from "implementation"
link: "#42"
closed_date: 2026-01-23  # Added
pir: "PIR.md"  # Added
---
```

### Phase 6: Cleanup Checkpoint

Offers task file cleanup:

```
🔄 CHECKPOINT: Task Cleanup

Epic closed successfully. The tasks/ folder contains 5 task files.

Options:
1. 🗑️ Archive tasks to tasks-archive/ (recommended)
2. 📁 Keep tasks/ folder as-is
3. 🗑️ Delete tasks/ folder completely

Which option? (1/2/3)
```

**Option 1** (recommended):
```bash
mkdir tasks-archive
mv tasks/TASK-*.md tasks-archive/
# Keeps task-review.md in tasks/
```

**Option 2**: No action

**Option 3**:
```bash
rm -rf tasks/
```

## Example Invocation

```bash
# Open epic
code docs/product/features/03-space-scoped-tags/epic.md

# Run command
/nxs.close
```

**Output**:
```
✓ Located epic: Space-Scoped Tags
✓ Epic linked to issue #42
✓ Loading 5 task files...
✓ Analyzing implementation outcomes...

Generating Post-Implementation Report...
✓ Consolidated 8 key decisions from tasks
✓ Summarized implementation approach
✓ Documented lessons learned
✓ Created PIR.md

Posting to GitHub...
✓ Posted PIR summary to issue #42
✓ Closed issue #42

Updating epic status...
✓ Updated epic.md frontmatter

🔄 CHECKPOINT: Task Cleanup
[Shows cleanup options]

User: 1

✓ Archived tasks to tasks-archive/

✅ EPIC CLOSED

Epic: Space-Scoped Tags
PIR: docs/product/features/03-space-scoped-tags/PIR.md
GitHub: https://github.com/org/repo/issues/42

Next: Review PIR and commit documentation changes
```

## Output Artifacts

**Created**:
- `PIR.md` - Post-Implementation Report

**Updated**:
- `epic.md` - Frontmatter status change

**Optional**:
- `tasks-archive/` - Archived task files

## Common Issues

### No GitHub Link

**Problem**: "Cannot close epic: No GitHub issue linked"

**Solutions**:
1. Run `/nxs.tasks` first (creates epic issue)
2. Manually add `link: "#42"` to epic.md frontmatter
3. Verify issue number is correct

### Issue Already Closed

**Problem**: GitHub issue already closed

**Solution**: Command detects this and skips closing. Still generates PIR.

### No Task Files

**Problem**: `tasks/` folder missing or empty

**Solution**: Command proceeds with minimal PIR based on epic content only. PIR will lack implementation detail.

### GitHub CLI Error

**Problem**: `gh` command fails

**Solutions**:
1. Check `gh auth status`
2. Verify repository access
3. Ensure issue exists

## PIR Contents

### Executive Summary
2-3 sentences on what was delivered and outcomes.

### Epic Objectives Achieved
Table mapping user stories to how they were implemented.

### Key Decisions Made
Consolidated from all task "Key Decisions" sections.

### Technical Approach
Summary of data layer, API layer, frontend approach.

### Implementation Notes
What went well, challenges, unexpected issues.

### Success Metrics
Comparison of targets vs actual outcomes.

### Lessons Learned
For next time, process improvements, technical debt.

### Delivered Artifacts
Code files, documentation, tests created.

### Related Documents
Links to epic, HLD, GitHub issue.

## Next Steps

After closing:

1. **Review PIR.md**: Validate accuracy
2. **Commit changes**:
   ```bash
   git add PIR.md epic.md tasks-archive/
   git commit -m "docs: Close epic #42 - Space-Scoped Tags"
   ```
3. **Share PIR**: Distribute to team for lessons learned
4. **Archive**: Move to historical documentation if desired

## Tips

**Close Only When Complete**: Ensure all tasks implemented and merged before closing.

**Review PIR**: The report is your historical record. Ensure it's accurate.

**Archive Tasks**: Option 1 (archive) is recommended - preserves history without clutter.

**Share Lessons**: PIR lessons are valuable for future epics.

**Update Features**: Consider updating Feature README with outcomes.

## Related Commands

- [/nxs.dev](nxs-dev.md) - Implement tasks (do before closing)
- [/nxs.tasks](nxs-tasks.md) - Creates tasks and epic issue

## Related Concepts

- [Epic to Implementation](../workflow/epic-to-implementation.md) - Full lifecycle including closure
