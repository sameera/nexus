/**
 * Deterministic concept-page validator (0003 §2, §5, §8.3 — mechanics as code).
 *
 * Usage:
 *   npx tsx libs/portable-tools/src/validate-concepts.ts [--base <git-ref>] [--concepts-dir <dir>] [files...]
 *
 * With no files, validates every active page under the concepts dir (README.md excluded).
 * With --base, additionally enforces that every changed page gained exactly one new
 * Decision Log entry and that prior entries are untouched (append-only).
 *
 * §8.3 checks are heuristics: fenced/indented code blocks, path-shaped tokens,
 * camelCase / snake_case / call-syntax identifiers. Deliberately not caught: bare
 * PascalCase type names — indistinguishable from proper nouns ("GitHub") without
 * a symbol table; that residue is left to distillation-PR review.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

interface CliOptions {
    base: string | null;
    conceptsDir: string;
    files: string[];
}

interface Frontmatter {
    fields: Map<string, string | string[]>;
    bodyStart: number;
}

export interface Finding {
    file: string;
    message: string;
}

const BODY_WORD_CAP = 400;
const MAX_INVARIANTS = 7;
const REQUIRED_SECTIONS: string[] = ["How It Works", "Key Invariants", "Integration Points", "Decision Log"];
const PROVENANCE_REF = /^(#\d+|[\w.-]+\/[\w.-]+#\d+|bootstrap|manual)$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LOG_HEADING = /^### (\d{4}-\d{2}-\d{2}) — (\S+) — (.+)$/;

export function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = { base: null, conceptsDir: ".nexus/concepts", files: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg: string = argv[i];
        if (arg === "--") {
            continue;
        } else if (arg === "--base") {
            options.base = argv[++i] ?? null;
        } else if (arg === "--concepts-dir") {
            options.conceptsDir = argv[++i] ?? options.conceptsDir;
        } else {
            options.files.push(arg);
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

function sectionLines(bodyLines: string[], heading: string): string[] | null {
    const start: number = bodyLines.findIndex((line: string) => line.trim() === `## ${heading}`);
    if (start === -1) {
        return null;
    }
    let end: number = bodyLines.length;
    for (let i: number = start + 1; i < bodyLines.length; i++) {
        if (/^## /.test(bodyLines[i])) {
            end = i;
            break;
        }
    }
    return bodyLines.slice(start + 1, end);
}

function decisionLogHeadings(content: string): string[] {
    const lines: string[] = content.split("\n");
    const fm: Frontmatter | null = parseFrontmatter(lines);
    const bodyLines: string[] = lines.slice(fm?.bodyStart ?? 0);
    const log: string[] | null = sectionLines(bodyLines, "Decision Log");
    if (log === null) {
        return [];
    }
    return log.filter((line: string) => line.startsWith("### "));
}

export function checkForbiddenContent(file: string, text: string, findings: Finding[]): void {
    const lines: string[] = text.split("\n");
    let inFence = false;
    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) {
            if (!inFence) {
                findings.push({ file, message: `§8.3: fenced code block ("${line.trim().slice(0, 20)}") — code belongs in source, not concept pages` });
            }
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }

        const pathTokens: RegExpMatchArray | null = line.match(/(?:\.{1,2}\/|\/)?[\w.@-]+(?:\/[\w.@-]+)+\/?/g);
        for (const token of pathTokens ?? []) {
            const slashes: number = (token.match(/\//g) ?? []).length;
            const lastSegment: string = token.replace(/\/$/, "").split("/").pop() ?? "";
            const looksLikePath: boolean =
                token.startsWith("/") || token.startsWith("./") || token.startsWith("../") ||
                token.endsWith("/") || slashes >= 2 || /\.[a-z]{1,4}$/i.test(lastSegment);
            if (looksLikePath) {
                findings.push({ file, message: `§8.3: file path "${token}" — paths rot; they belong in the derived anchors sidecar, not the page` });
            }
        }

        for (const pattern of [/\b[A-Za-z_][\w.]*\(\)/g, /\b[a-z0-9]+_[a-z0-9_]+\b/g, /\b[a-z][a-z0-9]*[A-Z]\w*\b/g]) {
            for (const token of line.match(pattern) ?? []) {
                findings.push({ file, message: `§8.3: code identifier "${token}" — type/function names rot; describe the behavior in domain terms` });
            }
        }
    }
}

function gitShow(ref: string, relPath: string): string | null {
    try {
        return execFileSync("git", ["show", `${ref}:${relPath}`], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        });
    } catch {
        return null;
    }
}

export function validatePage(file: string, base: string | null, repoRoot: string, findings: Finding[]): void {
    const content: string = fs.readFileSync(file, "utf8");
    const lines: string[] = content.split("\n");

    const slug: string = path.basename(file, ".md");
    if (!SLUG_PATTERN.test(slug)) {
        findings.push({ file, message: `slug "${slug}" is not kebab-case` });
    }

    const fm: Frontmatter | null = parseFrontmatter(lines);
    if (fm === null) {
        findings.push({ file, message: "missing or unterminated frontmatter block" });
        return;
    }

    // §2.1 frontmatter completeness (+ the R6 verification flag).
    const title: string | string[] | undefined = fm.fields.get("title");
    if (typeof title !== "string" || title === "") {
        findings.push({ file, message: "frontmatter: missing `title`" });
    }
    for (const listField of ["aliases", "touches"]) {
        if (!Array.isArray(fm.fields.get(listField))) {
            findings.push({ file, message: `frontmatter: missing list field \`${listField}\` (empty list is fine; absence is not)` });
        }
    }
    const provenance: string | string[] | undefined = fm.fields.get("last_updated_by");
    if (typeof provenance !== "string" || !PROVENANCE_REF.test(provenance)) {
        findings.push({ file, message: `frontmatter: \`last_updated_by\` must be #n, <owner>/<repo>#n, bootstrap, or manual (got ${JSON.stringify(provenance ?? null)})` });
    }
    const status: string | string[] | undefined = fm.fields.get("status");
    if (status !== "active" && status !== "deprecated") {
        findings.push({ file, message: `frontmatter: \`status\` must be active | deprecated (got ${JSON.stringify(status ?? null)})` });
    }
    const verification: string | string[] | undefined = fm.fields.get("verification");
    if (verification !== "verified" && verification !== "unverified") {
        findings.push({ file, message: `frontmatter: \`verification\` must be verified | unverified (got ${JSON.stringify(verification ?? null)})` });
    }
    for (const derived of ["slug", "id"]) {
        if (fm.fields.has(derived)) {
            findings.push({ file, message: `frontmatter: \`${derived}\` is derived state — the filename is the slug (0003 §2.1)` });
        }
    }

    const bodyLines: string[] = lines.slice(fm.bodyStart);

    // H1 mirrors title; a Summary lead follows it.
    const h1Index: number = bodyLines.findIndex((line: string) => line.startsWith("# "));
    if (h1Index === -1) {
        findings.push({ file, message: "body: missing H1" });
    } else {
        if (typeof title === "string" && bodyLines[h1Index].trim() !== `# ${title}`) {
            findings.push({ file, message: `body: H1 "${bodyLines[h1Index].trim()}" does not mirror title "${title}"` });
        }
        const firstSection: number = bodyLines.findIndex((line: string) => /^## /.test(line));
        const lead: string = bodyLines.slice(h1Index + 1, firstSection === -1 ? undefined : firstSection).join(" ").trim();
        if (lead === "") {
            findings.push({ file, message: "body: no Summary lead between the H1 and the first section" });
        }
    }

    for (const section of REQUIRED_SECTIONS) {
        if (sectionLines(bodyLines, section) === null) {
            findings.push({ file, message: `body: missing required section \`## ${section}\`` });
        }
    }

    // 400-word cap, excluding frontmatter + Decision Log.
    const logStart: number = bodyLines.findIndex((line: string) => line.trim() === "## Decision Log");
    const cappedText: string = bodyLines.slice(0, logStart === -1 ? undefined : logStart).join("\n");
    const wordCount: number = cappedText.split(/\s+/).filter((word: string) => word !== "").length;
    if (wordCount > BODY_WORD_CAP) {
        findings.push({ file, message: `body: ${wordCount} words exceeds the ${BODY_WORD_CAP}-word cap — split the concept, don't grow it (0003 §2.2)` });
    }

    // ≤7 invariants, numbered.
    const invariants: string[] | null = sectionLines(bodyLines, "Key Invariants");
    if (invariants !== null) {
        const numbered: number = invariants.filter((line: string) => /^\d+\.\s/.test(line.trim())).length;
        if (numbered > MAX_INVARIANTS) {
            findings.push({ file, message: `Key Invariants: ${numbered} entries exceeds the cap of ${MAX_INVARIANTS}` });
        }
    }

    // touches: == Integration Points, exactly.
    const touches: string | string[] | undefined = fm.fields.get("touches");
    const integration: string[] | null = sectionLines(bodyLines, "Integration Points");
    if (Array.isArray(touches) && integration !== null) {
        const linked: string[] = [];
        for (const line of integration) {
            const bullet: RegExpMatchArray | null = line.trim().match(/^[-*]\s+\[([a-z0-9-]+)\]\(([a-z0-9-]+)\.md\)/);
            if (bullet !== null) {
                linked.push(bullet[1]);
                if (bullet[1] !== bullet[2]) {
                    findings.push({ file, message: `Integration Points: link label "${bullet[1]}" and target "${bullet[2]}.md" disagree` });
                }
            } else if (/^[-*]\s+/.test(line.trim())) {
                findings.push({ file, message: `Integration Points: bullet does not lead with a [slug](slug.md) link: "${line.trim().slice(0, 60)}"` });
            }
        }
        const touchSet: Set<string> = new Set(touches);
        const linkSet: Set<string> = new Set(linked);
        for (const t of touchSet) {
            if (!linkSet.has(t)) {
                findings.push({ file, message: `touches: "${t}" has no Integration Points bullet (the sets must be equal)` });
            }
        }
        for (const l of linkSet) {
            if (!touchSet.has(l)) {
                findings.push({ file, message: `Integration Points names "${l}" missing from touches: (the sets must be equal)` });
            }
        }
    }

    // Decision Log: ≥1 well-formed entry.
    const headings: string[] = bodyLines.filter((line: string) => line.startsWith("### "));
    const logSection: string[] | null = sectionLines(bodyLines, "Decision Log");
    const logHeadings: string[] = (logSection ?? []).filter((line: string) => line.startsWith("### "));
    if (logSection !== null && logHeadings.length === 0) {
        findings.push({ file, message: "Decision Log: empty — every page carries at least its originating entry" });
    }
    for (const heading of logHeadings) {
        const match: RegExpMatchArray | null = heading.match(LOG_HEADING);
        if (match === null) {
            findings.push({ file, message: `Decision Log: malformed heading "${heading.trim()}" (expected \`### YYYY-MM-DD — <ref> — <title>\`)` });
        } else if (!PROVENANCE_REF.test(match[2])) {
            findings.push({ file, message: `Decision Log: bad provenance ref "${match[2]}" in "${heading.trim()}"` });
        }
    }
    if (headings.length !== logHeadings.length) {
        findings.push({ file, message: "body: H3 headings found outside the Decision Log" });
    }

    // §8.3 rejections over the whole body (Decision Log included — the ban is page-wide).
    checkForbiddenContent(file, bodyLines.join("\n"), findings);

    // Changed-page checks against --base: exactly one new Decision Log entry, append-only.
    if (base !== null) {
        const relPath: string = path.relative(repoRoot, path.resolve(file)).split(path.sep).join("/");
        let previous: string | null = gitShow(base, relPath);
        if (previous === null && relPath.includes("/_archive/")) {
            previous = gitShow(base, relPath.replace("/_archive/", "/"));
        }
        if (previous !== null && previous === content) {
            // Unchanged against base: nothing to enforce.
        } else if (previous !== null) {
            const oldHeadings: string[] = decisionLogHeadings(previous);
            const gained: number = logHeadings.length - oldHeadings.length;
            if (gained !== 1) {
                findings.push({ file, message: `Decision Log: page changed against ${base} but gained ${gained} entries (must be exactly 1)` });
            }
            for (let i = 0; i < oldHeadings.length; i++) {
                if (logHeadings[i]?.trim() !== oldHeadings[i].trim()) {
                    findings.push({ file, message: `Decision Log: prior entry "${oldHeadings[i].trim()}" edited, reordered, or removed — the log is append-only (0003 §2.3)` });
                    break;
                }
            }
        } else if (logHeadings.length !== 1) {
            findings.push({ file, message: `Decision Log: new page must carry exactly one entry (found ${logHeadings.length})` });
        }
    }
}

export function runCli(argv: string[]): number {
    const options: CliOptions = parseArgs(argv);
    let repoRoot: string = process.cwd();
    try {
        repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    } catch {
        // Not a git repo: --base checks will be skipped by gitShow failing.
    }

    let files: string[] = options.files;
    if (files.length === 0) {
        if (!fs.existsSync(options.conceptsDir)) {
            console.log(`No concepts directory at ${options.conceptsDir} — nothing to validate.`);
            return 0;
        }
        files = fs.readdirSync(options.conceptsDir)
            .filter((name: string) => name.endsWith(".md") && name !== "README.md")
            .map((name: string) => path.join(options.conceptsDir, name));
    }

    const findings: Finding[] = [];
    for (const file of files) {
        if (!fs.existsSync(file)) {
            findings.push({ file, message: "file not found" });
            continue;
        }
        validatePage(file, options.base, repoRoot, findings);
    }

    if (findings.length > 0) {
        for (const finding of findings) {
            console.error(`${finding.file}: ${finding.message}`);
        }
        console.error(`\n${findings.length} finding(s) across ${files.length} page(s).`);
        return 1;
    }
    console.log(`OK: ${files.length} page(s) validated.`);
    return 0;
}

function main(): void {
    process.exit(runCli(process.argv.slice(2)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
