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

## Phase 2: Stack detection

Identify the following stack attributes, without asking unless ambiguous:

1. **Project type**: monorepo, single app, library, API, full-stack
2. **Languages**: TypeScript, JavaScript, Python, Rust, Go, Java, C#, etc.
3. **Frameworks**: React, Vue, Fastify, Express, Django, Spring, etc.
4. **Database**: PostgreSQL, MySQL, MongoDB, SQLite, etc.
5. **Testing**: Vitest, Jest, pytest, JUnit, etc.
6. **Build tools**: Vite, Webpack, Nx, Gradle, Maven, etc.

### 2.1 Infer from CLAUDE.md first

If `CLAUDE.md` exists (checked in Phase 1), read it and infer as many of the six attributes above as it states or clearly implies. `CLAUDE.md` is authoritative for what it declares — take those values as given, do not re-derive them from the codebase.

Track which attributes remain **unresolved** after this pass (not mentioned, or too vague to pin down a concrete value).

### 2.2 Analyze the codebase for the gaps only

Run codebase analysis **only for the attributes left unresolved** in 2.1. Do not re-analyze anything CLAUDE.md already settled. If CLAUDE.md resolved all six, skip codebase analysis entirely.

For the unresolved attributes, read configuration files to drive detection:

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

**Generate only the files listed above** — no `README.md` or index file at `docs/system/`. Nothing in the pipeline reads one.

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

**Governing principle: a standard is a ledger of decisions, not a catalog of patterns.**

The code is ground truth and self-updating. A coding agent re-reads these files on _every_ `/nxs.hld` invocation, so each line is a recurring context cost. Only write what an agent **cannot recover by reading the code itself**.

**The test for every line you write:** could the agent learn this by looking at a neighboring source file? If yes, **cut it** — it is a copy that pays tokens forever and drifts silently. If no, it belongs here.

**Document (not recoverable from code):**

- **Canonical choice among alternatives** — when the codebase shows several patterns, which one wins and which is deprecated (e.g. "use Result types; the `try/catch` in `legacy/` is being migrated off"). Code shows the options and gives no signal which to follow.
- **Prohibitions** — "never do X". Absence is invisible in code.
- **Cross-cutting NFR budgets** — e.g. a global "page load < 2s". These live nowhere in source.
- **Security and authorization rules** that constrain how code must be written.

**Do NOT document:**

- Patterns an agent reads for free from one existing file (test framework, file naming, where tests live, formatting).
- Generic best practices not specific to a decision made on this project.
- Aspirational standards, or patterns that don't exist here.

**Format — pointer, not paste.** A standard entry is: the decision + its constraint/rationale + a **path** to the exemplar in code (`src/foo/bar.ts`). Do **not** paste code blocks that already exist in the repo — the path is stable and the paste drifts.

**Default to one `standards.md`** with short normative sections. Split into separate files only when a section grows large, or when it is loaded independently by work-type (the dev agent loads `unit-testing.md` always, `api-testing.md` for API work). Do not pre-generate files for capabilities that don't exist yet (no `auth.md` until there is auth work and a command path that loads it).

Use `.nexus/config/templates/standard.template.md` for structural guidance; adapt it toward decisions-and-constraints, not pattern description.

## Phase 4: Scaffold the Nexus surfaces

1. **`.nexus/config/issue-labels.yaml`** — seed it with this project's label set. Setup is the seeder for project-generated config.
2. **`docs/delivery/lessons/`** — create the folder plus a `README.md` documenting the one-file-per-lesson convention (`<date>-<slug>.md`, source-epic in frontmatter). This is the home `/nxs.close` writes process/delivery lessons to.
3. **`.nexus/queue/`** — this surface is **committed, not gitignored**. Do **not** add a `.nexus/` ignore rule for it.
4. **Templates** — do **not** seed `.nexus/config/templates/` here. The install/update script seeds the tool-agnostic templates; setup only seeds project-generated config (above).
5. **`.nexus/plans/` — gitignored scratch for plans and decision stubs.** Add a `.nexus/plans/`
   line to the project's `.gitignore` (create `.gitignore` if absent; skip if the line already
   exists). Do NOT create the directory itself — the capture hook and the agent create
   `.nexus/plans/<branch>/` on first write. This surface is scratch: `/nxs.close` consumes it
   as hints and deletes the branch's directory after its checkpoint. The distiller never reads it.
6. **`.nexus/config/hooks/capture-plan.sh`** — seed the plan-capture hook script (committed,
   executable). Write it with exactly this content:

    ```bash
    #!/usr/bin/env bash
    # Nexus plan-capture hook (PostToolUse on ExitPlanMode).
    # Opt-in: registered per-engineer in .claude/settings.local.json — never in a
    # committed settings file. Writes the approved plan to gitignored scratch:
    # .nexus/plans/<branch>/NN-plan.md. /nxs.close consumes these as hints.
    # Always exits 0 — capture must never block the tool call.
    set -u
    payload="$(cat)"
    plan="$(printf '%s' "$payload" | jq -r '.tool_input.plan // empty' 2>/dev/null)"
    [ -z "$plan" ] && exit 0
    branch="$(git branch --show-current 2>/dev/null)"
    [ -z "$branch" ] && branch="detached"
    dir=".nexus/plans/${branch//\//-}"
    mkdir -p "$dir" || exit 0
    n=$(ls "$dir"/*-plan.md 2>/dev/null | wc -l)
    printf '# Plan captured %s\n\n%s\n' "$(date +%Y-%m-%dT%H:%M:%S)" "$plan" \
        > "$dir/$(printf '%02d' $((n + 1)))-plan.md"
    exit 0
    ```

    Make it executable (`chmod +x`).
7. **Offer the opt-in registration (never write it into a committed file).** Tell the user in
   the Phase 7 summary how to opt in, per engineer, by adding to `.claude/settings.local.json`:

    ```json
    {
        "hooks": {
            "PostToolUse": [
                {
                    "matcher": "ExitPlanMode",
                    "hooks": [{ "type": "command", "command": ".nexus/config/hooks/capture-plan.sh" }]
                }
            ]
        }
    }
    ```

    If a `settings.local.json` already exists, this must be merged into it, not overwritten.
    Setup itself must NOT write `.claude/settings.json` (committed) or register the hook
    repo-wide — opt-in consent is the load-bearing constraint (memo 6c575fe9, contract item 2).

## Phase 5: Build the product context (interactive)

Invoke the **`nxs-setup` skill** to run the interactive product-context interview. The skill asks at most 5 strategic questions one at a time, infers the rest with PM expertise, and writes `docs/product/context.md`.

Personas live canonically in `docs/product/context.md` — later epics reference them rather than re-tabulating.

## Phase 6: Refactor CLAUDE.md

After the docs exist:

1. **Identify content to move** — detailed sections now better covered by standards files.
2. **Replace with links** — add a "Technical Patterns and Standards" section linking to `docs/system/`.
3. **Keep in CLAUDE.md** — project description, development commands, high-level architecture overview, import-path mappings, environment setup, recent changes.
4. **Add the decision-stub rule** — a short section instructing the coding agent:

    > **In-flight decision stubs.** When you make a non-obvious implementation choice — you
    > picked between viable approaches — append a stub to `.nexus/plans/<branch>/decisions.md`
    > (create the file/dir if absent) at the moment of choosing, not later:
    >
    > ```
    > ## <date> — <short decision title>
    > - **Choice:** <what was chosen>
    > - **Why:** <one sentence>
    > - **Refuted alternative:** <the viable option not taken, or "none">
    > ```
    >
    > This directory is gitignored scratch; `/nxs.close` mines it as hints and deletes it.
    > Obvious choices (only one sensible option) get no stub.

## Phase 7: Summary

Output a completion summary:

```markdown
## Project setup complete ✓

### Created

- `docs/system/stack.md` — technology stack
- `docs/system/standards/[file].md` — [brief description]
- `docs/product/context.md` — product context (interactive)
- `.nexus/config/issue-labels.yaml` — task label set
- `docs/delivery/lessons/README.md` — lessons convention
- `.nexus/config/hooks/capture-plan.sh` — plan-capture hook (opt-in; see registration below)
- `.gitignore` — `.nexus/plans/` scratch ignored

### Updated

- `CLAUDE.md` — refactored to link to system docs

### Next steps

1. Review generated docs for accuracy.
2. Add project-specific details as needed.
3. Commit changes to version control.
4. Start your first epic with `/nxs.epic`.
```

### Optional per-engineer opt-in

Plan capture is opt-in. To enable it for yourself, add the hook registration above to
`.claude/settings.local.json` (gitignored, per-engineer). Without it, only the CLAUDE.md
decision-stub rule is active — stubs still land in scratch and `/nxs.close` still uses them.

## Quality requirements

- **No placeholder content** — only document patterns that actually exist.
- **Real code examples** — extract from actual source files, with paths.
- **Valid links** — correct relative paths from project root.
- **Actionable guidance** — "how to", not just description.
- **Agent-friendly** — write for both human developers and AI agents.
- **Lean** — every generated section consumes agent context; don't generate what no agent or command consumes.
