import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    LessonRenderError,
    STYLESHEET_NAME,
    renderStylesheet,
    renderWorkbook,
    writeWorkbook,
    type LessonSource,
    type RenderedFile,
} from "./workbook-render";
import { READING_TOKEN_NAMES, renderReadingTokensCss } from "./reading-tokens";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-render-"));
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
function pageOf(files: readonly RenderedFile[], name: string): string {
    const found = files.find((f) => f.name === name);
    if (found === undefined) throw new Error(`no page named ${name}`);
    return found.contents;
}

describe("a lesson's markdown and front matter become a page", () => {
    it("puts the lesson's prose on a page a browser opens, from a file carrying no markup", () => {
        const source = lesson(
            "the-widget-seam.md",
            "The widget seam",
            [
                "A widget is an **inert** declaration in the prose.",
                "",
                "## Why it is inert",
                "",
                "- it resolves at render time",
                "- it fetches nothing",
                "",
                "See the [record](./record.html).",
            ].join("\n"),
        );

        const files = renderWorkbook({ lessons: [source] });
        const page = pageOf(files, "the-widget-seam.html");

        expect(source.source).not.toMatch(/<[a-z]/i);
        expect(page).toContain("<!doctype html>");
        expect(page).toContain("<title>The widget seam</title>");
        expect(page).toContain("<strong>inert</strong>");
        expect(page).toContain("<h2>Why it is inert</h2>");
        expect(page).toContain("<li>it resolves at render time</li>");
        expect(page).toContain('<a href="./record.html">record</a>');
    });

    it("renders a code block as code rather than as page structure", () => {
        const source = lesson("code.md", "Code", ["```bash", "nexus excluded-stores", "```"].join("\n"));

        const page = pageOf(renderWorkbook({ lessons: [source] }), "code.html");

        expect(page).toContain("<pre><code>nexus excluded-stores\n</code></pre>");
    });

    it("shows a lesson's angle brackets to the reader instead of acting on them", () => {
        const source = lesson("escapes.md", "Escapes", "Compare `a > b` and `a & b`.");

        const page = pageOf(renderWorkbook({ lessons: [source] }), "escapes.html");

        expect(page).toContain("<code>a &gt; b</code>");
        expect(page).toContain("<code>a &amp; b</code>");
    });
});

describe("the channel through which markup could reach a page is closed", () => {
    it("fails the render and names the lesson that carried markup", () => {
        const source = lesson("bad.md", "Bad", 'A <div class="card">card</div> in the prose.');

        expect(() => renderWorkbook({ lessons: [source] })).toThrow(LessonRenderError);
        expect(() => renderWorkbook({ lessons: [source] })).toThrow(/bad\.md/);
        expect(() => renderWorkbook({ lessons: [source] })).toThrow(/may never carry any/);
    });

    it("fails on a comment too, because a comment is still a channel", () => {
        const source = lesson("bad.md", "Bad", "Prose <!-- and a smuggled note -->.");

        expect(() => renderWorkbook({ lessons: [source] })).toThrow(/markup-in-lesson/);
    });

    it("names the lesson when its front matter is unusable", () => {
        expect(() => renderWorkbook({ lessons: [{ file: "no-fm.md", source: "just prose\n" }] })).toThrow(
            /no-fm\.md/,
        );
        expect(() =>
            renderWorkbook({ lessons: [{ file: "no-title.md", source: "---\nslug: x\n---\n\nprose\n" }] }),
        ).toThrow(/no-title\.md.*'title'/s);
    });
});

describe("two lessons authored months apart come out identical but for their prose", () => {
    it("shares chrome and styling exactly", () => {
        const early = lesson("early.md", "Early", "The first lesson.");
        const late = lesson("late.md", "Late", "The last lesson.");

        const files = renderWorkbook({ lessons: [early, late] });
        // Strip everything that is this lesson's own — its name, its title and its prose — and what
        // remains is the chrome. Two pages must be identical there.
        const strip = (page: string): string =>
            page
                .replace(/<!--[\s\S]*?-->/, "")
                .replace(/<nav class="workbook-nav"[\s\S]*?<\/nav>/, "")
                .replace(/<footer class="lesson-provenance">[\s\S]*?<\/footer>/, "")
                .replace(/<title>.*<\/title>/, "")
                .replace(/<h1 class="lesson-title">.*<\/h1>/, "")
                .replace(/<p>.*<\/p>/, "");

        expect(strip(pageOf(files, "early.html"))).toBe(strip(pageOf(files, "late.html")));
        expect(files.filter((f) => f.name === STYLESHEET_NAME)).toHaveLength(1);
    });

    it("references the one stylesheet by relative path instead of carrying a copy", () => {
        const files = renderWorkbook({ lessons: [lesson("a.md", "A", "prose"), lesson("b.md", "B", "prose")] });

        for (const name of ["a.html", "b.html"]) {
            expect(pageOf(files, name)).toContain(`<link rel="stylesheet" href="./${STYLESHEET_NAME}">`);
            expect(pageOf(files, name)).not.toContain("--c-ink");
        }
    });

    it("renders byte-identical output from identical input", () => {
        const lessons = [lesson("a.md", "A", "prose"), lesson("b.md", "B", "more prose")];

        expect(renderWorkbook({ lessons })).toEqual(renderWorkbook({ lessons }));
        expect(renderWorkbook({ lessons: [...lessons].reverse() }).map((f) => f.name)).toEqual(
            renderWorkbook({ lessons }).map((f) => f.name),
        );
    });
});

describe("the workbook declares no colour or typography of its own", () => {
    it("resolves every value from the shared reading-surface definition", () => {
        const css = renderStylesheet();

        expect(css).toContain(renderReadingTokensCss());
        // Everything after the shared definition is layout. The only assignments of a literal value
        // are inside @media print, and each of them assigns a shared token name (invariant 19).
        const layout = css.slice(renderReadingTokensCss().length);
        const printStart = layout.indexOf("@media print");
        const screen = layout.slice(0, printStart);
        const print = layout.slice(printStart);
        const literal = /#[0-9a-f]{3,8}\b|rgba?\(|font-family: (?!var\()/i;

        expect(screen.split("\n").filter((l) => literal.test(l))).toEqual([]);
        for (const line of print.split("\n").filter((l) => literal.test(l))) {
            expect(READING_TOKEN_NAMES.some((t) => line.trim().startsWith(`${t}:`))).toBe(true);
        }
    });

    it("presents the same colours and typography as the application, from one definition", () => {
        const appCss = fs.readFileSync(path.join(REPO_ROOT, "apps", "prime", "app", "app.css"), "utf8");
        const generated = fs.readFileSync(
            path.join(REPO_ROOT, "apps", "prime", "app", "reading-tokens.css"),
            "utf8",
        );

        expect(generated).toBe(renderReadingTokensCss());
        expect(appCss).toContain('@import "./reading-tokens.css";');
        for (const token of READING_TOKEN_NAMES) {
            expect(appCss).not.toMatch(new RegExp(`^\\s*${token}:`, "m"));
        }
    });
});

describe("the render produces the whole workbook or nothing", () => {
    it("writes every page and the stylesheet together", () => {
        const out = makeDir();

        const written = writeWorkbook(out, renderWorkbook({ lessons: [lesson("a.md", "A", "prose")] }));

        expect(written.sort()).toEqual(["a.html", STYLESHEET_NAME]);
        expect(fs.readdirSync(out).sort()).toEqual(["a.html", STYLESHEET_NAME]);
    });

    it("leaves an earlier render untouched when a later lesson fails", () => {
        const out = makeDir();
        writeWorkbook(out, renderWorkbook({ lessons: [lesson("a.md", "A", "prose")] }));
        const before = fs.readFileSync(path.join(out, "a.html"), "utf8");

        expect(() =>
            writeWorkbook(
                out,
                renderWorkbook({ lessons: [lesson("a.md", "A", "changed"), lesson("b.md", "B", "<hr/>")] }),
            ),
        ).toThrow(LessonRenderError);

        expect(fs.readFileSync(path.join(out, "a.html"), "utf8")).toBe(before);
        expect(fs.existsSync(path.join(out, "b.html"))).toBe(false);
    });

    it("leaves no stale page behind when a lesson is removed", () => {
        const out = makeDir();
        writeWorkbook(out, renderWorkbook({ lessons: [lesson("a.md", "A", "prose"), lesson("b.md", "B", "prose")] }));

        writeWorkbook(out, renderWorkbook({ lessons: [lesson("a.md", "A", "prose")] }));

        expect(fs.readdirSync(out).sort()).toEqual(["a.html", STYLESHEET_NAME]);
    });
});
