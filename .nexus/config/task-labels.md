# GitHub Issue Labels

Standard labels for categorizing GitHub issues in the Nexus Prime project. Prime is a
client-side React terminal emulator that drives the Nexus pipeline — labels reflect that
surface area (no backend/database layer).

## Frontend (`frontend`, #0075ca)

**Purpose:** React components, routing, UI/UX, client-side state

**Use for:**

- React component development
- react-router-dom routes and navigation
- Tailwind styling and layout
- Client-side state and hooks

## Terminal (`terminal`, #5319e7)

**Purpose:** The wterm-based in-browser terminal and the Claude Code session it hosts

**Use for:**

- wterm embedding and configuration
- Terminal I/O, rendering, and resize handling
- Claude Code process lifecycle inside the terminal

## Pipeline (`pipeline`, #1d76db)

**Purpose:** Orchestration of the Nexus stages (`nxs.*`) and the human-decision gates between them

**Use for:**

- Sequencing and ordering of `nxs.init` → `nxs.close`
- Stage-gate enforcement and decision prompts
- Surfacing pipeline state to the user

## Infrastructure (`infrastructure`, #0e8a16)

**Purpose:** Build tooling, Nx/Vite/pnpm config, dev environment, CI/CD

**Use for:**

- Nx workspace and target configuration
- Vite/Tailwind/ESLint build setup
- Dependency and tooling upgrades
- CI/CD pipeline setup

## Testing (`testing`, #fbca04)

**Purpose:** Vitest unit/component tests and Playwright e2e

**Use for:**

- Unit and component test coverage
- Playwright e2e flows
- Test tooling and fixtures

## Performance (`performance`, #d4c5f9)

**Purpose:** Frontend and terminal rendering performance

**Use for:**

- React rendering optimization
- Terminal throughput / large-output handling
- Bundle size and load time

## Usage Guidelines

1. **Multiple Labels:** Issues can have multiple labels when they span categories.
2. **Primary Label:** Choose the label that best represents the primary work area.
3. **Surface Labels:** Use `frontend`, `terminal`, `pipeline`, `infrastructure` for the primary
   work surface.
4. **Cross-cutting Labels:** Use `performance` or `testing` as secondary labels when relevant.
</content>
