---
description: Generate an Epic and User Stories document from a natural language feature description.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after `/epic.generate` in the triggering message **is** the feature description. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

Given that feature description, do this:

1. **Generate a concise filename** (kebab-case) for the document:

    - Analyze the feature description and extract the most meaningful keywords
    - Create a 2-5 word filename that captures the essence of the feature
    - Use noun or action-noun format (e.g., "user-authentication", "payment-processing", "analytics-dashboard")
    - Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)
    - Append `-epic.md` suffix to the filename
    - Examples:
        - "I want to add user authentication" → `user-authentication-epic.md`
        - "Implement OAuth2 integration for the API" → `oauth2-api-integration-epic.md`
        - "Create a dashboard for analytics" → `analytics-dashboard-epic.md`
        - "Fix payment processing timeout bug" → `payment-timeout-fix-epic.md`

2. **Determine the save location**:

    a. Check if there's a currently open file in the IDE:

    - If YES: Save the document to the **same folder** as the currently open file
    - If NO: Save to `docs/features` folder at the repository root

    b. Create the target directory if it doesn't exist:

    ```bash
    mkdir -p "<target-directory>"
    ```

    c. Construct the full file path: `<target-directory>/<filename>-epic.md`

3. **Parse and analyze the feature description**:

    Follow this execution flow:

    1. Parse user description from Input
        - If empty: ERROR "No feature description provided"
    2. Extract key concepts from description
        - Identify: actors/personas, goals, actions, data, constraints, business value
    3. For unclear aspects:
        - Make informed guesses based on context and industry standards
        - Only mark with [NEEDS CLARIFICATION: specific question] if:
            - The choice significantly impacts feature scope or user experience
            - Multiple reasonable interpretations exist with different implications
            - No reasonable default exists
        - **LIMIT: Maximum 3 [NEEDS CLARIFICATION] markers total**
        - Prioritize clarifications by impact: scope > security/privacy > user experience > technical details
    4. Decompose the feature into logical user stories
        - Each story should be independently deliverable
        - Stories should follow the INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
    5. Define acceptance criteria for each story
        - Each criterion must be testable and unambiguous
        - Use Given/When/Then format where appropriate
    6. Return: SUCCESS (epic document ready)

4. **Write the Epic document** using the following structure:

```markdown
# Epic: [Epic Title]

## Overview

**Epic Name**: [Concise name for the epic]
**Created**: [Current date in YYYY-MM-DD format]
**Status**: Draft
**Owner**: [Leave as TBD]

### Description

[2-3 paragraph description of the epic explaining WHAT the feature does and WHY it matters to users/business. Focus on value delivery, not implementation.]

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

-   [Links to related specs, designs, or documentation]
```

5. **Story Decomposition Guidelines**:

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

6. **Quality Validation**: After writing the initial document, validate against these criteria:

    a. **Epic Level**:

    - [ ] Clear business value articulated
    - [ ] Success metrics are measurable and technology-agnostic
    - [ ] Scope is clearly bounded with explicit out-of-scope items
    - [ ] No implementation details (languages, frameworks, APIs)

    b. **Story Level**:

    - [ ] Each story follows "As a... I want... So that..." format
    - [ ] Each story delivers independent user value
    - [ ] Acceptance criteria are testable and unambiguous
    - [ ] No story is too large (should be completable in 1-3 days)
    - [ ] Stories are ordered logically for development

    c. **Handle Validation Results**:

    - If items fail: Update the document to address issues before saving
    - If [NEEDS CLARIFICATION] markers remain (max 3): Present to user using the clarification format below

7. **Handle Clarifications** (if any remain):

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

8. **Report completion** with:
    - Full file path where document was saved
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

### Acceptance Criteria Best Practices

-   Use Given/When/Then format for complex scenarios
-   Keep criteria atomic (one testable condition per item)
-   Include happy path and key edge cases
-   Avoid implementation language ("the API should...", "the database must...")

### For AI Generation

When creating this document from a user prompt:

1. **Make informed guesses**: Use context, industry standards, and common patterns to fill gaps
2. **Document assumptions**: Record reasonable defaults in the Assumptions section
3. **Limit clarifications**: Maximum 3 [NEEDS CLARIFICATION] markers
4. **Think like a product owner**: Every story should answer "what value does this deliver?"
5. **Think like a tester**: Every acceptance criterion should be verifiable

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

```

```
