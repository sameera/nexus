const { createGlobPatternsForDependencies } = require("@nx/react/tailwind");
const { join } = require("path");

/*
 * Tailwind colors map onto the semantic CSS-variable tokens defined in
 * styles.css. Because every color resolves through `var(--c-*)`, switching the
 * `data-theme` on the shell root re-resolves all utilities to the active mode
 * with zero per-region theme branching. Each token carries exactly one value at
 * any moment — the single token source of truth the epic requires.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        join(
            __dirname,
            "{src,pages,components,app}/**/!(*.stories|*.spec).{ts,tsx,html}",
        ),
        ...createGlobPatternsForDependencies(__dirname),
    ],
    theme: {
        extend: {
            colors: {
                // base palette
                bg: "var(--c-bg)",
                "bg-glow": "var(--c-bg-glow)",
                term: "var(--c-term)",
                chrome: "var(--c-chrome)",
                line: "var(--c-line)",
                ink: {
                    DEFAULT: "var(--c-ink)",
                    dim: "var(--c-ink-dim)",
                    faint: "var(--c-ink-faint)",
                },
                accent: {
                    DEFAULT: "var(--c-accent)",
                    soft: "var(--c-accent-soft)",
                },
                green: "var(--c-green)",
                blue: "var(--c-blue)",
                violet: "var(--c-violet)",
                red: "var(--c-red)",
                gate: "var(--c-gate)",
                warn: "var(--c-warn)",

                // ink-on-colored-surface
                "on-accent": "var(--c-on-accent)",
                "on-gate": "var(--c-on-gate)",
                "on-green": "var(--c-on-green)",
                "on-red": "var(--c-on-red)",

                // raised surfaces + hairlines
                "surface-input": "var(--c-surface-input)",
                "surface-btn": "var(--c-surface-btn)",
                "surface-row": "var(--c-surface-row)",
                "row-line": "var(--c-row-line)",
                "seg-done-hover": "var(--c-seg-done-hover)",
                scrollbar: "var(--c-scrollbar)",
                "term-line": "var(--c-term-line)",

                // gate tray + validation surfaces
                "gate-surface": "var(--c-gate-surface)",
                "validation-surface": "var(--c-validation-surface)",
                "vio-surface": "var(--c-vio-surface)",
                "vio-line": "var(--c-vio-line)",
                "vio-passed-surface": "var(--c-vio-passed-surface)",
                "vio-passed-line": "var(--c-vio-passed-line)",
                "fix-ink": "var(--c-fix-ink)",
                "fix-line": "var(--c-fix-line)",
                "fix-hover": "var(--c-fix-hover)",

                // advance bar
                "advance-surface": "var(--c-advance-surface)",
                "advance-line": "var(--c-advance-line)",

                // drawer overlay
                scrim: "var(--c-scrim)",

                // alpha tints (alpha flips between modes)
                "badge-user": "var(--c-badge-user)",
                "badge-system": "var(--c-badge-system)",
                "gate-grad": "var(--c-gate-grad)",
                "validation-grad": "var(--c-validation-grad)",
                "weighty-ring": "var(--c-weighty-ring)",
            },
            borderRadius: {
                token: "var(--radius)",
            },
            fontFamily: {
                mono: ["var(--font-mono)"],
                sans: ["var(--font-sans)"],
            },
            boxShadow: {
                drawer: "-24px 0 48px var(--c-drawer-shadow)",
            },
            keyframes: {
                // The gate segment's attention pulse (mockup `@keyframes gatepulse`).
                "gate-pulse": {
                    "0%, 100%": { boxShadow: "0 0 0 0 var(--c-gate-pulse)" },
                    "50%": { boxShadow: "0 0 0 5px transparent" },
                },
                // The terminal input caret (mockup `@keyframes blink`).
                blink: {
                    "50%": { opacity: "0" },
                },
            },
            animation: {
                "gate-pulse": "gate-pulse 1.6s ease-in-out infinite",
                blink: "blink 1.1s step-end infinite",
            },
        },
    },
    plugins: [],
};
