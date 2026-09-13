// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderStylesheet, renderWorkbook, type LessonSource, type RenderedFile } from "./workbook-render";
import { printPage } from "./workbook-page-fixtures";
import { openPage } from "./workbook-learner-fixtures";
import { WIDGET_MANIFEST, WidgetError } from "./workbook-widgets";

const PAGE: string = "ordering.html";

function declaration(lines: readonly string[] | null, prompt: string = "Put the lines in order."): string {
    return [
        "component: parsons-problem",
        "data:",
        `  prompt: ${JSON.stringify(prompt)}`,
        ...(lines === null ? [] : ["  lines:", ...lines.map((line) => `    - ${JSON.stringify(line)}`)]),
    ].join("\n");
}

function lessonWith(...declarations: string[]): LessonSource {
    return {
        file: "ordering.md",
        source: ["---", "title: Ordering", "---", "", "Order the lines.", "", ...declarations.flatMap((d) => ["```widget", d, "```", ""])].join("\n"),
    };
}

const EXPECTED: readonly string[] = [
    "function firstLine(text: string): string {",
    "    const end: number = text.indexOf(\"\\n\");",
    "    if (end < 0) return text;",
    "    return text.slice(0, end);",
    "}",
];

function render(...declarations: string[]): RenderedFile[] {
    return renderWorkbook({ lessons: [lessonWith(...(declarations.length === 0 ? [declaration(EXPECTED)] : declarations))] });
}

/** Put the learner's lines into the expected order using only the move controls. */
function solve(page: ReturnType<typeof openPage>, expected: readonly string[]): void {
    for (let target = 0; target < expected.length; target++) {
        let at: number = page.lines().indexOf(expected[target], target);
        while (at > target) {
            page.moveEarlier(at);
            at -= 1;
        }
    }
}

describe("a Parsons problem opens with its lines out of order", () => {
    it("is in the shared library", () => {
        expect(Object.keys(WIDGET_MANIFEST)).toContain("parsons-problem");
    });

    it("shows every line, in an order that is not the expected one", () => {
        const page = openPage(render(), PAGE);

        expect([...page.lines()].sort()).toEqual([...EXPECTED].sort());
        expect(page.lines()).not.toEqual(EXPECTED);
        for (const line of EXPECTED) expect(page.visibleText()).toContain(line.trim());
    });

    it("never opens solved, whatever the lines are", () => {
        const samples: string[][] = [
            ["a", "b"],
            ["b", "a"],
            ["x", "x", "y"],
            ["y", "x", "x"],
            ["one", "two", "three", "four", "five", "six", "seven", "eight"],
            ["return a;", "return  a ;", "b"],
        ];
        for (const lines of samples) {
            const page = openPage(render(declaration(lines)), PAGE);
            page.check();
            expect(page.result()).toMatch(/not/i);
        }
    });

    it("meets a learner who reloads with the same problem, because the shuffle is written into the page", () => {
        const first = render();
        const second = render();

        expect(second.map((f) => f.contents)).toEqual(first.map((f) => f.contents));
        expect(openPage(second, PAGE).lines()).toEqual(openPage(first, PAGE).lines());
    });

    it("shows code that reads like markup as code", () => {
        const page = openPage(render(declaration(["const xs: Array<number> = [];", "if (i<n) xs.push(i);"])), PAGE);

        expect([...page.lines()].sort()).toEqual(["const xs: Array<number> = [];", "if (i<n) xs.push(i);"].sort());
    });
});

describe("the learner moves lines", () => {
    it("changes the order one position at a time, never losing or duplicating a line", () => {
        const page = openPage(render(), PAGE);
        const before: string[] = page.lines();

        page.moveLater(0);
        const after: string[] = page.lines();

        expect(after).not.toEqual(before);
        expect(after[1]).toBe(before[0]);
        expect(after[0]).toBe(before[1]);
        expect([...after].sort()).toEqual([...before].sort());

        page.moveEarlier(after.length - 1);
        page.moveEarlier(0);
        page.moveLater(after.length - 1);
        expect([...page.lines()].sort()).toEqual([...EXPECTED].sort());
    });

    it("keeps focus on the moved line and says where it went", () => {
        const page = openPage(render(), PAGE);
        const moved: string = page.lines()[2];

        page.moveEarlier(2);

        expect(page.focusedLine()).toBe(moved);
        expect(page.lines()[1]).toBe(moved);
        expect(page.announcement()).toMatch(/2/);
    });

    it("moves with controls a keyboard can reach", () => {
        expect(openPage(render(), PAGE).movesWorkFromKeyboard()).toBe(true);
    });

    it("keeps each line's own indentation, so only order is being asked about", () => {
        const page = openPage(render(), PAGE);

        expect(page.lines()).toContain("    if (end < 0) return text;");
    });
});

describe("the learner asks for the order to be checked", () => {
    it("says the order is wrong until it matches, and right once it does", () => {
        const page = openPage(render(), PAGE);

        page.check();
        expect(page.result()).toMatch(/not/i);

        solve(page, EXPECTED);
        expect(page.lines()).toEqual(EXPECTED);
        page.check();

        expect(page.result()).toMatch(/right|correct|matches/i);
        expect(page.reachedFor).toEqual([]);
    });

    it("is told the result the same way fill-the-signature tells it", () => {
        const files = renderWorkbook({
            lessons: [
                lessonWith(
                    declaration(EXPECTED),
                    ["component: fill-the-signature", "data:", "  prompt: p", "  answer: \"f(): void\""].join("\n"),
                ),
            ],
        });
        const page = openPage(files, PAGE);

        page.check(0);
        page.check(1);

        expect(page.result(0)).toBe(page.result(1));
        expect(page.resultIsAnnounced(0)).toBe(true);
    });

    it("clears the result as soon as a line moves", () => {
        const page = openPage(render(), PAGE);

        page.check();
        page.moveLater(0);

        expect(page.result()).toBe("");
    });

    it("treats identical lines as interchangeable", () => {
        const lines: string[] = ["open()", "tick()", "tick()", "close()"];
        const page = openPage(render(declaration(lines)), PAGE);

        solve(page, lines);
        page.check();

        expect(page.result()).toMatch(/right|correct|matches/i);
    });

    it("lets the expected order be revealed on screen only after a check", () => {
        const page = openPage(render(), PAGE);

        expect(page.canReveal()).toBe(false);
        page.check();
        expect(page.canReveal()).toBe(true);
    });
});

describe("an untouched Parsons problem prints", () => {
    it("puts every line and the expected order on the paper, and leaves the controls off it", () => {
        const html = render().find((f) => f.name === PAGE)!.contents;
        const printed = printPage(html, renderStylesheet());

        for (const line of EXPECTED) expect(printed.shows(line.trim())).toBe(true);
        expect(printed.shows(EXPECTED.map((l) => l.trim()).join(" "))).toBe(true);
        expect(printed.shows("Check my answer")).toBe(false);
        expect(printed.shows("earlier")).toBe(false);
    });
});

describe("a Parsons problem the learner leaves returns as written", () => {
    it("restores the written shuffle and clears the result after a return through history", () => {
        const page = openPage(render(), PAGE);
        const written: string[] = page.lines();
        page.moveLater(0);
        page.moveLater(1);
        page.check();

        page.returnThroughHistory();

        expect(page.lines()).toEqual(written);
        expect(page.result()).toBe("");
        expect(page.canReveal()).toBe(false);
    });
});

describe("a Parsons declaration that cannot make a checkable exercise fails the whole render", () => {
    for (const [why, broken] of [
        ["declares no lines", declaration(null)],
        ["declares one line", declaration(["only()"])],
        ["declares no two distinct lines", declaration(["same()", "same()", "same()"])],
    ] as const) {
        it(`refuses a problem that ${why}, naming the lesson and the component`, () => {
            let error: unknown;
            try {
                render(broken);
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(WidgetError);
            expect(String(error)).toMatch(/ordering\.md/);
            expect(String(error)).toMatch(/parsons-problem/);
        });
    }
});
