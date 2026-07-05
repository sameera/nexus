import { render, screen } from "@testing-library/react";
import {
    $createLineBreakNode,
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    type LexicalEditor,
} from "lexical";

import { MarkdownEditor } from "./markdown-editor.js";

/*
 * The raw-edit mode is @nexus/editor's plain-text, submit-capable input: no
 * Markdown machinery, text delivered verbatim, and the lib owns the Enter
 * gesture. Lexical needs a real layout engine to accept synthesized key/input
 * events, which jsdom lacks; so these tests set the editor's content through its
 * own model API (the editor Lexical exposes on the root element) and then assert
 * the user-visible outcome — what the field shows and what a submit delivers.
 */

function editorOf(box: HTMLElement): LexicalEditor {
    return (box as unknown as { __lexicalEditor: LexicalEditor })
        .__lexicalEditor;
}

/* Replace the field's content, mirroring what typing `text` would leave. */
function setText(box: HTMLElement, text: string): void {
    editorOf(box).update(
        () => {
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            text.split("\n").forEach((line, i) => {
                if (i > 0) paragraph.append($createLineBreakNode());
                paragraph.append($createTextNode(line));
            });
            root.append(paragraph);
            paragraph.selectEnd();
        },
        { discrete: true },
    );
}

describe("MarkdownEditor raw-edit mode", () => {
    it("renders a real, editable text field", () => {
        render(<MarkdownEditor mode="raw-edit" />);
        const box = screen.getByRole("textbox");
        expect(box).toBeInTheDocument();
        expect(box).toHaveAttribute("contenteditable", "true");
    });

    it("displays text that spans multiple lines", () => {
        render(<MarkdownEditor mode="raw-edit" />);
        const box = screen.getByRole("textbox");
        setText(box, "first line\nsecond line");
        expect(box.textContent).toContain("first line");
        expect(box.textContent).toContain("second line");
    });

    it("preserves Markdown-significant characters literally, without reformatting", () => {
        render(<MarkdownEditor mode="raw-edit" />);
        const box = screen.getByRole("textbox");
        setText(box, "# note *.ts --- flag");
        // The command text is kept verbatim in the model...
        let text = "";
        editorOf(box)
            .getEditorState()
            .read(() => {
                text = $getRoot().getTextContent();
            });
        expect(text).toBe("# note *.ts --- flag");
        // ...and is not turned into a heading, list, or horizontal rule.
        expect(box.querySelector("h1, h2, h3, hr, ul, ol")).toBeNull();
    });

    it("exposes no formatting or table toolbar", () => {
        render(<MarkdownEditor mode="raw-edit" />);
        expect(screen.queryByRole("button")).toBeNull();
    });
});
