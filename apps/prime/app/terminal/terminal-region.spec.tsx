import { fireEvent, render, screen, within } from "@testing-library/react";

import App from "../app";
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
