/**
 * The checkable answer (epic #480, story #517, decision record #616): the one way the shared library
 * tells a learner whether an answer is right.
 *
 * Every exercise that asks the learner for an answer builds on this and compares nothing by its own
 * means, so a learner meets one way of asking to be checked and one way of being told the result.
 * A checkable answer is made of one or more ordered parts, one expected copy on the page, a check
 * control and a result area. One exercise can hold several of them: a typed signature is one part, a
 * Parsons order is one part per line, and each trace question is its own checkable answer.
 *
 * The expected copy is written into the widget's hidden region at render time, exactly once, and the
 * check compares against that copy — so what is checked and what is printed cannot disagree. The n-th
 * checkable answer in a widget pairs with the n-th expected copy in the same widget.
 *
 * **A match is equality after one spacing rule.** Leading and trailing whitespace is ignored,
 * whitespace next to punctuation is ignored, and whitespace between two word characters counts as
 * exactly one space. Case, names, punctuation and quote style all count. Parts are compared one by
 * one, in order, so joining them can never make a wrong answer look right.
 *
 * **Nothing survives.** Answer fields opt out of the browser saving and autofilling them, and every
 * time a page is shown — first opening, reload, or a return through the back/forward cache — every
 * checkable answer goes back to how it was written.
 */

import { escapeText } from "./html-escape.js";

/**
 * A checkable answer, placed in the widget's always-visible region. `parts` is the markup the learner
 * works with; every element in it carrying `data-part` is one ordered part of the answer — a field's
 * value, or an element's text.
 */
export function renderCheckableAnswer(parts: string): string {
    return [
        `<div class="answer-check" data-check>`,
        `<div class="answer-check-parts">`,
        parts,
        "</div>",
        `<button class="answer-check-control" type="button">Check my answer</button>`,
        `<p class="answer-check-result" role="status" aria-live="polite"></p>`,
        "</div>",
    ].join("\n");
}

/** A typed part: one answer field, labelled, that remembers nothing between openings. */
export function renderAnswerField(label: string): string {
    return (
        `<label class="answer-check-field">${escapeText(label)} ` +
        `<input type="text" data-part value="" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">` +
        `</label>`
    );
}

/**
 * The expected copy of one checkable answer, placed in the widget's hidden region. Each part is shown
 * as code, escaped, and carries `data-part` so the check reads exactly what the paper shows.
 */
export function renderExpectedAnswer(parts: readonly string[], heading: string): string {
    return [
        `<div class="answer-expected" data-expected>`,
        `<p class="answer-expected-heading">${escapeText(heading)}</p>`,
        `<pre><code>${parts.map((part) => `<span class="answer-expected-part" data-part>${escapeText(part)}</span>`).join("\n")}</code></pre>`,
        "</div>",
    ].join("\n");
}

/** The words a result is stated in. Text, never colour alone. */
export const RESULT_RIGHT: string = "Right — your answer matches the expected answer.";
export const RESULT_WRONG: string = "Not right — your answer does not match the expected answer.";

/**
 * The checking half of the workbook's classic script. It compares answers and changes what is
 * visible; it creates, fetches and runs nothing, and touches no storage.
 *
 * It emits `answer-checked` from a checkable answer once it has been checked, so another control can
 * wait on a check without comparing anything itself, and it treats any `input` event inside a
 * checkable answer as the answer changing — a control that rearranges parts announces the change
 * that way rather than reaching into the check.
 */
export function renderCheckScript(): string {
    return [
        "function spacingNormal(text) {",
        "    var trimmed = text.replace(/^\\s+|\\s+$/g, '');",
        "    return trimmed.replace(/\\s+/g, function (run, at, whole) {",
        "        var before = whole.charAt(at - 1);",
        "        var after = whole.charAt(at + run.length);",
        "        return /\\w/.test(before) && /\\w/.test(after) ? ' ' : '';",
        "    });",
        "}",
        "function partsOf(root) {",
        "    var parts = root.querySelectorAll('[data-part]');",
        "    var values = [];",
        "    for (var i = 0; i < parts.length; i++) {",
        "        var part = parts[i];",
        "        values.push(part.tagName === 'INPUT' || part.tagName === 'TEXTAREA' ? part.value : part.textContent);",
        "    }",
        "    return values;",
        "}",
        "function answersMatch(given, expected) {",
        "    if (given.length !== expected.length) return false;",
        "    for (var i = 0; i < given.length; i++) {",
        "        if (spacingNormal(given[i]) !== spacingNormal(expected[i])) return false;",
        "    }",
        "    return true;",
        "}",
        "function expectedCopyOf(check) {",
        "    var widget = check.closest('.widget');",
        "    if (widget === null) return null;",
        "    var checks = widget.querySelectorAll('[data-check]');",
        "    var copies = widget.querySelectorAll('[data-expected]');",
        "    for (var i = 0; i < checks.length; i++) {",
        "        if (checks[i] === check) return copies[i] || null;",
        "    }",
        "    return null;",
        "}",
        "function clearCheck(check) {",
        "    check.removeAttribute('data-checked');",
        "    var result = check.querySelector('.answer-check-result');",
        "    if (result !== null) result.textContent = '';",
        "}",
        "function runCheck(check) {",
        "    var expected = expectedCopyOf(check);",
        "    if (expected === null) return;",
        `    var right = answersMatch(partsOf(check.querySelector('.answer-check-parts')), partsOf(expected));`,
        "    check.setAttribute('data-checked', right ? 'right' : 'wrong');",
        "    var result = check.querySelector('.answer-check-result');",
        `    if (result !== null) result.textContent = right ? ${JSON.stringify(RESULT_RIGHT)} : ${JSON.stringify(RESULT_WRONG)};`,
        "    var widget = check.closest('.widget');",
        "    var reveal = widget === null ? null : widget.querySelector('.widget-reveal');",
        "    if (reveal !== null) reveal.disabled = false;",
        "    check.dispatchEvent(new CustomEvent('answer-checked', { bubbles: true, detail: { right: right } }));",
        "}",
        "function resetChecks(root) {",
        "    var checks = root.querySelectorAll('[data-check]');",
        "    for (var i = 0; i < checks.length; i++) {",
        "        clearCheck(checks[i]);",
        "        var fields = checks[i].querySelectorAll('input[data-part], textarea[data-part]');",
        "        for (var j = 0; j < fields.length; j++) fields[j].value = fields[j].defaultValue;",
        "        var widget = checks[i].closest('.widget');",
        "        var reveal = widget === null ? null : widget.querySelector('.widget-reveal');",
        "        if (reveal !== null) reveal.disabled = true;",
        "    }",
        "}",
        "document.addEventListener('click', function (event) {",
        "    var control = event.target.closest('.answer-check-control');",
        "    if (control === null) return;",
        "    var check = control.closest('[data-check]');",
        "    if (check !== null) runCheck(check);",
        "});",
        "document.addEventListener('input', function (event) {",
        "    var check = event.target.closest('[data-check]');",
        "    if (check !== null) clearCheck(check);",
        "});",
        "window.addEventListener('pageshow', function () { resetChecks(document); });",
        "resetChecks(document);",
    ].join("\n");
}

/** The stylesheet rules the checkable answer owns. No interactive control reaches the paper. */
export function renderCheckStyles(): string {
    return [
        "",
        "/* The checkable answer. The result is stated in words; the expected copy lives in the",
        " * widget's hidden region, which print already shows. */",
        ".answer-check { margin: 1rem 0 0; }",
        ".answer-check-field { display: block; }",
        ".answer-check-field input {",
        "    font-family: var(--font-mono, monospace);",
        "    width: 100%;",
        "    box-sizing: border-box;",
        "}",
        ".answer-check-control { font: inherit; margin-top: 0.5rem; }",
        ".answer-check-result:empty { display: none; }",
        "@media print {",
        "    .answer-check-field { display: none; }",
        "    .answer-check-control { display: none; }",
        "    .answer-check-result { display: none; }",
        "}",
        "",
    ].join("\n");
}
