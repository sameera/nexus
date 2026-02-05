# /nxs.epic

Generate product specifications with user stories and acceptance criteria from a capability description.

## Purpose

Transforms a high-level capability idea into structured user stories with testable acceptance criteria. This is the first step in the Nexus workflow after creating a Feature README.

## When to Use

- You have a capability idea and need to specify user requirements
- You've written a Feature README and are ready to define user stories
- You need to validate epic scope before technical design

## Prerequisites

**Required Files**:
- Feature `README.md` with `feature:` frontmatter attribute

**Directory Structure**:
```
docs/product/features/
└── {feature-dir}/
    └── README.md (with feature: frontmatter)
```

## Usage

The command can locate the Feature README in multiple ways:

### Option 1: With Open File
```bash
# Open Feature README in IDE, then run:
/nxs.epic
```

### Option 2: With File Reference
```bash
# Reference the README explicitly:
/nxs.epic @docs/product/features/my-feature/README.md
```

### Option 3: With Description
```bash
# Provide capability description inline:
/nxs.epic Users should be able to create custom tags with colors
```

The command automatically finds the Feature README from context.

## What It Does

### Phase 1: Locate Feature Context

1. **Find README.md**:
   - Checks for referenced file in prompt
   - Checks currently open file in IDE
   - Looks for README.md in same directory as open file

2. **Validate Frontmatter**:
   - Parses YAML frontmatter
   - Requires `feature:` attribute
   - Extracts feature name

**Example valid README.md**:
```markdown
---
feature: "User Tagging System"
status: "proposed"
---

# User Tagging System

Allow users to create custom tags for content organization.
```

### Phase 2: Complexity Assessment (Right-Sizing Gate)

Before generating content, invokes the `nxs-decomposer` agent to assess scope using S/M/L/XL rubric:

| Complexity | Duration | Sprint Fit (10 days) | Action |
|------------|----------|---------------------|--------|
| **Small (S)** | 1-3 days | Fits | Proceed |
| **Medium (M)** | 1-2 weeks | Fits | Proceed |
| **Large (L)** | 2-4 weeks | Too large | Right-sizing prompt |
| **Extra Large (XL)** | 1-3 months | Way too large | Right-sizing prompt |

The decomposer provides:
- Complexity rating (S/M/L/XL)
- Best case / Likely case / Worst case timeline estimates
- Complexity drivers (why it's sized this way)
- For L/XL: Suggested decomposition into smaller epics

### Right-Sizing Prompt (L/XL Epics)

When scope exceeds Medium complexity:

```
## Epic Scope Assessment

The proposed epic has been assessed as **Large complexity**
with an estimated timeline of **3-4 weeks**.

This exceeds the target sprint duration of **10 working days**.

### Architect's Analysis

[Summary of complexity drivers from nxs-decomposer]

### Proposed Decomposition

The architect suggests breaking this into the following right-sized epics:

| # | Epic Scope | Estimated Complexity | Est. Duration |
|---|------------|---------------------|---------------|
| 1 | Core tagging CRUD | Medium | 8 days |
| 2 | Tag filtering & search | Small | 4 days |
| 3 | Tag analytics dashboard | Medium | 7 days |

---

**How would you like to proceed?**

| Option | Action |
|--------|--------|
| **1** | Generate epic with **reduced scope** (Epic #1 only, defer remainder) |
| **2** | Generate **multiple right-sized epics** (all sub-epics above) |
| **3** | Proceed with **original scope** (ignore warning) |

**Your choice**: _[1/2/3]_
```

**IMPORTANT**: Command waits for user choice before proceeding.

**Minimum viable epic**: Each sub-epic must be >4 days. Smaller work should be user stories within a larger epic.

### Phase 3: Generate Epic Folder Name

Creates a concise kebab-case name (2-5 words):

**Examples**:
- "Tags scoped to spaces" -> `space-scoped-tags`
- "Private user tags" -> `private-user-tags`
- "Tag inheritance" -> `tag-inheritance`

### Phase 4: Create Sequential Directory

Uses `nxs-sq-name-generator` skill to create numbered folder:

```bash
python ./scripts/next_sequential_name.py "docs/product/features" "space-scoped-tags"
```

**Output**: `03-space-scoped-tags` (if 01 and 02 already exist)

**Final structure**:
```
docs/product/features/
└── 03-space-scoped-tags/
    └── epic.md (generated)
```

### Phase 5: Handle External Plan Files

If you reference a plan file from outside the repository (e.g., Claude Code plan):

- **No HLD.md exists**: Copies external file to `HLD.md`
- **HLD.md exists**: Copies with original filename

**Never links to external files** - always copies into repository.

### Phase 6: Generate Epic Document

Creates structured epic with:

1. **Frontmatter**: Metadata (feature, epic name, complexity, status, estimated_duration)
2. **Description**: High-level overview of what and why
3. **Business Value**: Impact and success metrics
4. **User Personas**: Who benefits from this capability
5. **User Stories**: Persona-based requirements with acceptance criteria
6. **Dependencies**: Internal and external dependencies
7. **Assumptions**: Documented assumptions
8. **Out of Scope**: Explicit boundaries
9. **Open Questions**: [NEEDS CLARIFICATION] items (max 3)
10. **Appendix**: Complexity assessment details, glossary, related documents

**All links use absolute GitHub URLs** via `nxs-abs-doc-path` skill for portability.

## Epic Document Structure

```markdown
---
feature: "User Tagging System"
epic: "Space-Scoped Tags"
created: 2026-01-23
type: enhancement
status: draft
complexity: M
estimated_duration: "8 days"
---

# Epic: Space-Scoped Tags

[Warning banner if Option 3 was chosen for L/XL epic]

### Description

Enable tag scoping to spaces for multi-tenant organization...

### Business Value

- Improved content organization in multi-tenant environment
- ...

### Success Metrics

- 60% of spaces create at least one tag
- ...

---

## User Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Space Member | Regular user in a space | Organize content with tags |

---

## User Stories

### Story 1: User can create space-scoped tags

**As a** space member,
**I want to** create tags specific to my space,
**So that** I can organize space content independently.

#### Acceptance Criteria

- [ ] **Given** I am in a space, **when** I create a tag, **then** it is scoped to that space
- [ ] **Given** a tag exists in Space A, **when** I am in Space B, **then** I cannot see it
- [ ] ...

#### Notes

[Any assumptions or constraints]

---

### Story 2: User can apply tags to content

...

---

## Dependencies

| Dependency | Type | Description | Status |
|------------|------|-------------|--------|
| Multi-tenant space system | Internal | Existing | Known |

## Assumptions

- Spaces are isolated tenants
- Users belong to one or more spaces

## Out of Scope

- Cross-space tag sharing
- Global tag suggestions
- Tag analytics (deferred to future epic)

## Open Questions

[List any [NEEDS CLARIFICATION] items - max 3]

---

## Appendix

### Complexity Assessment

**Assessed by**: nxs-decomposer
**Rating**: M

**Timeline Estimates**:

| Scenario | Duration | Assumptions |
|----------|----------|-------------|
| Best Case | 5 days | No unexpected blockers, familiar patterns |
| Likely Case | 8 days | Normal development pace |
| Worst Case | 12 days | Integration issues, scope clarification needed |

**Complexity Drivers**:

- Multi-tenant data model considerations
- UI component complexity
- API surface area

### Glossary

| Term | Definition |
|------|------------|
| Space | Isolated tenant unit |
| Tag | User-created label for content |

### Related Documents

- [Parent Feature Brief](https://github.com/.../README.md)
- [Space Architecture](https://github.com/.../space-architecture.md)
```

## Example Invocation

### Scenario: Create Epic for Tag Feature

```bash
# 1. Open Feature README
code docs/product/features/tagging/README.md

# 2. Run command
/nxs.epic
```

**Output**:
```
Validated Feature: "User Tagging System"

Assessing complexity...
Invoking nxs-decomposer for scope assessment...

Complexity: Medium (8 days likely case)
Fits within sprint target

Generating epic folder name: "space-scoped-tags"
Creating directory: docs/product/features/03-space-scoped-tags/
Generating user stories...
Converting links to absolute URLs...

Epic created: docs/product/features/03-space-scoped-tags/epic.md

Next: Run /nxs.hld to generate technical design
```

## Output Artifacts

**Primary**:
- `{feature-dir}/{seq}-{epic-name}/epic.md`

**Metadata in Frontmatter**:
- `feature`: Parent feature name
- `epic`: Epic name
- `complexity`: S/M/L/XL assessment
- `estimated_duration`: Likely case estimate
- `status`: draft -> design -> implementation -> complete

## Common Issues

### No Feature Found

**Problem**: "Cannot proceed: No valid Feature context found"

**Solutions**:
1. Ensure README.md has `feature:` frontmatter
2. Open the Feature README in IDE
3. Reference it explicitly: `/nxs.epic @path/to/README.md`

### Epic Too Large Warning

**Problem**: Complexity assessment shows L or XL

**Solutions**:
1. Choose decomposition option 1 or 2
2. Reduce scope by moving items to "Out of Scope"
3. Only use option 3 (proceed anyway) if you understand the risk

### Frontmatter Parse Error

**Problem**: "Invalid frontmatter in README.md"

**Solutions**:
1. Verify YAML syntax (colons, quotes, hyphens)
2. Ensure `feature:` attribute exists
3. Use `---` delimiters at start and end

## Next Steps

After epic generation:

1. **Review epic.md**: Validate user stories match intent
2. **Review complexity assessment**: Check the appendix for estimate rationale
3. **Run /nxs.hld**: Generate technical design
4. **Optional: Run /nxs.council**: Get multi-perspective review

## Tips

**Be Specific**: More detailed capability descriptions lead to better user stories.

**Review Right-Sizing**: Don't skip the complexity assessment. Oversized epics cause problems later.

**Check the Appendix**: The Complexity Assessment section shows timeline estimates and drivers - useful for planning.

**Clarifications**: The command limits [NEEDS CLARIFICATION] markers to 3. Address these before proceeding.

**Absolute Links**: All generated links are absolute GitHub URLs for document portability.

**Sequential Naming**: Epic folders are auto-numbered. Don't manually rename them.

## Related Commands

- [/nxs.init](nxs-init.md) - Initialize project structure (run first)
- [/nxs.hld](nxs-hld.md) - Generate technical design from epic
- [/nxs.council](nxs-council.md) - Multi-perspective epic review

## Related Concepts

- [Epics & User Stories](../concepts/epics-and-stories.md) - Epic structure explained
- [Project Structure](../configuration/project-structure.md) - Directory conventions
