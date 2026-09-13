// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderStylesheet, renderWorkbook, type LessonSource, type RenderedFile } from "./workbook-render";
import { printPage, readPage } from "./workbook-page-fixtures";
import { openPage } from "./workbook-learner-fixtures";
import { WIDGET_MANIFEST, WidgetError } from "./workbook-widgets";

const PAGE: string = "signatures.html";

function declaration(prompt: string, answer: string | null): string {
    return [
        "component: fill-the-signature",
        "data:",
        `  prompt: ${JSON.stringify(prompt)}`,
        ...(answer === null ? [] : [`  answer: ${JSON.stringify(answer)}`]),
    ].join("\n");
}

function lessonWith(...declarations: string[]): LessonSource {
    return {
        file: "signatures.md",
        source: [
            "---",
            "title: Signatures",
            "---",
            "",
            "Say what the function takes before you read it.",
            "",
            ...declarations.flatMap((d) => ["```widget", d, "```", ""]),
        ].join("\n"),
    };
}

const READ_TITLE: string = declaration(
    "Write the signature of the function that reads a lesson's title from its front matter.",
    "readTitle(frontMatter: Record<string, unknown>): string | null",
);

function render(...declarations: string[]): RenderedFile[] {
    return renderWorkbook({ lessons: [lessonWith(...(declarations.length === 0 ? [READ_TITLE] : declarations))] });
}

describe("fill-the-signature asks for a typed signature and withholds the expected one", () => {
    it("is in the shared library", () => {
        expect(Object.keys(WIDGET_MANIFEST)).toContain("fill-the-signature");
    });

    it("shows the prompt and an empty answer field, and not the expected answer", () => {
        const page = openPage(render(), PAGE);

        expect(page.visibleText()).toContain("reads a lesson's title from its front matter");
        expect(page.typed()).toBe("");
        expect(page.visibleText()).not.toContain("readTitle(");
        expect(page.result()).toBe("");
    });

    it("renders a signature full of angle brackets, and shows it as code rather than refusing it as markup", () => {
        const files = render(declaration("Write the loader's signature.", "load<T>(path: string): Promise<T[]>"));

        expect(readPage(files.find((f) => f.name === PAGE)!.contents).code).toContain("load<T>(path: string): Promise<T[]>");
    });

    it("still refuses markup in a field that is not code", () => {
        expect(() => render(declaration("<b>Write</b> it.", "f(): void"))).toThrow(/markup-in-lesson/);
    });
});

describe("the learner asks for the typed answer to be checked", () => {
    it("says the answer is right when it matches, and wrong when it does not", () => {
        const page = openPage(render(), PAGE);

        page.type("readTitle(frontMatter: Record<string, unknown>): string");
        page.check();
        const wrong: string = page.result();

        page.type("readTitle(frontMatter: Record<string, unknown>): string | null");
        page.check();
        const right: string = page.result();

        expect(wrong).not.toBe("");
        expect(right).not.toBe("");
        expect(right).not.toBe(wrong);
        expect(right).toMatch(/right|correct|matches/i);
        expect(wrong).toMatch(/not/i);
    });

    it("checks on a machine with no network, and keeps nothing anywhere", () => {
        const page = openPage(render(), PAGE);

        page.type("readTitle(frontMatter: Record<string, unknown>): string | null");
        page.check();

        expect(page.result()).toMatch(/right|correct|matches/i);
        expect(page.reachedFor).toEqual([]);
    });

    it("states the result in words and announces it", () => {
        const page = openPage(render(), PAGE);

        page.type("nope");
        page.check();

        expect(page.result().length).toBeGreaterThan(0);
        expect(page.resultIsAnnounced()).toBe(true);
    });

    it("clears the result as soon as the answer it describes changes", () => {
        const page = openPage(render(), PAGE);

        page.type("nope");
        page.check();
        page.type("nope, but different");

        expect(page.result()).toBe("");
    });

    it("keeps a separate result for each exercise on the page", () => {
        const page = openPage(render(READ_TITLE, declaration("Write the escape function's signature.", "escapeText(text: string): string")), PAGE);

        page.type("escapeText(text: string): string", 1);
        page.check(1);

        expect(page.result(0)).toBe("");
        expect(page.result(1)).toMatch(/right|correct|matches/i);
    });
});

describe("an answer differing only in spacing is accepted, and nothing else is forgiven", () => {
    const cases: { typed: string; expected: string; accepted: boolean }[] = [
        { typed: "f( a:number )", expected: "f(a: number)", accepted: true },
        { typed: "   readTitle(frontMatter:Record<string,unknown>):string|null  ", expected: "readTitle(frontMatter: Record<string, unknown>): string | null", accepted: true },
        { typed: "f(a: readonly   string[])", expected: "f(a: readonly string[])", accepted: true },
        { typed: "f(a: readonlystring[])", expected: "f(a: readonly string[])", accepted: false },
        { typed: "F(a: number)", expected: "f(a: number)", accepted: false },
        { typed: "f(b: number)", expected: "f(a: number)", accepted: false },
        { typed: "f(a: number);", expected: "f(a: number)", accepted: false },
        { typed: "f(a = 'x')", expected: 'f(a = "x")', accepted: false },
    ];

    for (const { typed, expected, accepted } of cases) {
        it(`${accepted ? "accepts" : "rejects"} ${JSON.stringify(typed)} for ${JSON.stringify(expected)}`, () => {
            const page = openPage(render(declaration("Write it.", expected)), PAGE);
            const reference = openPage(render(declaration("Write it.", expected)), PAGE);

            page.type(typed);
            page.check();
            reference.type(expected);
            reference.check();

            expect(page.result() === reference.result()).toBe(accepted);
        });
    }
});

describe("the expected answer stays behind the learner's own attempt on screen", () => {
    it("cannot be revealed until the learner has checked at least once, and then can", () => {
        const page = openPage(render(), PAGE);

        expect(page.canReveal()).toBe(false);
        page.type("anything");
        page.check();

        expect(page.canReveal()).toBe(true);
        expect(page.reveal()).toContain("readTitle(frontMatter: Record<string, unknown>): string | null");
    });
});

describe("an untouched fill-the-signature exercise prints", () => {
    it("puts the prompt and the expected answer on the paper, and leaves the controls off it", () => {
        const html = render().find((f) => f.name === PAGE)!.contents;

        const printed = printPage(html, renderStylesheet());

        expect(printed.shows("reads a lesson's title from its front matter")).toBe(true);
        expect(printed.shows("readTitle(frontMatter: Record<string, unknown>): string | null")).toBe(true);
        expect(printed.shows("Check")).toBe(false);
        expect(printed.shows("Reveal")).toBe(false);
    });
});

describe("nothing the learner typed survives the page being reopened", () => {
    it("opens empty after the page is closed and opened again", () => {
        const files = render();
        const first = openPage(files, PAGE);
        first.type("readTitle(): string");
        first.check();

        const again = openPage(files, PAGE);

        expect(again.typed()).toBe("");
        expect(again.result()).toBe("");
        expect(again.canReveal()).toBe(false);
    });

    it("opts every answer field out of the browser restoring or autofilling it", () => {
        expect(openPage(render(), PAGE).fieldsRememberNothing()).toBe(true);
    });

    it("resets to how it was written when the learner comes back through history", () => {
        const page = openPage(render(), PAGE);
        page.type("readTitle(): string");
        page.check();
        page.reveal();

        page.returnThroughHistory();

        expect(page.typed()).toBe("");
        expect(page.result()).toBe("");
        expect(page.canReveal()).toBe(false);
        expect(page.visibleText()).not.toContain("readTitle(frontMatter");
    });
});

describe("a declaration that cannot make a checkable exercise fails the whole render", () => {
    it("names the lesson and the component when there is no expected answer", () => {
        for (const broken of [declaration("Write it.", null), declaration("Write it.", "   ")]) {
            let error: unknown;
            try {
                render(broken);
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(WidgetError);
            expect(String(error)).toMatch(/signatures\.md/);
            expect(String(error)).toMatch(/fill-the-signature/);
        }
    });
});
