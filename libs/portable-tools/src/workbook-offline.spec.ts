// @vitest-environment jsdom
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { STYLESHEET_NAME, renderStylesheet, renderWorkbook, writeWorkbook, type LessonSource } from "./workbook-render";
import { printPage, readPage } from "./workbook-page-fixtures";
import { SCRIPT_NAME } from "./workbook-widgets";

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

describe("a rendered page opens on a machine with no network", () => {
    it("resolves every asset it needs from a file beside it", () => {
        const out = makeDir();

        writeWorkbook(out, renderWorkbook({ lessons: LESSONS }));

        const present = new Set(fs.readdirSync(out));
        for (const name of ["the-store.html", "the-renderer.html"]) {
            const page = readPage(fs.readFileSync(path.join(out, name), "utf8"));
            expect(page.assets.length).toBeGreaterThan(0);
            for (const url of page.assets) {
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
        const files = renderWorkbook({ lessons: LESSONS });

        for (const file of files.filter((f) => f.name.endsWith(".html"))) {
            const page = readPage(file.contents);
            expect(page.scripts.every((script) => !script.module)).toBe(true);
            expect(page.assets.every((url) => !url.startsWith("/"))).toBe(true);
        }
        for (const file of files.filter((f) => !f.name.endsWith(".html"))) {
            expect(file.contents).not.toContain("import(");
        }
    });

    it("displays completely from a folder holding nothing but the render", () => {
        const out = makeDir();
        writeWorkbook(out, renderWorkbook({ lessons: LESSONS }));

        const page = readPage(fs.readFileSync(path.join(out, "the-store.html"), "utf8"));

        expect(page.title).toBe("The workbook store");
        expect(page.visibleText).toContain("The store sits beside the queue.");
        expect(fs.readdirSync(out).sort()).toEqual(
            ["the-renderer.html", "the-store.html", STYLESHEET_NAME, SCRIPT_NAME].sort(),
        );
    });
});

describe("a rendered page says it was generated", () => {
    it("names the authored file it came from, as the first content in the file", () => {
        const page = renderWorkbook({ lessons: LESSONS }).find((f) => f.name === "the-store.html")!.contents;

        const read = readPage(page);
        expect(read.firstContent).toContain("generated");
        expect(read.firstContent).toContain("the-store.md");
        expect(read.firstContent.trim()).not.toBe("");
    });

    it("tells a reader of the page the same thing it tells a reader of the diff", () => {
        const page = renderWorkbook({ lessons: LESSONS }).find((f) => f.name === "the-store.html")!.contents;

        const read = readPage(page);
        expect(read.visibleText).toContain("Generated from the authored lesson");
        expect(read.visibleText).toContain("the-store.md");
    });
});

describe("a printed page is readable on paper", () => {
    it("prints ink on white whatever the screen theme is", () => {
        const page = renderWorkbook({ lessons: LESSONS }).find((f) => f.name === "the-store.html")!.contents;

        const printed = printPage(page, renderStylesheet());

        // Whatever the reader had on screen, the paper is white and the words are black — a dark
        // reading surface printed is unreadable.
        expect(printed.colours["--c-bg"]).toBe("#ffffff");
        expect(printed.colours["--c-ink"]).toBe("#000000");
        for (const [token, value] of Object.entries(printed.colours)) {
            expect([token, value]).toEqual([token, expect.stringMatching(/^#(ffffff|000000)$/)]);
        }
    });

    it("leaves the navigation chrome off the paper and keeps the lesson on it", () => {
        const rendered = renderWorkbook({ lessons: LESSONS }).find((f) => f.name === "the-store.html")!.contents;

        const onScreen = readPage(rendered);
        const printed = printPage(rendered, renderStylesheet());

        expect(onScreen.navigation).toEqual(["The workbook store", "The renderer"]);
        expect(printed.shows("The renderer")).toBe(false);
        expect(printed.shows("The store sits beside the queue.")).toBe(true);
    });
});
