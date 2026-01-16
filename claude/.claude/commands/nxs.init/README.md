# /nxs.init

Generate AI-agent-context documentation for any project.

## Description

This command analyzes your codebase and creates structured documentation in `docs/system/` that enables Claude Code agents and slash commands to understand and work effectively with your project.

## What it Creates

```
docs/
└── system/
    ├── README.md              # Documentation index for agents
    ├── stack.md               # Technology stack overview
    └── standards/
        ├── .ai/               # AI utility scripts (optional)
        └── [patterns].md      # Standards based on your project
```

## Usage

```
/nxs.init
```

## Workflow

1. **Checks prerequisites** - Prompts to run `/init` if CLAUDE.md doesn't exist
2. **Analyzes project** - Detects tech stack, frameworks, and patterns
3. **Asks questions** - Up to 5 clarifying questions if needed
4. **Generates documentation** - Creates `docs/system/` with relevant standards
5. **Refactors CLAUDE.md** - Updates to reference new documentation

## Standards Generation

The command uses its judgment to determine what standards files your project needs based on:
- The technology stack detected
- Patterns observed in the codebase
- Project complexity and structure

It will **only** create documentation for patterns that actually exist in your code.

## Prerequisites

- Recommended: Run `/init` first to create CLAUDE.md
- A working project with code to analyze
