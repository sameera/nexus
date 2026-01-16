# /nxs.init

You are a documentation engineer tasked with creating AI-agent-context documentation for this project. Your goal is to analyze the codebase and generate comprehensive documentation in `docs/system/` that enables other Claude Code agents and slash commands to effectively understand and work with this project.

## Instructions

Follow these phases in order:

### Phase 1: Prerequisites Check

1. Check if `CLAUDE.md` exists in the project root
2. If it doesn't exist, ask the user:
   
   > "This project doesn't have a CLAUDE.md file. I recommend running `/init` first to generate baseline documentation. Would you like to:
   > 
   > 1. **Run `/init` first** (recommended)
   > 2. **Proceed without CLAUDE.md**
   > 
   > Please respond with 1 or 2."

3. If user chooses 1, stop and instruct them to run `/init` first
4. If user chooses 2 or CLAUDE.md exists, continue

### Phase 2: Project Analysis

Analyze the project to identify:

1. **Project Type**: monorepo, single app, library, API, full-stack
2. **Languages**: TypeScript, JavaScript, Python, Rust, Go, Java, C#, etc.
3. **Frameworks**: React, Vue, Fastify, Express, Django, Spring, etc.
4. **Database**: PostgreSQL, MySQL, MongoDB, SQLite, etc.
5. **Testing**: Vitest, Jest, pytest, JUnit, etc.
6. **Build Tools**: Vite, Webpack, Nx, Gradle, Maven, etc.

Look for configuration files like:
- `package.json`, `tsconfig.json`, `nx.json`, `turbo.json`
- `pyproject.toml`, `setup.py`, `requirements.txt`
- `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`
- `Dockerfile`, `docker-compose.yml`
- CI/CD configs (`.github/workflows/`, `Jenkinsfile`, etc.)

### Phase 3: Information Gathering

If you cannot determine key information from the codebase, ask the user **up to 5 questions in a single batch**:

> **I need some clarification to generate accurate documentation:**
>
> 1. [Question about unclear aspect]
> 2. [Question about unclear aspect]
> ...
>
> Please answer each numbered question. Skip any that don't apply.

**Only ask questions for information you truly cannot determine.** Potential topics:
- Tech stack confirmation (if detection is uncertain)
- Database system (if not evident)
- Authentication mechanism
- Deployment target
- Testing approach

### Phase 4: Generate Documentation

Create the following structure:

```
docs/
└── system/
    ├── README.md           # Navigation index for agents
    ├── stack.md            # Technology stack overview
    └── standards/
        ├── .ai/            # AI utility scripts (optional)
        └── *.md            # Pattern documentation files
```

#### 4.1 Create `docs/system/stack.md`

Document the complete technology stack. Include only sections that apply:

```markdown
---
stack: Primary Technology Stack
version: 1.0.0
last_updated: [DATE]
---

# Technology Stack

## Frontend
- **Framework**: [e.g., React 18.x]
- **Language**: [e.g., TypeScript 5.x]
- **State Management**: [if applicable]
- **Styling**: [e.g., Tailwind CSS]
- **Build Tool**: [e.g., Vite]

## Backend
- **Framework**: [e.g., Fastify 4.x]
- **Language**: [e.g., TypeScript 5.x]
- **Authentication**: [e.g., JWT, OAuth]

## Database
- **Primary**: [e.g., PostgreSQL 16]

## Infrastructure
- **Hosting**: [e.g., AWS, Vercel]
- **CI/CD**: [e.g., GitHub Actions]

## Development
- **Package Manager**: [e.g., pnpm]
- **Code Quality**: [e.g., ESLint, Prettier]
- **Testing**: [e.g., Vitest, Playwright]
```

#### 4.2 Create `docs/system/README.md`

Create a navigation index that:
- Links to all documentation files
- Provides brief descriptions and "when to consult" guidance for each
- References the main CLAUDE.md
- Includes quick navigation for common tasks

#### 4.3 Create Standards Files

**Use your judgment** to determine what standards files this project needs based on:
- The technology stack you documented in `stack.md`
- Patterns you observe in the codebase
- Complexity and size of the project

**Examples of standards files you might create** (illustrative, not prescriptive):
- API patterns and conventions
- Database schema and patterns
- Testing standards
- Code organization patterns
- Authentication/authorization patterns
- Error handling conventions
- Monorepo/workspace patterns
- Deployment patterns

**For each file you create:**
1. Document actual patterns found in the codebase
2. Include real code examples from the project (with file paths)
3. Provide actionable guidance for developers and AI agents
4. Link to related documentation

**Do NOT create files for:**
- Patterns that don't exist in this project
- Generic best practices not reflected in the code
- Hypothetical or aspirational standards

### Phase 5: Refactor CLAUDE.md

After generating documentation:

1. **Identify content to move**: Find detailed sections now better covered in standards files
2. **Replace with links**: Add a "Technical Patterns and Standards" section linking to `docs/system/`
3. **Keep in CLAUDE.md**:
   - Project description
   - Development commands
   - High-level architecture overview
   - Import path mappings
   - Environment setup
   - Recent changes

### Phase 6: Summary

Output a completion summary:

```markdown
## Documentation Generation Complete ✓

### Created Files:
- `docs/system/README.md` - Documentation index
- `docs/system/stack.md` - Technology stack
- `docs/system/standards/[file].md` - [Brief description]
...

### Updated Files:
- `CLAUDE.md` - Refactored to link to new documentation

### Next Steps:
1. Review generated documentation for accuracy
2. Add project-specific details as needed
3. Commit changes to version control
```

## Quality Requirements

- **NO placeholder content** - Only document patterns that actually exist
- **Real code examples** - Extract from actual source files with paths
- **Valid links** - Use correct relative paths from project root
- **Actionable guidance** - Provide "how to" instructions, not just descriptions
- **Agent-friendly** - Write for both human developers and AI agents

## Template Reference

A generic standards template is available at `templates/standard.template.md` for structural guidance. Adapt it to fit each specific standard you document.
