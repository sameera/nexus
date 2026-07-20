/**
 * Deterministic registry seed drafter (epic #94, STORY-94.03). A one-time adoption tool for a store
 * that has NO registry yet: it reads the concept link graph and runs the SAME deterministic detection
 * engine the drift advisory uses (detectCommunities, MIN_COMMUNITY_MEMBERS from ./drift-advisory),
 * then drafts (a) a candidate two-level registry and (b) a per-page suggested `domain:` list — writing
 * both as clearly-marked DRAFT files.
 *
 * It writes ONLY its draft outputs — never a concept page, never the registry file (domains.md), never
 * the atlas (decision-record Invariant 12). Output is byte-identical on repeat runs and explicitly
 * marked as requiring human curation before commit (Invariant 13). Community detection here is offline,
 * advisory, human-reviewed draft material — never persisted as page metadata or a store-read index
 * (Invariant 11). This is the seed half of the "one shared detection engine, two thin drivers"
 * decision: this file ships NO detection of its own; it consumes the engine drift-advisory.ts owns.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildAdjacency, loadConceptPages, registryPath, type ConceptPage } from "./generate-atlas.js";
import { detectCommunities, MIN_COMMUNITY_MEMBERS } from "./drift-advisory.js";

/** The draft registry filename — beside where domains.md would live, never domains.md itself. */
export const DRAFT_REGISTRY_FILENAME = "domains.draft.md";
/** The per-page filing-suggestion draft filename. */
export const DRAFT_SUGGESTIONS_FILENAME = "domain-filing-suggestions.draft.md";

/** The registry filename seed mode refuses to overwrite (its presence means a store already has one). */
const REGISTRY_FILENAME = "domains.md";

// --- draft shape ----------------------------------------------------------------------------------

export interface SeedSubdomain {
    slug: string; // leaf slug, e.g. "subdomain-1"
    title: string; // display title
    members: string[]; // page slugs, slug-sorted
}
export interface SeedDomain {
    slug: string; // leaf slug, e.g. "candidate-domain-1"
    title: string;
    members: string[]; // pages parent-filed directly (empty when the domain has subdomains), slug-sorted
    subdomains: SeedSubdomain[];
}
export interface SeedDraft {
    domains: SeedDomain[];
    ungrouped: string[]; // pages in no qualifying community, slug-sorted
}

// --- density-based parent grouping ----------------------------------------------------------------
// Two-level structure (AC1): communities are candidate domains; where two communities are cross-linked
// as densely as they are internally linked, they belong under one parent domain as subdomains. Every
// comparison is integer/exact — density ratios are cross-multiplied, never evaluated as floats
// (Invariant 10, mirroring the drift advisory's threshold discipline).

/** Undirected edges wholly inside `members` (each counted once via the u<v guard). */
function internalEdges(adjacency: Map<string, Set<string>>, members: Set<string>): number {
    let count = 0;
    for (const u of members) {
        for (const v of adjacency.get(u) ?? []) {
            if (members.has(v) && u < v) {
                count++;
            }
        }
    }
    return count;
}

/** Edges with one endpoint in `a` and the other in `b` (disjoint sets → each counted once). */
function crossEdges(adjacency: Map<string, Set<string>>, a: Set<string>, b: Set<string>): number {
    let count = 0;
    for (const u of a) {
        for (const v of adjacency.get(u) ?? []) {
            if (b.has(v)) {
                count++;
            }
        }
    }
    return count;
}

/** Unordered-pair count of a set of size n (integer: n*(n-1) is always even). */
function pairCount(n: number): number {
    return (n * (n - 1)) / 2;
}

/**
 * True when the cross-community link density between `a` and `b` rivals the internal density of the
 * sparser of the two — i.e. `dCross >= min(dInternal(a), dInternal(b))` — decided with integer
 * cross-multiplication. "Rivals the sparser side" (the OR) rather than "rivals both" (an AND) is the
 * deliberate reading of the AC's "rivals": a genuine bridge between two clusters, as dense as the
 * looser cluster's own fabric, is enough to propose a shared parent in a draft the human then curates.
 */
export function shouldGroupCommunities(adjacency: Map<string, Set<string>>, a: string[], b: string[]): boolean {
    const setA: Set<string> = new Set(a);
    const setB: Set<string> = new Set(b);
    const cross: number = crossEdges(adjacency, setA, setB);
    if (cross === 0) {
        return false;
    }
    const crossPairs: number = a.length * b.length;
    const mA: number = internalEdges(adjacency, setA);
    const mB: number = internalEdges(adjacency, setB);
    // dCross >= dA  ⟺  cross/crossPairs >= mA/pairs(a)  ⟺  cross*pairs(a) >= mA*crossPairs.
    const rivalsA: boolean = cross * pairCount(a.length) >= mA * crossPairs;
    const rivalsB: boolean = cross * pairCount(b.length) >= mB * crossPairs;
    return rivalsA || rivalsB;
}

/** Disjoint-set roots over community indices, grouped by the density rule (union-find). */
function groupCommunityIndices(adjacency: Map<string, Set<string>>, communities: string[][]): number[][] {
    const parent: number[] = communities.map((_, i) => i);
    // A plain root-walk (no path compression) — a store has only a handful of communities, so the
    // asymptotics never matter and the simpler form has no unreachable branch.
    const find = (x: number): number => {
        let root: number = x;
        while (parent[root] !== root) {
            root = parent[root];
        }
        return root;
    };
    for (let i = 0; i < communities.length; i++) {
        for (let j = i + 1; j < communities.length; j++) {
            if (shouldGroupCommunities(adjacency, communities[i], communities[j])) {
                parent[find(j)] = find(i);
            }
        }
    }
    const byRoot: Map<number, number[]> = new Map();
    for (let i = 0; i < communities.length; i++) {
        const root: number = find(i);
        const bucket: number[] | undefined = byRoot.get(root);
        if (bucket === undefined) {
            byRoot.set(root, [i]);
        } else {
            bucket.push(i);
        }
    }
    return Array.from(byRoot.values()).map((indices) => indices.sort((x, y) => x - y));
}

/**
 * Assembles the ordered candidate domains from a list of qualifying communities. Each meta-group of
 * one community becomes a standalone domain (its pages parent-filed); a meta-group of two or more
 * becomes a parent domain whose member communities are its subdomains. Communities arrive in
 * detectCommunities order (descending size, then slug), so index order is already canonical; groups
 * are ordered by descending total membership, then by their smallest first-member slug.
 */
export function assembleDomains(adjacency: Map<string, Set<string>>, communities: string[][]): SeedDomain[] {
    const groups: number[][] = groupCommunityIndices(adjacency, communities);
    const totalMembers = (indices: number[]): number => indices.reduce((sum, i) => sum + communities[i].length, 0);
    const firstSlug = (indices: number[]): string => indices.map((i) => communities[i][0]).sort()[0];
    groups.sort((g1, g2) => totalMembers(g2) - totalMembers(g1) || firstSlug(g1).localeCompare(firstSlug(g2)));

    return groups.map((indices, k) => {
        const domainSlug = `candidate-domain-${k + 1}`;
        const domainTitle = `Candidate Domain ${k + 1}`;
        if (indices.length === 1) {
            return { slug: domainSlug, title: domainTitle, members: [...communities[indices[0]]].sort(), subdomains: [] };
        }
        const subdomains: SeedSubdomain[] = indices.map((ci, j) => ({
            slug: `subdomain-${j + 1}`,
            title: `Candidate Subdomain ${k + 1}.${j + 1}`,
            members: [...communities[ci]].sort(),
        }));
        return { slug: domainSlug, title: domainTitle, members: [], subdomains };
    });
}

/** Runs the shared engine over the store's link graph and drafts a two-level candidate taxonomy. */
export function buildSeedDraft(pages: ConceptPage[]): SeedDraft {
    const adjacency: Map<string, Set<string>> = buildAdjacency(pages);
    const communities: string[][] = detectCommunities(adjacency);
    const qualifying: string[][] = communities.filter((c) => c.length >= MIN_COMMUNITY_MEMBERS);
    const ungrouped: string[] = communities
        .filter((c) => c.length < MIN_COMMUNITY_MEMBERS)
        .flatMap((c) => c)
        .sort();
    return { domains: assembleDomains(adjacency, qualifying), ungrouped };
}

// --- rendering ------------------------------------------------------------------------------------

/** One suggested `domain:` path per grouped page, slug-ordered (ungrouped pages excluded). */
export function pageSuggestions(draft: SeedDraft): { slug: string; path: string }[] {
    const out: { slug: string; path: string }[] = [];
    for (const domain of draft.domains) {
        for (const member of domain.members) {
            out.push({ slug: member, path: domain.slug });
        }
        for (const sub of domain.subdomains) {
            for (const member of sub.members) {
                out.push({ slug: member, path: `${domain.slug}/${sub.slug}` });
            }
        }
    }
    return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

const REGISTRY_BANNER: string[] = [
    "<!-- DRAFT REGISTRY — generated by `nexus seed-registry` (epic #94). This is NOT a committed",
    "     registry. Community detection is a starting point, not an answer. Before you save this as",
    `     ${REGISTRY_FILENAME}:`,
    "       1. rename every domain and subdomain to a meaningful title and slug,",
    "       2. author each filing rubric (replace every TODO line below),",
    "       3. review the groupings — merge, split, or re-parent as your judgment dictates.",
    "     Requires human curation before commit. -->",
];

const SUGGESTIONS_BANNER: string[] = [
    "<!-- DRAFT FILING SUGGESTIONS — generated by `nexus seed-registry` (epic #94). NOT authoritative.",
    "     One suggested `domain:` per page, derived from detected link communities. Review each",
    "     suggestion — and curate the draft registry — before writing any `domain:` into a page.",
    "     Requires human curation before commit. -->",
];

function memberEvidence(members: string[]): string {
    return members.map((m) => `\`${m}\``).join(", ");
}

/** Renders the draft registry in the registry's own grammar, with placeholder rubrics and evidence. */
export function renderDraftRegistry(draft: SeedDraft): string {
    const lines: string[] = [...REGISTRY_BANNER, "", "# Domain Registry (DRAFT)"];

    if (draft.domains.length === 0) {
        lines.push(
            "",
            `No link community of ${MIN_COMMUNITY_MEMBERS}+ pages was detected, so no candidate domain is`,
            "proposed. See the filing-suggestions draft for the ungrouped pages, and file them by hand.",
        );
        return lines.join("\n") + "\n";
    }

    for (const domain of draft.domains) {
        lines.push("", `## ${domain.title}`, `\`${domain.slug}\``, "");
        if (domain.subdomains.length > 0) {
            lines.push(
                "TODO: author the filing rubric for this parent domain — it groups the subdomains below,",
                "whose pages are cross-linked densely enough to share a parent.",
            );
            for (const sub of domain.subdomains) {
                lines.push("", `### ${sub.title}`, `\`${sub.slug}\``, "");
                lines.push(`TODO: author the filing rubric for this subdomain. Detected member pages: ${memberEvidence(sub.members)}.`);
            }
        } else {
            lines.push(`TODO: author the filing rubric for this domain. Detected member pages: ${memberEvidence(domain.members)}.`);
        }
    }

    return lines.join("\n") + "\n";
}

/** Renders the per-page filing suggestions, grouped pages first, then an ungrouped section. */
export function renderFilingSuggestions(draft: SeedDraft): string {
    const lines: string[] = [...SUGGESTIONS_BANNER, "", "# Per-Page Domain Filing Suggestions (DRAFT)"];

    const suggestions = pageSuggestions(draft);
    if (suggestions.length > 0) {
        lines.push("");
        for (const s of suggestions) {
            lines.push(`- \`${s.slug}\` → \`${s.path}\``);
        }
    }

    if (draft.ungrouped.length > 0) {
        lines.push("", `## Ungrouped (in no community of ${MIN_COMMUNITY_MEMBERS}+ pages — file these by hand)`, "");
        for (const slug of draft.ungrouped) {
            lines.push(`- \`${slug}\``);
        }
    }

    if (suggestions.length === 0 && draft.ungrouped.length === 0) {
        lines.push("", "No active concept pages were found.");
    }

    return lines.join("\n") + "\n";
}

// --- CLI ------------------------------------------------------------------------------------------

export function parseArgs(argv: string[]): { conceptsDir: string; outDir?: string } {
    const options: { conceptsDir: string; outDir?: string } = { conceptsDir: ".nexus/concepts", outDir: undefined };
    for (let i = 0; i < argv.length; i++) {
        const arg: string = argv[i];
        if (arg === "--concepts-dir") {
            options.conceptsDir = argv[++i] ?? options.conceptsDir;
        } else if (arg === "--out-dir") {
            options.outDir = argv[++i] ?? options.outDir;
        }
    }
    return options;
}

/**
 * Drafts the registry + filing suggestions and writes both marked draft files to the out dir
 * (default: the resolved docs root, beside where the registry would live). Refuses when a registry
 * already exists there — seed mode is for a store with none (Invariant 12). Returns 0 on success,
 * 1 on refusal.
 */
export function runCli(argv: string[]): number {
    const { conceptsDir, outDir } = parseArgs(argv);
    const targetDir: string = outDir ?? path.dirname(registryPath());
    const existingRegistry: string = path.join(targetDir, REGISTRY_FILENAME);
    if (fs.existsSync(existingRegistry)) {
        console.error(
            `A registry already exists at ${existingRegistry}. Seed mode drafts a registry for a store ` +
                "that has none; curate the existing registry (or the drain's taxonomy gate) instead.",
        );
        return 1;
    }

    const draft: SeedDraft = buildSeedDraft(loadConceptPages(conceptsDir));
    fs.mkdirSync(targetDir, { recursive: true });
    const registryOut: string = path.join(targetDir, DRAFT_REGISTRY_FILENAME);
    const suggestionsOut: string = path.join(targetDir, DRAFT_SUGGESTIONS_FILENAME);
    fs.writeFileSync(registryOut, renderDraftRegistry(draft));
    fs.writeFileSync(suggestionsOut, renderFilingSuggestions(draft));

    console.log(`Draft registry written: ${registryOut}`);
    console.log(`Draft filing suggestions written: ${suggestionsOut}`);
    console.log(
        `${draft.domains.length} candidate domain(s), ${draft.ungrouped.length} ungrouped page(s) — ` +
            "DRAFT, curate before commit.",
    );
    return 0;
}

function main(): void {
    process.exit(runCli(process.argv.slice(2)));
}

// See the matching comment in generate-atlas.ts / drift-advisory.ts: this file imports the shared
// engine from drift-advisory.ts (and, transitively, generate-atlas.ts), so esbuild inlines both of
// their source into this entry's bundle. The basename check keeps this guard from firing inside a run
// of either of those entry points after bundling collapses every `import.meta.url` to one value.
if (import.meta.url === `file://${process.argv[1]}` && path.basename(process.argv[1]).startsWith("seed-registry")) {
    main();
}
