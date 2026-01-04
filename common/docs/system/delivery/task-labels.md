# GitHub Issue Labels

Standard labels for categorizing GitHub issues in the Awzm project.

## Infrastructure (`infrastructure`, #0e8a16)

**Purpose:** Database setup, CI/CD pipelines, build tooling, deployment configuration

**Use for:**

-   Database schema creation and migrations
-   CI/CD pipeline setup and modifications
-   Build tool configuration
-   Development environment setup

## Backend (`backend`, #d876e3)

**Purpose:** API endpoints, server-side logic, Fastify handlers, database access

**Use for:**

-   REST API endpoint implementation
-   Fastify route handlers
-   Service layer logic
-   Database query functions

## Frontend (`frontend`, #0075ca)

**Purpose:** React components, client-side logic, UI implementation

**Use for:**

-   React component development
-   React Query hooks
-   Lexical editor plugins
-   UI/UX implementation

## Database (`database`, #fbca04)

**Purpose:** Database-specific work including schema, indexes, queries, PL/pgSQL functions

**Use for:**

-   Table creation and schema changes
-   Index creation and optimization
-   PL/pgSQL stored function development
-   Database triggers and constraints

## Performance (`performance`, #d4c5f9)

**Purpose:** Performance optimization including indexes, caching, query optimization

**Use for:**

-   Database index optimization
-   Query performance improvements
-   Caching strategies
-   Frontend rendering optimization

## Integration (`integration`, #e99695)

**Purpose:** Cross-layer integration work, data persistence, API-to-database flow

**Use for:**

-   Frontend-to-backend integration
-   Data persistence logic
-   End-to-end feature flows
-   Cross-component coordination

## Usage Guidelines

1. **Multiple Labels:** Issues can have multiple labels when they span categories
2. **Primary Label:** Choose the label that best represents the primary work area
3. **Architecture Labels:** Use `infrastructure`, `backend`, `frontend`, `database` for architectural categorization
4. **Cross-cutting Labels:** Use `performance` or `integration` as secondary labels when relevant
