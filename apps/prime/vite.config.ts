import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: "../../node_modules/.vite/apps/prime",
    server: {
        port: 4200,
        host: "localhost",
    },
    plugins: [reactRouter()],
    optimizeDeps: {
        /*
         * `@nexus/editor` is workspace source, so Vite only discovers its
         * `@lexical/*` imports by crawling that file at request time, one
         * entry per request. On a cold start that forces a round of
         * "Outdated Optimize Dep" reloads per undiscovered entry — a
         * keystroke landing mid-reload can drop the Enter-submit gesture
         * (the field remounts without it). Listing every entry up front
         * makes the optimizer bundle them all in one pass, so there is
         * nothing left to discover once the app is interactive.
         *
         * pnpm keeps these under `libs/editor/node_modules`, not
         * `apps/prime`'s, so they are not resolvable as bare specifiers
         * from this root. The `@nexus/editor > <dep>` form tells Vite to
         * resolve each nested dep through the editor package.
         */
        include: [
            "@nexus/editor > @lexical/code",
            "@nexus/editor > @lexical/link",
            "@nexus/editor > @lexical/list",
            "@nexus/editor > @lexical/markdown",
            "@nexus/editor > @lexical/react/LexicalAutoFocusPlugin",
            "@nexus/editor > @lexical/react/LexicalComposer",
            "@nexus/editor > @lexical/react/LexicalComposerContext",
            "@nexus/editor > @lexical/react/LexicalContentEditable",
            "@nexus/editor > @lexical/react/LexicalErrorBoundary",
            "@nexus/editor > @lexical/react/LexicalHistoryPlugin",
            "@nexus/editor > @lexical/react/LexicalHorizontalRuleNode",
            "@nexus/editor > @lexical/react/LexicalHorizontalRulePlugin",
            "@nexus/editor > @lexical/react/LexicalLinkPlugin",
            "@nexus/editor > @lexical/react/LexicalListPlugin",
            "@nexus/editor > @lexical/react/LexicalMarkdownShortcutPlugin",
            "@nexus/editor > @lexical/react/LexicalOnChangePlugin",
            "@nexus/editor > @lexical/react/LexicalPlainTextPlugin",
            "@nexus/editor > @lexical/react/LexicalRichTextPlugin",
            "@nexus/editor > @lexical/react/LexicalTablePlugin",
            "@nexus/editor > @lexical/rich-text",
            "@nexus/editor > @lexical/table",
            "@nexus/editor > lexical",
        ],
    },
    build: {
        reportCompressedSize: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    environments: {
        ssr: {
            build: {
                rollupOptions: {
                    input: "./server/app.ts",
                },
            },
        },
    },
});
