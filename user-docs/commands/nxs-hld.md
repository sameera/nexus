# /nxs.hld

Generate a comprehensive High-Level Design document from an epic specification.

## Purpose

Creates a structured technical architecture document by delegating architectural analysis to the `nxs-architect` agent. The HLD provides the blueprint for implementation before task decomposition.

## When to Use

- After creating an epic with `/nxs.epic`
- For new features requiring architectural planning
- For major refactoring initiatives
- For system integrations
- Before breaking work into implementation tasks

## Prerequisites

**Required Files**:
- `epic.md` in the current or parent directory
- `docs/product/context.md` (product vision)
- `docs/system/stack.md` (technology stack)
- `docs/system/standards/*.md` (coding standards)

**Directory Context**:
```
docs/product/features/
└── {seq}-{epic-name}/
    └── epic.md (required)
```

## Usage

### Option 1: With Open Epic File
```bash
# Open epic.md in IDE, then run:
/nxs.hld
```

### Option 2: From Epic Directory
```bash
# Navigate to epic directory:
cd docs/product/features/03-space-scoped-tags/
/nxs.hld
```

### Option 3: With File Reference
```bash
/nxs.hld @docs/product/features/03-space-scoped-tags/epic.md
```

## What It Does

### Phase 1: Invoke Architect Agent

Delegates comprehensive analysis to `nxs-architect` agent, which:

1. **Determines Analysis Depth**:
   - Quick (S complexity): Basic patterns, minimal research
   - Medium (M complexity): Standard analysis with comparisons
   - Deep (L/XL complexity): Exhaustive exploration, prototyping

2. **Reads Context**:
   - Product context from `docs/product/context.md`
   - Technology stack from `docs/system/stack.md`
   - Coding standards from `docs/system/standards/`
   - Related feature documentation

3. **Performs Analysis**:
   - Complexity assessment (S/M/L/XL rubric)
   - System dependencies and integrations
   - Data model requirements
   - API design approach
   - Security requirements
   - Technical risk identification
   - Implementation approach evaluation
   - Technical debt implications

4. **Delivers Recommendations**:
   - Architectural decisions with rationale
   - Implementation phases
   - Testing strategy
   - Success criteria
   - Clarifications needed

### Phase 2: Format HLD Document

Formats architect's analysis into 16-section structure:

1. **Executive Summary**
2. **Complexity Assessment**
3. **System Context**
4. **Requirements Analysis**
5. **Architecture Overview**
6. **Data Model Strategy**
7. **API Design Strategy**
8. **Frontend Architecture**
9. **Security Architecture**
10. **Implementation Phases**
11. **Approach Comparison**
12. **Key Decisions**
13. **Risk Assessment**
14. **Technical Debt**
15. **Testing Strategy**
16. **Success Criteria**

### Phase 3: Save HLD Document

Writes `HLD.md` in the same directory as `epic.md`:

```
docs/product/features/03-space-scoped-tags/
├── epic.md
└── HLD.md (new)
```

## HLD Document Structure

### Section 1: Executive Summary
Brief overview, key objectives, high-level approach.

### Section 2: Complexity Assessment
T-shirt size with justification and factor breakdown:

```markdown
## 2. Complexity Assessment

**Rating**: Medium (M)

**Justification**: Standard CRUD operations with multi-tenant constraints. Moderate data model changes.

| Factor | Assessment | Notes |
|--------|------------|-------|
| Scope | Medium | 4-5 components across stack |
| Technical Risk | Low | Well-understood patterns |
| Integration Complexity | Medium | Touches existing space system |
| Data Migration | Low | Additive schema changes |

**Key Complexity Drivers**:
- Multi-tenant data isolation
- Unique constraints per space
- Tag limit enforcement
```

### Section 3: System Context
Current state, dependencies, technology stack, constraints.

### Section 4: Requirements Analysis
Categorized functional, non-functional, constraints, out of scope.

### Section 5: Architecture Overview
Layer descriptions with Mermaid diagrams:

```mermaid
graph TD
    A[TagManager Component] --> B[/api/tags]
    B --> C[TagService]
    C --> D[(tags table)]
```

### Section 6: Data Model Strategy
Entities, relationships, migrations:

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    space_id UUID NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7),
    UNIQUE(space_id, name)
);
```

### Section 7-9: API, Frontend, Security
Design patterns for each layer.

### Section 10: Implementation Phases
Recommended build order:

```markdown
## 10. Implementation Phases

### Phase 1: Data Layer (2 days)
- Create tags table migration
- Implement Tag model and repository
- Add validation logic

### Phase 2: API Layer (3 days)
- Implement CRUD endpoints
- Add space-scoped authorization
- Write API tests

### Phase 3: UI Layer (3 days)
- Build TagManager component
- Integrate with API
- Add validation feedback
```

### Section 11: Approach Comparison
Trade-offs between implementation options:

```markdown
## 11. Approach Comparison

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| Global tags with space filter | Simpler queries | Namespace collisions | ❌ Not recommended |
| Space-scoped tags (recommended) | Clean isolation | More complex queries | ✅ Recommended |
```

### Section 12: Key Decisions
Architectural choices with rationale.

### Section 13: Risk Assessment
Top 3-5 risks with severity/likelihood/mitigation:

```markdown
## 13. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Tag limit bypass | High | Low | Database constraint + app validation |
| Performance with many tags | Medium | Medium | Add indexes, pagination |
```

### Section 14: Technical Debt
Implications and future considerations.

### Section 15: Testing Strategy
Unit, integration, E2E approach.

### Section 16: Success Criteria
Measurable technical outcomes.

## Example Invocation

```bash
# 1. Open epic
code docs/product/features/03-space-scoped-tags/epic.md

# 2. Run command
/nxs.hld
```

**Output**:
```
✓ Located epic: docs/product/features/03-space-scoped-tags/epic.md
✓ Reading product context...
✓ Reading technology stack...
✓ Reading coding standards...

Invoking nxs-architect agent for analysis...

Architect assessing complexity... Medium (M)
Architect analyzing data model...
Architect designing API approach...
Architect evaluating security requirements...
Architect identifying risks...
Architect recommending implementation phases...

✓ Architect analysis complete
✓ Formatting HLD document...
✓ Saved: docs/product/features/03-space-scoped-tags/HLD.md

HLD generated with 16 sections
Complexity: Medium (8 days)
Key risks: 2 medium, 1 low

Next: Run /nxs.tasks to decompose into implementation tasks
```

## Analysis Depth Levels

The architect automatically selects depth based on epic complexity:

| Epic Complexity | Analysis Depth | Activities |
|-----------------|----------------|------------|
| Small (S) | Quick | Basic patterns, minimal codebase research |
| Medium (M) | Medium | Standard analysis, approach comparison |
| Large (L) | Deep | Exhaustive exploration, multiple prototypes |
| Extra Large (XL) | Deep | Comprehensive research, risk modeling |

## Output Artifacts

**Primary**:
- `{epic-dir}/HLD.md`

**Structure**:
- 16 standardized sections
- Mermaid diagrams (optional)
- Code examples (SQL, TypeScript)
- Tables for comparisons and assessments

## Common Issues

### Epic Not Found

**Problem**: "Cannot locate epic.md"

**Solutions**:
1. Ensure you're in the epic directory
2. Open epic.md in IDE
3. Reference it explicitly: `/nxs.hld @path/to/epic.md`

### Missing Context Files

**Problem**: "Cannot read docs/system/stack.md"

**Solutions**:
1. Run `/nxs.init` to create required structure
2. Manually create missing files
3. Verify file paths are correct

### Insufficient Standards

**Problem**: "No coding standards found"

**Solutions**:
1. Create files in `docs/system/standards/`
2. Populate with your team's conventions
3. At minimum: coding-standards.md, testing-standards.md

### Clarifications Needed

**Problem**: HLD contains "⚠️ NEEDS CLARIFICATION" markers

**Solutions**:
1. Review marked items in Section 4 (Requirements Analysis)
2. Update epic.md with clarified requirements
3. Re-run `/nxs.hld` to regenerate

## Next Steps

After HLD generation:

1. **Review HLD.md**: Validate architecture aligns with epic intent
2. **Address Clarifications**: Resolve any "⚠️ NEEDS CLARIFICATION" items
3. **Run /nxs.tasks**: Decompose HLD into implementation tasks
4. **Optional: Run /nxs.analyze**: Validate consistency (done automatically by `/nxs.tasks`)

## Tips

**Read the Stack**: Ensure `docs/system/stack.md` is accurate. Architect uses it for technology-specific patterns.

**Populate Standards**: The more standards you document, the better the architect's recommendations align with your codebase.

**Trust the Architect**: The agent performs deep analysis. Don't skip sections thinking they're unnecessary.

**Review Phases**: Implementation phases in Section 10 guide task decomposition order.

**Check Risks**: Section 13 highlights what to watch during implementation.

## Related Commands

- [/nxs.epic](nxs-epic.md) - Generate epic (run first)
- [/nxs.tasks](nxs-tasks.md) - Decompose HLD into tasks (run next)
- [/nxs.analyze](nxs-analyze.md) - Validate consistency

## Related Concepts

- [High-Level Design](../concepts/high-level-design.md) - HLD structure explained
- [Agents](../reference/agents.md) - nxs-architect details

## Technical Notes

### Agent Delegation

This command is a thin orchestration layer. All analysis is performed by `nxs-architect` to ensure:
- Consistent quality
- Deep architectural thinking
- Separation of concerns (formatting vs analysis)

### Standards Conformance

The architect performs a "Standards Conformance Pass" against `docs/system/standards/` to ensure:
- Recommended patterns match your codebase
- Technology choices align with stack
- Naming conventions are consistent

### Absolute Path Linking

Like `/nxs.epic`, all markdown links are converted to absolute GitHub URLs using the `nxs-abs-doc-path` skill.
