import { useEffect } from "react";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import type {
    ElementTransformer,
    MultilineElementTransformer,
} from "@lexical/markdown";
import {
    $convertFromMarkdownString,
    $convertToMarkdownString,
    TRANSFORMERS,
} from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import {
    $createHorizontalRuleNode,
    $isHorizontalRuleNode,
    HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
    $createTableCellNode,
    $createTableNode,
    $createTableRowNode,
    $isTableNode,
    TableCellHeaderStates,
    TableCellNode,
    TableNode,
    TableRowNode,
} from "@lexical/table";
import type { EditorState } from "lexical";
import {
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    COMMAND_PRIORITY_HIGH,
    KEY_ENTER_COMMAND,
} from "lexical";

import { editorTheme } from "./editor-theme.js";
import { TableActionMenuPlugin } from "./table-action-menu-plugin.js";

export interface MarkdownEditorProps {
    content?: string;
    /*
     * `edit`/`view` are the Markdown modes. `raw-edit` is a plain-text,
     * submit-capable mode: it mounts none of the Markdown machinery, delivers
     * text verbatim (no Markdown serialization), and owns the Enter gesture
     * (Enter submits and self-clears, Shift+Enter inserts a newline).
     */
    mode?: "edit" | "view" | "raw-edit";
    onChange?: (markdown: string) => void;
    /* Called in `raw-edit` mode with the verbatim text when Enter submits. */
    onSubmit?: (text: string) => void;
    onFocus?: () => void;
    placeholder?: string;
    className?: string;
}

const HR_TRANSFORMER: ElementTransformer = {
    dependencies: [HorizontalRuleNode],
    export: (node) => ($isHorizontalRuleNode(node) ? "---" : null),
    regExp: /^(---|\*\*\*|___)\s?$/,
    replace: (parentNode, _children, _match, isImport) => {
        const line = $createHorizontalRuleNode();
        if (isImport || parentNode.getNextSibling() != null) {
            parentNode.replace(line);
        } else {
            parentNode.insertBefore(line);
        }
        line.selectNext();
    },
    type: "element",
};

const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/;
const TABLE_ROW_DIVIDER_REG_EXP = /^(\| ?:?-+:? ?)+\|\s?$/;

const parseTableCells = (line: string): string[] =>
    line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());

const TABLE_TRANSFORMER: MultilineElementTransformer = {
    dependencies: [TableNode, TableRowNode, TableCellNode],
    export: (node) => {
        if (!$isTableNode(node)) return null;
        const rows = node.getChildren() as TableRowNode[];
        if (rows.length === 0) return null;
        const toRowString = (row: TableRowNode) =>
            "| " +
            (row.getChildren() as TableCellNode[])
                .map((c) => c.getTextContent().trim())
                .join(" | ") +
            " |";
        const headerStr = toRowString(rows[0]);
        const colCount = (rows[0].getChildren() as TableCellNode[]).length;
        const divider = "| " + Array(colCount).fill("---").join(" | ") + " |";
        return [headerStr, divider, ...rows.slice(1).map(toRowString)].join(
            "\n",
        );
    },
    handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
        const headerLine = lines[startLineIndex];
        if (!TABLE_ROW_REG_EXP.test(headerLine)) return null;
        const dividerLine = lines[startLineIndex + 1];
        if (!dividerLine || !TABLE_ROW_DIVIDER_REG_EXP.test(dividerLine))
            return null;

        const table = $createTableNode();

        const headerRow = $createTableRowNode();
        for (const col of parseTableCells(headerLine)) {
            const cell = $createTableCellNode(TableCellHeaderStates.ROW);
            const para = $createParagraphNode();
            para.append($createTextNode(col));
            cell.append(para);
            headerRow.append(cell);
        }
        table.append(headerRow);

        let lastLine = startLineIndex + 1;
        for (let i = startLineIndex + 2; i < lines.length; i++) {
            if (!TABLE_ROW_REG_EXP.test(lines[i])) break;
            const row = $createTableRowNode();
            for (const col of parseTableCells(lines[i])) {
                const cell = $createTableCellNode(
                    TableCellHeaderStates.NO_STATUS,
                );
                const para = $createParagraphNode();
                para.append($createTextNode(col));
                cell.append(para);
                row.append(cell);
            }
            table.append(row);
            lastLine = i;
        }

        rootNode.append(table);
        return [true, lastLine];
    },
    regExpStart: TABLE_ROW_REG_EXP,
    replace: () => {
        // import handled entirely by handleImportAfterStartMatch
    },
    type: "multiline-element",
};

const ALL_TRANSFORMERS = [...TRANSFORMERS, HR_TRANSFORMER, TABLE_TRANSFORMER];

const NODES = [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
    AutoLinkNode,
    CodeNode,
    CodeHighlightNode,
    HorizontalRuleNode,
    TableNode,
    TableRowNode,
    TableCellNode,
];

function MarkdownInitializerPlugin({
    content,
    transformers,
}: {
    content: string;
    transformers: typeof TRANSFORMERS;
}) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        editor.update(() => {
            $convertFromMarkdownString(content, transformers);
        });
    }, [content, editor, transformers]);

    return null;
}

function MarkdownOnChangePlugin({
    onChange,
}: {
    onChange: (markdown: string) => void;
}) {
    const handleChange = (editorState: EditorState) => {
        editorState.read(() => {
            onChange($convertToMarkdownString(ALL_TRANSFORMERS));
        });
    };

    return <OnChangePlugin onChange={handleChange} />;
}

/*
 * Owns the Enter gesture for `raw-edit` mode. Intercepts KEY_ENTER above
 * Lexical's default: plain Enter reads the verbatim text and, if it is not
 * blank, submits then clears the field and keeps the caret (empty/whitespace is
 * a no-op). Shift+Enter is left to the plain-text plugin, which inserts a
 * newline. Clearing is driven here — feeding empty content back through the
 * `content` prop is a no-op, so the field must reset itself.
 */
function CommandSubmitPlugin({
    onSubmit,
}: {
    onSubmit?: (text: string) => void;
}) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand(
            KEY_ENTER_COMMAND,
            (event: KeyboardEvent | null) => {
                if (!onSubmit) {
                    // No submit target: Enter behaves as a plain newline.
                    return false;
                }
                if (event?.shiftKey) {
                    // Fall through to the plain-text plugin's newline insertion.
                    return false;
                }
                event?.preventDefault();

                let text = "";
                editor.getEditorState().read(() => {
                    text = $getRoot().getTextContent();
                });

                if (text.trim() !== "") {
                    onSubmit?.(text);
                    editor.update(() => {
                        const root = $getRoot();
                        root.clear();
                        const paragraph = $createParagraphNode();
                        root.append(paragraph);
                        paragraph.select();
                    });
                }

                // Handled either way: suppress the default newline; blank input
                // simply does nothing.
                return true;
            },
            COMMAND_PRIORITY_HIGH,
        );
    }, [editor, onSubmit]);

    return null;
}

export function MarkdownEditor({
    content = "",
    mode = "edit",
    onChange,
    onSubmit,
    onFocus,
    placeholder = "",
    className = "",
}: MarkdownEditorProps) {
    const isView = mode === "view";
    const isRaw = mode === "raw-edit";
    // The Markdown modes (edit); raw-edit mounts none of the Markdown machinery.
    const isMarkdown = !isView && !isRaw;

    const initialConfig = {
        namespace: "MarkdownEditor",
        theme: editorTheme,
        editable: !isView,
        onError: (error: Error) => {
            console.error("MarkdownEditor error:", error);
        },
        nodes: NODES,
    };

    const contentEditable = (
        <ContentEditable
            className={
                isView
                    ? "w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none pointer-events-none text-left"
                    : isRaw
                      ? "w-full resize-none whitespace-pre-wrap break-words bg-transparent text-left outline-none"
                      : "min-h-[300px] w-full resize-none bg-transparent px-3 py-2 text-base text-left ring-offset-background focus-visible:outline-none focus-visible:border-l-2 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150"
            }
            onFocus={!isView ? onFocus : undefined}
        />
    );

    // View shows none; raw-edit shows one only when explicitly given; edit falls
    // back to the historic default.
    const placeholderNode = isView ? null : isRaw ? (
        placeholder ? (
            <div className="pointer-events-none absolute left-0 top-0 text-muted-foreground">
                {placeholder}
            </div>
        ) : null
    ) : (
        <div className="pointer-events-none absolute left-3 top-2 text-base text-muted-foreground">
            {placeholder || "Start typing..."}
        </div>
    );

    return (
        <LexicalComposer key={mode} initialConfig={initialConfig}>
            <div className={`relative w-full ${className}`}>
                {isRaw ? (
                    <PlainTextPlugin
                        contentEditable={contentEditable}
                        placeholder={placeholderNode}
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                ) : (
                    <RichTextPlugin
                        contentEditable={contentEditable}
                        placeholder={placeholderNode}
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                )}
                {!isRaw && <ListPlugin />}
                {!isRaw && <LinkPlugin />}
                {!isRaw && <HorizontalRulePlugin />}
                {!isRaw && <TablePlugin />}
                {content && !isRaw && (
                    <MarkdownInitializerPlugin
                        content={content}
                        transformers={ALL_TRANSFORMERS}
                    />
                )}
                {!isView && <HistoryPlugin />}
                {isMarkdown && <AutoFocusPlugin />}
                {isMarkdown && (
                    <MarkdownShortcutPlugin transformers={ALL_TRANSFORMERS} />
                )}
                {isMarkdown && onChange && (
                    <MarkdownOnChangePlugin onChange={onChange} />
                )}
                {isMarkdown && <TableActionMenuPlugin />}
                {isRaw && <CommandSubmitPlugin onSubmit={onSubmit} />}
            </div>
        </LexicalComposer>
    );
}
