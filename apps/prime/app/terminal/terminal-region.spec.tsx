import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";

import App from "../app";
import { OverlayProvider, useOverlay } from "../layout/overlay";
import { TerminalRegion } from "./terminal-region";

/*
 * The terminal interior: a labelled placeholder standing in for the wterm/Claude
 * Code emulation, plus a real, editable command input (replacing the old static
 * prompt stub). These tests assert user-visible presence — the placeholder, the
 * prompt glyph, and an editable input that survives the receded state — not the
 * flex layout or caret styling.
 */

describe("TerminalRegion", () => {
    const terminal = (): HTMLElement => screen.getByTestId("terminal-region");

    it("shows a clearly labelled placeholder for the terminal interior", () => {
        render(<TerminalRegion />);
        expect(screen.getByText(/placeholder/i)).toBeInTheDocument();
    });

    it("shows the prompt glyph on the input line", () => {
        render(<TerminalRegion />);
        expect(screen.getByText("❯")).toBeInTheDocument();
    });

    it("renders a real, editable command input rather than an inert stub", () => {
        render(<TerminalRegion />);
        const input = screen.getByRole("textbox");
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("contenteditable", "true");
    });

    it("keeps the command input present and editable while the terminal is receded", () => {
        render(<App />);
        expect(within(terminal()).getByRole("textbox")).toBeInTheDocument();

        // Surfacing a gate recedes the terminal (presentational dim only).
        fireEvent.click(
            screen.getByRole("button", { name: /pending epic gate/i }),
        );
        expect(terminal()).toHaveAttribute("data-receded", "true");

        const input = within(terminal()).getByRole("textbox");
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("contenteditable", "true");
    });
});

/*
 * The submit hand-off (Story 3): a submitted command reaches the terminal
 * through the shell's shared surfaced-command slot. Lexical cannot be driven
 * from jsdom (the raw-edit Enter gesture is covered in @nexus/editor's own
 * tests), so here we exercise the terminal seam directly — a probe invokes the
 * same overlay action the input's onSubmit is wired to — and assert what the
 * user sees echoed in the terminal.
 */
function SubmitProbe({ command }: { command: string }): ReactElement {
    const { submitCommand } = useOverlay();
    return <button onClick={() => submitCommand(command)}>send</button>;
}

describe("TerminalRegion command hand-off", () => {
    const terminal = (): HTMLElement => screen.getByTestId("terminal-region");

    const renderWithSubmit = (command: string): void => {
        render(
            <OverlayProvider>
                <TerminalRegion />
                <SubmitProbe command={command} />
            </OverlayProvider>,
        );
        fireEvent.click(screen.getByRole("button", { name: "send" }));
    };

    it("surfaces a submitted command verbatim, preserving all lines", () => {
        renderWithSubmit("grep -r foo .\n--- flag");
        const surfaced = within(terminal()).getByText(
            (_content, el) => el?.textContent === "grep -r foo .\n--- flag",
        );
        expect(surfaced).toBeInTheDocument();
    });

    it("injects no leading slash and no execution-status suffix", () => {
        renderWithSubmit("nxs.hld");
        const term = within(terminal());
        expect(term.getByText("nxs.hld")).toBeInTheDocument();
        // Not slash-prefixed and not framed as running.
        expect(term.queryByText(/\/nxs\.hld/)).toBeNull();
        expect(term.queryByText(/running/i)).toBeNull();
    });

    it("replaces the prior surfaced command rather than accumulating", () => {
        render(
            <OverlayProvider>
                <TerminalRegion />
                <SubmitProbe command="second command" />
            </OverlayProvider>,
        );
        const send = screen.getByRole("button", { name: "send" });
        fireEvent.click(send);
        fireEvent.click(send);
        expect(
            within(terminal()).getAllByText("second command"),
        ).toHaveLength(1);
    });
});
