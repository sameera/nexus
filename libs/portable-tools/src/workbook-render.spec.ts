// @vitest-environment jsdom
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    LessonRenderError,
    STYLESHEET_NAME,
    checkWorkbook,
    renderStylesheet,
    renderWorkbook,
    renderWorkbookInto,
    writeWorkbook,
    type LessonSource,
    type RenderedFile,
} from "./workbook-render";
import { readPage } from "./workbook-page-fixtures";
import { SCRIPT_NAME } from "./workbook-widgets";
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
        const page = readPage(pageOf(files, "the-widget-seam.html"));

        expect(source.source).not.toMatch(/<[a-z]/i);
        expect(page.title).toBe("The widget seam");
        expect(page.text).toContain("A widget is an inert declaration in the prose.");
        expect(page.emphasised).toContain("inert");
        expect(page.headings).toContain("Why it is inert");
        expect(page.listItems).toContain("it resolves at render time");
        expect(page.links).toContainEqual({ label: "record", href: "./record.html" });
    });

    it("renders a code block as code rather than as page structure", () => {
        const source = lesson("code.md", "Code", ["```bash", "nexus excluded-stores", "```"].join("\n"));

        const page = readPage(pageOf(renderWorkbook({ lessons: [source] }), "code.html"));

        expect(page.code).toContain("nexus excluded-stores");
        expect(page.text).toContain("nexus excluded-stores");
    });

    it("shows a lesson's angle brackets to the reader instead of acting on them", () => {
        const source = lesson("escapes.md", "Escapes", "Compare `a > b` and `a & b`.");

        const page = readPage(pageOf(renderWorkbook({ lessons: [source] }), "escapes.html"));

        expect(page.code).toContain("a > b");
        expect(page.code).toContain("a & b");
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
        // The chrome is everything a reader meets that is not this lesson's own words: the
        // navigation, the styling, the runtime, and the shape of the provenance sentence. Two
        // pages authored months apart must present all of it identically.
        const first = readPage(pageOf(files, "early.html"));
        const second = readPage(pageOf(files, "late.html"));

        expect(first.chrome).toEqual(second.chrome);
        expect(first.navigation).toEqual(["Early", "Late"]);
        expect(files.filter((f) => f.name === STYLESHEET_NAME)).toHaveLength(1);
    });

    it("shows a slice with no lesson yet as not written rather than as a link", () => {
        const files = renderWorkbook({
            lessons: [lesson("01-drift.md", "Drift", "The first lesson.")],
            stubs: ["Story #464", "Story #465"],
        });

        const page = readPage(pageOf(files, "01-drift.html"));
        expect(page.navigation).toEqual(["Drift", "Story #464 — not yet written", "Story #465 — not yet written"]);
        expect(page.links.map((l) => l.label)).not.toContain("Story #464 — not yet written");
    });

    it("references the one stylesheet by relative path instead of carrying a copy", () => {
        const files = renderWorkbook({ lessons: [lesson("a.md", "A", "prose"), lesson("b.md", "B", "prose")] });

        for (const name of ["a.html", "b.html"]) {
            expect(readPage(pageOf(files, name)).stylesheets).toEqual([`./${STYLESHEET_NAME}`]);
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

        expect(written.sort()).toEqual(["a.html", STYLESHEET_NAME, SCRIPT_NAME].sort());
        expect(fs.readdirSync(out).sort()).toEqual(["a.html", STYLESHEET_NAME, SCRIPT_NAME].sort());
    });

    it("leaves no page at all behind when a lesson fails — not even the last render's", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose")] });

        expect(() =>
            renderWorkbookInto(out, {
                lessons: [lesson("a.md", "A", "changed"), lesson("b.md", "B", "<hr/>")],
            }),
        ).toThrow(LessonRenderError);

        // A page a learner could still open after a failed render would be one that no longer
        // matches the lesson that produced it, and nothing on the page would say so.
        expect(fs.readdirSync(out)).toEqual([]);
    });

    it("renders again cleanly once the lesson that failed is fixed", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose")] });
        expect(() => renderWorkbookInto(out, { lessons: [lesson("b.md", "B", "<hr/>")] })).toThrow();

        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose"), lesson("b.md", "B", "fixed")] });

        expect(readPage(fs.readFileSync(path.join(out, "b.html"), "utf8")).text).toContain("fixed");
    });

    it("leaves no stale page behind when a lesson is removed", () => {
        const out = makeDir();
        writeWorkbook(out, renderWorkbook({ lessons: [lesson("a.md", "A", "prose"), lesson("b.md", "B", "prose")] }));

        writeWorkbook(out, renderWorkbook({ lessons: [lesson("a.md", "A", "prose")] }));

        expect(fs.readdirSync(out).sort()).toEqual(["a.html", STYLESHEET_NAME, SCRIPT_NAME].sort());
    });
});

describe("a committed page that has drifted from its lesson is reported", () => {
    it("says nothing while every committed file is what the lessons render to", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose"), lesson("b.md", "B", "more")] });

        expect(checkWorkbook(out, { lessons: [lesson("a.md", "A", "prose"), lesson("b.md", "B", "more")] }))
            .toEqual([]);
    });

    it("names a page someone edited by hand rather than re-rendering", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose")] });
        fs.writeFileSync(path.join(out, "a.html"), "<p>edited by hand</p>\n");

        const drift = checkWorkbook(out, { lessons: [lesson("a.md", "A", "prose")] });

        expect(drift).toEqual([{ name: "a.html", state: "changed" }]);
    });

    it("names a page whose lesson changed since it was rendered", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose")] });

        const drift = checkWorkbook(out, { lessons: [lesson("a.md", "A", "the lesson says something else")] });

        expect(drift).toEqual([{ name: "a.html", state: "changed" }]);
    });

    it("names a lesson that was never rendered and a page whose lesson is gone", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose"), lesson("gone.md", "Gone", "old")] });

        const drift = checkWorkbook(out, { lessons: [lesson("a.md", "A", "prose"), lesson("new.md", "New", "b")] });

        expect(drift).toContainEqual({ name: "gone.html", state: "extra" });
        expect(drift).toContainEqual({ name: "new.html", state: "missing" });
        // The surviving page names its neighbours, so replacing one lesson dates the other's page too.
        expect(drift).toContainEqual({ name: "a.html", state: "changed" });
    });

    it("reports the drift and repairs nothing", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose")] });
        fs.writeFileSync(path.join(out, "a.html"), "<p>edited by hand</p>\n");

        checkWorkbook(out, { lessons: [lesson("a.md", "A", "prose")] });

        expect(fs.readFileSync(path.join(out, "a.html"), "utf8")).toBe("<p>edited by hand</p>\n");
    });

    it("reports a workbook that was never rendered as wholly missing", () => {
        const out = makeDir();

        expect(checkWorkbook(out, { lessons: [lesson("a.md", "A", "prose")] }).map((d) => d.name)).toEqual([
            "a.html",
            STYLESHEET_NAME,
            SCRIPT_NAME,
        ]);
    });

    it("fails the check for a lesson it cannot render, leaving the pages alone", () => {
        const out = makeDir();
        renderWorkbookInto(out, { lessons: [lesson("a.md", "A", "prose")] });

        expect(() => checkWorkbook(out, { lessons: [lesson("a.md", "A", "<hr/>")] })).toThrow(LessonRenderError);
        expect(fs.existsSync(path.join(out, "a.html"))).toBe(true);
    });
});
