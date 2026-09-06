/**
 * Escaping text for a page (epic #405). It lives on its own because both halves of the renderer
 * need it — the markdown conversion and the widget seam — and neither should have to import the
 * other to get it.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
};

/** Render text as text: a lesson's angle brackets are shown to the reader, never acted on. */
export function escapeText(text: string): string {
    return text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);
}
