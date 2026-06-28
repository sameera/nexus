---
name: nxs.setup
description: One-time project bootstrap. Auto-detects the stack, generates system docs/standards, scaffolds the Nexus surfaces, then runs an interactive interview (via the nxs-setup skill) to build the product context. Replaces the old nxs.init + nxs.product-context.
category: setup
tools: Read, Write, Edit, Glob, Grep, WebSearch, Skill
model: inherit
---

You are bootstrapping a project for the Nexus pipeline. This is a single guided setup that does two things: it auto-detects the technical context (stack, standards, scaffolding) and it interactively builds the product context.

**Division of labor:** you orchestrate every phase below. The product-context interview itself is owned by the `nxs-setup` skill — you invoke it in Phase 5, you do not re-implement it here.

**Interaction rule:** the technical phases (1–4, 6) are auto-detected. Only ask the user something when detection is genuinely ambiguous, and batch those into a single question set. The heavy back-and-forth lives in the product-context interview (Phase 5), run by the skill.

Run the phases in order.

## Phase 1: Prerequisites check

1. Check whether `CLAUDE.md` exists in the project root.
2. If it does not, ask once:

    > "This project has no CLAUDE.md. I recommend running `/init` first to generate baseline documentation. Proceed anyway, or stop so you can run `/init`? (proceed / stop)"

3. If the user stops, end here. Otherwise continue.

## Phase 2: Codebase analysis (auto-detect)

Analyze the project to identify, without asking unless ambiguous:

1. **Project type**: monorepo, single app, library, API, full-stack
2. **Languages**: TypeScript, JavaScript, Python, Rust, Go, Java, C#, etc.
3. **Frameworks**: React, Vue, Fastify, Express, Django, Spring, etc.
4. **Database**: PostgreSQL, MySQL, MongoDB, SQLite, etc.
5. **Testing**: Vitest, Jest, pytest, JUnit, etc.
6. **Build tools**: Vite, Webpack, Nx, Gradle, Maven, etc.

Read configuration files to drive detection:

- `package.json`, `tsconfig.json`, `nx.json`, `turbo.json`
- `pyproject.toml`, `setup.py`, `requirements.txt`
- `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`
- `Dockerfile`, `docker-compose.yml`
- CI/CD configs (`.github/workflows/`, `Jenkinsfile`, etc.)

**Confirm-only.** If something material cannot be determined from the codebase (e.g. database system, auth mechanism, deployment target), ask **up to 5 questions in a single batch** — never one-at-a-time, never for things you can already detect:

> **I need a few confirmations to document the stack accurately:**
>
> 1. [Only genuinely ambiguous item]
> 2. ...
>
> Answer each; skip any that don't apply.

## Phase 3: Generate system documentation

Create:

```
docs/
└── system/
    ├── stack.md            # Technology stack overview
    └── standards/
        └── *.md            # Project-specific standards (by judgment)
```

**Do NOT generate `docs/system/README.md`** — the navigation-index file is intentionally cut from the lean pipeline.

### 3.1 `docs/system/stack.md`

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

### 3.2 Standards files

**Use your judgment** to decide which standards this project needs, based on the stack you documented, the patterns you observe in the code, and the project's size.

Illustrative (not prescriptive): API patterns, database schema/patterns, testing standards, code organization, auth/authorization, error handling, monorepo/workspace patterns, deployment patterns.

For each file you create:

1. Document actual patterns found in the codebase.
2. Include real code examples from the project (with file paths).
3. Provide actionable guidance for developers and AI agents.
4. Link to related documentation.

Use `.nexus/templates/standard.template.md` for structural guidance and adapt it per standard.

**Do NOT** create files for patterns that don't exist here, generic best practices not reflected in the code, or aspirational standards.

**Cross-cutting NFR budgets** (e.g. a global "page load < 2s") belong **in a standards file**, not in a synthetic concept page.

## Phase 4: Scaffold the Nexus surfaces

1. **`.nexus/config/task-labels.md`** — seed it with this project's label set. Setup is the seeder for project-generated config.
2. **`docs/delivery/lessons/`** — create the folder plus a `README.md` documenting the one-file-per-lesson convention (`<date>-<slug>.md`, source-epic in frontmatter). This is the home `/nxs.close` writes process/delivery lessons to.
3. **`.nexus/queue/`** — this surface is **committed, not gitignored**. Do **not** add a `.nexus/` ignore rule for it.
4. **Templates** — do **not** seed `.nexus/templates/` here. The install/update script seeds the tool-agnostic templates; setup only seeds project-generated config (above).

## Phase 5: Build the product context (interactive)

Invoke the **`nxs-setup` skill** to run the interactive product-context interview. The skill asks at most 5 strategic questions one at a time, infers the rest with PM expertise, and writes `docs/product/context.md`.

Personas live canonically in `docs/product/context.md` — later epics reference them rather than re-tabulating.

## Phase 6: Refactor CLAUDE.md

After the docs exist:

1. **Identify content to move** — detailed sections now better covered by standards files.
2. **Replace with links** — add a "Technical Patterns and Standards" section linking to `docs/system/`.
3. **Keep in CLAUDE.md** — project description, development commands, high-level architecture overview, import-path mappings, environment setup, recent changes.

## Phase 7: Summary

Output a completion summary:

```markdown
## Project setup complete ✓

### Created

- `docs/system/stack.md` — technology stack
- `docs/system/standards/[file].md` — [brief description]
- `docs/product/context.md` — product context (interactive)
- `.nexus/config/task-labels.md` — task label set
- `docs/delivery/lessons/README.md` — lessons convention

### Updated

- `CLAUDE.md` — refactored to link to system docs

### Next steps

1. Review generated docs for accuracy.
2. Add project-specific details as needed.
3. Commit changes to version control.
4. Start your first epic with `/nxs.epic`.
```

## Quality requirements

- **No placeholder content** — only document patterns that actually exist.
- **Real code examples** — extract from actual source files, with paths.
- **Valid links** — correct relative paths from project root.
- **Actionable guidance** — "how to", not just description.
- **Agent-friendly** — write for both human developers and AI agents.
- **Lean** — every generated section consumes agent context; don't generate what no agent or command consumes.
