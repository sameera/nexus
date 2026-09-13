/**
 * Fill-the-signature (epic #480, story #517): the learner types the signature they think a function
 * should have and is told whether they got it right, so they find out what they actually knew
 * instead of grading themselves.
 *
 * It is the smallest of the answer-asking components, which is why the checkable answer every later
 * component uses was built alongside it. The typed signature is one part of one checkable answer.
 *
 * The prompt and the answer field are in the always-visible region; the expected signature is in the
 * hidden region, so an untouched exercise prints its prompt and its answer, and the check compares
 * against the very copy the paper shows.
 */

import { renderAnswerField, renderCheckableAnswer, renderExpectedAnswer } from "./answer-check.js";
import { escapeText } from "./html-escape.js";
import { type WidgetComponent } from "./workbook-widgets.js";

/** The name a lesson declares to use this component. */
export const FILL_THE_SIGNATURE_COMPONENT: string = "fill-the-signature";

function textOf(data: Record<string, unknown>, field: string): string {
    const value: unknown = data[field];
    return value === undefined || value === null ? "" : String(value);
}

export const FILL_THE_SIGNATURE: WidgetComponent = {
    codeFields: ["answer"],
    refuse: (data) => (textOf(data, "answer").trim() === "" ? "it declares no expected answer ('answer')" : null),
    lead: (data) =>
        [
            `<p class="widget-question">${escapeText(textOf(data, "prompt"))}</p>`,
            renderCheckableAnswer(renderAnswerField("Your signature")),
        ].join("\n"),
    summary: () => "Reveal the expected signature",
    render: (data) => renderExpectedAnswer([textOf(data, "answer")], "Expected signature"),
};
