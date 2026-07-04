import { useCallback, useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $deleteTableColumn__EXPERIMENTAL,
    $deleteTableRow__EXPERIMENTAL,
    $getTableCellNodeFromLexicalNode,
    $insertTableColumn__EXPERIMENTAL,
    $insertTableRow__EXPERIMENTAL,
} from "@lexical/table";
import { $getSelection, $isRangeSelection } from "lexical";
import { Trash2 } from "lucide-react";

interface ToolbarPosition {
    top: number;
    left: number;
}

interface ActionButtonProps {
    label: string;
    title: string;
    onClick: () => void;
    variant?: "default" | "danger";
}

function ActionButton({
    label,
    title,
    onClick,
    variant = "default",
}: ActionButtonProps) {
    const base =
        "px-2 py-1 text-xs rounded border transition-colors duration-100 cursor-pointer font-medium";
    const styles =
        variant === "danger"
            ? `${base} border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20`
            : `${base} border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground`;
    return (
        <button
            className={styles}
            title={title}
            onMouseDown={(e) => {
                e.preventDefault();
                onClick();
            }}
        >
            {variant === "danger" ? <Trash2 size={12} /> : label}
        </button>
    );
}

export function TableActionMenuPlugin() {
    const [editor] = useLexicalComposerContext();
    const [position, setPosition] = useState<ToolbarPosition | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        return editor.registerUpdateListener(({ editorState }) => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
            rafRef.current = requestAnimationFrame(() => {
                editorState.read(() => {
                    const selection = $getSelection();
                    if (!$isRangeSelection(selection)) {
                        setPosition(null);
                        return;
                    }
                    const anchorNode = selection.anchor.getNode();
                    const cellNode =
                        $getTableCellNodeFromLexicalNode(anchorNode);
                    if (!cellNode) {
                        setPosition(null);
                        return;
                    }
                    const cellDom = editor.getElementByKey(cellNode.getKey());
                    const editorRoot = editor.getRootElement();
                    if (!cellDom || !editorRoot) {
                        setPosition(null);
                        return;
                    }
                    const cellRect = cellDom.getBoundingClientRect();
                    const editorRect = editorRoot.getBoundingClientRect();
                    setPosition({
                        top: cellRect.top - editorRect.top - 40,
                        left: cellRect.left - editorRect.left,
                    });
                });
            });
        });
    }, [editor]);

    const run = useCallback(
        (fn: () => void) => {
            editor.update(fn);
        },
        [editor],
    );

    if (!position) return null;

    return (
        <div
            className="absolute z-50 flex items-center gap-1 rounded-md border border-border bg-popover px-2 py-1 shadow-md"
            style={{ top: position.top, left: position.left }}
        >
            <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Row
            </span>
            <ActionButton
                label="+ Above"
                title="Insert row above"
                onClick={() => run(() => $insertTableRow__EXPERIMENTAL(false))}
            />
            <ActionButton
                label="+ Below"
                title="Insert row below"
                onClick={() => run(() => $insertTableRow__EXPERIMENTAL(true))}
            />
            <ActionButton
                label="Delete"
                title="Delete current row"
                variant="danger"
                onClick={() => run(() => $deleteTableRow__EXPERIMENTAL())}
            />
            <div className="mx-1 h-4 w-px bg-border" />
            <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Col
            </span>
            <ActionButton
                label="+ Before"
                title="Insert column before"
                onClick={() =>
                    run(() => $insertTableColumn__EXPERIMENTAL(false))
                }
            />
            <ActionButton
                label="+ After"
                title="Insert column after"
                onClick={() =>
                    run(() => $insertTableColumn__EXPERIMENTAL(true))
                }
            />
            <ActionButton
                label="Delete"
                title="Delete current column"
                variant="danger"
                onClick={() => run(() => $deleteTableColumn__EXPERIMENTAL())}
            />
        </div>
    );
}
