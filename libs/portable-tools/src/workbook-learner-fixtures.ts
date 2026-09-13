/**
 * A learner working a rendered workbook page, in a spec (epic #480, decision record #616).
 *
 * The page fixtures read static markup, which is enough for a reveal: the content is in the page and
 * the control only changes whether it shows. Checking an answer is different — the spacing rule, the
 * result and what clears it only exist when the shipped script runs. So this module opens a rendered
 * page in a browser-like window, runs the workbook's own script against it, and hands the spec back
 * the actions a learner takes and what they would see. A spec never reads the script's text or names
 * a tag to test checking behaviour.
 *
 * Like the page fixtures, this is the one place that knows what the markup looks like. It also
 * records every attempt the script makes to reach the network or keep anything, because a page
 * opened from a file has neither and a script that tried would fail a learner silently.
 *
 * Spec-only: nothing the toolkit ships imports it.
 */

import { JSDOM } from "jsdom";
import { type RenderedFile } from "./workbook-render";
import { SCRIPT_NAME } from "./workbook-widgets";

/** What a learner can do on a page and what they can see there. */
export interface LearnerPage {
    /** Every word showing on screen right now, in page order. */
    visibleText(): string;
    /** Type into the n-th answer field on the page, replacing what was there. */
    type(text: string, field?: number): void;
    /** What the n-th answer field holds. */
    typed(field?: number): string;
    /** Every answer field on the page opts out of the browser remembering or restoring what was typed. */
    fieldsRememberNothing(): boolean;
    /** The lines of the n-th Parsons problem on the page, in the order they stand now, as written. */
    lines(problem?: number): string[];
    /** Move a line of the n-th Parsons problem one position earlier, with its own control. */
    moveEarlier(line: number, problem?: number): void;
    /** Move a line of the n-th Parsons problem one position later, with its own control. */
    moveLater(line: number, problem?: number): void;
    /** The text of the line that holds keyboard focus, or "" when no line does. */
    focusedLine(): string;
    /** What the page last announced about a move. */
    announcement(): string;
    /** Every move control is a native control a keyboard reaches and presses. */
    movesWorkFromKeyboard(): boolean;
    /** The text of the line the n-th trace stepper marks as the current one. */
    markedLine(trace?: number): string;
    /** The state the n-th trace stepper shows beside its snippet right now. */
    stateShown(trace?: number): string;
    /** Whether the n-th trace stepper's step control can be pressed. */
    canStep(trace?: number): boolean;
    /** Press the n-th trace stepper's step control; a control that cannot be pressed does nothing. */
    step(trace?: number): void;
    /** Press the n-th check control on the page. */
    check(answer?: number): void;
    /** What the n-th result area says, or "" when it says nothing. */
    result(answer?: number): string;
    /** The n-th result area is announced to assistive technology when it changes. */
    resultIsAnnounced(answer?: number): boolean;
    /** Whether the n-th widget's reveal control can be pressed. */
    canReveal(widget?: number): boolean;
    /** Press the n-th widget's reveal control, and return what is showing inside it afterwards. */
    reveal(widget?: number): string;
    /** The learner leaves and comes back through the browser's back/forward cache. */
    returnThroughHistory(): void;
    /** Every way the script tried to reach the network or keep something. */
    reachedFor: string[];
}

function normalise(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

/** The names of the facilities a page opened from a file does not have. */
const WINDOW_FACILITIES: readonly string[] = [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "caches",
];

/** Open a rendered page as a learner's browser does, with the workbook's own script running. */
export function openPage(files: readonly RenderedFile[], pageName: string): LearnerPage {
    const page: RenderedFile | undefined = files.find((f) => f.name === pageName);
    const script: RenderedFile | undefined = files.find((f) => f.name === SCRIPT_NAME);
    if (page === undefined || script === undefined) throw new Error(`no ${pageName} or ${SCRIPT_NAME} in the render`);

    const dom: JSDOM = new JSDOM(page.contents, { runScripts: "outside-only", pretendToBeVisual: true });
    const win = dom.window;
    const doc: Document = win.document;
    const reachedFor: string[] = [];

    const trap = (target: object, name: string): void => {
        Object.defineProperty(target, name, {
            configurable: true,
            get() {
                reachedFor.push(name);
                return undefined;
            },
            set() {
                reachedFor.push(name);
            },
        });
    };
    for (const name of WINDOW_FACILITIES) trap(win, name);
    trap(doc, "cookie");
    trap(win.history, "pushState");
    trap(win.history, "replaceState");
    trap(win.navigator, "sendBeacon");

    win.eval(script.contents);
    win.dispatchEvent(new win.PageTransitionEvent("pageshow", { persisted: false }));

    const hidden = (element: Element): boolean => {
        for (let node: Element | null = element; node !== null; node = node.parentElement) {
            if (node.hasAttribute("hidden")) return true;
        }
        return false;
    };
    const fields = (): HTMLInputElement[] => [...doc.querySelectorAll<HTMLInputElement>("input[data-part]")];
    const checks = (): Element[] => [...doc.querySelectorAll("[data-check]")];
    const nth = <T>(items: T[], index: number, what: string): T => {
        const item: T | undefined = items[index];
        if (item === undefined) throw new Error(`the page has no ${what} #${index}`);
        return item;
    };
    const click = (element: Element): void => {
        element.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
    };
    const revealOf = (widget: number): HTMLButtonElement =>
        nth([...doc.querySelectorAll<HTMLButtonElement>(".widget-reveal")], widget, "reveal control");

    const problems = (): Element[] => [...doc.querySelectorAll(".parsons-lines")];
    const lineText = (line: Element): string => line.querySelector("[data-part]")?.textContent ?? "";
    const move = (direction: "earlier" | "later", line: number, problem: number): void => {
        const row: Element = nth([...nth(problems(), problem, "Parsons problem").children], line, "line");
        const control: HTMLButtonElement | null = row.querySelector(`button[data-move="${direction}"]`);
        if (control === null) throw new Error(`line #${line} has no control to move it ${direction}`);
        control.focus();
        click(control);
    };

    const traces = (): Element[] => [...doc.querySelectorAll("[data-trace]")];
    const stepControl = (trace: number): HTMLButtonElement => {
        const control: HTMLButtonElement | null = nth(traces(), trace, "trace stepper").querySelector(".trace-step-forward");
        if (control === null) throw new Error(`trace stepper #${trace} has no step control`);
        return control;
    };

    return {
        markedLine(trace: number = 0): string {
            const marked: Element | null = nth(traces(), trace, "trace stepper").querySelector(".trace-line[aria-current]");
            return marked === null ? "" : (marked.textContent ?? "").trim();
        },
        stateShown(trace: number = 0): string {
            const states: Element[] = [...nth(traces(), trace, "trace stepper").querySelectorAll(".trace-state")].filter((s) => !hidden(s));
            return states.map((s) => normalise(s.querySelector("pre")?.textContent ?? "")).join(" ");
        },
        canStep(trace: number = 0): boolean {
            return !stepControl(trace).disabled;
        },
        step(trace: number = 0): void {
            const control: HTMLButtonElement = stepControl(trace);
            if (!control.disabled) click(control);
        },
        lines(problem: number = 0): string[] {
            return [...nth(problems(), problem, "Parsons problem").children].map(lineText);
        },
        moveEarlier(line: number, problem: number = 0): void {
            move("earlier", line, problem);
        },
        moveLater(line: number, problem: number = 0): void {
            move("later", line, problem);
        },
        focusedLine(): string {
            const row: Element | null = doc.activeElement?.closest(".parsons-line") ?? null;
            return row === null ? "" : lineText(row);
        },
        announcement(): string {
            return [...doc.querySelectorAll(".parsons-announce")].map((a) => normalise(a.textContent ?? "")).join(" ").trim();
        },
        movesWorkFromKeyboard(): boolean {
            const controls: Element[] = [...doc.querySelectorAll("[data-move]")];
            return (
                controls.length > 0 &&
                controls.every((c) => c.tagName === "BUTTON" && c.getAttribute("tabindex") !== "-1" && c.getAttribute("aria-label") !== "")
            );
        },
        visibleText(): string {
            const visible: string[] = [];
            for (const element of doc.body.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, footer, button, label")) {
                if (hidden(element)) continue;
                if (element.parentElement?.closest("p, li, pre, label, button") != null) continue;
                visible.push(normalise(element.textContent ?? ""));
            }
            return visible.filter((t) => t !== "").join(" ");
        },
        type(text: string, field: number = 0): void {
            const input: HTMLInputElement = nth(fields(), field, "answer field");
            input.focus();
            input.value = text;
            input.dispatchEvent(new win.Event("input", { bubbles: true }));
        },
        typed(field: number = 0): string {
            return nth(fields(), field, "answer field").value;
        },
        fieldsRememberNothing(): boolean {
            return fields().every((input) => input.getAttribute("autocomplete") === "off");
        },
        check(answer: number = 0): void {
            const control: Element | null = nth(checks(), answer, "check").querySelector(".answer-check-control");
            if (control === null) throw new Error(`check #${answer} has no control`);
            click(control);
        },
        result(answer: number = 0): string {
            const area: Element | null = nth(checks(), answer, "check").querySelector(".answer-check-result");
            return area === null || hidden(area) ? "" : normalise(area.textContent ?? "");
        },
        resultIsAnnounced(answer: number = 0): boolean {
            const area: Element | null = nth(checks(), answer, "check").querySelector(".answer-check-result");
            return area !== null && (area.getAttribute("role") === "status" || area.hasAttribute("aria-live"));
        },
        canReveal(widget: number = 0): boolean {
            return !revealOf(widget).disabled;
        },
        reveal(widget: number = 0): string {
            const control: HTMLButtonElement = revealOf(widget);
            click(control);
            const content: Element | null = control.parentElement?.querySelector(".widget-content") ?? null;
            return content === null || hidden(content) ? "" : normalise(content.textContent ?? "");
        },
        returnThroughHistory(): void {
            win.dispatchEvent(new win.PageTransitionEvent("pagehide", { persisted: true }));
            win.dispatchEvent(new win.PageTransitionEvent("pageshow", { persisted: true }));
        },
        reachedFor,
    };
}
