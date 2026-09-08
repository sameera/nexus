/**
 * Predict-then-reveal (epic #407, story #461): the first component in the shared widget library,
 * which shipped empty with the renderer (epic #405).
 *
 * A learner who commits to an answer before seeing it finds out what they actually knew, rather
 * than recognising an answer they were shown (decision record #469). Commitment is enforced by
 * ordering alone — the reveal control is the only path to the answer — and nothing the learner
 * types is ever stored: a page opened from a file has nowhere to write, and giving it somewhere
 * would create a record about a person outside the one folder the ignore rule protects.
 *
 * The question needs to be on the page and on the paper whether or not the learner ever touches
 * the control, so it uses the widget seam's `lead` region rather than the reveal button's summary
 * label — a `<button>` is itself excluded from print, so content carried only by its label would
 * disappear from a printed, untouched page.
 */

import { escapeText } from "./html-escape.js";
import { type WidgetComponent } from "./workbook-widgets.js";

/** The name a lesson declares to use this component. */
export const PREDICT_THEN_REVEAL_COMPONENT: string = "predict-then-reveal";

function textOf(data: Record<string, unknown>, field: string): string {
    return String(data[field] ?? "");
}

export const PREDICT_THEN_REVEAL: WidgetComponent = {
    lead: (data) => `<p class="widget-question">${escapeText(textOf(data, "question"))}</p>`,
    summary: () => "Reveal the answer",
    render: (data) => `<p class="widget-answer">${escapeText(textOf(data, "answer"))}</p>`,
};
