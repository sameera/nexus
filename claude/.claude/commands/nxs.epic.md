---
description: Generate an Epic and User Stories document from a natural language capability description within a Feature.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after the slash command **is** the capability/epic description. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

Given that capability description, do this:

1. **Locate and validate the Feature context**:

    a. **Find the Feature README.md**:
    - Check if the user referenced a README.md file in their prompt
    - OR check if there's a currently open file in the IDE named `README.md`
    - OR check if there's a currently open file in the IDE and look for `README.md` in the same directory

    b. **Validate the Feature Brief**:
    - Read the README.md file and parse its YAML frontmatter
    - **Required**: The frontmatter MUST contain a `feature` attribute
    - Extract the feature name from the `feature` attribute value

    c. **Handle validation failure**:

    ```
    ❌ **Cannot proceed**: No valid Feature context found.

    This command must be executed within a Feature. Ensure one of the following:
    1. Reference a Feature's README.md file in your prompt (e.g., "@README.md")
    2. Have the Feature's README.md open in your IDE
    3. Have any file open within a Feature directory that contains a README.md

    The README.md must have YAML frontmatter with a `feature` attribute:
    ---
    feature: "Your Feature Name"
    ---
    ```

    - **Do not proceed** if validation fails

    d. **Store the feature directory path** for later use (the directory containing README.md)

2. **Right-Size Assessment** (MANDATORY GATE):

    Before generating any epic content, invoke the `nxs-architect` agent to assess the scope:

    ```
    Invoke: nxs-architect
    Topic: Complexity assessment for proposed epic
    Context: [The capability description from user input]
    Request:
    - Assess complexity using the S/M/L/XL rubric
    - Provide best/likely/worst case timeline estimates
    - If complexity exceeds Medium (M), identify logical decomposition points
    - For each potential sub-epic, estimate complexity
    ```

    a. **Interpret the assessment**:

    | Architect Assessment             | Sprint Fit (10 days)           | Action                      |
    | -------------------------------- | ------------------------------ | --------------------------- |
    | **Small (S)**: 1-3 days          | ✅ Fits easily                 | Proceed to epic generation  |
    | **Medium (M)**: 1-2 weeks        | ✅ Fits (likely case ≤10 days) | Proceed to epic generation  |
    | **Large (L)**: 2-4 weeks         | ❌ Too large                   | Trigger right-sizing prompt |
    | **Extra Large (XL)**: 1-3 months | ❌ Way too large               | Trigger right-sizing prompt |

    b. **Right-sizing prompt** (when L or XL):

    Present the architect's analysis and the following options to the user:

    ```markdown
    ## ⚠️ Epic Scope Assessment

    The proposed epic has been assessed as **[L/XL] complexity** with an estimated timeline of **[X-Y weeks/months]**.

    This exceeds the target sprint duration of **10 working days**.

    ### Architect's Analysis

    [Summary of complexity drivers from nxs-architect]

    ### Proposed Decomposition

    The architect suggests breaking this into the following right-sized epics:

    | #   | Epic Scope               | Estimated Complexity | Est. Duration |
    | --- | ------------------------ | -------------------- | ------------- |
    | 1   | [Sub-epic 1 description] | [S/M]                | [X days]      |
    | 2   | [Sub-epic 2 description] | [S/M]                | [X days]      |
    | ... | ...                      | ...                  | ...           |

    ---

    **How would you like to proceed?**

    | Option | Action                                                               |
    | ------ | -------------------------------------------------------------------- |
    | **1**  | Generate epic with **reduced scope** (Epic #1 only, defer remainder) |
    | **2**  | Generate **multiple right-sized epics** (all sub-epics above)        |
    | **3**  | Proceed with **original scope** (ignore warning)                     |

    **Your choice**: _[1/2/3]_
    ```

    c. **MANDATORY STOP**: Do NOT proceed until the user explicitly selects option 1, 2, or 3.

    d. **Handle user choice**:
    - **Option 1 (Reduced scope)**:
        - Use only the first sub-epic scope for generation
        - Note deferred scope in "Out of Scope" section
        - Add deferred items to "Related Documents" or "Future Work" appendix

    - **Option 2 (Multiple epics)**:
        - Generate separate epic documents for each sub-epic
        - Each gets its own sequential folder (e.g., `01-sub-epic-a/`, `02-sub-epic-b/`)
        - Link the epics to each other in "Related Documents"

    - **Option 3 (Ignore warning)**:
        - Proceed with original scope
        - Add a warning banner to the epic document:
            ```markdown
            > ⚠️ **Scope Warning**: This epic was assessed as [L/XL] complexity
            > (estimated [X weeks/months]). It may not fit within a single sprint.
            > Consider breaking into smaller deliverables during planning.
            ```

    e. **Minimum viable epic check** (for decomposition):

    When breaking into multiple epics, validate each sub-epic has sufficient work:
    - Each sub-epic MUST be estimated at **>4 days** of work
    - If a sub-epic is <4 days, merge it with an adjacent epic
    - Rationale: Epics smaller than 4 days should likely be user stories within a larger epic

3. **Generate a concise epic folder name** (kebab-case):
    - Analyze the capability description and extract the most meaningful keywords
    - Create a 2-5 word name that captures the essence of the capability
    - Use noun or action-noun format (e.g., "space-scoped-tags", "private-user-tags", "tag-inheritance")
    - Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)
    - **Do NOT** add any prefix or suffix — the sequential generator will handle prefixing
    - Examples:
        - "Tags should be available to all users in a space" → `space-scoped-tags`
        - "Allow users to have private tags not visible to others" → `private-user-tags`
        - "Implement tag inheritance from parent spaces" → `tag-inheritance`
        - "Add bulk tag operations for administrators" → `bulk-tag-operations`

4. **Create the Epic directory using sequential-name-generator**:

    a. Use the `sequential-name-generator` skill to generate the folder name:

    ```bash
    python ./scripts/next_sequential_name.py "<feature-directory>" "<epic-name>"
    ```

    - `<feature-directory>` is the directory containing the Feature's README.md
    - `<epic-name>` is the kebab-case name generated in step 3 (no extension = folder mode)

    b. The script will return a name like `03-space-scoped-tags`

    c. Create the epic directory:

    ```bash
    mkdir -p "<feature-directory>/<sequential-epic-folder>"
    ```

    d. The epic document will be saved as `epic.md` inside this directory:
    `<feature-directory>/<sequential-epic-folder>/epic.md`

5. **Handle external plan files** (if referenced):

    If the user referenced a Claude Code planning mode document or any file outside the repository:

    a. **Check for HLD.md in the epic directory**:
    - If `HLD.md` does NOT exist in `<feature-directory>/<sequential-epic-folder>/`:
        - Copy the external file to `<feature-directory>/<sequential-epic-folder>/HLD.md`
        - This becomes the High-Level Design document for reference

    b. **If HLD.md already exists**:
    - Copy the external file to `<feature-directory>/<sequential-epic-folder>/` with its original filename
        - For example: `plan-2026-01-08.md`, `design-notes.md`, etc.

    c. **Never link to files outside the repository**:
    - ❌ NEVER use paths like `~/.claude/plans/...`
    - ❌ NEVER use absolute paths outside the repository
    - ✅ ALWAYS copy external files into the repository
    - ✅ ONLY link to repository-relative paths in documentation

6. **Parse and analyze the capability description**:

    Follow this execution flow:
    1. Parse user description from Input
        - If empty: ERROR "No capability description provided"
    2. Extract key concepts from description
        - Identify: actors/personas, goals, actions, data, constraints, business value
        - Consider the parent Feature context for consistency
    3. For unclear aspects:
        - Make informed guesses based on context and industry standards
        - Only mark with [NEEDS CLARIFICATION: specific question] if:
            - The choice significantly impacts epic scope or user experience
            - Multiple reasonable interpretations exist with different implications
            - No reasonable default exists
        - **LIMIT: Maximum 3 [NEEDS CLARIFICATION] markers total**
        - Prioritize clarifications by impact: scope > security/privacy > user experience > technical details
    4. Decompose the capability into logical user stories
        - Each story should be independently deliverable
        - Stories should follow the INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
    5. Define acceptance criteria for each story
        - Each criterion must be testable and unambiguous
    6. Return: SUCCESS (epic document ready)

7. **Write the Epic document** using the following structure:

    **IMPORTANT - Absolute Path Linking**: All `.md` file links in the document MUST use absolute GitHub URLs. Use the `nxs-abs-doc-path` skill to convert relative paths:

    ```bash
    python ./.claude/skills/nxs-abs-doc-path/get_abs_doc_path.py "<relative-path-from-repo-root>"
    ```

    Example:

    ```bash
    python ./.claude/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/tagging/README.md"
    # Output: https://github.com/sameera/awzm/tree/main/docs/features/tagging/README.md
    ```

```markdown
---
feature: "[Feature Name from README.md]"
epic: "[Epic Name]"
created: [Current date in YYYY-MM-DD format]
type: enhancement
status: draft
complexity: [S/M/L/XL - from architect assessment]
estimated_duration: "[X days/weeks - likely case from architect]"
---

# Epic: [Epic Title]

[If Option 3 was chosen, include warning banner here]

### Description

[2-3 paragraph description of the epic explaining WHAT the capability does and WHY it matters to users/business. Focus on value delivery, not implementation. Reference how this capability extends or modifies the parent Feature.]

### Business Value

[Bullet points explaining the business justification and expected outcomes]

### Success Metrics

[Measurable, technology-agnostic criteria that indicate the epic is successful]

---

## User Personas

| Persona | Description         | Primary Goals               |
| ------- | ------------------- | --------------------------- |
| [Name]  | [Brief description] | [What they want to achieve] |

---

## User Stories

### Story 1: [Story Title]

**As a** [persona],
**I want** [goal/desire],
**So that** [benefit/value].

#### Acceptance Criteria

- [ ] **Given** [precondition], **when** [action], **then** [expected result]
- [ ] **Given** [precondition], **when** [action], **then** [expected result]
- [ ] [Additional criteria as needed]

#### Notes

[Any assumptions, constraints, or additional context]

---

### Story 2: [Story Title]

[Repeat structure for each story...]

---

## Dependencies

| Dependency | Type                | Description         | Status          |
| ---------- | ------------------- | ------------------- | --------------- |
| [Name]     | [Internal/External] | [Brief description] | [Known/Unknown] |

## Assumptions

- [List reasonable assumptions made during story creation]
- [Document defaults chosen for unspecified details]

## Out of Scope

- [Explicitly list what is NOT included in this epic]
- [Helps prevent scope creep]
- [If Option 1 was chosen, list deferred scope here with reference to future epic]

## Open Questions

[List any [NEEDS CLARIFICATION] items here for visibility - max 3]

---

## Appendix

### Complexity Assessment

**Assessed by**: nxs-architect
**Rating**: [S/M/L/XL]
**Timeline Estimates**:
| Scenario | Duration | Assumptions |
|----------|----------|-------------|
| Best Case | [X days] | [Key assumptions] |
| Likely Case | [X days] | [Key assumptions] |
| Worst Case | [X days] | [Key assumptions] |

**Complexity Drivers**:

- [Key factor 1 from architect analysis]
- [Key factor 2 from architect analysis]

### Glossary

| Term   | Definition   |
| ------ | ------------ |
| [Term] | [Definition] |

### Related Documents

- [Parent Feature Brief](ABSOLUTE_URL_TO_PARENT_README) - Parent Feature Brief
- [Links to related epics if part of a decomposition - USE ABSOLUTE URLs]
- [Links to related specs, designs, or documentation - USE ABSOLUTE URLs]

**Note**: All document links must be absolute GitHub URLs generated via `nxs-abs-doc-path` skill. Never use relative paths like `../README.md`.
```

8. **Story Decomposition Guidelines**:

    When breaking down the epic into user stories:

    a. **Identify natural boundaries**:
    - Different user actions or workflows
    - Different data entities being manipulated
    - Different permission levels or user types
    - Core functionality vs. enhancements

    b. **Apply story splitting patterns**:
    - Split by user persona (admin vs. regular user)
    - Split by workflow step (create, read, update, delete)
    - Split by data variation (simple case vs. edge cases)
    - Split by interface (web, mobile, API)
    - Split by business rule (basic validation vs. complex rules)

    c. **Story sizing guidance**:
    - Each story should be completable in 1-3 days of work
    - If a story seems larger, consider splitting further
    - Aim for 3-8 stories per epic (adjust based on complexity)

    d. **Story ordering**:
    - Place foundational stories first (data models, core CRUD)
    - Follow with enhancement stories (validations, notifications)
    - End with polish stories (UI refinements, edge cases)

9. **Quality Validation**: After writing the initial document, validate against these criteria:

    a. **Epic Level**:
    - [ ] Clear business value articulated
    - [ ] Success metrics are measurable and technology-agnostic
    - [ ] Scope is clearly bounded with explicit out-of-scope items
    - [ ] No implementation details (languages, frameworks, APIs)
    - [ ] Properly linked to parent Feature
    - [ ] Complexity assessment included in appendix
    - [ ] **All .md links use absolute GitHub URLs** (not relative paths)

    b. **Story Level**:
    - [ ] Each story follows "As a... I want... So that..." format
    - [ ] Each story delivers independent user value
    - [ ] Acceptance criteria are testable and unambiguous
    - [ ] No story is too large (should be completable in 1-3 days)
    - [ ] Stories are ordered logically for development

    c. **Handle Validation Results**:
    - If items fail: Update the document to address issues before saving
    - If [NEEDS CLARIFICATION] markers remain (max 3): Present to user using the clarification format below

10. **Handle Clarifications** (if any remain):

    For each clarification needed (max 3), present options:

    ```markdown
    ## Clarification Needed: [Topic]

    **Context**: [Quote relevant section]

    **Question**: [Specific question]

    | Option | Answer          | Impact on Stories                   |
    | ------ | --------------- | ----------------------------------- |
    | A      | [First option]  | [How this affects the epic/stories] |
    | B      | [Second option] | [How this affects the epic/stories] |
    | C      | [Third option]  | [How this affects the epic/stories] |

    **Your choice**: _[A/B/C or provide custom answer]_
    ```

    After receiving answers, update the document and remove [NEEDS CLARIFICATION] markers.

11. **Report completion** with:
    - Feature name and link to Feature README (using absolute URL)
    - Full file path where epic document was saved
    - Epic summary (name, story count, complexity rating)
    - Any clarifications needed before the epic is considered complete
    - If multiple epics were generated (Option 2), list all with their paths
    - Suggested next steps

---

## General Guidelines

### Quick Guidelines

- Focus on **WHAT** users need and **WHY** (business value)
- Avoid **HOW** to implement (no tech stack, APIs, code structure)
- Written for product owners, stakeholders, and developers to align on scope
- Each story should be a conversation starter, not a complete specification
- Maintain consistency with the parent Feature's context and terminology
- **All .md file links MUST use absolute GitHub URLs** (use `nxs-abs-doc-path` skill)

### Absolute Path Linking

All markdown document links in generated epics MUST be absolute GitHub URLs, not relative paths.

**Why?**

- Ensures links work regardless of where the document is viewed (GitHub, local, exported PDFs)
- Provides consistent navigation experience
- Avoids broken links when documents are moved or referenced from different contexts

**How?**
Use the `nxs-abs-doc-path` skill to convert relative paths:

```bash
# Convert a single path
python ./.claude/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/tagging/README.md"

# Convert multiple paths at once
python ./.claude/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/tagging/README.md" "docs/system/delivery/task-labels.md"
```

The script reads the `docRoot` from `docs/system/delivery/config.json` and constructs the full URL.

**Example transformation:**

- Input: `../README.md` or `docs/features/tagging/README.md`
- Output: `https://github.com/sameera/awzm/tree/main/docs/features/tagging/README.md`

### Right-Sizing Philosophy

The goal of right-sizing is to ensure:

1. **Predictable delivery**: Epics that fit in a sprint can be planned reliably
2. **Meaningful scope**: Epics smaller than 4 days lack sufficient cohesion
3. **Clear boundaries**: Each epic has a defined start and end state
4. **Independent value**: Each epic delivers something usable to stakeholders

### Acceptance Criteria Best Practices

- Use Given/When/Then format for complex scenarios
- Keep criteria atomic (one testable condition per item)
- Include happy path and key edge cases
- Avoid implementation language ("the API should...", "the database must...")

### For AI Generation

When creating this document from a user prompt:

1. **Validate Feature context first**: Always ensure you have a valid Feature before proceeding
2. **Assess complexity early**: Invoke nxs-architect before generating content
3. **Respect the gate**: NEVER proceed past right-sizing prompt without user input
4. **Make informed guesses**: Use context, industry standards, and common patterns to fill gaps
5. **Document assumptions**: Record reasonable defaults in the Assumptions section
6. **Limit clarifications**: Maximum 3 [NEEDS CLARIFICATION] markers
7. **Think like a product owner**: Every story should answer "what value does this deliver?"
8. **Think like a tester**: Every acceptance criterion should be verifiable
9. **Maintain Feature coherence**: Ensure the epic aligns with and extends the parent Feature
10. **Use absolute URLs**: Always run `nxs-abs-doc-path` skill for any .md file links

**Examples of reasonable defaults** (don't ask about these):

- Standard CRUD operations for data management features
- Basic validation (required fields, format validation)
- Standard error handling with user-friendly messages
- Responsive design for web features
- Basic accessibility compliance

**Common areas that MAY need clarification** (only if critical):

- User roles and permission boundaries
- Integration with external systems
- Compliance or regulatory requirements
- Performance requirements for high-scale features

### Directory Structure Example

After running this command for a "Tagging" feature:

```
docs/features/tagging/
├── README.md                      # Feature Brief (feature: "Tagging")
├── 01-space-scoped-tags/
│   └── epic.md                    # First epic (M complexity)
├── 02-private-user-tags/
│   └── epic.md                    # Second epic (S complexity)
├── 03-tag-inheritance/
│   └── epic.md                    # Third epic - split from larger scope
├── 04-tag-inheritance-advanced/
│   └── epic.md                    # Fourth epic - remainder of split
└── 05-bulk-tag-operations/
    └── epic.md                    # Fifth epic (M complexity)
```

### Complexity-to-Sprint Mapping Reference

| Complexity | Typical Duration | Sprint Fit    | Action       |
| ---------- | ---------------- | ------------- | ------------ |
| S          | 1-3 days         | ✅ Yes        | Proceed      |
| M          | 5-10 days        | ✅ Yes        | Proceed      |
| L          | 10-20 days       | ⚠️ Borderline | Likely split |
| XL         | 20-60 days       | ❌ No         | Must split   |

**Note**: The architect's "likely case" estimate is used for sprint fit determination.
