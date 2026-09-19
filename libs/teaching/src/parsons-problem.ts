/**
 * Parsons problems (epic #480, story #518): the learner puts shuffled lines into the order that makes
 * them work and is told whether the order is right, so they practise the shape of a solution without
 * typing every character of it.
 *
 * The order is one checkable answer with one part per line, checked by the mechanism story #517
 * built and nothing else — so two identical lines are interchangeable, and joining lines can never
 * make a wrong order look right.
 *
 * **The shuffle is written into the page.** It is a fixed function of the declaration's lines, so the
 * same lesson always renders byte-identical pages, a reload meets the same problem, and the paper
 * matches the screen. It never equals the expected order: a shuffle that lands on it is rotated by
 * one, and a sequence holding two distinct lines always differs from its own rotation. That guard
 * compares lines with every whitespace character removed, which is stricter than the check's spacing
 * rule, so a written shuffle can never pass the check.
 *
 * **Lines move by swapping with a neighbour.** A swap cannot lose or duplicate a line, and a pair of
 * native buttons per line works by keyboard, touch and pointer on a page opened from a file — which
 * drag and drop does not. Focus stays on the moved line and its new position is announced. A move
 * tells the checkable answer it changed with an ordinary `input` event, so the result clears without
 * this component reaching into the check.
 */

import { renderCheckableAnswer, renderExpectedAnswer } from "./answer-check.js";
import { escapeText } from "./html-escape.js";
import { type WidgetComponent } from "./workbook-widgets.js";

/** The name a lesson declares to use this component. */
export const PARSONS_PROBLEM_COMPONENT: string = "parsons-problem";

function linesOf(data: Record<string, unknown>): string[] {
    const lines: unknown = data["lines"];
    return Array.isArray(lines) ? lines.map((line) => (line === null || line === undefined ? "" : String(line))) : [];
}

/** A line as the order guard sees it: with no whitespace at all. */
function bare(line: string): string {
    return line.replace(/\s+/g, "");
}

/** A 32-bit FNV-1a hash of the lines: the seed that makes the shuffle a function of the declaration. */
function seedOf(lines: readonly string[]): number {
    let hash: number = 0x811c9dc5;
    for (const char of JSON.stringify(lines)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

/**
 * The order the lines are written in: a seeded Fisher–Yates shuffle of their positions, rotated by
 * one when it would open solved.
 */
function writtenOrder(lines: readonly string[]): number[] {
    let state: number = seedOf(lines);
    const next = (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t: number = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const order: number[] = lines.map((_line, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
        const j: number = Math.floor(next() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    const solved: boolean = order.every((position, index) => bare(lines[position]) === bare(lines[index]));
    return solved ? [...order.slice(1), order[0]] : order;
}

function renderLine(line: string, written: number): string {
    const text: string = escapeText(line);
    return [
        `<li class="parsons-line" data-line="${written}">`,
        `<code class="parsons-text" data-part>${text}</code>`,
        `<span class="parsons-moves">`,
        `<button class="parsons-move" type="button" data-move="earlier" aria-label="Move earlier: ${text}">Earlier</button>`,
        `<button class="parsons-move" type="button" data-move="later" aria-label="Move later: ${text}">Later</button>`,
        "</span>",
        "</li>",
    ].join("");
}

export const PARSONS_PROBLEM: WidgetComponent = {
    codeFields: ["lines"],
    refuse: (data) => {
        const lines: string[] = linesOf(data);
        if (lines.length === 0) return "it declares no lines ('lines')";
        if (new Set(lines.map(bare)).size < 2) return "it declares fewer than two distinct lines, so no order of them can be wrong";
        return null;
    },
    lead: (data) => {
        const lines: string[] = linesOf(data);
        const parts: string = [
            `<ol class="parsons-lines">`,
            ...writtenOrder(lines).map((position, written) => renderLine(lines[position], written)),
            "</ol>",
            `<p class="parsons-announce" aria-live="polite"></p>`,
        ].join("\n");
        return [`<p class="widget-question">${escapeText(String(data["prompt"] ?? ""))}</p>`, renderCheckableAnswer(parts)].join("\n");
    },
    summary: () => "Reveal the expected order",
    render: (data) => renderExpectedAnswer(linesOf(data), "Expected order"),
};

/**
 * The moving half of the workbook's classic script. It reorders lines already on the page and
 * creates, fetches and runs nothing.
 */
export function renderParsonsScript(): string {
    return [
        "function announceMove(line) {",
        "    var list = line.parentNode;",
        "    var announce = list.parentNode.querySelector('.parsons-announce');",
        "    if (announce === null) return;",
        "    var position = Array.prototype.indexOf.call(list.children, line) + 1;",
        "    announce.textContent = 'Line moved to position ' + position + ' of ' + list.children.length + '.';",
        "}",
        "document.addEventListener('click', function (event) {",
        "    var control = event.target.closest('[data-move]');",
        "    if (control === null) return;",
        "    var line = control.closest('.parsons-line');",
        "    if (line === null) return;",
        "    var list = line.parentNode;",
        "    if (control.getAttribute('data-move') === 'earlier') {",
        "        if (line.previousElementSibling === null) return;",
        "        list.insertBefore(line, line.previousElementSibling);",
        "    } else {",
        "        if (line.nextElementSibling === null) return;",
        "        list.insertBefore(line.nextElementSibling, line);",
        "    }",
        "    control.focus();",
        "    announceMove(line);",
        "    line.dispatchEvent(new Event('input', { bubbles: true }));",
        "});",
        "function resetParsons(root) {",
        "    var lists = root.querySelectorAll('.parsons-lines');",
        "    for (var i = 0; i < lists.length; i++) {",
        "        var lines = Array.prototype.slice.call(lists[i].children);",
        "        lines.sort(function (a, b) { return Number(a.getAttribute('data-line')) - Number(b.getAttribute('data-line')); });",
        "        for (var j = 0; j < lines.length; j++) lists[i].appendChild(lines[j]);",
        "        var announce = lists[i].parentNode.querySelector('.parsons-announce');",
        "        if (announce !== null) announce.textContent = '';",
        "    }",
        "}",
        "window.addEventListener('pageshow', function () { resetParsons(document); });",
    ].join("\n");
}

/** The stylesheet rules the Parsons problem owns. Lines keep their indentation; controls stay off paper. */
export function renderParsonsStyles(): string {
    return [
        "",
        "/* The Parsons problem. */",
        ".parsons-lines { list-style: none; padding: 0; margin: 0; }",
        ".parsons-line { display: flex; align-items: center; gap: 0.5rem; }",
        ".parsons-text { white-space: pre; flex: 1; }",
        ".parsons-move { font: inherit; }",
        ".parsons-announce {",
        "    position: absolute;",
        "    width: 1px;",
        "    height: 1px;",
        "    overflow: hidden;",
        "    clip: rect(0 0 0 0);",
        "}",
        "@media print {",
        "    .parsons-moves { display: none; }",
        "}",
        "",
    ].join("\n");
}
