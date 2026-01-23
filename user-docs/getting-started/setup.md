# Project Setup

This guide covers initializing a new project with Nexus's required documentation structure.

## Overview

Nexus requires a specific folder structure and configuration files to function. The `/nxs.init` command automates this setup.

## Quick Setup

```bash
# Navigate to your project root
cd /path/to/your/project

# Initialize Nexus structure
/nxs.init
```

This creates the complete documentation hierarchy and required configuration files.

## What Gets Created

### Folder Structure

```
your-project/
├── docs/
│   ├── product/
│   │   ├── context.md
│   │   └── features/
│   │       └── .gitkeep
│   └── system/
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
└── CLAUDE.md (if doesn't exist)
```

### Key Files Explained

#### `docs/product/context.md`
High-level product vision, target users, and business context. This file provides AI agents with background about your product.

**Example content**:
```markdown
# Product Context

## Vision
A developer productivity platform that reduces context switching.

## Target Users
- Software engineers working on multiple projects
- Teams practicing spec-driven development

## Key Differentiators
- AI-native workflow
- Specification-first approach
```

#### `docs/system/stack.md`
Technology stack and architectural constraints. Guides technical decisions during HLD generation.

**Example content**:
```markdown
# Technology Stack

## Frontend
- React 18
- TypeScript 5
- Tailwind CSS

## Backend
- Node.js 20
- Express
- PostgreSQL 15

## Infrastructure
- Docker
- GitHub Actions
```

#### `docs/system/standards/*.md`
Coding, testing, documentation, and git standards. Referenced during implementation.

These files are scaffolded with common best practices but should be customized to your team's conventions.

#### `docs/system/delivery/config.json`
Configuration for GitHub URL generation and project metadata.

**Default structure**:
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

**Purpose**: Used by the `nxs-abs-doc-path` skill to convert relative documentation paths to absolute GitHub URLs for portability.

#### `docs/system/delivery/task-labels.md`
Defines available labels for task categorization.

**Example**:
```markdown
# Task Labels

## By Layer
- frontend
- backend
- database
- infrastructure

## By Type
- feature
- bugfix
- refactor
- docs
- test
```

These labels appear in task frontmatter and GitHub issues.

#### `docs/system/delivery/task-template.md`
Template for generated task files. Supports variable substitution.

**Variables**:
- `{{EPIC}}` - Epic number
- `{{SEQ}}` - Task sequence number
- `{{TITLE}}` - Task title
- `{{SUMMARY}}` - Task summary
- `{{BLOCKED_BY}}` - Dependency list
- `{{BLOCKS}}` - Dependents list
- And more...

See [Templates Reference](../reference/templates.md) for full variable list.

#### `CLAUDE.md`
Project-specific context for Claude Code. Created if it doesn't exist.

**Purpose**: Store project-specific patterns, environment file patterns, and memories that persist across sessions.

## Manual Setup (Alternative)

If you prefer manual control or `/nxs.init` fails:

1. **Create folder structure**:
   ```bash
   mkdir -p docs/product/features
   mkdir -p docs/system/{standards,delivery}
   ```

2. **Create required files**:
   ```bash
   touch docs/product/context.md
   touch docs/system/stack.md
   touch docs/system/standards/{coding,testing,documentation,git}-standards.md
   touch docs/system/delivery/{config.json,task-labels.md,task-template.md}
   ```

3. **Copy templates** from `~/nexus/common/docs/` to your project.

## Configuration

### Customize config.json

Edit `docs/system/delivery/config.json` to match your project:

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

The `prefix` is used for epic numbering (e.g., `API-01`, `API-02`).

### Customize Standards

Edit files in `docs/system/standards/` to reflect your team's practices:

- **coding-standards.md**: Naming conventions, code style, patterns
- **testing-standards.md**: Test structure, coverage expectations
- **documentation-standards.md**: Comment style, README requirements
- **git-standards.md**: Commit message format, branch naming

These standards are referenced by agents during implementation.

### Customize Task Template

Edit `docs/system/delivery/task-template.md` to modify generated task structure:

- Add custom sections
- Change frontmatter fields
- Adjust acceptance criteria format

**Example customization** (add a "Testing Notes" section):
```markdown
## Testing Notes

{{TESTING_NOTES}}
```

Then modify `/nxs.tasks` prompt to populate `{{TESTING_NOTES}}`.

## Verification

After setup, verify required files exist:

```bash
# Check structure
tree docs/

# Verify config.json is valid JSON
cat docs/system/delivery/config.json | jq .

# Check CLAUDE.md exists
ls -l CLAUDE.md
```

## Git Integration

Add documentation to version control:

```bash
git add docs/ CLAUDE.md
git commit -m "chore: Initialize Nexus documentation structure"
```

**Recommendation**: Commit the structure immediately so all team members have the same foundation.

## Next Steps

- [Your First Epic](first-epic.md) - Create your first feature specification
- [Project Structure](../configuration/project-structure.md) - Detailed folder hierarchy explanation
- [Required Files](../configuration/required-files.md) - Deep dive on each configuration file

## Common Issues

### config.json Syntax Errors

**Problem**: Commands fail with "invalid JSON"

**Solution**: Validate JSON syntax:
```bash
cat docs/system/delivery/config.json | jq .
```

Fix any syntax errors (missing commas, quotes, etc.).

### Missing Standards Files

**Problem**: `/nxs.dev` can't find coding standards

**Solution**: Ensure all files in `docs/system/standards/` exist and have content. Empty files will cause warnings.

### Wrong GitHub URLs

**Problem**: Generated task links point to wrong repository

**Solution**: Update `docs/system/delivery/config.json` with correct org/repo/branch values.
