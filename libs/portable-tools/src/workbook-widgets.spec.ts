// @vitest-environment jsdom
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderStylesheet, renderWorkbook, renderWorkbookInto, type LessonSource } from "./workbook-render";
import { printPage, readPage } from "./workbook-page-fixtures";
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

        const read = readPage(page);
        const [widget] = read.controls;
        expect(widget.label).toContain("where does the store live?");
        expect(widget.content).toContain("beside the queue, under the Nexus root");
        // The widget sits where the lesson put it: after the prose above it, before the prose below.
        expect(read.text.indexOf("The store sits beside the queue.")).toBeLessThan(read.text.indexOf(widget.label));
        expect(read.text.indexOf(widget.label)).toBeLessThan(read.text.indexOf("And that is the whole rule."));
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
            const read = readPage(two.find((f) => f.name === name)!.contents);
            expect(read.controls[0].content).toContain("beside the queue, under the Nexus root");
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

        const read = readPage(page);
        expect(read.code).toContain("nexus excluded-stores");
        expect(read.controls).toEqual([]);
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
            renderWorkbookInto(out, {
                lessons: [good, lessonWith("component: does-not-exist")],
                widgets: LIBRARY,
            }),
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

        const read = readPage(page);
        // The answer is in the page a learner has not touched; the reveal only stops it showing.
        expect(read.text).toContain("beside the queue, under the Nexus root");
        expect(read.visibleText).not.toContain("beside the queue, under the Nexus root");
        expect(read.controls[0].showing).toBe(false);
    });

    it("puts that content on the paper and leaves the reveal control off it", () => {
        const page = renderWorkbook({ lessons: [lessonWith(DECLARATION)], widgets: LIBRARY }).find(
            (f) => f.name === "the-store.html",
        )!.contents;

        const printed = printPage(page, renderStylesheet());

        expect(printed.shows("beside the queue, under the Nexus root")).toBe(true);
        expect(printed.shows("Show the answer to: where does the store live?")).toBe(false);
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
        const read = readPage(files.find((f) => f.name === "the-store.html")!.contents);
        expect(read.scripts).toEqual([{ src: `./${SCRIPT_NAME}`, module: false }]);
    });
});
