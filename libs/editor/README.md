# @nexus/editor

Markdown editor library. Single public export: the `MarkdownEditor` React component. Built on [Lexical](https://lexical.dev) `0.38.2`. Edits and renders Markdown round-trip (string in → string out).

## Public API

Import path: `@nexus/editor` (resolved via the package `exports` in [package.json](package.json) — a pnpm workspace package, no tsconfig path mapping).

```ts
import { MarkdownEditor } from "@nexus/editor";
import type { MarkdownEditorProps } from "@nexus/editor";
```

These two symbols are the entire public surface. Source: [src/index.ts](src/index.ts). Do NOT import from internal files (`markdown-editor`, `editor-theme`, `table-action-menu-plugin`) — they are not re-exported as stable API.

### `MarkdownEditorProps`

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `content` | `string` | `""` | Initial Markdown. See "Reactivity contract" below — NOT a controlled value. |
| `mode` | `"edit" \| "view"` | `"edit"` | `"view"` = read-only, no toolbar/history/shortcuts, `pointer-events: none`. |
| `onChange` | `(markdown: string) => void` | — | Fires on every edit with serialized Markdown. Ignored in `view` mode. |
| `onFocus` | `() => void` | — | Fires when the content area gains focus. Ignored in `view` mode. |
| `placeholder` | `string` | `"Start typing..."` | Shown only in `edit` mode when empty. |
| `className` | `string` | `""` | Appended to the root wrapper `div` (`relative w-full`). |

## Minimal usage

```tsx
import { useState } from "react";
import { MarkdownEditor } from "@nexus/editor";

function Example() {
    const [md, setMd] = useState("# Hello\n\nText.");
    return <MarkdownEditor content={md} mode="edit" onChange={setMd} />;
}
```

Read-only render:

```tsx
<MarkdownEditor content={markdown} mode="view" />
```

The component self-contains its Lexical `LexicalComposer`. Do NOT wrap it in your own composer or pass Lexical nodes/config — there is no prop for that.

## Reactivity contract (critical)

- `content` is read into editor state via a `useEffect` keyed on `[content, editor, transformers]`. Changing the `content` prop string DOES re-initialize the document. This means external prop updates and internal user edits both write to the same editor — feeding `onChange` output straight back into `content` is fine for a controlled-style loop but be aware each new string reference triggers a re-convert.
- `mode` is wired to `LexicalComposer key={mode}`. Toggling `mode` REMOUNTS the editor (fresh state). After a mode switch, state is rebuilt from the current `content` prop, so persist edits via `onChange` before toggling or they are lost.
- Empty `content` (`""`) skips the initializer plugin entirely.

## Supported Markdown

Standard Lexical `TRANSFORMERS` plus two custom transformers defined in [src/markdown-editor.tsx](src/markdown-editor.tsx):

- Headings `#`–`#####`, bold, italic, underline, strikethrough, inline `code`.
- Lists (ordered `ol`, unordered `ul`, nested), blockquotes, code blocks, links (and autolinks).
- **Horizontal rules** — `HR_TRANSFORMER`. Matches `---`, `***`, `___`. Exports as `---`.
- **Tables** — `TABLE_TRANSFORMER` (`MultilineElementTransformer`). GFM pipe syntax: header row, `| --- | --- |` divider, body rows. First row is always treated as a header row. Export normalizes dividers to `---` and pads cells with single spaces.

In `edit` mode, `MarkdownShortcutPlugin` makes these shortcuts live as you type (e.g. typing `## ` creates an h2, `| a | b |` + divider creates a table).

## Tables editing

In `edit` mode, placing the caret inside a table cell shows a floating toolbar ([src/table-action-menu-plugin.tsx](src/table-action-menu-plugin.tsx)) for insert/delete row and column. It is absolutely positioned relative to the editor root and auto-hides when selection leaves table cells. No configuration; active automatically in `edit` mode.

## Styling requirements

- **Tailwind CSS is required.** The theme ([src/editor-theme.ts](src/editor-theme.ts)) and all class names use Tailwind utility classes plus design-token color names: `foreground`, `muted`, `muted-foreground`, `border`, `primary`, `accent`, `accent-foreground`, `background`, `popover`, `destructive`. The consuming app MUST define these tokens (this repo's Tailwind/quantum theme does). Without them, text/borders render with no color.
- Edit-mode content area is `min-h-[300px]`; view mode collapses to content height.
- To customize outer layout, use `className`; to customize element styling, the theme is internal and not overridable via props.

## Dependencies

Runtime deps (see [package.json](package.json)): `lexical` + `@lexical/*` (`code`, `link`, `list`, `markdown`, `react`, `rich-text`, `table`), all pinned to `0.38.2`. Keep these versions in lockstep — mismatched `@lexical/*` versions break at runtime.

Peer/host expectations NOT in this package's deps, must be provided by the consumer:
- `react` (hooks: `useState`, `useEffect`, `useRef`, `useCallback`).
- `lucide-react` — `Trash2` icon used by the table toolbar.
- Tailwind CSS with the design tokens above.

## Build / test (Nx)

Project name `@nexus/editor`, type `library`. This is a **source-consumed** lib: the package
`exports` point straight at `src/index.ts`, so consumers (e.g. `apps/prime`) import the
TypeScript source and their own bundler compiles it — there is no separate build step or
`dist/` output. Targets are inferred by the Nx plugins (no per-lib executor config).

```bash
npx nx lint @nexus/editor
npx nx typecheck @nexus/editor   # tsc --build (emitDeclarationOnly)
npx nx show project @nexus/editor
```

## Agent gotchas

- Only `MarkdownEditor` and `MarkdownEditorProps` are exported — adding new exports requires editing [src/index.ts](src/index.ts).
- There is no `value`/`defaultValue` prop and no imperative ref handle; interact only via `content` + `onChange`.
- `onChange` and `onFocus` are silently inactive in `view` mode (conditionally rendered plugins).
- Switching `mode` remounts and reseeds from `content` — round-trip edits through `onChange` first.
- All colors come from external Tailwind design tokens; a "no styles" bug is almost always a missing-token / missing-Tailwind issue in the host app, not this lib.
