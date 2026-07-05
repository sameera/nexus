import { fireEvent, render, screen } from "@testing-library/react";
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

function modelText(box: HTMLElement): string {
    let text = "";
    editorOf(box)
        .getEditorState()
        .read(() => {
            text = $getRoot().getTextContent();
        });
    return text;
}

describe("MarkdownEditor raw-edit — Enter gesture", () => {
    const pressEnter = (box: HTMLElement, shiftKey = false): void => {
        fireEvent.keyDown(box, { key: "Enter", code: "Enter", shiftKey });
    };

    it("submits the verbatim text on Enter and then clears the field", async () => {
        const onSubmit = vi.fn();
        render(<MarkdownEditor mode="raw-edit" onSubmit={onSubmit} />);
        const box = screen.getByRole("textbox");
        setText(box, "npm run build");
        pressEnter(box);

        expect(onSubmit).toHaveBeenCalledExactlyOnceWith("npm run build");
        // The field resets itself after a successful submit (next tick).
        await Promise.resolve();
        expect(modelText(box)).toBe("");
    });

    it("delivers a multi-line command as a single submission, lines preserved", () => {
        const onSubmit = vi.fn();
        render(<MarkdownEditor mode="raw-edit" onSubmit={onSubmit} />);
        const box = screen.getByRole("textbox");
        setText(box, "line one\nline two\nline three");
        pressEnter(box);

        expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
            "line one\nline two\nline three",
        );
    });

    it("keeps Markdown-significant characters byte-for-byte on submit", () => {
        const onSubmit = vi.fn();
        render(<MarkdownEditor mode="raw-edit" onSubmit={onSubmit} />);
        const box = screen.getByRole("textbox");
        setText(box, "--- flag # note *.ts");
        pressEnter(box);

        expect(onSubmit).toHaveBeenCalledExactlyOnceWith("--- flag # note *.ts");
    });

    it("does not submit on Shift+Enter", () => {
        const onSubmit = vi.fn();
        render(<MarkdownEditor mode="raw-edit" onSubmit={onSubmit} />);
        const box = screen.getByRole("textbox");
        setText(box, "still typing");
        pressEnter(box, true);

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("does nothing on Enter when the field is empty or only whitespace", () => {
        const onSubmit = vi.fn();
        render(<MarkdownEditor mode="raw-edit" onSubmit={onSubmit} />);
        const box = screen.getByRole("textbox");
        pressEnter(box);
        setText(box, "   \n  ");
        pressEnter(box);

        expect(onSubmit).not.toHaveBeenCalled();
    });
});
