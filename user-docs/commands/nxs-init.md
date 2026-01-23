# /nxs.init

Bootstrap your project's documentation structure for Nexus compatibility.

## Purpose

Creates the required folder hierarchy and configuration files that Nexus commands depend on. This is typically the first command you run in a new project.

## When to Use

- Setting up a new project for Nexus
- Adding Nexus to an existing project
- After cloning a repository that doesn't have Nexus structure

## Prerequisites

None. This is the entry point command.

## Usage

```bash
/nxs.init
```

No arguments required. The command is context-aware and adapts to your project.

## What It Does

### Phase 1: Prerequisites Check

Checks if `CLAUDE.md` exists at project root. If missing, offers to run Claude Code's `/init` command first (recommended for comprehensive project documentation).

### Phase 2: Project Analysis

Automatically detects:
- Project type (monorepo, library, API, full-stack)
- Languages and frameworks
- Database systems
- Testing frameworks
- Build tools

Scans configuration files:
- `package.json`, `tsconfig.json` (JavaScript/TypeScript)
- `pyproject.toml`, `requirements.txt` (Python)
- `Cargo.toml` (Rust), `go.mod` (Go)
- Docker and CI/CD configs

### Phase 3: Information Gathering

If detection is uncertain, asks targeted questions (max 5):
- Tech stack confirmation
- Database type
- Authentication mechanism
- Deployment target

### Phase 4: Generate Documentation

Creates this structure:

```
your-project/
├── docs/
│   ├── product/
│   │   ├── context.md
│   │   └── features/
│   │       └── .gitkeep
│   └── system/
│       ├── README.md
│       ├── stack.md
│       ├── standards/
│       │   ├── coding-standards.md
│       │   ├── testing-standards.md
│       │   ├── documentation-standards.md
│       │   └── git-standards.md
│       └── delivery/
│           ├── config.json
│           ├── task-labels.md
│           └── task-template.md
└── CLAUDE.md (updated if exists)
```

### Phase 5: Refactor CLAUDE.md

If `CLAUDE.md` exists, refactors it to:
- Move detailed patterns to `docs/system/standards/`
- Add links to new documentation
- Keep high-level project info in CLAUDE.md

## Output

### Completion Summary

```
## Documentation Generation Complete ✓

### Created Files:

- docs/system/README.md - Documentation index
- docs/system/stack.md - Technology stack
- docs/system/standards/coding-standards.md - Coding patterns
- docs/system/standards/testing-standards.md - Test conventions
- docs/system/delivery/config.json - Project configuration
- docs/product/context.md - Product vision

### Updated Files:

- CLAUDE.md - Refactored to link to new documentation

### Next Steps:

1. Review generated documentation for accuracy
2. Update docs/system/delivery/config.json with GitHub details
3. Customize docs/system/standards/ files for your team
4. Commit changes to version control
```

## Generated Files Explained

### docs/product/context.md

High-level product vision and user context. Provides AI agents with "why" understanding.

**What to edit**: Product vision, target users, key differentiators.

### docs/system/stack.md

Complete technology stack organized by layer (frontend, backend, database, infrastructure).

**What to edit**: Verify detected technologies, add missing tools.

### docs/system/standards/*.md

Pattern documentation for:
- **coding-standards.md**: Naming conventions, code organization
- **testing-standards.md**: Test structure, coverage expectations
- **documentation-standards.md**: Comment style, README format
- **git-standards.md**: Commit messages, branch naming

**What to edit**: Customize to match your team's actual practices.

### docs/system/delivery/config.json

Project metadata for GitHub integration:

```json
{
    "github": {
        "org": "your-org",
        "repo": "your-repo",
        "branch": "main"
    },
    "project": {
        "name": "Your Project",
        "prefix": "PRJ"
    }
}
```

**What to edit**: Replace placeholders with actual values.

### docs/system/delivery/task-labels.md

Available labels for task categorization (frontend, backend, database, etc.).

**What to edit**: Add project-specific labels.

### docs/system/delivery/task-template.md

Template for generated task files with variable substitution.

**What to edit**: Add custom sections, modify structure.

## Example Invocation

```bash
cd /path/to/my-project
/nxs.init
```

**Output**:
```
Analyzing project structure...

Detected:
- Frontend: React 18.x, TypeScript 5.x
- Backend: Express, Node.js
- Database: PostgreSQL
- Testing: Vitest, Playwright

Creating documentation structure...

✓ Created docs/product/context.md
✓ Created docs/system/stack.md
✓ Created docs/system/standards/coding-standards.md
✓ Created docs/system/standards/testing-standards.md
✓ Created docs/system/delivery/config.json
✓ Updated CLAUDE.md

Documentation generation complete!

Next: Edit docs/system/delivery/config.json with your GitHub details.
```

## Post-Initialization

### 1. Verify Structure

```bash
tree docs/
```

### 2. Configure GitHub Settings

Edit `docs/system/delivery/config.json`:

```json
{
    "github": {
        "org": "acme-corp",
        "repo": "product-api",
        "branch": "main"
    },
    "project": {
        "name": "Product API",
        "prefix": "API"
    }
}
```

### 3. Validate JSON

```bash
cat docs/system/delivery/config.json | jq .
```

### 4. Review Standards

Edit files in `docs/system/standards/` to match your team's conventions.

### 5. Commit Changes

```bash
git add docs/ CLAUDE.md
git commit -m "chore: Initialize Nexus documentation structure"
```

## Common Issues

### CLAUDE.md Not Found

**Problem**: Command prompts to run `/init` first

**Solution**: Run Claude Code's `/init` command to generate baseline project documentation, then re-run `/nxs.init`.

### Wrong Technology Detected

**Problem**: Stack.md lists incorrect frameworks

**Solution**: Edit `docs/system/stack.md` manually to correct detected technologies.

### Missing Sections

**Problem**: Expected standards files not created

**Solution**: Command only creates files for patterns it detects. Add missing files manually using the template structure.

## Next Steps

- [Project Setup](../getting-started/setup.md) - Detailed configuration guide
- [Your First Epic](../getting-started/first-epic.md) - Start specifying features
- [/nxs.epic](nxs-epic.md) - Generate user stories

## Tips

**Run Once**: Only run `/nxs.init` once per project. Subsequent runs may overwrite customizations.

**Commit Immediately**: Commit the generated structure so team members have the same foundation.

**Customize Standards**: The generated standards are starting points. Tailor them to your team's practices.

**Review stack.md**: Verify detected technologies before proceeding. Accurate stack info improves HLD generation.

## Related Commands

- `/init` (Claude Code built-in) - Generates CLAUDE.md
- [/nxs.epic](nxs-epic.md) - Requires structure created by `/nxs.init`
