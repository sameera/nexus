import type { EditorThemeClasses } from "lexical";

export const editorTheme: EditorThemeClasses = {
    paragraph: "mb-2 text-foreground",
    quote: "border-l-4 border-border pl-4 italic my-4 text-muted-foreground",
    heading: {
        h1: "text-4xl font-bold mb-4 mt-6 text-foreground",
        h2: "text-3xl font-semibold mb-3 mt-5 text-foreground",
        h3: "text-2xl font-semibold mb-2 mt-4 text-foreground",
        h4: "text-xl font-semibold mb-2 mt-3 text-foreground",
        h5: "text-lg font-semibold mb-1 mt-2 text-foreground",
    },
    list: {
        nested: {
            listitem: "list-none",
        },
        ol: "list-decimal ml-6 my-2",
        ul: "list-disc ml-6 my-2",
        listitem: "mb-1",
    },
    text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
        strikethrough: "line-through",
        code: "bg-muted px-1.5 py-0.5 rounded font-mono text-sm",
    },
    link: "text-primary underline hover:text-primary/80 cursor-pointer",
    hr: "border-t border-border my-4",
    code: "bg-muted p-4 rounded-lg font-mono text-sm block my-4 overflow-x-auto",
    table: "border-collapse w-full my-4 text-sm",
    tableRow: "",
    tableCell: "border border-border px-3 py-2 text-left align-top",
    tableCellHeader: "border border-border px-3 py-2 text-left font-semibold bg-muted text-muted-foreground",
};
