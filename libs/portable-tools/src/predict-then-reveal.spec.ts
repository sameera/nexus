// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderStylesheet, renderWorkbook, type LessonSource } from "./workbook-render";
import { printPage, readPage } from "./workbook-page-fixtures";
import { PREDICT_THEN_REVEAL, PREDICT_THEN_REVEAL_COMPONENT } from "./predict-then-reveal";

const DECLARATION: string = [
    "component: predict-then-reveal",
    "data:",
    "  question: what does the drift check compare?",
    "  answer: the story's title and body, whitespace normalized",
].join("\n");

function lessonWith(declaration: string): LessonSource {
    return {
        file: "the-drift-check.md",
        source: [
            "---",
            "title: The drift check",
            "---",
            "",
            "Predict your answer before you see it.",
            "",
            "```widget",
            declaration,
            "```",
        ].join("\n"),
    };
}

function pageFor(declaration: string = DECLARATION) {
    const file = renderWorkbook({
        lessons: [lessonWith(declaration)],
        widgets: { [PREDICT_THEN_REVEAL_COMPONENT]: PREDICT_THEN_REVEAL },
    }).find((f) => f.name === "the-drift-check.html")!.contents;
    return readPage(file);
}

describe("predict-then-reveal is the first component in the shared library", () => {
    it("shows the question and hides the answer", () => {
        const page = pageFor();
        expect(page.visibleText).toContain("what does the drift check compare?");
        expect(page.visibleText).not.toContain("whitespace normalized");
        expect(page.text).toContain("whitespace normalized");
        expect(page.controls[0].showing).toBe(false);
    });

    it("reveals the answer through the control, and the control is the only path to it", () => {
        const page = pageFor();
        expect(page.controls).toHaveLength(1);
        expect(page.controls[0].content).toContain("whitespace normalized");
    });

    it("prints the question and the answer even when the learner never touched the control", () => {
        const file = renderWorkbook({
            lessons: [lessonWith(DECLARATION)],
            widgets: { [PREDICT_THEN_REVEAL_COMPONENT]: PREDICT_THEN_REVEAL },
        }).find((f) => f.name === "the-drift-check.html")!.contents;
        const printed = printPage(file, renderStylesheet());
        expect(printed.shows("what does the drift check compare?")).toBe(true);
        expect(printed.shows("whitespace normalized")).toBe(true);
    });

    it("persists nothing about the learner: the same declaration renders the same page every time", () => {
        const first = pageFor();
        const second = pageFor();
        expect(first.text).toEqual(second.text);
    });
});
