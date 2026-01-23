# /nxs.council

Multi-perspective review of epics, features, or decisions via Product Management and Architecture council.

## Purpose

Synthesizes PM and Architecture perspectives into actionable recommendations. Provides balanced analysis for feature decisions, build-vs-buy evaluations, and scope trade-offs.

## When to Use

- **After `/nxs.epic`**: Validate epic scope and approach before HLD
- **Feature Decisions**: Choose between implementation options
- **Build vs Buy**: Evaluate internal vs external solutions
- **Scope Trade-offs**: Balance feature breadth vs delivery speed
- **Strategic Decisions**: Cross-functional impact requiring multiple perspectives

## Prerequisites

**Required**:
- Epic or capability description
- Product context (helps PM perspective)
- Technology stack (helps Architect perspective)

**Optional**:
- `epic.md` (for structured epic review)

## Usage

### Option 1: Review Epic
```bash
# Open epic.md in IDE, then run:
/nxs.council
```

### Option 2: Evaluate Decision
```bash
/nxs.council Should we build our own auth system or use Auth0?
```

### Option 3: Scope Trade-off
```bash
/nxs.council @epic.md What can we descope to fit in one sprint?
```

## What It Does

### Council Types

#### Quick Council (Simple Decisions)

**Use when**:
- Clear precedent exists
- Low risk, easily reversible
- Single stakeholder perspective sufficient
- Binary yes/no questions

**Process**: Invokes ONE subagent (whichever more relevant), brief synthesis.

#### Full Council (Significant Decisions)

**Use when**:
- Cross-functional impact
- Resource commitment >1 week
- Architectural changes or new patterns
- Strategic or irreversible decisions

**Process**: Full multi-agent analysis with synthesis.

### Phase 1: Validate Question

Ensures topic is actionable:

| Required | Question | If Missing |
|----------|----------|------------|
| WHAT | What needs to be decided/built? | Ask for specifics |
| WHY | What problem drives this? | Ask for motivation |
| SCOPE | What are boundaries? | Clarify constraints |

**Stops and asks clarifying questions if underspecified.**

### Phase 2: Gather Perspectives

Invokes specialized subagents:

#### Product Management Analysis (`nxs-council-pm`)

Evaluates:
- Customer value assessment
- Business impact and prioritization
- Go-to-market considerations
- Recommended scope (MVP thinking)
- User pain points
- Competitive positioning
- Success metrics

**PM Perspective**: Customer-first, value-driven, pragmatic scope.

#### Technical Architecture Analysis (`nxs-council-architect`)

Evaluates:
- Technical feasibility
- Complexity assessment (S/M/L/XL)
- Implementation approaches
- Technical risks and unknowns
- Maintenance burden
- Integration complexity
- Technical debt implications

**Architect Perspective**: Feasibility-focused, risk-aware, systems thinking.

### Phase 3: Synthesize Recommendations

Facilitates decision by:

**Identifying Alignment**:
- Where PM and Architect agree
- Shared concerns or recommendations
- Consensus approach

**Surfacing Tensions**:
- Where perspectives diverge
- PM wants X, Architect recommends Y
- Trade-offs to consider

**Challenging Both Sides**:
- Question optimistic PM timelines
- Question pessimistic engineering estimates
- Push for creative alternatives

**Driving to Decision**:
- Clear recommendation with rationale
- Options with pros/cons
- Decision criteria
- Next steps

## Output Format

### Full Council Report

```markdown
# Council Review: Space-Scoped Tags

## Topic
Should we implement space-scoped tags in the proposed epic scope, or descope to user-scoped tags?

## PM Perspective

**Value Assessment**: HIGH
- Direct customer request from 3 enterprise accounts
- Enables multi-tenant use case (key to Enterprise tier)
- Competitive gap vs competitors

**Business Impact**: Unblocks $120K/year enterprise pipeline

**Recommended Scope**: Space-scoped, but defer tag analytics to future

**Success Metrics**:
- 60% of spaces create at least one tag
- Tag usage in 40% of content items

## Architect Perspective

**Complexity**: MEDIUM (M)
- Standard multi-tenant data isolation pattern
- Moderate migration complexity
- Existing space system provides foundation

**Feasibility**: HIGH - well-understood patterns

**Technical Risks**:
- Query performance with many spaces/tags (mitigated via indexing)
- Tag limit enforcement requires both DB and app validation

**Recommended Approach**: Space-scoped with composite unique constraints

**Alternatives Considered**:
- Global tags with space filter (rejected - namespace collision risk)
- User-scoped tags (simpler but doesn't meet use case)

## Tensions & Trade-offs

**Aligned On**:
- ✅ Space-scoped approach is correct
- ✅ Tag analytics should be deferred
- ✅ Technical complexity is manageable

**Divergence**:
- ⚠️ **PM**: Target 2-week delivery
- ⚠️ **Architect**: Estimate 8-10 days (aligns with M complexity)

**Trade-off**: PM wants tag suggestions in MVP, Architect recommends deferring (adds 3-4 days, introduces ML complexity)

## Synthesis

### Recommendation: PROCEED with Descoped MVP

**Rationale**:
- Core value (space-scoped CRUD) is well-scoped and technically sound
- Complexity estimate (8-10 days) fits sprint target
- Deferring analytics and suggestions preserves MVP focus

### Suggested Scope

**Include**:
- Space-scoped tag CRUD
- Tag application to content
- Basic filtering by tags

**Defer**:
- Tag suggestions/auto-complete
- Tag analytics dashboard
- Bulk tag operations

**Estimated Timeline**: 8-10 days (Medium complexity)

### Decision Criteria

Choose space-scoped approach if:
- ✅ Enterprise accounts confirmed as priority
- ✅ Multi-tenancy is core to product strategy
- ✅ Team has 8-10 days available

Consider user-scoped (simpler) if:
- ❌ Enterprise deals not urgent
- ❌ Sprint capacity <7 days
- ❌ Want to validate usage before multi-tenant investment

## Next Steps

1. **Confirm descoped scope** with PM stakeholders
2. **Run /nxs.hld** to generate technical design
3. **Validate 8-10 day estimate** during task decomposition
4. **Create follow-on epic** for deferred features (analytics, suggestions)

## Flagged for Validation

- ⚠️ Confirm enterprise accounts will accept MVP without suggestions
- ⚠️ Validate tag limit (50) with product team
```

### Quick Council Report (Condensed)

```markdown
# Council Quick Review: Auth Provider Decision

## Question
Build custom auth or use Auth0?

## Recommendation: USE AUTH0

**Rationale**:
- **PM**: Auth is commodity, not differentiator. Focus effort on core product.
- **Architect**: Security-critical component. Auth0 provides battle-tested implementation, compliance, and ongoing maintenance.

**Consensus**: Strong alignment - buy, don't build.

**Cost**: $0 (free tier) → $1,200/year (Pro tier at scale)
**Timeline Saved**: 3-4 weeks of implementation + ongoing maintenance

**Next Steps**:
1. Prototype Auth0 integration (1 day spike)
2. Validate free tier limits meet current needs
3. Proceed with integration if spike successful
```

## Example Invocations

### Example 1: Epic Review

```bash
# Open epic
code docs/product/features/03-space-scoped-tags/epic.md

# Run council
/nxs.council
```

**Output**:
```
Validating topic...
✓ Topic: Epic review for Space-Scoped Tags

Gathering perspectives...
[1/2] Invoking nxs-council-pm for product analysis...
[2/2] Invoking nxs-council-architect for technical analysis...

Synthesizing recommendations...

[Council report shown]
```

### Example 2: Build vs Buy

```bash
/nxs.council Should we build a custom PDF generation engine or use a library?
```

**Output**:
```
Validating topic...
? What are your requirements for PDF generation? (format, complexity, volume)

User: Generate invoices and reports, ~1000/month, need custom branding

Gathering perspectives...
[1/2] Invoking nxs-council-pm...

PM Perspective: This is infrastructure, not a differentiator. Buy.

[2/2] Invoking nxs-council-architect...

Architect Perspective: Custom branding is standard library feature. Use Puppeteer or similar.

Synthesis:

RECOMMENDATION: Use existing library (Puppeteer or PDFKit)

- Low cost (free/open source)
- Meets requirements (custom branding supported)
- Proven at scale
- No maintenance burden

Avoid custom engine unless requirements change to:
- Highly specialized PDF features not available in libraries
- Performance >10,000 PDFs/month with strict latency requirements

Next: Spike Puppeteer for invoice generation (1 day)
```

### Example 3: Scope Trade-off

```bash
/nxs.council @epic.md What can we descope to fit in 7 days?
```

**Output**:
```
Reviewing epic: Space-Scoped Tags (estimated 10 days)

Gathering perspectives...

PM Analysis: Tag filtering is core value, suggestions are nice-to-have
Architect Analysis: Suggestions add 3-4 days (ML component complexity)

RECOMMENDATION: Descope tag suggestions

Reduces timeline: 10 days → 6-7 days
Preserves core value: Space-scoped CRUD + filtering
Defer to follow-on: Tag suggestions, analytics

Updated scope fits 7-day target.
```

## Common Issues

### Underspecified Question

**Problem**: "Topic is too vague to evaluate"

**Solution**: Council asks clarifying questions. Provide specifics on WHAT, WHY, SCOPE.

### No Epic Context

**Problem**: "Cannot locate epic for review"

**Solutions**:
1. Open epic.md in IDE
2. Reference it: `/nxs.council @path/to/epic.md`
3. Provide inline description

### Trivial Question

**Problem**: "This doesn't need council"

**Solution**: Council may answer directly without invoking subagents for simple questions with clear answers.

## When NOT to Use

Don't use council for:
- **Implementation details**: Use `/nxs.hld` (architect directly)
- **Bug fixes**: Obvious correctness issues don't need PM/Arch debate
- **Trivial clarifications**: Just ask the user or decide
- **Pure execution**: Once decided, execute without re-evaluating

## Tips

**Use Early**: Run council after `/nxs.epic`, before `/nxs.hld` to validate approach.

**Embrace Tensions**: PM/Arch disagreement surfaces important trade-offs. Don't paper over conflicts.

**Challenge Estimates**: Council should push back on both overly optimistic and pessimistic views.

**Be Specific**: "Should we build feature X?" is better than "What should we do next?"

**Trust Synthesis**: The council's value is in synthesis, not just relaying two opinions.

## Related Commands

- [/nxs.epic](nxs-epic.md) - Create epic (run before council)
- [/nxs.hld](nxs-hld.md) - Generate design (run after council validation)

## Related Concepts

- [Agents](../reference/agents.md) - nxs-council-pm and nxs-council-architect details
- [Specification-First](../workflow/specification-first.md) - Role of multi-perspective review
