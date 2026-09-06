import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET_NAME, renderStylesheet, renderWorkbook, writeWorkbook, type LessonSource } from "./workbook-render";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-offline-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

function lesson(file: string, title: string, body: string): LessonSource {
    return { file, source: `---\ntitle: ${title}\n---\n\n${body}` };
}
const LESSONS: LessonSource[] = [
    lesson("the-store.md", "The workbook store", "The store sits beside the queue."),
    lesson("the-renderer.md", "The renderer", "The renderer turns prose into a page."),
];

/** Every URL a page asks the browser to resolve. */
function referencedUrls(page: string): string[] {
    return [...page.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
}

describe("a rendered page opens on a machine with no network", () => {
    it("resolves every asset it needs from a file beside it", () => {
        const out = makeDir();

        writeWorkbook(out, renderWorkbook({ lessons: LESSONS }));

        const present = new Set(fs.readdirSync(out));
        for (const name of ["the-store.html", "the-renderer.html"]) {
            for (const url of referencedUrls(fs.readFileSync(path.join(out, name), "utf8"))) {
                expect(url.startsWith("./")).toBe(true);
                expect(present.has(url.slice(2))).toBe(true);
            }
        }
        expect(present.has(STYLESHEET_NAME)).toBe(true);
    });

    it("makes no request that would leave the machine", () => {
        const files = renderWorkbook({ lessons: LESSONS });

        for (const file of files) {
            expect(file.contents).not.toMatch(/https?:\/\//);
            expect(file.contents).not.toMatch(/(?:href|src)="\/\//);
            expect(file.contents).not.toMatch(/@import\s+url\(/);
        }
    });

    it("loads nothing that needs a module loader or a running process", () => {
        for (const file of renderWorkbook({ lessons: LESSONS })) {
            expect(file.contents).not.toContain('type="module"');
            expect(file.contents).not.toContain("import(");
            expect(file.contents).not.toMatch(/(?:href|src)="\//);
        }
    });

    it("displays completely from a folder holding nothing but the render", () => {
        const out = makeDir();
        writeWorkbook(out, renderWorkbook({ lessons: LESSONS }));

        const page = fs.readFileSync(path.join(out, "the-store.html"), "utf8");

        expect(page).toContain("The store sits beside the queue.");
        expect(page).toContain("</html>");
        expect(fs.readdirSync(out).sort()).toEqual(["the-renderer.html", "the-store.html", STYLESHEET_NAME]);
    });
});

describe("a rendered page says it was generated", () => {
    it("names the authored file it came from, as the first content in the file", () => {
        const page = renderWorkbook({ lessons: LESSONS }).find((f) => f.name === "the-store.html")!.contents;

        const firstContent = page.slice(0, page.indexOf("<!doctype html>"));
        expect(firstContent).toContain("generated");
        expect(firstContent).toContain("the-store.md");
        expect(firstContent.trim().startsWith("<!--")).toBe(true);
    });

    it("tells a reader of the page the same thing it tells a reader of the diff", () => {
        const page = renderWorkbook({ lessons: LESSONS }).find((f) => f.name === "the-store.html")!.contents;

        expect(page).toContain("Generated from the authored lesson");
        expect(page).toContain("<code>the-store.md</code>");
    });
});

describe("a printed page is readable on paper", () => {
    it("prints ink on white whatever the screen theme is", () => {
        const printBlock = renderStylesheet().slice(renderStylesheet().indexOf("@media print"));

        expect(printBlock).toContain("--c-bg: #ffffff;");
        expect(printBlock).toContain("--c-ink: #000000;");
        for (const theme of [":root", '[data-theme="dark"]', '[data-theme="light"]']) {
            expect(printBlock).toContain(theme);
        }
    });

    it("leaves the navigation chrome off the paper and keeps the lesson on it", () => {
        const css = renderStylesheet();
        const printBlock = css.slice(css.indexOf("@media print"));
        const page = renderWorkbook({ lessons: LESSONS }).find((f) => f.name === "the-store.html")!.contents;

        expect(page).toContain('<nav class="workbook-nav"');
        expect(printBlock).toContain(".workbook-nav { display: none; }");
        expect(printBlock).not.toMatch(/\.lesson\s*\{[^}]*display:\s*none/);
    });
});
