# Specification-First Philosophy

Understanding why Nexus enforces thinking before coding.

## The Problem

Traditional "code-first" development often leads to:

- **Wasted Effort**: Building the wrong thing, then rebuilding
- **Context Loss**: Design decisions forgotten, rationale undocumented
- **Integration Pain**: Components built in isolation don't fit together
- **Review Friction**: Unclear what was intended vs what was delivered
- **Knowledge Silos**: Only the original author understands the "why"

## The Nexus Approach

**Specification-first development** inverts the process:

```
Traditional:          Specification-First:
┌──────────┐         ┌──────────────┐
│ Code     │         │ Think        │
└────┬─────┘         └──────┬───────┘
     │                      │
┌────▼─────┐         ┌──────▼───────┐
│ Refactor │         │ Specify      │
└────┬─────┘         └──────┬───────┘
     │                      │
┌────▼─────┐         ┌──────▼───────┐
│ Document │         │ Design       │
└──────────┘         └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │ Code (once)  │
                     └──────────────┘
```

## Three Phases of Clarity

### 1. Product Specification (Epic)

**Document**: `epic.md`
**Command**: `/nxs.epic`
**Question**: **What** should we build and **why**?

**Artifacts**:
- User stories (persona-based)
- Acceptance criteria (testable)
- Business value and success metrics
- Explicit scope boundaries

**Benefit**: Team alignment on **outcomes** before technical debates.

### 2. Technical Design (HLD)

**Document**: `HLD.md`
**Command**: `/nxs.hld`
**Question**: **How** should we build it?

**Artifacts**:
- System architecture
- Data model design
- API contracts
- Security approach
- Risk assessment

**Benefit**: Architectural issues caught before code, not after.

### 3. Implementation Planning (Tasks)

**Documents**: `TASK-*.md` files
**Command**: `/nxs.tasks`
**Question**: **What order** and **what chunks**?

**Artifacts**:
- Sized tasks (≤2 days)
- Dependency sequencing
- Low-level design per task
- Acceptance criteria per task

**Benefit**: Parallelizable work, no forward references, consistent state after each task.

## Intentional Friction

Nexus introduces **deliberate friction** at phase boundaries:

### Friction 1: Epic Generation

**Friction**: Must write Feature README with frontmatter, describe capability.

**Purpose**: Forces articulation of **why** and **for whom**.

**Payoff**: Epic becomes team contract. No surprise "that's not what I meant" later.

### Friction 2: Complexity Assessment

**Friction**: `/nxs.epic` forces right-sizing check. Oversized epics trigger decomposition prompt.

**Purpose**: Prevents scope creep into multi-month efforts disguised as sprints.

**Payoff**: Epics fit sprints. Delivery is predictable.

### Friction 3: HLD Architect Review

**Friction**: `/nxs.hld` delegates to `nxs-architect` agent for comprehensive analysis.

**Purpose**: Ensures architectural thinking, not just "start coding."

**Payoff**: Technical risks identified early. Design alternatives evaluated.

### Friction 4: Consistency Analysis

**Friction**: `/nxs.tasks` auto-runs `/nxs.analyze` to check epic/HLD/task consistency.

**Purpose**: Catches coverage gaps, circular dependencies, conflicting implementations.

**Payoff**: Backlog is coherent. No "wait, this task doesn't match the HLD" surprises.

### Friction 5: Review Checkpoints

**Friction**: `/nxs.tasks` and `/nxs.dev` require user confirmation at key gates.

**Purpose**: Human review before irreversible actions (GitHub issue creation, commits).

**Payoff**: User agency preserved. No unwanted commits or issues.

## When to Skip Nexus

Specification-first is **not** for everything. Skip Nexus for:

- **Bug Fixes**: Obvious correctness issues
- **Trivial Changes**: One-line typo fixes
- **Experiments**: Prototyping unknowns (codify after learning)
- **Emergencies**: Production incidents requiring immediate fixes

**Rule of Thumb**: If the change is <1 hour and low-risk, skip the ceremony.

## The Payoff

### During Planning

- **Clarity**: Team aligned on scope and approach
- **Realism**: Complexity assessed before commitment
- **Alternatives**: Design options evaluated explicitly

### During Implementation

- **Focus**: Clear acceptance criteria, no ambiguity
- **Speed**: LLD provides blueprint, no "figuring it out"
- **Consistency**: Standards applied, architectural alignment verified

### After Delivery

- **Context Preservation**: Future maintainers read epic/HLD, not just code
- **Lessons Learned**: PIR documents what worked, what didn't
- **Reuse**: Patterns documented, not tribal knowledge

## Comparison to Alternatives

| Approach | Upfront Cost | Rework Cost | Context Loss | Team Alignment |
|----------|--------------|-------------|--------------|----------------|
| **Code First** | Low | High | High | Low |
| **Light Planning** | Medium | Medium | Medium | Medium |
| **Specification-First (Nexus)** | High | Low | Low | High |

**Nexus optimizes for**: Complex features, team environments, long-term maintenance.

**Not optimized for**: Solo prototyping, throwaway code, trivial changes.

## Anti-Patterns

### Anti-Pattern 1: Over-Specifying Simple Work

**Problem**: Running full Nexus workflow for a one-line bug fix.

**Solution**: Use judgment. Nexus for features, not for trivial fixes.

### Anti-Pattern 2: Spec as Formality

**Problem**: Writing epic/HLD to "check the box," then ignoring during implementation.

**Solution**: If you're not using the specs, stop writing them. Ceremony without value is waste.

### Anti-Pattern 3: Waterfall Mindset

**Problem**: Treating epic/HLD as immutable contract, refusing to adapt.

**Solution**: Specs are **starting points**, not scripture. Update them when you learn.

### Anti-Pattern 4: Analysis Paralysis

**Problem**: Spending weeks perfecting epic before starting.

**Solution**: Right-size to sprint. Epic should take hours, not weeks. Defer details to HLD.

## Practical Tips

### Start Small

First epic should be Small (S) complexity. Learn the workflow before tackling Large (L) epics.

### Iterate Standards

Your first HLDs won't be perfect. Refine `docs/system/standards/` as you learn what the architect needs.

### Read Your Own Specs

Before implementing, **read the epic and HLD**. If they're not useful, figure out why and improve them.

### Update Specs When You Learn

Implementation reveals unknowns. Update HLD when you make significant decisions not captured in original design.

### Trust the Process

The friction feels slow at first. The payoff comes during implementation when you're not constantly backtracking.

## Related Concepts

- [Epic to Implementation Flow](epic-to-implementation.md) - Complete workflow
- [Epics & User Stories](../concepts/epics-and-stories.md) - Specification structure
- [High-Level Design](../concepts/high-level-design.md) - Technical architecture
