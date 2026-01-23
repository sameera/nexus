# Product Context

> This document provides foundational context for product decisions. It informs AI agents (like nxs-pm) and serves as a single source of truth for product strategy, target users, and domain expertise.
>
> **Keep it lean**: Only include information that changes how decisions are made. If the agent can look something up or infer it, don't document it here.

---

## Vision & Strategy

### Product Vision

[One sentence describing the future state your product enables.]

### Strategic Pillars

[3-5 core strategic bets that guide product decisions. These should be stable for 1-2 years.]

1. **[Pillar Name]**: [Brief description]
2. **[Pillar Name]**: [Brief description]
3. **[Pillar Name]**: [Brief description]

### Constraints

[Non-negotiable boundaries that shape every decision]

- [e.g., "Must run on-premise for enterprise customers"]
- [e.g., "Team of 5 engineers, no dedicated ML expertise"]
- [e.g., "Must maintain SOC 2 compliance"]

---

## Target Users

### Primary Persona: [Name]

**Who**: [Role, company size, technical sophistication — 1-2 sentences]

**Goals**:

- [What they're trying to accomplish]
- [Secondary goal if relevant]

**Pain Points**:

- [Frustration or problem they face today]
- [Another pain point]

**Key Quote**: "[Actual quote from research that captures their mindset]"

### Anti-Persona: [Name]

**Who**: [Brief description]

**Why Not**: [Why they're not a fit — keeps scope focused]

---

## Domain Expertise

### Industry Context

| Attribute          | Details                                       |
| ------------------ | --------------------------------------------- |
| **Industry**       | [e.g., Fintech, Healthcare SaaS, E-commerce]  |
| **Market Segment** | [SMB / Mid-Market / Enterprise / Consumer]    |
| **Geography**      | [Primary markets and regional considerations] |

### Industry Patterns

[Patterns that affect product decisions — things customers expect or that create constraints]

- [e.g., "Enterprise healthcare requires IT security review before deployment"]
- [e.g., "Integration with Salesforce is table stakes for this segment"]
- [e.g., "Buyers expect annual contracts with quarterly business reviews"]

### Regulatory & Compliance

[Only regulations that actively constrain product decisions]

| Regulation    | Product Impact                                                   |
| ------------- | ---------------------------------------------------------------- |
| [e.g., HIPAA] | [What it means for features — data handling, audit trails, etc.] |
| [e.g., GDPR]  | [Data residency, consent, deletion requirements]                 |

### Competitive Landscape

**Our Position**: [One sentence — what you're best at, who you're for]

**Key Competitors**:

| Competitor | Strengths           | Weaknesses              |
| ---------- | ------------------- | ----------------------- |
| [Name]     | [What they do well] | [Where they fall short] |
| [Name]     | [What they do well] | [Where they fall short] |

**Table Stakes**: [Features every competitor has — required for consideration]

**Our Differentiators**: [What actually wins deals]

### Domain Terminology

[Terms with specific meaning in your domain — only include non-obvious ones]

| Term   | Definition                      |
| ------ | ------------------------------- |
| [Term] | [What it means in your context] |
| [Term] | [What it means in your context] |

---

## Success Metrics

### North Star

**[Metric Name]**: [Exactly how it's measured]

- **Current**: [Value]
- **Target**: [Value]
- **Why This Metric**: [One sentence on why this captures product success]

### Input Metrics

[2-4 leading indicators that drive the North Star — only include if they inform prioritization]

| Metric   | Current | Target  |
| -------- | ------- | ------- |
| [Metric] | [Value] | [Value] |
| [Metric] | [Value] | [Value] |
