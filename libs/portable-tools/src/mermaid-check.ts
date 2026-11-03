/**
 * `nexus mermaid-check` — checks that every Mermaid block in a Markdown page parses. `/nxs.hld`
 * runs it before its preview gate, so a diagram that GitHub would show as an error never reaches
 * the asset store.
 *
 * The parser is Mermaid's own `parse()`, run in Node. Its flowchart parser needs a DOM for its
 * sanitizer, so a jsdom window is installed first. No browser is involved and nothing is fetched.
 *
 * Neither package ships with Nexus: together they are about 150 MB, and the release bundle carries
 * no runtime dependency. They are optional peers. The check looks for them beside the Nexus
 * install (where `npm install -g mermaid jsdom` puts them) and then in the directories it is
 * given, such as the target repository. The specifiers are built at run time, so the bundler
 * leaves them out. When either package is absent the check reports `unchecked` and exits 0: the
 * caller says so to the lead instead of stopping.
 */

import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface MermaidCheckIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

export const MERMAID_CHECK_USAGE: string = [
    "  nexus mermaid-check --file <path> [--root <dir>]",
    "      Read-only. Parse every ```mermaid block in a Markdown file with Mermaid's own parser and",
    "      print { command, file, state, blocks, reason? }. Each block gives its fence line, and",
    "      either its diagramType or its error, with errorLine (the line in the file) when the",
    "      parser names one. state is parsed (exit 0), invalid (exit 1) or unchecked (exit 0):",
    "      mermaid and jsdom are optional peers, looked for beside the Nexus install and then under",
    "      --root (default: the working directory), and unchecked means one of them is absent.",
    "      A fence may sit at any indent; a ```mermaid fence the file never closes is invalid, parser",
    "      or not. Exits 1 when the file cannot be read; 2 on a usage error.",
].join("\n");

const INSTALL_HINT = "mermaid and jsdom are not installed; install both (npm install -g mermaid jsdom) to check the diagrams";

export interface MermaidParser {
    parse: (text: string) => Promise<{ diagramType: string }>;
}

export type MermaidLoader = (bases: string[]) => Promise<MermaidParser | null>;

interface Block {
    /** 1-based line of the opening fence. */
    line: number;
    text: string;
    /** True when the file ends before the block's closing fence. */
    unclosed?: boolean;
}

interface BlockResult {
    line: number;
    diagramType?: string;
    error?: string;
    errorLine?: number;
}

/**
 * Every fenced block whose info string is `mermaid`, with the line of its opening fence. A fence may
 * sit at any indent, because a block nested under a list item is still rendered by GitHub; the
 * opening fence's indent is taken off each body line. A Mermaid block the file ends inside is
 * returned with `unclosed`.
 */
export function mermaidBlocks(markdown: string): Block[] {
    const lines: string[] = markdown.split(/\r?\n/);
    const blocks: Block[] = [];
    let open: { line: number; fence: string; indent: number; mermaid: boolean; body: string[] } | null = null;
    lines.forEach((text, index) => {
        if (open === null) {
            const start: RegExpMatchArray | null = text.match(/^( *)(`{3,}|~{3,})\s*([^\s`]*)/);
            if (start !== null) open = { line: index + 1, indent: start[1].length, fence: start[2], mermaid: start[3].toLowerCase() === "mermaid", body: [] };
            return;
        }
        const close: RegExpMatchArray | null = text.match(/^ *(`{3,}|~{3,})\s*$/);
        if (close !== null && close[1][0] === open.fence[0] && close[1].length >= open.fence.length) {
            if (open.mermaid) blocks.push({ line: open.line, text: open.body.join("\n") });
            open = null;
            return;
        }
        const indent: number = open.indent;
        open.body.push(text.replace(new RegExp(`^ {0,${indent}}`), ""));
    });
    const last = open as { line: number; mermaid: boolean; body: string[] } | null;
    if (last !== null && last.mermaid) blocks.push({ line: last.line, text: last.body.join("\n"), unclosed: true });
    return blocks;
}

const UNCLOSED = "the ```mermaid fence is never closed";

/** Resolve a package from the first base directory that has it; null when none does. */
function resolveFrom(name: string, bases: string[]): string | null {
    for (const base of bases) {
        try {
            return createRequire(path.join(base, "noop.js")).resolve(name);
        } catch {
            // not installed under this base; try the next
        }
    }
    return null;
}

/** Load Mermaid's parser with a jsdom window, from the given directories. Null when either package is absent. */
export async function loadMermaidParser(bases: string[]): Promise<MermaidParser | null> {
    const mermaidPath: string | null = resolveFrom("mermaid", bases);
    const jsdomPath: string | null = resolveFrom("jsdom", bases);
    if (mermaidPath === null || jsdomPath === null) return null;
    const scope = globalThis as { window?: unknown; document?: unknown };
    if (scope.window === undefined) {
        const { JSDOM } = (await import(pathToFileURL(jsdomPath).href)) as { JSDOM: new (html: string) => { window: { document: unknown } } };
        const dom = new JSDOM("");
        scope.window = dom.window;
        scope.document = dom.window.document;
    }
    const loaded = (await import(pathToFileURL(mermaidPath).href)) as { default: MermaidParser };
    return loaded.default;
}

/** The directory this code runs from: beside the Nexus install in a release, `src/` in the checkout. */
function installDir(): string {
    return path.dirname(fileURLToPath(import.meta.url));
}

function takeFlag(argv: string[], flag: string): string | undefined {
    const index: number = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
}

export async function runMermaidCheck(argv: string[], io: MermaidCheckIo, load: MermaidLoader = loadMermaidParser): Promise<number> {
    const file: string | undefined = takeFlag(argv, "--file");
    const root: string | undefined = takeFlag(argv, "--root");
    if (file === undefined || file.startsWith("--") || (argv.includes("--root") && (root === undefined || root.startsWith("--")))) {
        io.stderr("usage: nexus mermaid-check --file <path> [--root <dir>]");
        return 2;
    }
    const target: string = path.resolve(io.cwd, file);
    let markdown: string;
    try {
        markdown = fs.readFileSync(target, "utf8");
    } catch {
        io.stderr(`mermaid-check: cannot read ${target}`);
        return 1;
    }

    const blocks: Block[] = mermaidBlocks(markdown);
    const print = (state: string, results: BlockResult[], reason?: string): void => {
        io.stdout(JSON.stringify({ command: "mermaid-check", file: target, state, blocks: results, ...(reason === undefined ? {} : { reason }) }, null, 2));
    };

    const parser: MermaidParser | null = await load([installDir(), path.resolve(io.cwd, root ?? ".")]);
    if (parser === null) {
        // An unclosed fence is found without the parser, so it fails the page either way.
        const unclosed: boolean = blocks.some((b) => b.unclosed === true);
        print(unclosed ? "invalid" : "unchecked", blocks.map((b) => (b.unclosed === true ? { line: b.line, error: UNCLOSED } : { line: b.line })), INSTALL_HINT);
        return unclosed ? 1 : 0;
    }

    const results: BlockResult[] = [];
    for (const block of blocks) {
        if (block.unclosed === true) {
            results.push({ line: block.line, error: UNCLOSED });
            continue;
        }
        try {
            const { diagramType } = await parser.parse(block.text);
            results.push({ line: block.line, diagramType });
        } catch (caught) {
            const message: string = caught instanceof Error ? caught.message : String(caught);
            const where: RegExpMatchArray | null = message.match(/on line (\d+)/);
            results.push({
                line: block.line,
                error: message.split("\n")[0],
                ...(where === null ? {} : { errorLine: block.line + Number(where[1]) }),
            });
        }
    }
    const invalid: boolean = results.some((r) => r.error !== undefined);
    print(invalid ? "invalid" : "parsed", results);
    return invalid ? 1 : 0;
}
