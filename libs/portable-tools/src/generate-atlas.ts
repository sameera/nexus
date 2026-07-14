/**
 * Deterministic concept-atlas generator (decision: 0b8973e2 — generated atlas at
 * docs/concepts.md, contract item 2).
 *
 * Usage:
 *   npx tsx libs/portable-tools/src/generate-atlas.ts [--concepts-dir <dir>] [--out <path>] [--check]
 *
 * Reads every active concept page's frontmatter and clusters them mechanically from the
 * `touches:` graph. No LLM judgment: pure parsing + graph mechanics. `--check` regenerates
 * in memory and byte-compares against the existing output file without writing (the sync
 * gate the validator invokes).
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface CliOptions {
    conceptsDir: string;
    out: string;
    check: boolean;
}

interface Frontmatter {
    fields: Map<string, string | string[]>;
    bodyStart: number;
}

export interface ConceptPage {
    slug: string;
    title: string;
    touches: string[];
    hook: string;
}

export interface Cluster {
    name: string;
    pages: ConceptPage[];
}

export function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = { conceptsDir: ".nexus/concepts", out: "docs/concepts.md", check: false };
    for (let i = 0; i < argv.length; i++) {
        const arg: string = argv[i];
        if (arg === "--concepts-dir") {
            options.conceptsDir = argv[++i] ?? options.conceptsDir;
        } else if (arg === "--out") {
            options.out = argv[++i] ?? options.out;
        } else if (arg === "--check") {
            options.check = true;
        }
    }
    return options;
}

function splitInlineList(raw: string): string[] {
    const inner: string = raw.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
    if (inner === "") {
        return [];
    }
    const items: string[] = [];
    let current = "";
    let quote: string | null = null;
    for (const ch of inner) {
        if (quote !== null) {
            if (ch === quote) {
                quote = null;
            } else {
                current += ch;
            }
        } else if (ch === "\"" || ch === "'") {
            quote = ch;
        } else if (ch === ",") {
            items.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim() !== "") {
        items.push(current.trim());
    }
    return items;
}

function stripQuotes(raw: string): string {
    const trimmed: string = raw.trim();
    if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

export function parseFrontmatter(lines: string[]): Frontmatter | null {
    if (lines[0]?.trim() !== "---") {
        return null;
    }
    const fields: Map<string, string | string[]> = new Map();
    let i = 1;
    for (; i < lines.length; i++) {
        const line: string = lines[i];
        if (line.trim() === "---") {
            return { fields, bodyStart: i + 1 };
        }
        const match: RegExpMatchArray | null = line.match(/^([\w-]+):\s*(.*)$/);
        if (match === null) {
            continue;
        }
        const key: string = match[1];
        const rawValue: string = match[2].trim();
        if (rawValue.startsWith("[")) {
            fields.set(key, splitInlineList(rawValue));
        } else if (rawValue === "") {
            const items: string[] = [];
            while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
                items.push(stripQuotes(lines[i + 1].replace(/^\s+-\s+/, "")));
                i++;
            }
            fields.set(key, items);
        } else {
            fields.set(key, stripQuotes(rawValue));
        }
    }
    return null;
}

export function extractHookLine(bodyLines: string[]): string {
    const h1Index: number = bodyLines.findIndex((line: string) => /^# /.test(line));
    if (h1Index === -1) {
        return "";
    }
    let sectionIndex: number = bodyLines.length;
    for (let i: number = h1Index + 1; i < bodyLines.length; i++) {
        if (/^## /.test(bodyLines[i])) {
            sectionIndex = i;
            break;
        }
    }
    const lead: string = bodyLines.slice(h1Index + 1, sectionIndex).join(" ").replace(/\s+/g, " ").trim();
    const match: RegExpMatchArray | null = lead.match(/^(.*?\.)(?:\s|$)/);
    return match ? match[1].trim() : lead;
}

export function loadConceptPages(conceptsDir: string): ConceptPage[] {
    if (!fs.existsSync(conceptsDir)) {
        return [];
    }
    const pages: ConceptPage[] = [];
    for (const entry of fs.readdirSync(conceptsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "README.md") {
            continue;
        }
        const content: string = fs.readFileSync(path.join(conceptsDir, entry.name), "utf8");
        const lines: string[] = content.split("\n");
        const fm: Frontmatter | null = parseFrontmatter(lines);
        if (fm === null || fm.fields.get("status") === "deprecated") {
            continue;
        }
        const title: string | string[] | undefined = fm.fields.get("title");
        const touches: string | string[] | undefined = fm.fields.get("touches");
        pages.push({
            slug: path.basename(entry.name, ".md"),
            title: typeof title === "string" ? title : "",
            touches: Array.isArray(touches) ? touches : [],
            hook: extractHookLine(lines.slice(fm.bodyStart)),
        });
    }
    return pages;
}

function buildAdjacency(pages: ConceptPage[]): Map<string, Set<string>> {
    const slugs: Set<string> = new Set(pages.map((p: ConceptPage) => p.slug));
    const adjacency: Map<string, Set<string>> = new Map();
    for (const page of pages) {
        adjacency.set(page.slug, new Set());
    }
    for (const page of pages) {
        for (const touched of page.touches) {
            if (touched !== page.slug && slugs.has(touched)) {
                adjacency.get(page.slug)?.add(touched);
                adjacency.get(touched)?.add(page.slug);
            }
        }
    }
    return adjacency;
}

function findComponents(pages: ConceptPage[], adjacency: Map<string, Set<string>>): string[][] {
    const visited: Set<string> = new Set();
    const components: string[][] = [];
    for (const slug of pages.map((p: ConceptPage) => p.slug).sort()) {
        if (visited.has(slug)) {
            continue;
        }
        const component: string[] = [];
        const stack: string[] = [slug];
        visited.add(slug);
        while (stack.length > 0) {
            const current: string = stack.pop() as string;
            component.push(current);
            for (const neighbor of adjacency.get(current) ?? []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    stack.push(neighbor);
                }
            }
        }
        components.push(component);
    }
    return components;
}

export function buildClusters(pages: ConceptPage[]): Cluster[] {
    const bySlug: Map<string, ConceptPage> = new Map(pages.map((p: ConceptPage) => [p.slug, p]));
    const adjacency: Map<string, Set<string>> = buildAdjacency(pages);
    const degree = (slug: string): number => adjacency.get(slug)?.size ?? 0;
    const byDegreeThenSlug = (a: ConceptPage, b: ConceptPage): number => degree(b.slug) - degree(a.slug) || a.slug.localeCompare(b.slug);

    const namedClusters: Cluster[] = [];
    const singletons: ConceptPage[] = [];

    for (const component of findComponents(pages, adjacency)) {
        if (component.length === 1) {
            singletons.push(bySlug.get(component[0]) as ConceptPage);
            continue;
        }
        const sorted: ConceptPage[] = component.map((slug: string) => bySlug.get(slug) as ConceptPage).sort(byDegreeThenSlug);
        namedClusters.push({ name: sorted[0].title, pages: sorted });
    }

    namedClusters.sort((a: Cluster, b: Cluster) => b.pages.length - a.pages.length || a.name.localeCompare(b.name));

    const clusters: Cluster[] = [...namedClusters];
    if (singletons.length > 0) {
        clusters.push({ name: "Standalone", pages: [...singletons].sort((a: ConceptPage, b: ConceptPage) => a.slug.localeCompare(b.slug)) });
    }
    return clusters;
}

export function renderAtlas(clusters: Cluster[]): string {
    const total: number = clusters.reduce((sum: number, c: Cluster) => sum + c.pages.length, 0);
    const lines: string[] = [
        "<!-- DERIVED — generated from .nexus/concepts/ frontmatter by the concept-atlas generator.",
        "     Regenerated by /nxs.distill on every drain. Never hand-edit — regenerate it",
        "     through the atlas generator instead. -->",
        "",
        "# Concept Atlas",
        "",
        `Orientation map of the concept store — ${total} active concepts. Each links to its full page`,
        "(behavior, invariants, decision history); code locations live in the matching",
        "`.nexus/anchors/<slug>.md` sidecar.",
    ];
    for (const cluster of clusters) {
        lines.push("", `## ${cluster.name}`, "");
        for (const page of cluster.pages) {
            lines.push(`- [${page.title}](../.nexus/concepts/${page.slug}.md) — ${page.hook}`);
        }
    }
    return lines.join("\n") + "\n";
}

export function generateAtlas(conceptsDir: string): string {
    return renderAtlas(buildClusters(loadConceptPages(conceptsDir)));
}

export function runCli(argv: string[]): number {
    const options: CliOptions = parseArgs(argv);
    const pages: ConceptPage[] = loadConceptPages(options.conceptsDir);
    const atlas: string = renderAtlas(buildClusters(pages));

    if (options.check) {
        if (!fs.existsSync(options.out)) {
            console.error(`Atlas missing: ${options.out} — regenerate it from .nexus/concepts/ before checking again.`);
            return 1;
        }
        const existing: string = fs.readFileSync(options.out, "utf8");
        if (existing !== atlas) {
            console.error(`Atlas out of sync: ${options.out} does not match generated content — regenerate it from .nexus/concepts/ and retry.`);
            return 1;
        }
        console.log("OK");
        return 0;
    }

    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, atlas);
    console.log(`Atlas written: ${options.out} (${pages.length} concepts)`);
    return 0;
}

function main(): void {
    process.exit(runCli(process.argv.slice(2)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
