/**
 * Shared domain-registry grammar + parser (epic #89, STORY-89.01).
 *
 * The registry (`domains.md`, beside the atlas) authors a curated two-level taxonomy: domains and
 * their subdomains, each with a display title, a leaf slug, and a one-paragraph filing rubric. Both
 * the validator and the atlas generator consume this one parser so they agree exactly on what the
 * registry means. The parse is total — a malformed registry yields findings, never a throw — because
 * the atlas parses it at drain before the validator has had a chance to reject it.
 *
 * This module is standalone (no imports) and gets inlined into both portable-tools bundles by the
 * build; it stays byte-for-byte independent of validate-concepts.ts's own constants by design.
 */

export interface DomainNode {
    title: string;      // display title (heading text)
    slug: string;       // authored leaf slug ("" when missing)
    path: string;       // full slash-form identity path (composed from nesting)
    rubric: string;     // one-paragraph filing rubric ("" when missing)
    subdomains: DomainNode[];
}

export interface ParsedRegistry {
    domains: DomainNode[];
    findings: string[];  // structural problems; [] iff well-formed
}

const DOMAIN_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;      // kebab, same shape as the page slug pattern
const SLUG_LINE = /^`([^`]+)`$/;                     // a slug line: one backticked token, alone
const HEADING = /^(#{2,6})\s+(.*)$/;                 // H2..H6; H1 and pre-heading prose are ignored

interface Block {
    level: number;
    title: string;
    body: string[];
}

function segmentBlocks(content: string): Block[] {
    const lines: string[] = content.split("\n");
    const blocks: Block[] = [];
    let current: Block | null = null;
    for (const line of lines) {
        const match: RegExpMatchArray | null = line.match(HEADING);
        if (match !== null) {
            if (current !== null) {
                blocks.push(current);
            }
            current = { level: match[1].length, title: match[2].trim(), body: [] };
        } else if (current !== null) {
            current.body.push(line);
        }
        // Lines before the first heading are ignored.
    }
    if (current !== null) {
        blocks.push(current);
    }
    return blocks;
}

function extractSlugAndRubric(body: string[]): { slug: string; rubric: string } {
    const nonBlank: string[] = body.map((line) => line.trim()).filter((line) => line !== "");
    let slug = "";
    let rubricLines: string[] = nonBlank;
    if (nonBlank.length > 0) {
        const first: RegExpMatchArray | null = nonBlank[0].match(SLUG_LINE);
        if (first !== null && DOMAIN_SLUG.test(first[1])) {
            slug = first[1];
            rubricLines = nonBlank.slice(1);
        }
    }
    const rubric: string = rubricLines.join(" ").replace(/\s+/g, " ").trim();
    return { slug, rubric };
}

export function parseDomainRegistry(content: string): ParsedRegistry {
    const domains: DomainNode[] = [];
    const findings: string[] = [];
    let currentDomain: DomainNode | null = null;
    const recorded: DomainNode[] = [];

    for (const block of segmentBlocks(content)) {
        const { level, title, body } = block;

        if (level >= 4) {
            findings.push(`entry "${title || "(untitled)"}" nests a third level — the taxonomy caps at domain plus subdomain (0089)`);
            continue;
        }

        const { slug, rubric } = extractSlugAndRubric(body);
        let node: DomainNode;

        if (level === 2) {
            node = { title, slug, path: slug, rubric, subdomains: [] };
            domains.push(node);
            currentDomain = node;
        } else {
            // level === 3
            if (currentDomain === null) {
                findings.push(`subdomain "${title || slug || "(untitled)"}" appears before any domain — a subdomain must nest under a domain (0089)`);
                node = { title, slug, path: slug, rubric, subdomains: [] };
            } else {
                const composed: string = (currentDomain.path !== "" && slug !== "") ? `${currentDomain.path}/${slug}` : slug;
                node = { title, slug, path: composed, rubric, subdomains: [] };
                currentDomain.subdomains.push(node);
            }
        }

        recorded.push(node);

        if (title === "") {
            findings.push(`entry with slug "${slug || "(none)"}" is missing its display title (0089)`);
        }
        if (slug === "") {
            findings.push(`entry "${title || "(untitled)"}" is missing its slug line (0089)`);
        }
        if (rubric === "") {
            findings.push(`entry "${title || slug || "(untitled)"}" is missing its filing rubric (0089)`);
        }
    }

    const pathCounts: Map<string, number> = new Map();
    for (const node of recorded) {
        if (node.slug === "") {
            continue;
        }
        pathCounts.set(node.path, (pathCounts.get(node.path) ?? 0) + 1);
    }
    for (const [nodePath, count] of pathCounts) {
        if (count > 1) {
            findings.push(`duplicate slug path "${nodePath}" — the full slug path is an entry's identity and must be unique (0089)`);
        }
    }

    return { domains, findings };
}
