import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAdjacency, type ConceptPage } from "./generate-atlas";
import { parseDomainRegistry, type ParsedRegistry } from "./domain-registry";
import {
    AFFINITY_DEN,
    AFFINITY_NUM,
    computeAdvisory,
    detectCommunities,
    MIN_COMMUNITY_MEMBERS,
    MIN_LINKS,
    parseArgs,
    renderAdvisory,
    runCli,
    STALENESS_DEN,
    STALENESS_NUM,
    topLevelDomain,
} from "./drift-advisory";

// Fixture string duplicated from generate-atlas.spec.ts / validate-concepts.spec.ts (no shared
// fixtures module — CLAUDE.md forbids barrel-style re-export files).
const REGISTRY_WELL_FORMED =
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

const REGISTRY: ParsedRegistry = parseDomainRegistry(REGISTRY_WELL_FORMED);

function pg(slug: string, domain: string, touches: string[] = []): ConceptPage {
    return { slug, title: slug[0].toUpperCase() + slug.slice(1), touches, hook: `${slug} hook.`, domain };
}

let tmpDirs: string[] = [];

function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function writeConceptFile(conceptsDir: string, slug: string, domain: string, touches: string[] = []): void {
    const touchesYaml: string = touches.length > 0 ? `[${touches.map((t) => `"${t}"`).join(", ")}]` : "[]";
    const content = `---
title: "${slug}"
aliases: []
touches: ${touchesYaml}
last_updated_by: "bootstrap"
status: active
verification: verified
domain: ${domain}
---

# ${slug}

${slug} hook line.

## How It Works

Body prose.

## Key Invariants

## Integration Points

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
`;
    fs.writeFileSync(path.join(conceptsDir, `${slug}.md`), content);
}

describe("named threshold constants", () => {
    it("pins the documented threshold values", () => {
        expect(MIN_LINKS).toBe(3);
        expect(AFFINITY_NUM).toBe(2);
        expect(AFFINITY_DEN).toBe(3);
        expect(MIN_COMMUNITY_MEMBERS).toBe(3);
        expect(STALENESS_NUM).toBe(1);
        expect(STALENESS_DEN).toBe(5);
    });
});

describe("topLevelDomain", () => {
    it("splits a subdomain path to its top-level domain", () => {
        expect(topLevelDomain("a/b")).toBe("a");
    });
    it("returns a parent domain unchanged", () => {
        expect(topLevelDomain("a")).toBe("a");
    });
    it("returns empty string for an unfiled page", () => {
        expect(topLevelDomain("")).toBe("");
    });
});

// ---------------------------------------------------------------------------------------------
// T1 — AC1: cross-domain misfile
// ---------------------------------------------------------------------------------------------
describe("AC1 — cross-domain misfile", () => {
    it("flags a page whose links concentrate under one other domain", () => {
        // Six pages total keeps the 1-misfile fraction under the AC5 20% staleness threshold
        // (1*5 < 6*1), so this exercises the per-page section, not the store-level alarm.
        const pages: ConceptPage[] = [
            pg("p", "sources", ["c1", "c2", "c3"]),
            pg("c1", "connectors"),
            pg("c2", "connectors/catalog"),
            pg("c3", "connectors/runtime"),
            pg("f1", "sources"),
            pg("f2", "sources"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.misfiles).toHaveLength(1);
        const m = findings.misfiles[0];
        expect(m.slug).toBe("p");
        expect(m.filedDomain).toBe("sources");
        expect(m.otherDomain).toBe("connectors");
        expect(m.count).toBe(3);
        expect(m.total).toBe(3);

        const rendered = renderAdvisory(findings);
        expect(rendered).toContain("### Cross-domain misfiles");
        expect(rendered).toContain("`p`");
        expect(rendered).toContain("sources");
        expect(rendered).toContain("connectors");
    });

    it("boundary: exactly 2/3 affinity to another domain still flags (3*2 >= 2*3)", () => {
        const pages: ConceptPage[] = [
            pg("q", "sources", ["c1", "c2", "s1"]),
            pg("c1", "connectors"),
            pg("c2", "connectors"),
            pg("s1", "sources"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.misfiles).toHaveLength(1);
        expect(findings.misfiles[0].slug).toBe("q");
        expect(findings.misfiles[0].count).toBe(2);
        expect(findings.misfiles[0].total).toBe(3);
    });

    it("boundary: 1/3 affinity to another domain does not flag", () => {
        const pages: ConceptPage[] = [
            pg("r", "sources", ["c1", "s1", "s2"]),
            pg("c1", "connectors"),
            pg("s1", "sources"),
            pg("s2", "sources"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.misfiles).toHaveLength(0);
    });

    it("boundary: 3/5 affinity (just under 2/3) does not flag", () => {
        const pages: ConceptPage[] = [
            pg("t", "sources", ["c1", "c2", "c3", "s1", "s2"]),
            pg("c1", "connectors"),
            pg("c2", "connectors"),
            pg("c3", "connectors"),
            pg("s1", "sources"),
            pg("s2", "sources"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.misfiles).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------------------------
// T2 — AC2: sibling-subdomain drift is at most a low-priority note, never a misfile
// ---------------------------------------------------------------------------------------------
describe("AC2 — sibling-subdomain drift is at most a low-priority note, never a misfile", () => {
    it("flags a low-priority note, not a misfile, for a subdomain-filed page drifting to a sibling subdomain", () => {
        const pages: ConceptPage[] = [
            pg("m", "connectors/catalog", ["r1", "r2", "r3"]),
            pg("r1", "connectors/runtime"),
            pg("r2", "connectors/runtime"),
            pg("r3", "connectors/runtime"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.misfiles).toHaveLength(0);
        expect(findings.siblingNotes).toHaveLength(1);
        const note = findings.siblingNotes[0];
        expect(note.slug).toBe("m");
        expect(note.subdomain).toBe("connectors/runtime");

        const rendered = renderAdvisory(findings);
        expect(rendered).toContain("### Low-priority notes");
        expect(rendered).not.toContain("### Cross-domain misfiles");
    });
});

// ---------------------------------------------------------------------------------------------
// T3 — AC3: refinement hint for a parent-filed page
// ---------------------------------------------------------------------------------------------
describe("AC3 — refinement hint for a parent-filed page", () => {
    it("flags a refinement hint for a parent-filed page drifting into one subdomain", () => {
        const pages: ConceptPage[] = [
            pg("n", "connectors", ["b1", "b2", "b3"]),
            pg("b1", "connectors/catalog"),
            pg("b2", "connectors/catalog"),
            pg("b3", "connectors/catalog"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.misfiles).toHaveLength(0);
        expect(findings.refinements).toHaveLength(1);
        const r = findings.refinements[0];
        expect(r.slug).toBe("n");
        expect(r.subdomain).toBe("connectors/catalog");

        const rendered = renderAdvisory(findings);
        expect(rendered).toContain("### Refinement hints");
        expect(rendered).toContain("connectors/catalog");
    });

    it("guard: the identical link pattern from a subdomain-filed page yields a note, never a refinement", () => {
        const pages: ConceptPage[] = [
            pg("n3", "connectors/runtime", ["b1", "b2", "b3"]),
            pg("b1", "connectors/catalog"),
            pg("b2", "connectors/catalog"),
            pg("b3", "connectors/catalog"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.refinements).toHaveLength(0);
        expect(findings.siblingNotes).toHaveLength(1);
        expect(findings.siblingNotes[0].slug).toBe("n3");
        expect(findings.siblingNotes[0].subdomain).toBe("connectors/catalog");
    });
});

// ---------------------------------------------------------------------------------------------
// T4 — AC4: new-domain candidate from a community with no majority domain
// ---------------------------------------------------------------------------------------------
describe("AC4 — new-domain candidate from a community with no majority domain", () => {
    it("groups a 3-page densely-linked community with no majority domain into a candidate", () => {
        const pages: ConceptPage[] = [
            pg("ta", "sources", ["tb", "tc"]),
            pg("tb", "connectors", ["ta", "tc"]),
            pg("tc", "docs", ["ta", "tb"]),
        ];
        const adjacency = buildAdjacency(pages);
        const communities = detectCommunities(adjacency);
        expect(communities).toEqual([["ta", "tb", "tc"]]);

        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.candidates).toHaveLength(1);
        expect(findings.candidates[0].members).toEqual(["ta", "tb", "tc"]);

        const rendered = renderAdvisory(findings);
        expect(rendered).toContain("### New-domain candidates");
        expect(rendered).toContain("`ta`");
        expect(rendered).toContain("`tb`");
        expect(rendered).toContain("`tc`");
    });

    it("determinism: detectCommunities returns identical arrays on repeated calls", () => {
        const pages: ConceptPage[] = [
            pg("ta", "sources", ["tb", "tc"]),
            pg("tb", "connectors", ["ta", "tc"]),
            pg("tc", "docs", ["ta", "tb"]),
        ];
        const adjacency = buildAdjacency(pages);
        expect(detectCommunities(adjacency)).toEqual(detectCommunities(adjacency));
    });

    it("a community below MIN_COMMUNITY_MEMBERS yields no candidate", () => {
        const pages: ConceptPage[] = [pg("ua", "sources", ["ub"]), pg("ub", "connectors", ["ua"])];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.candidates).toHaveLength(0);
    });

    it("a 3-member community with a majority domain yields no candidate", () => {
        const pages: ConceptPage[] = [
            pg("va", "connectors", ["vb", "vc"]),
            pg("vb", "connectors", ["va", "vc"]),
            pg("vc", "connectors", ["va", "vb"]),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.candidates).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------------------------
// T5 — AC5: store-level staleness alarm replaces per-page flags; candidates survive
// ---------------------------------------------------------------------------------------------
describe("AC5 — store-level staleness alarm", () => {
    it("fires when misfile disagreement reaches 20% of active pages, replacing per-page sections", () => {
        const pages: ConceptPage[] = [
            pg("p", "sources", ["c1", "c2", "c3"]),
            pg("c1", "connectors"),
            pg("c2", "connectors"),
            pg("c3", "connectors"),
            pg("f5", "sources"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.staleness).toEqual({ affected: 1, total: 5 });

        const rendered = renderAdvisory(findings);
        expect(rendered).toContain("### Store-level staleness alarm");
        expect(rendered).toContain("re-filing");
        expect(rendered).not.toContain("### Cross-domain misfiles");
        expect(rendered).not.toContain("### Refinement hints");
        expect(rendered).not.toContain("### Low-priority notes");
    });

    it("new-domain candidates survive the staleness alarm (Invariant 8)", () => {
        const pages: ConceptPage[] = [
            pg("p1", "sources", ["c1", "c2", "c3"]),
            pg("p2", "docs", ["c1", "c2", "c3"]),
            pg("c1", "connectors"),
            pg("c2", "connectors"),
            pg("c3", "connectors"),
            pg("ta", "sources", ["tb", "tc"]),
            pg("tb", "connectors", ["ta", "tc"]),
            pg("tc", "docs", ["ta", "tb"]),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.staleness).not.toBeNull();
        expect(findings.candidates.length).toBeGreaterThan(0);

        const rendered = renderAdvisory(findings);
        expect(rendered).toContain("### Store-level staleness alarm");
        expect(rendered).toContain("### New-domain candidates");
    });

    it("boundary: just under 20% does not fire; per-page flags remain", () => {
        const pages: ConceptPage[] = [
            pg("p", "sources", ["c1", "c2", "c3"]),
            pg("c1", "connectors"),
            pg("c2", "connectors"),
            pg("c3", "connectors"),
            pg("f5", "sources"),
            pg("f6", "sources"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.staleness).toBeNull();
        expect(findings.misfiles).toHaveLength(1);

        const rendered = renderAdvisory(findings);
        expect(rendered).not.toContain("### Store-level staleness alarm");
        expect(rendered).toContain("### Cross-domain misfiles");
    });
});

// ---------------------------------------------------------------------------------------------
// T6 — AC6: below every threshold → empty/omitted
// ---------------------------------------------------------------------------------------------
describe("AC6 — a clean store yields empty/omitted output", () => {
    it("computeAdvisory returns all-empty findings and renderAdvisory returns the empty string", () => {
        const pages: ConceptPage[] = [
            pg("alpha", "connectors"),
            pg("beta", "connectors/catalog"),
            pg("gamma", "sources"),
        ];
        const findings = computeAdvisory(pages, REGISTRY);
        expect(findings.misfiles).toEqual([]);
        expect(findings.refinements).toEqual([]);
        expect(findings.siblingNotes).toEqual([]);
        expect(findings.candidates).toEqual([]);
        expect(findings.staleness).toBeNull();
        expect(renderAdvisory(findings)).toBe("");
    });

    it("runCli over a clean store prints nothing and returns 0", () => {
        const dir = makeTmpDir("drift-clean-");
        const conceptsDir = path.join(dir, "concepts");
        const docsDir = path.join(dir, "docs");
        fs.mkdirSync(conceptsDir);
        fs.mkdirSync(docsDir);
        fs.writeFileSync(path.join(docsDir, "domains.md"), REGISTRY_WELL_FORMED);
        writeConceptFile(conceptsDir, "alpha", "connectors");

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const exit = runCli(["--concepts-dir", conceptsDir, "--registry", path.join(docsDir, "domains.md")]);
        expect(exit).toBe(0);
        expect(logSpy).not.toHaveBeenCalled();
        logSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------------------------
// T7 — AC7: byte-identical twice + exits zero regardless
// ---------------------------------------------------------------------------------------------
describe("AC7 — determinism and always-exit-zero", () => {
    it("renderAdvisory(computeAdvisory(...)) is byte-identical across repeated calls — findings case", () => {
        const pages: ConceptPage[] = [
            pg("p", "sources", ["c1", "c2", "c3"]),
            pg("c1", "connectors"),
            pg("c2", "connectors"),
            pg("c3", "connectors"),
        ];
        const first = renderAdvisory(computeAdvisory(pages, REGISTRY));
        const second = renderAdvisory(computeAdvisory(pages, REGISTRY));
        expect(first).toBe(second);
        expect(first.length).toBeGreaterThan(0);
    });

    it("renderAdvisory(computeAdvisory(...)) is byte-identical across repeated calls — clean case", () => {
        const pages: ConceptPage[] = [pg("alpha", "connectors")];
        const first = renderAdvisory(computeAdvisory(pages, REGISTRY));
        const second = renderAdvisory(computeAdvisory(pages, REGISTRY));
        expect(first).toBe(second);
        expect(first).toBe("");
    });

    it("runCli returns 0 whether findings exist or not, byte-identical stdout across repeated runs", () => {
        const dir = makeTmpDir("drift-cli-");
        const conceptsDir = path.join(dir, "concepts");
        const docsDir = path.join(dir, "docs");
        fs.mkdirSync(conceptsDir);
        fs.mkdirSync(docsDir);
        fs.writeFileSync(path.join(docsDir, "domains.md"), REGISTRY_WELL_FORMED);
        // Six pages total keeps the 1-misfile fraction under the AC5 20% staleness threshold.
        writeConceptFile(conceptsDir, "p", "sources", ["c1", "c2", "c3"]);
        writeConceptFile(conceptsDir, "c1", "connectors");
        writeConceptFile(conceptsDir, "c2", "connectors");
        writeConceptFile(conceptsDir, "c3", "connectors");
        writeConceptFile(conceptsDir, "f1", "sources");
        writeConceptFile(conceptsDir, "f2", "sources");
        const registryFile = path.join(docsDir, "domains.md");

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const exit1 = runCli(["--concepts-dir", conceptsDir, "--registry", registryFile]);
        const out1 = logSpy.mock.calls.map((c) => c[0]).join("\n");
        logSpy.mockClear();
        const exit2 = runCli(["--concepts-dir", conceptsDir, "--registry", registryFile]);
        const out2 = logSpy.mock.calls.map((c) => c[0]).join("\n");
        logSpy.mockRestore();

        expect(exit1).toBe(0);
        expect(exit2).toBe(0);
        expect(out1).toBe(out2);
        expect(out1).toContain("Cross-domain misfiles");
        expect(exit1).not.toBeNull();
    });

    it("runCli returns 0 and prints nothing when no registry exists (self-guard)", () => {
        const dir = makeTmpDir("drift-cli-noreg-");
        const conceptsDir = path.join(dir, "concepts");
        fs.mkdirSync(conceptsDir);
        writeConceptFile(conceptsDir, "alpha", "connectors");

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const exit = runCli(["--concepts-dir", conceptsDir, "--registry", path.join(dir, "does-not-exist.md")]);
        logSpy.mockRestore();

        expect(exit).toBe(0);
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("runCli never throws, even over a nonexistent concepts dir", () => {
        const dir = makeTmpDir("drift-cli-nodir-");
        fs.writeFileSync(path.join(dir, "domains.md"), REGISTRY_WELL_FORMED);
        expect(() =>
            runCli(["--concepts-dir", path.join(dir, "no-such-dir"), "--registry", path.join(dir, "domains.md")]),
        ).not.toThrow();
    });
});

// ---------------------------------------------------------------------------------------------
// T8 — engine unit coverage
// ---------------------------------------------------------------------------------------------
describe("detectCommunities — engine unit coverage", () => {
    it("empty graph (no nodes) returns []", () => {
        expect(detectCommunities(new Map())).toEqual([]);
    });

    it("all-isolated nodes each form their own singleton", () => {
        const adjacency = new Map<string, Set<string>>([
            ["a", new Set<string>()],
            ["b", new Set<string>()],
            ["c", new Set<string>()],
        ]);
        expect(detectCommunities(adjacency)).toEqual([["a"], ["b"], ["c"]]);
    });

    it("a fully-connected triangle forms one community", () => {
        const pages: ConceptPage[] = [
            pg("a", "x", ["b", "c"]),
            pg("b", "x", ["a", "c"]),
            pg("c", "x", ["a", "b"]),
        ];
        const adjacency = buildAdjacency(pages);
        expect(detectCommunities(adjacency)).toEqual([["a", "b", "c"]]);
    });

    it("a tie-break case resolves deterministically by slug order", () => {
        const pages: ConceptPage[] = [
            pg("a", "x", ["b"]),
            pg("b", "x", ["c"]),
            pg("c", "x", ["d"]),
            pg("d", "x", []),
        ];
        const adjacency = buildAdjacency(pages);
        const result = detectCommunities(adjacency);
        expect(result).toEqual([
            ["a", "b"],
            ["c", "d"],
        ]);
        expect(detectCommunities(adjacency)).toEqual(result);
    });
});

describe("parseArgs", () => {
    it("parses --concepts-dir and --registry, defaulting when absent", () => {
        expect(parseArgs([])).toEqual({ conceptsDir: ".nexus/concepts", registry: undefined });
        expect(parseArgs(["--concepts-dir", "foo", "--registry", "bar/domains.md"])).toEqual({
            conceptsDir: "foo",
            registry: "bar/domains.md",
        });
    });
});

describe("runCli default resolution", () => {
    it("no-ops safely with default args when neither concepts nor a registry exist at cwd", () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const exit = runCli([]);
        logSpy.mockRestore();
        expect(exit).toBe(0);
    });
});
