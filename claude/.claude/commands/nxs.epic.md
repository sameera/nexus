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

2. **Generate a concise epic folder name** (kebab-case):

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

3. **Create the Epic directory using sequential-name-generator**:

    a. Use the `sequential-name-generator` skill to generate the folder name:

    ```bash
    python ./scripts/next_sequential_name.py "<feature-directory>" "<epic-name>"
    ```

    - `<feature-directory>` is the directory containing the Feature's README.md
    - `<epic-name>` is the kebab-case name generated in step 2 (no extension = folder mode)

    b. The script will return a name like `03-space-scoped-tags`

    c. Create the epic directory:

    ```bash
    mkdir -p "<feature-directory>/<sequential-epic-folder>"
    ```

    d. The epic document will be saved as `epic.md` inside this directory:
    `<feature-directory>/<sequential-epic-folder>/epic.md`

4. **Parse and analyze the capability description**:

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

5. **Write the Epic document** using the following structure:

```markdown
---
feature: "[Feature Name from README.md]"
epic: "[Epic Name]"
created: [Current date in YYYY-MM-DD format]
type: enhancement
status: draft
---

# Epic: [Epic Title]

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

-   [ ] **Given** [precondition], **when** [action], **then** [expected result]
-   [ ] **Given** [precondition], **when** [action], **then** [expected result]
-   [ ] [Additional criteria as needed]

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

-   [List reasonable assumptions made during story creation]
-   [Document defaults chosen for unspecified details]

## Out of Scope

-   [Explicitly list what is NOT included in this epic]
-   [Helps prevent scope creep]

## Open Questions

[List any [NEEDS CLARIFICATION] items here for visibility - max 3]

---

## Appendix

### Glossary

| Term   | Definition   |
| ------ | ------------ |
| [Term] | [Definition] |

### Related Documents

-   [../README.md](../README.md) - Parent Feature Brief
-   [Links to related specs, designs, or documentation]
```

6. **Story Decomposition Guidelines**:

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

7. **Quality Validation**: After writing the initial document, validate against these criteria:

    a. **Epic Level**:

    - [ ] Clear business value articulated
    - [ ] Success metrics are measurable and technology-agnostic
    - [ ] Scope is clearly bounded with explicit out-of-scope items
    - [ ] No implementation details (languages, frameworks, APIs)
    - [ ] Properly linked to parent Feature

    b. **Story Level**:

    - [ ] Each story follows "As a... I want... So that..." format
    - [ ] Each story delivers independent user value
    - [ ] Acceptance criteria are testable and unambiguous
    - [ ] No story is too large (should be completable in 1-3 days)
    - [ ] Stories are ordered logically for development

    c. **Handle Validation Results**:

    - If items fail: Update the document to address issues before saving
    - If [NEEDS CLARIFICATION] markers remain (max 3): Present to user using the clarification format below

8. **Handle Clarifications** (if any remain):

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

9. **Report completion** with:
    - Feature name and link to Feature README
    - Full file path where epic document was saved
    - Epic summary (name, story count)
    - Any clarifications needed before the epic is considered complete
    - Suggested next steps

---

## General Guidelines

### Quick Guidelines

-   Focus on **WHAT** users need and **WHY** (business value)
-   Avoid **HOW** to implement (no tech stack, APIs, code structure)
-   Written for product owners, stakeholders, and developers to align on scope
-   Each story should be a conversation starter, not a complete specification
-   Maintain consistency with the parent Feature's context and terminology

### Acceptance Criteria Best Practices

-   Use Given/When/Then format for complex scenarios
-   Keep criteria atomic (one testable condition per item)
-   Include happy path and key edge cases
-   Avoid implementation language ("the API should...", "the database must...")

### For AI Generation

When creating this document from a user prompt:

1. **Validate Feature context first**: Always ensure you have a valid Feature before proceeding
2. **Make informed guesses**: Use context, industry standards, and common patterns to fill gaps
3. **Document assumptions**: Record reasonable defaults in the Assumptions section
4. **Limit clarifications**: Maximum 3 [NEEDS CLARIFICATION] markers
5. **Think like a product owner**: Every story should answer "what value does this deliver?"
6. **Think like a tester**: Every acceptance criterion should be verifiable
7. **Maintain Feature coherence**: Ensure the epic aligns with and extends the parent Feature

**Examples of reasonable defaults** (don't ask about these):

-   Standard CRUD operations for data management features
-   Basic validation (required fields, format validation)
-   Standard error handling with user-friendly messages
-   Responsive design for web features
-   Basic accessibility compliance

**Common areas that MAY need clarification** (only if critical):

-   User roles and permission boundaries
-   Integration with external systems
-   Compliance or regulatory requirements
-   Performance requirements for high-scale features

### Directory Structure Example

After running this command for a "Tagging" feature:

```
docs/features/tagging/
├── README.md                      # Feature Brief (feature: "Tagging")
├── 01-space-scoped-tags/
│   └── epic.md                    # First epic
├── 02-private-user-tags/
│   └── epic.md                    # Second epic (this command creates)
└── 03-tag-inheritance/
    └── epic.md                    # Third epic (future)
```
