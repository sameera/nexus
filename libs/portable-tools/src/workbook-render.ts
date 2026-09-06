/**
 * The workbook renderer (epic #405, story #447): an authored lesson's markdown and front-matter
 * become a page a learner opens in a browser, and no agent writes the markup.
 *
 * Markup is mechanical and costs several times the tokens the prose it wraps costs, on every
 * lesson anyone ever writes. Moving it into code pays that once and buys three things a generated
 * page cannot have: the output is testable, it is identical across pages, and it cannot drift as
 * lessons accumulate.
 *
 * Two properties are structural rather than encouraged:
 *
 * - **The markup channel is closed.** The markdown path has raw-markup pass-through disabled, so an
 *   authored lesson containing markup fails the render and the failure names the file. "No agent
 *   writes the markup" is only enforceable when there is no channel through which markup could
 *   arrive.
 * - **The render is all-or-nothing.** Pages are built in memory and written only once every lesson
 *   has rendered, and a failed render clears any output left from a previous one — so a workbook
 *   is never part new and part stale.
 *
 * Chrome comes from one place (`renderPageShell`), and every page references one stylesheet by
 * relative path rather than carrying a copy, so a change to the runtime rewrites two files instead
 * of every page.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { renderReadingTokensCss } from "./reading-tokens.js";

/** The stylesheet written once per workbook and referenced by every page. */
export const STYLESHEET_NAME: string = "workbook.css";

export type RenderProblem = "markup-in-lesson" | "malformed-front-matter" | "missing-title";

export class LessonRenderError extends Error {
    readonly problem: RenderProblem;
    readonly lesson: string;
    constructor(problem: RenderProblem, lesson: string, detail: string) {
        super(`${problem} in ${lesson}: ${detail}`);
        this.name = "LessonRenderError";
        this.problem = problem;
        this.lesson = lesson;
    }
}

/** One authored lesson: its file name, and what the author wrote. */
export interface LessonSource {
    /** The authored file's name, as a reader would cite it. */
    file: string;
    /** The file's whole contents — front matter and prose. */
    source: string;
}

export interface Lesson {
    file: string;
    title: string;
    frontMatter: Record<string, unknown>;
    body: string;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
};

export function escapeText(text: string): string {
    return text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);
}

/**
 * A lesson that contains markup fails the render. The check runs on the authored source, before
 * any conversion, so no markup can reach a page even by an accident of ordering.
 */
function refuseMarkup(lesson: LessonSource): void {
    const match: RegExpMatchArray | null = lesson.source.match(/<\/?[a-zA-Z][^\n>]*>|<!--/);
    if (match === null) return;
    throw new LessonRenderError(
        "markup-in-lesson",
        lesson.file,
        `the authored lesson contains markup (${match[0].slice(0, 40)}). A lesson is prose and ` +
        `front matter; the page's markup is generated, so an authored file may never carry any.`,
    );
}

/** Split front matter from prose, and refuse a lesson that is not readable as either. */
export function parseLesson(lesson: LessonSource): Lesson {
    refuseMarkup(lesson);
    const lines: string[] = lesson.source.split("\n");
    if (lines[0]?.trim() !== "---") {
        throw new LessonRenderError("malformed-front-matter", lesson.file, "the lesson has no front matter");
    }
    const end: number = lines.slice(1).findIndex((l) => l.trim() === "---");
    if (end === -1) {
        throw new LessonRenderError("malformed-front-matter", lesson.file, "the front matter is never closed");
    }
    let doc: unknown;
    try {
        doc = parse(lines.slice(1, end + 1).join("\n"));
    } catch (e) {
        const detail: string = e instanceof Error ? e.message : String(e);
        throw new LessonRenderError("malformed-front-matter", lesson.file, detail);
    }
    const frontMatter: Record<string, unknown> = (doc as Record<string, unknown> | null) ?? {};
    const title: unknown = frontMatter["title"];
    if (typeof title !== "string" || title.trim() === "") {
        throw new LessonRenderError("missing-title", lesson.file, "front matter declares no 'title'");
    }
    return { file: lesson.file, title, frontMatter, body: lines.slice(end + 2).join("\n") };
}

/** Inline prose: emphasis, code spans and links, over already-escaped text. */
function renderInline(text: string): string {
    let out: string = escapeText(text);
    out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
    out = out.replace(/\*\*([^*]+)\*\*/g, (_m, s: string) => `<strong>${s}</strong>`);
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, (_m, lead: string, s: string) => `${lead}<em>${s}</em>`);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
        `<a href="${href}">${label}</a>`);
    return out;
}

/**
 * The markdown subset a lesson is written in. It is deliberately small: every construct here has
 * one rendering, so two lessons authored months apart cannot come out shaped differently.
 *
 * `blockHook` lets a later stage claim a fenced block — the widget seam uses it — without this
 * function learning what a widget is.
 */
export function renderMarkdown(
    body: string,
    blockHook?: (info: string, content: string) => string | null,
): string {
    const lines: string[] = body.split("\n");
    const out: string[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushParagraph = (): void => {
        if (paragraph.length === 0) return;
        out.push(`<p>${renderInline(paragraph.join(" ").trim())}</p>`);
        paragraph = [];
    };
    const flushList = (): void => {
        if (list === null) return;
        const tag: string = list.ordered ? "ol" : "ul";
        out.push(`<${tag}>`, ...list.items.map((i) => `<li>${renderInline(i)}</li>`), `</${tag}>`);
        list = null;
    };
    const flush = (): void => {
        flushParagraph();
        flushList();
    };

    for (let i = 0; i < lines.length; i++) {
        const line: string = lines[i];
        const fence: RegExpMatchArray | null = line.match(/^```(.*)$/);
        if (fence !== null) {
            flush();
            const info: string = fence[1].trim();
            const content: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith("```")) content.push(lines[i++]);
            const text: string = content.join("\n");
            const claimed: string | null = blockHook === undefined ? null : blockHook(info, text);
            out.push(claimed ?? `<pre><code>${escapeText(text)}\n</code></pre>`);
            continue;
        }
        const heading: RegExpMatchArray | null = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading !== null) {
            flush();
            const level: number = heading[1].length;
            out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
            continue;
        }
        if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
            flush();
            out.push("<hr>");
            continue;
        }
        const quote: RegExpMatchArray | null = line.match(/^>\s?(.*)$/);
        if (quote !== null) {
            flush();
            out.push(`<blockquote>${renderInline(quote[1].trim())}</blockquote>`);
            continue;
        }
        const bullet: RegExpMatchArray | null = line.match(/^[-*]\s+(.*)$/);
        const numbered: RegExpMatchArray | null = line.match(/^\d+\.\s+(.*)$/);
        if (bullet !== null || numbered !== null) {
            flushParagraph();
            const ordered: boolean = numbered !== null;
            if (list !== null && list.ordered !== ordered) flushList();
            if (list === null) list = { ordered, items: [] };
            list.items.push((bullet ?? numbered)![1].trim());
            continue;
        }
        if (line.trim() === "") {
            flush();
            continue;
        }
        flushList();
        paragraph.push(line.trim());
    }
    flush();
    return out.join("\n");
}

export interface PageShellInput {
    title: string;
    /** The lesson's own rendered prose. */
    content: string;
    /** Extra elements placed before the content — the provenance banner, and nothing else yet. */
    lead?: string;
    /** Extra elements placed after the content. */
    trail?: string;
    /** Elements loaded at the end of the body, e.g. the workbook's script. */
    scripts?: string;
}

/**
 * The page's chrome, generated from this one function. Every page in every workbook shares it, so
 * two lessons authored months apart cannot differ in anything but their prose.
 */
export function renderPageShell(input: PageShellInput): string {
    return [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<title>${escapeText(input.title)}</title>`,
        `<link rel="stylesheet" href="./${STYLESHEET_NAME}">`,
        "</head>",
        "<body>",
        input.lead ?? "",
        '<main class="lesson">',
        `<h1 class="lesson-title">${escapeText(input.title)}</h1>`,
        input.content,
        "</main>",
        input.trail ?? "",
        input.scripts ?? "",
        "</body>",
        "</html>",
        "",
    ]
        .filter((part) => part !== "")
        .join("\n");
}

/**
 * The workbook's stylesheet. It declares no colour and no type stack of its own: every one of them
 * resolves from the shared reading-surface definition embedded at the top.
 */
export function renderStylesheet(): string {
    return [
        renderReadingTokensCss(),
        "",
        "/* The workbook's own layout. Every colour and type stack above is the shared reading",
        " * surface; nothing below introduces one. */",
        "body {",
        "    margin: 0;",
        "    background: var(--c-bg);",
        "    color: var(--c-ink);",
        "    font-family: var(--font-sans);",
        "    line-height: 1.6;",
        "}",
        ".lesson {",
        "    max-width: 44rem;",
        "    margin: 0 auto;",
        "    padding: 3rem 1.5rem 6rem;",
        "}",
        ".lesson h1, .lesson h2, .lesson h3 { line-height: 1.25; }",
        ".lesson a { color: var(--c-accent); }",
        ".lesson hr { border: 0; border-top: 1px solid var(--c-line); }",
        ".lesson blockquote {",
        "    margin: 1.5rem 0;",
        "    padding: 0.25rem 1rem;",
        "    border-left: 2px solid var(--c-line);",
        "    color: var(--c-ink-dim);",
        "}",
        ".lesson code {",
        "    font-family: var(--font-mono);",
        "    background: var(--c-term);",
        "    border-radius: var(--radius);",
        "    padding: 0.1em 0.35em;",
        "}",
        ".lesson pre {",
        "    background: var(--c-term);",
        "    border: 1px solid var(--c-term-line);",
        "    border-radius: var(--radius);",
        "    padding: 1rem;",
        "    overflow-x: auto;",
        "}",
        ".lesson pre code { background: none; padding: 0; }",
        "",
    ].join("\n");
}

export interface RenderedFile {
    name: string;
    contents: string;
}

export interface RenderOptions {
    lessons: readonly LessonSource[];
    /** Hook for a fenced block a later stage claims; see `renderMarkdown`. */
    blockHook?: (info: string, content: string) => string | null;
    /** Elements placed before a page's content — the provenance banner. */
    lead?: (lesson: Lesson) => string;
    /** Elements loaded at the end of a page's body. */
    scripts?: (lesson: Lesson) => string;
    /** Files written once per workbook beside the pages, in addition to the stylesheet. */
    sharedAssets?: readonly RenderedFile[];
}

/** The page name a lesson renders to: its own name with the markdown suffix replaced. */
export function pageNameFor(lessonFile: string): string {
    return `${path.basename(lessonFile).replace(/\.mdx?$/, "")}.html`;
}

/**
 * Render every lesson to its page, plus the shared assets. Pure: it produces the whole workbook's
 * bytes or it throws, and it touches no filesystem.
 */
export function renderWorkbook(options: RenderOptions): RenderedFile[] {
    const pages: RenderedFile[] = [];
    for (const source of options.lessons) {
        const lesson: Lesson = parseLesson(source);
        pages.push({
            name: pageNameFor(lesson.file),
            contents: renderPageShell({
                title: lesson.title,
                content: renderMarkdown(lesson.body, options.blockHook),
                lead: options.lead?.(lesson),
                scripts: options.scripts?.(lesson),
            }),
        });
    }
    const assets: RenderedFile[] = [
        { name: STYLESHEET_NAME, contents: renderStylesheet() },
        ...(options.sharedAssets ?? []),
    ];
    return [...pages, ...assets].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Write a rendered workbook into its folder. The whole render happens first, so a lesson that
 * fails leaves the folder untouched; and the previous render's pages are cleared, so no stale page
 * survives a lesson being removed or renamed.
 */
export function writeWorkbook(outDir: string, files: readonly RenderedFile[]): string[] {
    fs.mkdirSync(outDir, { recursive: true });
    for (const existing of fs.readdirSync(outDir)) {
        if (existing.endsWith(".html") || existing === STYLESHEET_NAME) {
            fs.rmSync(path.join(outDir, existing), { force: true });
        }
    }
    const written: string[] = [];
    for (const file of files) {
        fs.writeFileSync(path.join(outDir, file.name), file.contents);
        written.push(file.name);
    }
    return written;
}
