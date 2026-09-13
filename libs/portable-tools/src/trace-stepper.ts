/**
 * The trace stepper (epic #480, story #519): the learner walks a snippet one step at a time beside
 * its changing state, predicting the state at a step before taking it, so they learn to read code by
 * running it in their head rather than by skimming it.
 *
 * **The steps are written by the lesson.** Each names its line and the state after that line runs, so
 * a trace can follow loops and branches — which is where tracing teaches the most — and stepping moves
 * the mark to the line the next step names (decision record #616 amends the story's "moves on by one
 * line" to this). Every state is in the page when the page is written; stepping changes what is
 * visible and computes nothing.
 *
 * **A question waits for a check, not for a right answer.** A question belongs to the step it asks
 * about. While it is unchecked that step cannot be taken and its state stays hidden; once it has been
 * checked, right or wrong, the learner can step and the state that appears shows the correct answer.
 * Waiting for a right answer would trap a learner who cannot get it. Each question is its own
 * checkable answer, checked by the mechanism story #517 built and nothing else — the stepper only
 * listens for a check having happened.
 *
 * The stepper moves forward only. The full trace — every step's line and state, and each question's
 * expected answer — is in the hidden region, so an untouched stepper prints all of it.
 */

import { renderAnswerField, renderCheckableAnswer, renderExpectedAnswer } from "./answer-check.js";
import { escapeText } from "./html-escape.js";
import { type WidgetComponent } from "./workbook-widgets.js";

/** The name a lesson declares to use this component. */
export const TRACE_STEPPER_COMPONENT: string = "trace-stepper";

interface TraceStep {
    line: unknown;
    state: string;
    question: string | null;
    answer: string;
}

function textOf(value: unknown): string {
    return value === undefined || value === null ? "" : String(value);
}

function snippetOf(data: Record<string, unknown>): string[] {
    const lines: string[] = textOf(data["snippet"]).replace(/\r\n/g, "\n").split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines;
}

function stepsOf(data: Record<string, unknown>): TraceStep[] {
    const steps: unknown = data["steps"];
    if (!Array.isArray(steps)) return [];
    return steps.map((step: unknown) => {
        const record: Record<string, unknown> = typeof step === "object" && step !== null ? (step as Record<string, unknown>) : {};
        const question: string = textOf(record["question"]);
        return {
            line: record["line"],
            state: textOf(record["state"]),
            question: question.trim() === "" ? null : question,
            answer: textOf(record["answer"]),
        };
    });
}

function refuse(data: Record<string, unknown>): string | null {
    const snippet: string[] = snippetOf(data);
    const steps: TraceStep[] = stepsOf(data);
    if (steps.length === 0) return "its trace is empty — it declares no steps ('steps')";
    for (const [index, step] of steps.entries()) {
        if (typeof step.line !== "number" || !Number.isInteger(step.line) || step.line < 1 || step.line > snippet.length) {
            return `step ${index + 1} names line ${JSON.stringify(step.line ?? null)}, which the ${snippet.length}-line snippet does not have`;
        }
        if (step.question !== null && index === 0) return "it attaches a question to the first step, which the page opens on";
        if (step.question !== null && step.answer.trim() === "") return `step ${index + 1} asks a question with no expected answer ('answer')`;
    }
    return null;
}

function renderLead(data: Record<string, unknown>): string {
    const snippet: string[] = snippetOf(data);
    const steps: TraceStep[] = stepsOf(data);
    const first: number = steps[0].line as number;
    const blocked: boolean = steps.length < 2 || steps[1].question !== null;
    return [
        `<p class="widget-question">${escapeText(textOf(data["prompt"]))}</p>`,
        `<div class="trace" data-trace data-current="0">`,
        `<ol class="trace-snippet">`,
        ...snippet.map(
            (line, index) =>
                `<li class="trace-line"${index + 1 === first ? ` aria-current="step"` : ""}><code>${escapeText(line)}</code></li>`,
        ),
        "</ol>",
        `<div class="trace-states">`,
        ...steps.map((step, index) =>
            [
                `<div class="trace-state" data-step-line="${step.line as number}"${index === 0 ? "" : " hidden"}>`,
                `<p class="trace-state-label">State after line ${step.line as number}</p>`,
                `<pre><code>${escapeText(step.state)}</code></pre>`,
                "</div>",
            ].join(""),
        ),
        "</div>",
        ...steps.flatMap((step, index) =>
            step.question === null
                ? []
                : [
                    `<div class="trace-question" data-question-for="${index}"${index === 1 ? "" : " hidden"}>`,
                    `<p class="trace-question-text">${escapeText(step.question)}</p>`,
                    renderCheckableAnswer(renderAnswerField("Your answer")),
                    "</div>",
                ],
        ),
        `<button class="trace-step-forward" type="button"${blocked ? " disabled" : ""}>Step forward</button>`,
        `<p class="trace-position" aria-live="polite">Step 1 of ${steps.length}</p>`,
        "</div>",
    ].join("\n");
}

function renderFullTrace(data: Record<string, unknown>): string {
    const snippet: string[] = snippetOf(data);
    return [
        `<div class="trace-full">`,
        `<ol class="trace-full-steps">`,
        ...stepsOf(data).map((step) => {
            const line: number = step.line as number;
            return [
                "<li>",
                `<p>Line ${line}: <code>${escapeText(snippet[line - 1])}</code></p>`,
                `<pre><code>${escapeText(step.state)}</code></pre>`,
                step.question === null
                    ? ""
                    : `<p class="trace-full-question">${escapeText(step.question)}</p>\n${renderExpectedAnswer([step.answer], "Expected answer")}`,
                "</li>",
            ]
                .filter((part) => part !== "")
                .join("\n");
        }),
        "</ol>",
        "</div>",
    ].join("\n");
}

export const TRACE_STEPPER: WidgetComponent = {
    codeFields: ["snippet", "steps.*.state", "steps.*.answer"],
    refuse,
    lead: renderLead,
    summary: () => "Reveal the full trace",
    render: renderFullTrace,
};

/**
 * The stepping half of the workbook's classic script. It moves the step marker and changes what is
 * visible; it computes no state, and it compares nothing — it only asks whether a question's
 * checkable answer has been checked.
 */
export function renderTraceScript(): string {
    return [
        "function traceCanStep(trace) {",
        "    var next = Number(trace.getAttribute('data-current')) + 1;",
        "    if (next >= trace.querySelectorAll('.trace-state').length) return false;",
        "    var question = trace.querySelector('[data-question-for=\"' + next + '\"]');",
        "    if (question === null) return true;",
        "    var check = question.querySelector('[data-check]');",
        "    return check !== null && check.hasAttribute('data-checked');",
        "}",
        "function traceShow(trace, index) {",
        "    trace.setAttribute('data-current', String(index));",
        "    var states = trace.querySelectorAll('.trace-state');",
        "    for (var i = 0; i < states.length; i++) {",
        "        if (i === index) states[i].removeAttribute('hidden');",
        "        else states[i].setAttribute('hidden', '');",
        "    }",
        "    var marked = states[index].getAttribute('data-step-line');",
        "    var lines = trace.querySelectorAll('.trace-line');",
        "    for (var j = 0; j < lines.length; j++) {",
        "        if (String(j + 1) === marked) lines[j].setAttribute('aria-current', 'step');",
        "        else lines[j].removeAttribute('aria-current');",
        "    }",
        "    var questions = trace.querySelectorAll('.trace-question');",
        "    for (var k = 0; k < questions.length; k++) {",
        "        if (questions[k].getAttribute('data-question-for') === String(index + 1)) questions[k].removeAttribute('hidden');",
        "        else questions[k].setAttribute('hidden', '');",
        "    }",
        "    var position = trace.querySelector('.trace-position');",
        "    if (position !== null) position.textContent = 'Step ' + (index + 1) + ' of ' + states.length;",
        "    traceRefresh(trace);",
        "}",
        "function traceRefresh(trace) {",
        "    var control = trace.querySelector('.trace-step-forward');",
        "    if (control !== null) control.disabled = !traceCanStep(trace);",
        "}",
        "document.addEventListener('click', function (event) {",
        "    var control = event.target.closest('.trace-step-forward');",
        "    if (control === null) return;",
        "    var trace = control.closest('[data-trace]');",
        "    if (trace === null || !traceCanStep(trace)) return;",
        "    traceShow(trace, Number(trace.getAttribute('data-current')) + 1);",
        "});",
        "function traceRefreshFrom(event) {",
        "    var trace = event.target.closest('[data-trace]');",
        "    if (trace !== null) traceRefresh(trace);",
        "}",
        "document.addEventListener('answer-checked', traceRefreshFrom);",
        "document.addEventListener('input', traceRefreshFrom);",
        "window.addEventListener('pageshow', function () {",
        "    var traces = document.querySelectorAll('[data-trace]');",
        "    for (var i = 0; i < traces.length; i++) traceShow(traces[i], 0);",
        "});",
    ].join("\n");
}

/** The stylesheet rules the trace stepper owns. The marked line is shown by more than colour. */
export function renderTraceStyles(): string {
    return [
        "",
        "/* The trace stepper. */",
        ".trace-snippet { font-family: var(--font-mono, monospace); padding-left: 2.5rem; }",
        ".trace-line code { white-space: pre; }",
        ".trace-line[aria-current] { font-weight: bold; list-style-type: disclosure-closed; }",
        ".trace-step-forward { font: inherit; }",
        "@media print {",
        "    .trace-step-forward { display: none; }",
        "    .trace-position { display: none; }",
        "}",
        "",
    ].join("\n");
}
