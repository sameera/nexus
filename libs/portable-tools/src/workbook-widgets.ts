/**
 * The widget seam (epic #405, story #448): a small declaration in a lesson resolves to a working
 * component, so a lesson gains an interactive exercise without anyone writing markup for it.
 *
 * A widget is declared at the point in the prose where it belongs, as a fenced block that remains
 * ordinary markdown — the lesson still reads in every other surface that displays markdown, which
 * a custom directive syntax would have cost. The declaration is inert: it names a component and
 * its data, and it resolves at render time against the manifest the runtime declares. Rendering
 * never bundles and never runs the runtime; it looks the name up.
 *
 * Two behaviours are structural:
 *
 * - **A name the library does not hold fails the whole render**, names the missing component, and
 *   leaves no output behind. Failing one page instead would make a page with a hole in it
 *   unlikely rather than impossible.
 * - **A widget's content is in the page at render time.** Nothing is generated or fetched when the
 *   learner interacts; interaction only changes what is visible. That is what puts an untouched
 *   widget's content on the paper for free, instead of making it something every future component
 *   must implement and every reviewer must check.
 *
 * The library shipped empty at #405; this seam and this file are what a component built later
 * resolves against. Its first component, predict-then-reveal, arrived with story #461.
 *
 * Epic #480 amends the second behaviour: interaction may also compare answers, and it still never
 * creates, fetches or runs content (decision record #616). It adds two more structural rules — a
 * declaration that cannot make a checkable exercise fails the whole render, and only the fields a
 * component declares as code skip the renderer's markup check.
 */

import { parse } from "yaml";
import { renderCheckScript, renderCheckStyles } from "./answer-check.js";
import { FILL_THE_SIGNATURE, FILL_THE_SIGNATURE_COMPONENT } from "./fill-the-signature.js";
import { escapeText } from "./html-escape.js";
import { PARSONS_PROBLEM, PARSONS_PROBLEM_COMPONENT, renderParsonsScript, renderParsonsStyles } from "./parsons-problem.js";
import { PREDICT_THEN_REVEAL, PREDICT_THEN_REVEAL_COMPONENT } from "./predict-then-reveal.js";
import { TRACE_STEPPER, TRACE_STEPPER_COMPONENT, renderTraceScript, renderTraceStyles } from "./trace-stepper.js";

/** The fenced block's info string that marks a declaration. */
export const WIDGET_FENCE_INFO: string = "widget";

/** The script written once per workbook, carrying the interactive runtime. */
export const SCRIPT_NAME: string = "workbook.js";

/** What a lesson declares. */
export interface WidgetDeclaration {
    component: string;
    data: Record<string, unknown>;
}

/**
 * One component in the shared library. `render` returns the widget's content, already complete —
 * it is called at render time and never at interaction time.
 */
export interface WidgetComponent {
    /**
     * Content that is always visible and always printed, placed before the reveal control. A
     * component that needs a region the reveal control cannot hide — predict-then-reveal's
     * question is the first one — uses this rather than the summary label, which sits on a
     * control that is itself omitted from print.
     */
    lead?: (data: Record<string, unknown>) => string;
    /** A short label the reveal control shows before the content is visible. */
    summary: (data: Record<string, unknown>) => string;
    /** The widget's content, as page markup. Complete at render time. */
    render: (data: Record<string, unknown>) => string;
    /**
     * The data fields that carry code, as dotted paths where `*` matches every item of a list or
     * every key of a map. Their values skip the renderer's markup check — a signature such as
     * `Promise<void>` reads like a tag — so the component must write every one of them escaped and
     * shown as code. Every other field is still checked.
     */
    codeFields?: readonly string[];
    /**
     * Why this declaration cannot make the exercise, or null when it can. A problem fails the whole
     * render: an exercise with a hole in its expected answer tells every learner they are wrong.
     */
    refuse?: (data: Record<string, unknown>) => string | null;
}

/** The library: every lesson in every workbook resolves against this one manifest. */
export type WidgetRegistry = Readonly<Record<string, WidgetComponent>>;

/**
 * The shipped library. It held nothing until story #461, which builds the seam's first consumer,
 * predict-then-reveal, alongside the drill it is built for.
 */
export const WIDGET_MANIFEST: WidgetRegistry = {
    [PREDICT_THEN_REVEAL_COMPONENT]: PREDICT_THEN_REVEAL,
    [FILL_THE_SIGNATURE_COMPONENT]: FILL_THE_SIGNATURE,
    [PARSONS_PROBLEM_COMPONENT]: PARSONS_PROBLEM,
    [TRACE_STEPPER_COMPONENT]: TRACE_STEPPER,
};

export class WidgetError extends Error {
    readonly component: string | null;
    readonly lesson: string;
    constructor(lesson: string, component: string | null, detail: string) {
        super(`widget in ${lesson}: ${detail}`);
        this.name = "WidgetError";
        this.lesson = lesson;
        this.component = component;
    }
}

/** Read a declaration out of a fenced block. */
export function parseDeclaration(lesson: string, content: string): WidgetDeclaration {
    let doc: unknown;
    try {
        doc = parse(content);
    } catch (e) {
        throw new WidgetError(lesson, null, `the declaration is not readable — ${e instanceof Error ? e.message : String(e)}`);
    }
    const record: Record<string, unknown> = (doc as Record<string, unknown> | null) ?? {};
    const component: unknown = record["component"];
    if (typeof component !== "string" || component.trim() === "") {
        throw new WidgetError(lesson, null, "the declaration names no component");
    }
    const data: unknown = record["data"];
    return {
        component: component.trim(),
        data: typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {},
    };
}

/** Remove every value a dotted path names from a copy of the data, leaving everything else. */
function withoutPath(value: unknown, path: readonly string[]): unknown {
    if (path.length === 0) return undefined;
    if (typeof value !== "object" || value === null) return value;
    const [head, ...rest] = path;
    if (Array.isArray(value)) {
        if (head !== "*" && !/^\d+$/.test(head)) return value;
        return value.map((item, index) => (head === "*" || String(index) === head ? withoutPath(item, rest) : item));
    }
    const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const key of Object.keys(copy)) {
        if (head === "*" || key === head) {
            if (rest.length === 0) delete copy[key];
            else copy[key] = withoutPath(copy[key], rest);
        }
    }
    return copy;
}

/** Every key and scalar in a parsed declaration, one per line. */
function scalarsOf(value: unknown, into: string[]): string[] {
    if (Array.isArray(value)) {
        for (const item of value) scalarsOf(item, into);
    } else if (typeof value === "object" && value !== null) {
        for (const [key, item] of Object.entries(value)) {
            into.push(key);
            scalarsOf(item, into);
        }
    } else if (value !== undefined && value !== null) {
        into.push(String(value));
    }
    return into;
}

/**
 * The part of a widget declaration the renderer's markup check reads: the whole declaration, minus
 * the values of the fields its component declares as code. A declaration that does not parse, or
 * names a component the library does not hold, is read whole — the seam refuses it later anyway.
 */
export function declarationMarkupText(content: string, registry: WidgetRegistry = WIDGET_MANIFEST): string {
    let doc: unknown;
    try {
        doc = parse(content);
    } catch {
        return content;
    }
    if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return content;
    const record: Record<string, unknown> = doc as Record<string, unknown>;
    const name: unknown = record["component"];
    const component: WidgetComponent | undefined = typeof name === "string" ? registry[name.trim()] : undefined;
    if (component?.codeFields === undefined || component.codeFields.length === 0) return content;
    let data: unknown = record["data"];
    for (const field of component.codeFields) data = withoutPath(data, field.split("."));
    return scalarsOf({ ...record, data }, []).join("\n");
}

/**
 * Wrap a component's content in the reveal container. The content is in the page; the control only
 * changes whether it is visible, and printing shows it whether or not the learner touched it.
 *
 * `lead`, when given, is a region before the control that is never hidden — a question a component
 * needs on the page regardless of interaction, which a button's own label cannot provide because a
 * `<button>` is itself excluded from print.
 */
export function renderWidgetShell(component: string, lead: string | null, summary: string, content: string): string {
    return [
        `<div class="widget" data-widget="${escapeText(component)}">`,
        lead === null || lead === "" ? "" : `<div class="widget-lead">${lead}</div>`,
        `<button class="widget-reveal" type="button" aria-expanded="false">${escapeText(summary)}</button>`,
        `<div class="widget-content" hidden>`,
        content,
        "</div>",
        "</div>",
    ]
        .filter((part) => part !== "")
        .join("\n");
}

/**
 * The block hook the renderer calls for every fenced block. Returns null for a block that is not a
 * declaration, so ordinary code blocks are untouched.
 */
export function makeWidgetSeam(
    lessonFile: string,
    registry: WidgetRegistry = WIDGET_MANIFEST,
): (info: string, content: string) => string | null {
    return (info: string, content: string): string | null => {
        if (info !== WIDGET_FENCE_INFO) return null;
        const declaration: WidgetDeclaration = parseDeclaration(lessonFile, content);
        const component: WidgetComponent | undefined = registry[declaration.component];
        if (component === undefined) {
            const known: string = Object.keys(registry).sort().join(", ");
            throw new WidgetError(
                lessonFile,
                declaration.component,
                `the shared component library holds no component named '${declaration.component}'. ` +
                `The library holds: ${known === "" ? "(nothing yet)" : known}. ` +
                `The whole render fails rather than leaving a page with a hole in it.`,
            );
        }
        const problem: string | null = component.refuse?.(declaration.data) ?? null;
        if (problem !== null) {
            throw new WidgetError(
                lessonFile,
                declaration.component,
                `the '${declaration.component}' declaration cannot make a checkable exercise: ${problem}. ` +
                `The whole render fails rather than leaving a page that tells every learner they are wrong.`,
            );
        }
        return renderWidgetShell(
            declaration.component,
            component.lead?.(declaration.data) ?? null,
            component.summary(declaration.data),
            component.render(declaration.data),
        );
    };
}

/**
 * The workbook's interactive runtime, written once per workbook and loaded as a classic script —
 * a page opened from disk cannot load a module script. It changes what is visible and compares
 * answers against copies already in the page (the checkable answer); no widget generates, fetches
 * or runs anything when the learner interacts with it, and nothing is stored.
 *
 * Every time the page is shown — including a return through the back/forward cache, which would
 * otherwise hand the learner back the page exactly as they left it — every widget goes back to how
 * it was written.
 */
export function renderScript(): string {
    return [
        "/* Generated by the Nexus workbook renderer — do not edit by hand.",
        " * Interaction changes what is visible and compares answers against copies already in the",
        " * page: every widget's content is put there at render time, and nothing is fetched or kept. */",
        '"use strict";',
        "document.addEventListener('click', function (event) {",
        "    var control = event.target.closest('.widget-reveal');",
        "    if (control === null || control.disabled) return;",
        "    var content = control.parentNode.querySelector('.widget-content');",
        "    if (content === null) return;",
        "    var revealed = content.hasAttribute('hidden');",
        "    if (revealed) content.removeAttribute('hidden');",
        "    else content.setAttribute('hidden', '');",
        "    control.setAttribute('aria-expanded', String(revealed));",
        "});",
        "function resetReveals(root) {",
        "    var controls = root.querySelectorAll('.widget-reveal');",
        "    for (var i = 0; i < controls.length; i++) {",
        "        var content = controls[i].parentNode.querySelector('.widget-content');",
        "        if (content !== null) content.setAttribute('hidden', '');",
        "        controls[i].setAttribute('aria-expanded', 'false');",
        "    }",
        "}",
        "window.addEventListener('pageshow', function () { resetReveals(document); });",
        renderCheckScript(),
        renderParsonsScript(),
        renderTraceScript(),
        "",
    ].join("\n");
}

/** The stylesheet rules the seam owns, appended to the workbook's one stylesheet. */
export function renderWidgetStyles(): string {
    return [
        "",
        "/* The widget seam. The content is in the page at render time; the control only changes",
        " * whether it is visible — which is why printing puts an untouched widget's content on the",
        " * paper without any component doing anything for it. */",
        ".widget {",
        "    margin: 1.5rem 0;",
        "    border: 1px solid var(--c-line);",
        "    border-radius: var(--radius);",
        "    padding: 1rem;",
        "}",
        ".widget-reveal {",
        "    font: inherit;",
        "    color: var(--c-accent);",
        "    background: none;",
        "    border: 0;",
        "    padding: 0;",
        "    cursor: pointer;",
        "}",
        "@media print {",
        "    .widget-reveal { display: none; }",
        "    .widget-content[hidden] { display: block !important; }",
        "}",
        renderCheckStyles(),
        renderParsonsStyles(),
        renderTraceStyles(),
    ].join("\n");
}
