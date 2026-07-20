/**
 * Deterministic taxonomy drift advisory (epic #94, STORY-94.02). Reads the same concept link graph
 * and filings the atlas is built from, and reports taxonomy decay as PR-body markdown: cross-domain
 * misfiles, refinement hints, low-priority sibling notes, new-domain candidates, and a store-level
 * staleness alarm. Advisory only — always exits 0, never writes a page or the registry, never a CI
 * gate (decision-record Invariant 7). Deterministic by construction: slug-ordered, integer/exact
 * arithmetic, no wall-clock, no randomness (Invariants 6, 10) — held to the same parity + fingerprint
 * gate as the atlas generator and validator.
 *
 * The detection engine here is shared: STORY-94.03 (seed mode) imports detectCommunities and the
 * graph helpers and adds its own thin driver. This file ships NO seed behavior.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildAdjacency, loadConceptPages, registryPath, type ConceptPage } from "./generate-atlas.js";
import { parseDomainRegistry, type ParsedRegistry } from "./domain-registry.js";

export const MIN_LINKS = 3;
export const AFFINITY_NUM = 2; // 2/3 affinity
export const AFFINITY_DEN = 3;
export const MIN_COMMUNITY_MEMBERS = 3;
export const STALENESS_NUM = 1; // 1/5 == 20%
export const STALENESS_DEN = 5;

/** The top-level domain of a `domain:` path — a subdomain link counts toward its parent (Invariant 5). */
export function topLevelDomain(domainPath: string): string {
    return domainPath.split("/")[0];
}

// --- shared engine ---------------------------------------------------------------------------

interface Community {
    members: string[]; // kept slug-sorted
    sigmaTot: number;
}

/**
 * Deterministic-by-construction greedy modularity agglomeration (decision record: "deterministic-
 * by-construction algorithm, not a seeded-random one"). Merges the pair of communities with the
 * highest integer merge gain each step, tie-breaking by the pair's lexicographically smallest
 * (minSlug, maxSlug) representative tuple, until no merge has a positive gain. No floating point,
 * no Math.random, no Date — every input and tie is resolved by slug order (Invariant 10).
 */
export function detectCommunities(adjacency: Map<string, Set<string>>): string[][] {
    const nodes: string[] = Array.from(adjacency.keys()).sort();
    if (nodes.length === 0) {
        return [];
    }

    let twoM = 0;
    for (const n of nodes) {
        twoM += adjacency.get(n)?.size ?? 0;
    }
    if (twoM === 0) {
        return nodes.map((n) => [n]);
    }

    let communities: Community[] = nodes.map((n) => ({ members: [n], sigmaTot: adjacency.get(n)?.size ?? 0 }));

    const edgesBetween = (a: Community, b: Community): number => {
        const [smaller, larger] = a.members.length <= b.members.length ? [a, b] : [b, a];
        const largerSet: Set<string> = new Set(larger.members);
        let count = 0;
        for (const u of smaller.members) {
            for (const v of adjacency.get(u) ?? []) {
                if (largerSet.has(v)) {
                    count++;
                }
            }
        }
        return count;
    };

    for (;;) {
        let bestKey: number = Number.NEGATIVE_INFINITY;
        let bestPair: [number, number] | null = null;
        let bestRep: [string, string] | null = null;

        for (let i = 0; i < communities.length; i++) {
            for (let j = i + 1; j < communities.length; j++) {
                const eAB: number = edgesBetween(communities[i], communities[j]);
                if (eAB === 0) {
                    continue;
                }
                const key: number = twoM * eAB - communities[i].sigmaTot * communities[j].sigmaTot;
                const repI: string = communities[i].members[0];
                const repJ: string = communities[j].members[0];
                const rep: [string, string] = repI < repJ ? [repI, repJ] : [repJ, repI];

                const better: boolean =
                    bestPair === null ||
                    key > bestKey ||
                    (key === bestKey &&
                        bestRep !== null &&
                        (rep[0] < bestRep[0] || (rep[0] === bestRep[0] && rep[1] < bestRep[1])));

                if (better) {
                    bestKey = key;
                    bestPair = [i, j];
                    bestRep = rep;
                }
            }
        }

        if (bestPair === null || bestKey <= 0) {
            break;
        }

        const [i, j] = bestPair;
        const merged: Community = {
            members: [...communities[i].members, ...communities[j].members].sort(),
            sigmaTot: communities[i].sigmaTot + communities[j].sigmaTot,
        };
        communities = [...communities.filter((_, idx) => idx !== i && idx !== j), merged];
    }

    return communities
        .map((c) => c.members)
        .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

// --- findings ----------------------------------------------------------------------------------

export interface Misfile {
    slug: string;
    filedDomain: string;
    otherDomain: string;
    count: number;
    total: number;
}
export interface Refinement {
    slug: string;
    domain: string;
    subdomain: string;
    count: number;
    total: number;
}
export interface SiblingNote {
    slug: string;
    domain: string;
    subdomain: string;
    count: number;
    total: number;
}
export interface Candidate {
    members: string[];
}
export interface Staleness {
    affected: number;
    total: number;
}
export interface AdvisoryFindings {
    misfiles: Misfile[];
    refinements: Refinement[];
    siblingNotes: SiblingNote[];
    candidates: Candidate[];
    staleness: Staleness | null;
}

/** Picks the max-count entry from a Map, tie-breaking by ascending key (slug order). */
function maxByCount(counts: Map<string, number>, exclude: (key: string) => boolean): { key: string; count: number } | null {
    let best: { key: string; count: number } | null = null;
    for (const [key, count] of Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        if (exclude(key)) {
            continue;
        }
        if (best === null || count > best.count) {
            best = { key, count };
        }
    }
    return best;
}

/**
 * Computes the drift advisory findings over the same link graph and filings the atlas is built
 * from (Invariant 9). Per-page signals (misfile, refinement, sibling note) are pure neighbor-
 * counting; community detection is used only for the new-domain candidates (decision record —
 * "Per-page drift signals are deterministic neighbor-counting; community detection is confined to
 * proposing missing domains and seeding").
 */
export function computeAdvisory(pages: ConceptPage[], registry: ParsedRegistry): AdvisoryFindings {
    // `registry` is accepted for signature parity with the driver (which always has one on hand —
    // a registry's presence is the sole gate into running this at all) and for Story 3's seed
    // driver to share this same function shape; the per-page and community signals below derive
    // entirely from each page's own resolved `domain:` and the link graph (Invariants 5, 9), never
    // from registry structure itself.
    void registry;
    const adjacency: Map<string, Set<string>> = buildAdjacency(pages);
    const bySlug: Map<string, ConceptPage> = new Map(pages.map((p) => [p.slug, p]));
    const domainOf = (slug: string): string => bySlug.get(slug)?.domain ?? "";

    const misfiles: Misfile[] = [];
    const refinements: Refinement[] = [];
    const siblingNotes: SiblingNote[] = [];

    const sortedSlugs: string[] = pages.map((p) => p.slug).sort();
    for (const slug of sortedSlugs) {
        const page: ConceptPage = bySlug.get(slug) as ConceptPage;
        const neighbors: string[] = Array.from(adjacency.get(slug) ?? []);
        const total: number = neighbors.length;
        if (total < MIN_LINKS) {
            continue;
        }

        const filedDomain: string = page.domain ?? "";
        const Dp: string = topLevelDomain(filedDomain);
        const Sp: string | null = filedDomain.includes("/") ? filedDomain : null;

        const byDomain: Map<string, number> = new Map();
        const bySub: Map<string, number> = new Map();
        for (const n of neighbors) {
            const d: string = domainOf(n);
            const top: string = topLevelDomain(d);
            byDomain.set(top, (byDomain.get(top) ?? 0) + 1);
            if (d.includes("/")) {
                bySub.set(d, (bySub.get(d) ?? 0) + 1);
            }
        }

        const bestOther = maxByCount(byDomain, (d) => d === Dp);
        if (bestOther !== null && AFFINITY_DEN * bestOther.count >= AFFINITY_NUM * total) {
            misfiles.push({ slug, filedDomain, otherDomain: bestOther.key, count: bestOther.count, total });
            continue;
        }

        if (Sp === null) {
            const bestSub = maxByCount(bySub, (s) => topLevelDomain(s) !== Dp);
            if (bestSub !== null && AFFINITY_DEN * bestSub.count >= AFFINITY_NUM * total) {
                refinements.push({ slug, domain: Dp, subdomain: bestSub.key, count: bestSub.count, total });
            }
        } else {
            const bestSub = maxByCount(bySub, (s) => s === Sp || topLevelDomain(s) !== Dp);
            if (bestSub !== null && AFFINITY_DEN * bestSub.count >= AFFINITY_NUM * total) {
                siblingNotes.push({ slug, domain: Dp, subdomain: bestSub.key, count: bestSub.count, total });
            }
        }
    }

    const candidates: Candidate[] = [];
    for (const community of detectCommunities(adjacency)) {
        if (community.length < MIN_COMMUNITY_MEMBERS) {
            continue;
        }
        const total: number = community.length;
        const domainCounts: Map<string, number> = new Map();
        for (const slug of community) {
            const top: string = topLevelDomain(domainOf(slug));
            domainCounts.set(top, (domainCounts.get(top) ?? 0) + 1);
        }
        const hasMajority: boolean = Array.from(domainCounts.values()).some((count) => 2 * count > total);
        if (!hasMajority) {
            candidates.push({ members: community });
        }
    }
    candidates.sort((a, b) => b.members.length - a.members.length || a.members[0].localeCompare(b.members[0]));

    const affected: number = misfiles.length;
    const total: number = pages.length;
    const staleness: Staleness | null =
        affected > 0 && affected * STALENESS_DEN >= total * STALENESS_NUM ? { affected, total } : null;

    return { misfiles, refinements, siblingNotes, candidates, staleness };
}

/**
 * Renders the advisory findings as PR-body markdown. Returns the empty string when nothing is
 * above threshold (AC6). When the store-level staleness alarm fires it replaces every per-page
 * section — misfiles, refinements, AND low-priority notes — keeping only the new-domain candidates
 * (store-level, per Invariant 8; see decision stub for the low-priority-note interpretive gap).
 */
export function renderAdvisory(findings: AdvisoryFindings): string {
    const { misfiles, refinements, siblingNotes, candidates, staleness } = findings;
    if (
        misfiles.length === 0 &&
        refinements.length === 0 &&
        siblingNotes.length === 0 &&
        candidates.length === 0 &&
        staleness === null
    ) {
        return "";
    }

    const lines: string[] = ["## Taxonomy Drift Advisory"];

    if (staleness !== null) {
        lines.push("", "### Store-level staleness alarm", "");
        lines.push(
            `Filed-vs-detected disagreement affects ${staleness.affected}/${staleness.total} pages (>= 20%) — ` +
                "recommend a deliberate re-filing pass over the store.",
        );
    } else {
        if (misfiles.length > 0) {
            lines.push("", "### Cross-domain misfiles", "");
            for (const m of misfiles) {
                lines.push(
                    `- \`${m.slug}\` filed under \`${m.filedDomain}\`, but ${m.count}/${m.total} links land under \`${m.otherDomain}\``,
                );
            }
        }
        if (refinements.length > 0) {
            lines.push("", "### Refinement hints", "");
            for (const r of refinements) {
                lines.push(`- \`${r.slug}\` — ${r.count}/${r.total} links point into \`${r.subdomain}\``);
            }
        }
        if (siblingNotes.length > 0) {
            lines.push("", "### Low-priority notes", "");
            for (const n of siblingNotes) {
                lines.push(`- \`${n.slug}\` — ${n.count}/${n.total} links drift toward sibling subdomain \`${n.subdomain}\``);
            }
        }
    }

    if (candidates.length > 0) {
        lines.push("", "### New-domain candidates", "");
        for (const c of candidates) {
            lines.push(`- ${c.members.map((m) => `\`${m}\``).join(", ")}`);
        }
    }

    return lines.join("\n").replace(/\s+$/, "") + "\n";
}

// --- CLI -----------------------------------------------------------------------------------------

export function parseArgs(argv: string[]): { conceptsDir: string; registry?: string } {
    const options: { conceptsDir: string; registry?: string } = { conceptsDir: ".nexus/concepts", registry: undefined };
    for (let i = 0; i < argv.length; i++) {
        const arg: string = argv[i];
        if (arg === "--concepts-dir") {
            options.conceptsDir = argv[++i] ?? options.conceptsDir;
        } else if (arg === "--registry") {
            options.registry = argv[++i] ?? options.registry;
        }
    }
    return options;
}

/**
 * Runs the advisory and prints its markdown to stdout. Always returns 0 (Invariant 7 — never a
 * gate). No registry at the resolved (or given) path is a self-guard: print nothing, exit 0 — the
 * identical inert behavior Story 1's taxonomy gate uses when no registry exists.
 */
export function runCli(argv: string[]): number {
    const options = parseArgs(argv);
    const registryFile: string = options.registry ?? registryPath();
    if (!fs.existsSync(registryFile)) {
        return 0;
    }

    const registry: ParsedRegistry = parseDomainRegistry(fs.readFileSync(registryFile, "utf8"));
    const pages: ConceptPage[] = loadConceptPages(options.conceptsDir);
    const rendered: string = renderAdvisory(computeAdvisory(pages, registry));
    if (rendered !== "") {
        console.log(rendered.replace(/\n$/, ""));
    }
    return 0;
}

function main(): void {
    process.exit(runCli(process.argv.slice(2)));
}

// See the matching comment in generate-atlas.ts: the filename check disambiguates this guard from
// another entry point's bundle that imports from this module (Story 3's planned seed driver
// imports detectCommunities and the shared graph helpers from here) after esbuild inlines this
// file's source into that entry's bundle.
if (import.meta.url === `file://${process.argv[1]}` && path.basename(process.argv[1]).startsWith("drift-advisory")) {
    main();
}
