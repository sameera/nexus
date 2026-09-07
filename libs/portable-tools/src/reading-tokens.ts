/**
 * The shared reading-surface definition (epic #405, story #447, record #450 invariant 20).
 *
 * The workbook declares no colour and no typography of its own. That is only possible while a
 * shared definition exists, because a library cannot depend on an application — the choice is one
 * shared definition or a copy, and a copy is defining its own.
 *
 * Only the *reading* subset is lifted here: background, ink levels, accent, rules, code surfaces,
 * type stacks and radius. Application chrome tokens — gate trays, validation surfaces, drawer
 * shadows, badge tints — stay with the application, so this file does not become a home for them.
 *
 * Both consumers read the CSS this module renders: the application imports the generated file,
 * and the workbook's stylesheet embeds it. Neither restates a value.
 */

/** One token: the custom-property name and what it is for. */
export interface ReadingToken {
    name: string;
    role: string;
}

/** The reading subset, in a stable order so every rendering is byte-identical. */
export const READING_TOKENS: readonly ReadingToken[] = [
    { name: "--c-bg", role: "the page background" },
    { name: "--c-ink", role: "body text" },
    { name: "--c-ink-dim", role: "secondary text" },
    { name: "--c-ink-faint", role: "the quietest text on the surface" },
    { name: "--c-accent", role: "links and emphasis" },
    { name: "--c-accent-soft", role: "the accent at rest" },
    { name: "--c-line", role: "rules and hairlines" },
    { name: "--c-term", role: "the code surface" },
    { name: "--c-term-line", role: "the code surface's hairline" },
    { name: "--font-sans", role: "the prose type stack" },
    { name: "--font-mono", role: "the code type stack" },
    { name: "--radius", role: "corner radius" },
];

export const READING_TOKEN_NAMES: readonly string[] = READING_TOKENS.map((t) => t.name);

/** Values that do not flip between modes. */
export const MODE_INVARIANT_VALUES: Readonly<Record<string, string>> = {
    "--radius": "7px",
    "--font-mono": '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, Menlo,\n        Consolas, monospace',
    "--font-sans": 'ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif',
};

export const DARK_VALUES: Readonly<Record<string, string>> = {
    "--c-bg": "#16161a",
    "--c-ink": "#e6e6ea",
    "--c-ink-dim": "#8a8a96",
    "--c-ink-faint": "#5a5a66",
    "--c-accent": "#d59766",
    "--c-accent-soft": "#c98a57",
    "--c-line": "#2a2a33",
    "--c-term": "#0e0e11",
    "--c-term-line": "#1a1a20",
};

export const LIGHT_VALUES: Readonly<Record<string, string>> = {
    "--c-bg": "#eceae6",
    "--c-ink": "#23232a",
    "--c-ink-dim": "#65656f",
    "--c-ink-faint": "#9a9aa2",
    "--c-accent": "#bf6a2e",
    "--c-accent-soft": "#a85a26",
    "--c-line": "#d9d7d0",
    "--c-term": "#fbfaf8",
    "--c-term-line": "#e7e5df",
};

/** The banner every generated copy of this definition carries. */
export const READING_TOKENS_BANNER: string =
    "/* Generated from libs/portable-tools/src/reading-tokens.ts — do not edit by hand.\n" +
    " * The one definition of the reading surface, shared by the application and every workbook\n" +
    " * page, so neither carries a colour or a type stack the other could drift from. */";

function block(selector: string, values: Readonly<Record<string, string>>): string {
    const lines: string[] = READING_TOKENS.filter((t) => t.name in values).map(
        (t) => `    ${t.name}: ${values[t.name]};`,
    );
    return `${selector} {\n${lines.join("\n")}\n}`;
}

/**
 * The shared definition as CSS. Dark is also the fallback, matching the application's own default,
 * so a page with no theme attribute still resolves every token.
 */
export function renderReadingTokensCss(): string {
    return [
        READING_TOKENS_BANNER,
        "",
        block(":root", MODE_INVARIANT_VALUES),
        "",
        block(':root,\n[data-theme="dark"]', DARK_VALUES),
        "",
        block('[data-theme="light"]', LIGHT_VALUES),
        "",
    ].join("\n");
}
