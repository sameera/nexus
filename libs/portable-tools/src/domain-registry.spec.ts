import { describe, expect, it } from "vitest";
import { parseDomainRegistry } from "./domain-registry";

const WELL_FORMED =
`# Domain Registry

## Connectors
\`connectors\`

Everything about pulling data in from and pushing it out to external systems.

### Catalog
\`catalog\`

The registry of available connector types and their published metadata.

### Runtime
\`runtime\`

How a configured connector executes when a flow runs.

## Sources
\`sources\`

Upstream systems and the shape of the data they provide.

### Catalog
\`catalog\`

The inventory of known source systems.
`;

const THIRD_LEVEL =
`## Connectors
\`connectors\`

Rubric for connectors.

### Catalog
\`catalog\`

Rubric for catalog.

#### Nested Too Deep
\`nested\`

This nests a third level and must be rejected.
`;

const DUP_PATH =
`## Connectors
\`connectors\`

First connectors rubric.

## Connectors Again
\`connectors\`

A second entry claiming the same slug path.
`;

const MISSING_TITLE =            // note the trailing space after "##"
`## 
\`connectors\`

Rubric with no domain title.
`;

const MISSING_SLUG =
`## Connectors

Everything about connectors, but the slug line is missing entirely.
`;

const MISSING_RUBRIC =
`## Connectors
\`connectors\`

## Sources
\`sources\`

Sources rubric present so only the first entry lacks a rubric.
`;

describe("parseDomainRegistry", () => {
    it("AC1 — returns the ordered tree from a well-formed registry", () => {
        const parsed = parseDomainRegistry(WELL_FORMED);
        expect(parsed.findings).toEqual([]);
        expect(parsed.domains.map((d) => d.title)).toEqual(["Connectors", "Sources"]);
        expect(parsed.domains[0].slug).toBe("connectors");
        expect(parsed.domains[0].path).toBe("connectors");
        expect(parsed.domains[0].rubric).toContain("pulling data in");
        expect(parsed.domains[0].subdomains.map((s) => s.title)).toEqual(["Catalog", "Runtime"]);
        expect(parsed.domains[0].subdomains[0].path).toBe("connectors/catalog");
        expect(parsed.domains[1].subdomains[0].path).toBe("sources/catalog");
    });

    it("AC2 — a third level fails validation with a finding naming the entry", () => {
        const parsed = parseDomainRegistry(THIRD_LEVEL);
        expect(parsed.findings.length).toBeGreaterThan(0);
        expect(parsed.findings.some((f) => f.includes("Nested Too Deep") && /third level/.test(f))).toBe(true);
        const subdomainTitles = parsed.domains[0].subdomains.map((s) => s.title);
        expect(subdomainTitles).not.toContain("Nested Too Deep");
    });

    it("AC3 — a duplicate slug path fails validation with a finding naming the entry", () => {
        const parsed = parseDomainRegistry(DUP_PATH);
        expect(parsed.findings.length).toBeGreaterThan(0);
        expect(parsed.findings.some((f) => f.includes("connectors") && f.includes("duplicate"))).toBe(true);
    });

    it("AC3 — a missing title fails validation with a finding naming the entry", () => {
        const parsed = parseDomainRegistry(MISSING_TITLE);
        expect(parsed.findings.length).toBeGreaterThan(0);
        expect(parsed.findings.some((f) => f.includes("connectors") && /title/.test(f))).toBe(true);
    });

    it("AC3 — a missing slug fails validation with a finding naming the entry", () => {
        const parsed = parseDomainRegistry(MISSING_SLUG);
        expect(parsed.findings.length).toBeGreaterThan(0);
        expect(parsed.findings.some((f) => f.includes("Connectors") && /slug/.test(f))).toBe(true);
    });

    it("AC3 — a missing rubric fails validation with a finding naming the first entry only", () => {
        const parsed = parseDomainRegistry(MISSING_RUBRIC);
        expect(parsed.findings.length).toBeGreaterThan(0);
        expect(parsed.findings.some((f) => f.includes("Connectors") && /rubric/.test(f))).toBe(true);
        expect(parsed.findings.some((f) => f.includes("Sources") && /rubric/.test(f))).toBe(false);
    });

    it("leaf reuse under different parents is legal — no duplicate finding", () => {
        const parsed = parseDomainRegistry(WELL_FORMED);
        expect(parsed.findings.some((f) => f.includes("duplicate"))).toBe(false);
    });

    it("the parse is total — never throws, on empty or headingless content", () => {
        expect(() => parseDomainRegistry("")).not.toThrow();
        expect(parseDomainRegistry("").domains).toEqual([]);
        expect(parseDomainRegistry("").findings).toEqual([]);

        const prose = "random\nprose\nno headings\n";
        expect(() => parseDomainRegistry(prose)).not.toThrow();
        expect(parseDomainRegistry(prose).domains).toEqual([]);
        expect(parseDomainRegistry(prose).findings).toEqual([]);
    });

    it("an orphan subdomain before any domain yields a finding, without throwing", () => {
        const orphan =
`### Catalog
\`catalog\`

An orphan subdomain with no preceding domain.
`;
        expect(() => parseDomainRegistry(orphan)).not.toThrow();
        const parsed = parseDomainRegistry(orphan);
        expect(parsed.findings.some((f) => /before any domain/.test(f))).toBe(true);
    });
});
