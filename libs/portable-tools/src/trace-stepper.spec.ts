// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderStylesheet, renderWorkbook, type LessonSource, type RenderedFile } from "./workbook-render";
import { printPage } from "./workbook-page-fixtures";
import { openPage } from "./workbook-learner-fixtures";
import { WIDGET_MANIFEST, WidgetError } from "./workbook-widgets";

const PAGE: string = "tracing.html";

interface Step {
    line: number | string;
    state?: string;
    question?: string;
    answer?: string;
}

const SNIPPET: readonly string[] = [
    "let total = 0;",
    "for (let i = 1; i <= 2; i++) {",
    "    total += i;",
    "}",
    "console.log(total);",
];

const STEPS: readonly Step[] = [
    { line: 1, state: "total is 0" },
    { line: 2, state: "i is 1, total is 0" },
    { line: 3, state: "i is 1, total is 1", question: "What is total now?", answer: "1" },
    { line: 2, state: "i is 2, total is 1" },
    { line: 3, state: "i is 2, total is 3", question: "And now?", answer: "3" },
    { line: 5, state: "prints 3" },
];

function declaration(steps: readonly Step[] | null, snippet: readonly string[] = SNIPPET): string {
    const out: string[] = ["component: trace-stepper", "data:", "  prompt: Run it in your head.", "  snippet: |", ...snippet.map((l) => `    ${l}`)];
    if (steps !== null) {
        out.push(steps.length === 0 ? "  steps: []" : "  steps:");
        for (const step of steps) {
            out.push(`    - line: ${JSON.stringify(step.line)}`);
            if (step.state !== undefined) out.push(`      state: ${JSON.stringify(step.state)}`);
            if (step.question !== undefined) out.push(`      question: ${JSON.stringify(step.question)}`);
            if (step.answer !== undefined) out.push(`      answer: ${JSON.stringify(step.answer)}`);
        }
    }
    return out.join("\n");
}

function lessonWith(...declarations: string[]): LessonSource {
    return {
        file: "tracing.md",
        source: ["---", "title: Tracing", "---", "", "Trace before you skim.", "", ...declarations.flatMap((d) => ["```widget", d, "```", ""])].join("\n"),
    };
}

function render(...declarations: string[]): RenderedFile[] {
    return renderWorkbook({ lessons: [lessonWith(...(declarations.length === 0 ? [declaration(STEPS)] : declarations))] });
}

describe("a trace stepper opens at its first step", () => {
    it("is in the shared library", () => {
        expect(Object.keys(WIDGET_MANIFEST)).toContain("trace-stepper");
    });

    it("shows the snippet with the first step's line marked and that step's state beside it", () => {
        const page = openPage(render(), PAGE);

        for (const line of SNIPPET) expect(page.visibleText()).toContain(line.trim());
        expect(page.markedLine()).toBe("let total = 0;");
        expect(page.stateShown()).toBe("total is 0");
        expect(page.visibleText()).not.toContain("i is 1, total is 0");
    });

    it("renders the same page every time", () => {
        expect(render().map((f) => f.contents)).toEqual(render().map((f) => f.contents));
    });
});

describe("the learner steps forward", () => {
    it("moves the mark to the line the next step names, and shows the state after that line", () => {
        const page = openPage(render(declaration(STEPS.map(({ line, state }) => ({ line, state })))), PAGE);

        const walked: [string, string][] = [];
        while (page.canStep()) {
            page.step();
            walked.push([page.markedLine(), page.stateShown()]);
        }

        expect(walked).toEqual([
            ["for (let i = 1; i <= 2; i++) {", "i is 1, total is 0"],
            ["total += i;", "i is 1, total is 1"],
            ["for (let i = 1; i <= 2; i++) {", "i is 2, total is 1"],
            ["total += i;", "i is 2, total is 3"],
            ["console.log(total);", "prints 3"],
        ]);
    });

    it("moves forward only, and stops at the last step", () => {
        const page = openPage(render(declaration([{ line: 1, state: "a" }, { line: 2, state: "b" }])), PAGE);

        page.step();

        expect(page.canStep()).toBe(false);
        expect(page.markedLine()).toBe("for (let i = 1; i <= 2; i++) {");
    });
});

describe("a step with a question waits for the learner's answer to be checked", () => {
    function atFirstQuestion(): ReturnType<typeof openPage> {
        const page = openPage(render(), PAGE);
        page.step();
        return page;
    }

    it("cannot be taken, and keeps its state hidden, until the question is checked", () => {
        const page = atFirstQuestion();

        expect(page.visibleText()).toContain("What is total now?");
        expect(page.canStep()).toBe(false);
        page.step();

        expect(page.markedLine()).toBe("for (let i = 1; i <= 2; i++) {");
        expect(page.visibleText()).not.toContain("i is 1, total is 1");
    });

    it("says whether the answer is right before the step is taken, and then lets the learner step", () => {
        const page = atFirstQuestion();

        page.type("2");
        page.check();

        expect(page.result()).toMatch(/not/i);
        expect(page.markedLine()).toBe("for (let i = 1; i <= 2; i++) {");
        expect(page.canStep()).toBe(true);

        page.step();
        expect(page.markedLine()).toBe("total += i;");
        expect(page.stateShown()).toBe("i is 1, total is 1");
    });

    it("tells a right answer it is right, in the words every exercise uses", () => {
        const files = renderWorkbook({
            lessons: [lessonWith(declaration(STEPS), ["component: fill-the-signature", "data:", "  prompt: p", "  answer: \"f(): void\""].join("\n"))],
        });
        const page = openPage(files, PAGE);
        page.step();

        page.type(" 1 ", 0);
        page.check(0);
        page.type("f( ): void", 2);
        page.check(2);

        expect(page.result(0)).toMatch(/right|correct|matches/i);
        expect(page.result(0)).toBe(page.result(2));
        expect(page.resultIsAnnounced(0)).toBe(true);
    });

    it("waits again when the answer changes after it was checked", () => {
        const page = atFirstQuestion();

        page.type("1");
        page.check();
        page.type("12");

        expect(page.result()).toBe("");
        expect(page.canStep()).toBe(false);
    });

    it("lets the full trace be revealed on screen only after a check", () => {
        const page = atFirstQuestion();

        expect(page.canReveal()).toBe(false);
        page.type("1");
        page.check();
        expect(page.canReveal()).toBe(true);
    });

    it("walks the whole trace with no network and keeps nothing", () => {
        const page = openPage(render(), PAGE);
        let field: number = 0;
        for (let guard = 0; guard < 20; guard++) {
            if (page.canStep()) {
                page.step();
                continue;
            }
            if (page.markedLine() === "console.log(total);") break;
            page.type("anything", field);
            page.check(field);
            field += 1;
        }

        expect(page.stateShown()).toBe("prints 3");
        expect(page.reachedFor).toEqual([]);
    });
});

describe("an untouched trace stepper prints", () => {
    it("puts every line, the state at every step and every expected answer on the paper, and no control", () => {
        const html = render().find((f) => f.name === PAGE)!.contents;
        const printed = printPage(html, renderStylesheet());

        for (const line of SNIPPET) expect(printed.shows(line.trim())).toBe(true);
        for (const step of STEPS) expect(printed.shows(step.state!)).toBe(true);
        expect(printed.shows("What is total now?")).toBe(true);
        expect(printed.shows("And now?")).toBe(true);
        expect(printed.shows("Step forward")).toBe(false);
        expect(printed.shows("Check my answer")).toBe(false);
    });
});

describe("a trace stepper the learner leaves returns as written", () => {
    it("goes back to the first step, with empty answers and no results, after a return through history", () => {
        const page = openPage(render(), PAGE);
        page.step();
        page.type("1");
        page.check();
        page.step();

        page.returnThroughHistory();

        expect(page.markedLine()).toBe("let total = 0;");
        expect(page.stateShown()).toBe("total is 0");
        expect(page.typed()).toBe("");
        expect(page.result()).toBe("");
        page.step();
        expect(page.canStep()).toBe(false);
    });
});

describe("a trace's code is shown as code, and its prose is still checked for markup", () => {
    it("renders a snippet, states and answers that read like markup", () => {
        const page = openPage(
            render(
                declaration(
                    [
                        { line: 1, state: "xs is Array<number> []" },
                        { line: 2, state: "i<n holds", question: "Type of xs?", answer: "Array<number>" },
                    ],
                    ["const xs: Array<number> = [];", "if (i<n) xs.push(i);"],
                ),
            ),
            PAGE,
        );

        expect(page.markedLine()).toBe("const xs: Array<number> = [];");
        page.type("Array< number >");
        page.check();
        expect(page.result()).toMatch(/right|correct|matches/i);
    });

    it("refuses markup in a question", () => {
        expect(() => render(declaration([{ line: 1, state: "a" }, { line: 2, state: "b", question: "<b>why</b>", answer: "x" }]))).toThrow(
            /markup-in-lesson/,
        );
    });
});

describe("a trace declaration that cannot make a checkable exercise fails the whole render", () => {
    const broken: [string, string][] = [
        ["has no steps", declaration(null)],
        ["has an empty trace", declaration([])],
        ["names a line the snippet does not have", declaration([{ line: 1, state: "a" }, { line: 9, state: "b" }])],
        ["names line zero", declaration([{ line: 0, state: "a" }])],
        ["names a line that is not a number", declaration([{ line: "two", state: "a" }])],
        ["attaches a question to the first step", declaration([{ line: 1, state: "a", question: "q?", answer: "a" }])],
        ["asks a question with no expected answer", declaration([{ line: 1, state: "a" }, { line: 2, state: "b", question: "q?" }])],
    ];
    for (const [why, declared] of broken) {
        it(`refuses a trace that ${why}, naming the lesson and the component`, () => {
            let error: unknown;
            try {
                render(declared);
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(WidgetError);
            expect(String(error)).toMatch(/tracing\.md/);
            expect(String(error)).toMatch(/trace-stepper/);
        });
    }
});
