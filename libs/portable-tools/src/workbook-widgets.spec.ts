import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderStylesheet, renderWorkbook, writeWorkbook, type LessonSource } from "./workbook-render";
import {
    SCRIPT_NAME,
    WIDGET_MANIFEST,
    WidgetError,
    renderScript,
    type WidgetRegistry,
} from "./workbook-widgets";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-widgets-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

/** A library standing in for the one the runtime ships, which starts empty. */
const LIBRARY: WidgetRegistry = {
    "check-your-understanding": {
        summary: (data) => `Show the answer to: ${String(data["question"] ?? "")}`,
        render: (data) => `<p class="answer">${String(data["answer"] ?? "")}</p>`,
    },
};

function lessonWith(declaration: string): LessonSource {
    return {
        file: "the-store.md",
        source: [
            "---",
            "title: The workbook store",
            "---",
            "",
            "The store sits beside the queue.",
            "",
            "```widget",
            declaration,
            "```",
            "",
            "And that is the whole rule.",
        ].join("\n"),
    };
}

const DECLARATION: string = [
    "component: check-your-understanding",
    "data:",
    "  question: where does the store live?",
    "  answer: beside the queue, under the Nexus root",
].join("\n");

describe("a declaration resolves to a component from the shared library", () => {
    it("puts the component's content on the page, at the point the lesson declared it", () => {
        const page = renderWorkbook({ lessons: [lessonWith(DECLARATION)], widgets: LIBRARY }).find(
            (f) => f.name === "the-store.html",
        )!.contents;

        expect(page).toContain("beside the queue, under the Nexus root");
        expect(page).toContain('data-widget="check-your-understanding"');
        expect(page.indexOf("The store sits beside the queue.")).toBeLessThan(page.indexOf("data-widget"));
        expect(page.indexOf("data-widget")).toBeLessThan(page.indexOf("And that is the whole rule."));
    });

    it("leaves the authored lesson ordinary markdown, carrying no markup", () => {
        expect(lessonWith(DECLARATION).source).not.toMatch(/<[a-z]/i);
    });

    it("draws from a library shared by every lesson, and ships that library empty", () => {
        const two = renderWorkbook({
            lessons: [lessonWith(DECLARATION), { ...lessonWith(DECLARATION), file: "other.md" }],
            widgets: LIBRARY,
        });

        for (const name of ["the-store.html", "other.html"]) {
            expect(two.find((f) => f.name === name)!.contents).toContain("beside the queue, under the Nexus root");
        }
        expect(Object.keys(WIDGET_MANIFEST)).toEqual([]);
    });

    it("leaves an ordinary code block alone", () => {
        const source: LessonSource = {
            file: "code.md",
            source: ["---", "title: Code", "---", "", "```bash", "nexus excluded-stores", "```"].join("\n"),
        };

        const page = renderWorkbook({ lessons: [source], widgets: LIBRARY }).find((f) => f.name === "code.html")!
            .contents;

        expect(page).toContain("<pre><code>nexus excluded-stores");
        expect(page).not.toContain("data-widget");
    });
});

describe("a component the library does not hold fails the whole render", () => {
    it("names the missing component instead of producing a page with a hole in it", () => {
        const source = lessonWith("component: does-not-exist");

        expect(() => renderWorkbook({ lessons: [source], widgets: LIBRARY })).toThrow(WidgetError);
        expect(() => renderWorkbook({ lessons: [source], widgets: LIBRARY })).toThrow(/does-not-exist/);
        expect(() => renderWorkbook({ lessons: [source], widgets: LIBRARY })).toThrow(/the-store\.md/);
    });

    it("renders no page at all, not even the lessons that would have succeeded", () => {
        const out = makeDir();
        const good: LessonSource = { file: "good.md", source: "---\ntitle: Good\n---\n\nprose\n" };

        expect(() =>
            writeWorkbook(
                out,
                renderWorkbook({ lessons: [good, lessonWith("component: does-not-exist")], widgets: LIBRARY }),
            ),
        ).toThrow(WidgetError);

        expect(fs.readdirSync(out)).toEqual([]);
    });

    it("refuses a declaration that names no component", () => {
        expect(() => renderWorkbook({ lessons: [lessonWith("data:\n  a: 1")], widgets: LIBRARY })).toThrow(
            /names no component/,
        );
    });
});

describe("a widget the learner has not touched still prints", () => {
    it("has its content in the page at render time, not behind the interaction", () => {
        const page = renderWorkbook({ lessons: [lessonWith(DECLARATION)], widgets: LIBRARY }).find(
            (f) => f.name === "the-store.html",
        )!.contents;

        expect(page).toContain("beside the queue, under the Nexus root");
        expect(page).toContain('<div class="widget-content" hidden>');
    });

    it("puts that content on the paper and leaves the reveal control off it", () => {
        const css = renderStylesheet();
        const printBlock = css.slice(css.lastIndexOf("@media print"));

        expect(printBlock).toContain(".widget-content[hidden] { display: block !important; }");
        expect(printBlock).toContain(".widget-reveal { display: none; }");
    });

    it("changes only what is visible when the learner does interact", () => {
        const script = renderScript();

        expect(script).toContain("hidden");
        expect(script).not.toMatch(/fetch\(|XMLHttpRequest|innerHTML|import\(/);
    });
});

describe("the runtime travels inside the toolkit", () => {
    it("is written once per workbook and loaded as a classic script", () => {
        const files = renderWorkbook({ lessons: [lessonWith(DECLARATION)], widgets: LIBRARY });

        expect(files.filter((f) => f.name === SCRIPT_NAME)).toHaveLength(1);
        const page = files.find((f) => f.name === "the-store.html")!.contents;
        expect(page).toContain(`<script src="./${SCRIPT_NAME}"></script>`);
        expect(page).not.toContain('type="module"');
    });
});
