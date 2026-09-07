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
 * The library ships empty. This story builds the seam and the library, not the components — the
 * first component arrives with the stage that asks for it.
 */

import { parse } from "yaml";
import { escapeText } from "./html-escape.js";

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
    /** A short label the reveal control shows before the content is visible. */
    summary: (data: Record<string, unknown>) => string;
    /** The widget's content, as page markup. Complete at render time. */
    render: (data: Record<string, unknown>) => string;
}

/** The library: every lesson in every workbook resolves against this one manifest. */
export type WidgetRegistry = Readonly<Record<string, WidgetComponent>>;

/**
 * The shipped library. It is empty: the seam exists so a component can be added, and the first one
 * arrives with the stage that needs it.
 */
export const WIDGET_MANIFEST: WidgetRegistry = {};

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

/**
 * Wrap a component's content in the reveal container. The content is in the page; the control only
 * changes whether it is visible, and printing shows it whether or not the learner touched it.
 */
export function renderWidgetShell(component: string, summary: string, content: string): string {
    return [
        `<div class="widget" data-widget="${escapeText(component)}">`,
        `<button class="widget-reveal" type="button" aria-expanded="false">${escapeText(summary)}</button>`,
        `<div class="widget-content" hidden>`,
        content,
        "</div>",
        "</div>",
    ].join("\n");
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
        return renderWidgetShell(
            declaration.component,
            component.summary(declaration.data),
            component.render(declaration.data),
        );
    };
}

/**
 * The workbook's interactive runtime, written once per workbook and loaded as a classic script —
 * a page opened from disk cannot load a module script. It toggles visibility and does nothing
 * else: no widget generates or fetches anything when the learner interacts with it.
 */
export function renderScript(): string {
    return [
        "/* Generated by the Nexus workbook renderer — do not edit by hand.",
        " * Interaction changes what is visible and nothing else: every widget's content is already",
        " * in the page, put there at render time. */",
        '"use strict";',
        "document.addEventListener('click', function (event) {",
        "    var control = event.target.closest('.widget-reveal');",
        "    if (control === null) return;",
        "    var content = control.parentNode.querySelector('.widget-content');",
        "    if (content === null) return;",
        "    var revealed = content.hasAttribute('hidden');",
        "    if (revealed) content.removeAttribute('hidden');",
        "    else content.setAttribute('hidden', '');",
        "    control.setAttribute('aria-expanded', String(revealed));",
        "});",
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
        "",
    ].join("\n");
}
