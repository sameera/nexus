---
name: nxs-qa
description: Three-phase QA skill for test specification generation, automated E2E test programming, and comprehensive verification with security, performance, and edge case testing.
---

# nxs-qa Skill

Three-phase QA automation skill for comprehensive feature validation.

## Purpose

- **Design:** Generate test specifications from epics (defines what to test)
- **Implement:** Write and execute automated E2E tests (defines how to test)
- **Verify:** Comprehensive QA validation including security, performance, edge cases (validates everything)

## Common Procedures

### Before Each Phase: Standards Compliance

**MANDATORY FIRST STEP in every phase:**
1. **Phase 1 (Design):** Read `docs/system/standards/qa-design.md` before creating issues. Defines mandatory coverage categories and ambiguity checks.
2. **Phase 2 (Implement):** Read `docs/system/standards/qa-implementation.md` before writing tests. Defines test code patterns and standards.
3. **Phase 3 (Verify):** Read `docs/system/standards/qa-verify.md` before running any test. Defines mandatory validation order.

**If files missing:** Fetch from origin before proceeding.

### QA Case Resolution

All phases that need QA cases use the same pattern:
- Load from `<epic-folder>/qa_issues.json` if available
- If missing, run `git fetch origin && git checkout origin/main -- <epic-folder>`
- If still missing, query GitHub for open issues labeled `qa-test-case`

---

## Workflow Phases

### Phase 1: Design - QA Case Creation

**Input:**
- Epic and task documents defining what will be implemented

**Output:**
- One or more GitHub issues with label `qa-test-case`
- Metadata file: `<epic-folder>/qa_issues.json` (contains issue IDs and titles)

**Process:**
1. **MANDATORY FIRST STEP:** See "Common Procedures" section above for qa-design.md requirement.
2. If epic or task docs are missing locally, run `git fetch origin` and `git checkout origin/main -- <epic-folder>` before continuing.
3. Read task requirements and acceptance criteria (scan all tasks in one pass)
4. Identify testable scenarios across all tasks
5. Detect mismatch between epic intent and proposed test-case intent (e.g., epic requires A but test case is B). If mismatch exists, prompt user for correction choice (update QA cases, update epic/tasks, continue with risk acknowledgment).
6. For each confirmed testable scenario, build an issue spec:
   - Title: `QA: <story/scenario>`
   - Body: scenario, test steps, expected outcomes, referenced tasks (~200 words)
7. Write all specs to a temp JSON file and run the creation script:
   ```bash
   python <skill-dir>/scripts/nxs_gh_create_qa_issues.py <specs.json> --label qa-test-case
   ```
   The script creates all issues and writes `<epic-folder>/qa_issues.json`.

**Format rules (design phase):**
- Output is GitHub issue list instead of single spec file
- Each issue must include test priority, scenario, steps, pass/fail criteria, and link to tasks
- Keep issue bodies brief (~200 words) and actionable
- Avoid ambiguous statements; ask user for clarification where needed
- All created issues are included in the metadata file above

**Timing:** After tasks are created, before development

### Phase 2: Implement - Automated Test Programming

**Input:**
- QA case GH issue list (`<epic-folder>/qa_issues.json`)
- Committed implementation code

**Output:**
- Automated test files passing all test cases
- Test execution summary

**Process:**
1. **MANDATORY FIRST STEP:** See "Common Procedures" section above for qa-implementation.md requirement.
2. Resolve QA cases: See "Common Procedures" section for details on loading from qa_issues.json or GitHub.
3. Parse issue text for test scenarios and expected outcomes
4. Inspect implementation code to identify selectors, routes, and API endpoints
5. Write tests aligned to your project's test framework and standards
6. Execute tests
7. Fix failing tests until all pass

**Constraint:** Phase cannot complete until all tests pass and follow your project's testing standards

### Phase 3: Verify - Comprehensive QA Validation

**Input:**
- QA case GH issue list (`<epic-folder>/qa_issues.json`)
- Running application

**Output:**
- Comprehensive QA report: `docs/features/<epic>/qa/QA-REPORT-<date>-<time>.md`
- Evidence artifacts (screenshots, logs, API responses)

**Process — mandatory order:**
1. **MANDATORY FIRST STEP:** See "Common Procedures" section above for qa-verify.md requirement.
2. **MANDATORY SECOND STEP:** Call `mcp__playwright__browser_navigate` to the app base URL and `mcp__playwright__browser_take_screenshot`. If the app does not load, STOP and report to the user — do not substitute code analysis.
3. Resolve QA cases: See "Common Procedures" section for details on loading from qa_issues.json or GitHub.
4. Execute each resolved QA case scenario using Playwright MCP browser interactions only
5. Collect evidence (screenshots/snapshots) for every result
6. Generate the QA report

**Hard constraint:** A test result is only valid if produced by a Playwright MCP tool call with evidence. Code analysis does not count as a test result.

**Testing Scope:**

**Functional Testing**
- Run all test cases from QA specs using Playwright MCP browser tools
- Verify user workflows end-to-end
- Validate UI interactions and state changes

**Security Testing**
- OWASP Top 10 validation:
  - SQL injection attempts
  - XSS payload testing
  - CSRF token validation
  - Authentication bypass attempts
  - Authorization boundary testing
  - Sensitive data exposure checks
- HTTPS/TLS validation
- CORS policy checks
- Token handling validation

**Performance Testing**
- Page load time measurement (target: < 2s)
- API response time measurement (target: < 500ms)
- Concurrent user handling
- Memory leak detection

**Permission Testing**
- Role-based access control validation
- Data isolation verification
- Feature flag checks

**Monkey Testing (Edge Cases)**
- Rapid clicks/form submissions
- Large input handling
- Special character input
- Copy-paste operations
- Unusual interaction sequences

**Cross-Browser Testing**
- Chrome, Firefox, Safari, Mobile browsers
- Verify consistent behavior

**Accessibility Testing**
- Keyboard navigation (Tab, Enter)
- Screen reader support
- Color contrast validation (WCAG AA)
- Form label associations

---

## File Locations

- QA issue metadata: `<epic-folder>/qa_issues.json`
- QA Reports: `<epic-folder>/qa/` (output path configured in nxs.qa command)

---

## Usage

### Phase 1: Design

```bash
# Create QA issues for the epic
nxs.qa --mode design --epic-path docs/features/login/epic.md

# Output: QA issue list in <epic-folder>/qa_issues.json and GH issues labeled qa-test-case
```

### Phase 2: Implement

```bash
# Verify implementation against QA issue list
nxs.qa --mode implement --epic-path docs/features/login

# Output: readout of QA issue status and recommended next steps
```

### Phase 3: Verify

```bash
# Comprehensive QA validation for the epic
nxs.qa --mode verify --epic-path docs/features/login/epic.md

# Output: docs/features/login/qa/QA-REPORT-<timestamp>.md

# With auto-start (starts dev server if needed):
nxs.qa --mode verify --epic-path docs/features/login/epic.md --auto-start
```

---

## Test Case GitHub Issue Format

QA test cases are stored as GitHub issues with label `qa-test-case`. Each issue follows this format:

**Title:** `QA: <story/scenario>`

**Body:**
```markdown
**Priority:** P0 | P1 | P2

**Scenario:**
<Brief description of what is being tested and why>

**Referenced Tasks:**
- TASK-XX.01
- TASK-XX.02

**Test Steps:**
1. Step 1
2. Step 2
3. Step 3

**Expected Outcomes:**
- Outcome 1
- Outcome 2

**Testing Categories:**
- Security: [auth | injection | xss | other] or none
- Performance: [true/false]
- Monkey Testing: [true/false]
```

**Example Issue:**

**Title:** `QA: User successfully completes primary workflow`

**Body:**
```markdown
**Priority:** P0

**Scenario:**
Verify that a standard user can complete the primary feature workflow without errors or performance degradation.

**Referenced Tasks:**
- TASK-05.01
- TASK-05.02

**Test Steps:**
1. Navigate to feature entry point
2. Complete primary user action
3. Verify state change and confirmation

**Expected Outcomes:**
- Action completes without error
- User receives confirmation
- Data persists correctly
- Response time < 2s

**Testing Categories:**
- Security: none
- Performance: true
- Monkey Testing: false
```

---

## QA Report Structure

**Header Metadata:**
- Epic name
- Report date and time
- Total tests, passed/failed/blocked counts
- Pass rate percentage
- Execution duration

**Sections:**
1. Executive Summary (quick stats)
2. Results by Category (Functional, Security, Performance, etc.)
3. Issues Found (Critical, Warnings, Info)
4. Recommendations (blocking vs non-blocking)
5. Evidence Artifacts (screenshots, logs)
6. Next Steps (fix, re-run, or proceed)

**Example Issue Entry:**
```markdown
## 🔴 CRITICAL: Security Vulnerability in User Input Handling

- **Test:** SEC-input-02
- **Description:** Input field fails to properly sanitize user data
- **Location:** Relevant component file and line
- **Risk:** Code injection vulnerability
- **Fix:** Apply proper input validation framework
- **Priority:** Must fix before shipping
```

---

## Integration with Other Commands

```
nxs.epic (feature design)
  ↓
nxs.tasks (implementation tasks)
  ↓
nxs.qa --mode design (create QA cases)
  ↓
nxs.dev (write code + unit tests)
  ↓
nxs.qa --mode implement (validate coverage)
  ↓
nxs.qa --mode verify (comprehensive QA)
  ↓
nxs.ship (commit and close)
```

## Key Features

✅ **Test-First:** Specs defined before code implementation
✅ **Two-Method Testing:** Functional tests + agent-generated tests
✅ **Security Focused:** OWASP Top 10 and critical checks
✅ **Performance Validated:** Load times and response times measured
✅ **Evidence Captured:** Screenshots and logs for all findings
✅ **User Controlled:** Comprehensive report, user decides next steps
✅ **Repeatable:** Can re-run verify after fixes

---

## See Also

- Command documentation: `.gemini/commands/nxs.qa.md`
- Agent documentation: `.gemini/agents/nxs-qa.md`
