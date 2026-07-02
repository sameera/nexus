import { render, screen } from "@testing-library/react";

import { TerminalRegion } from "./terminal-region";

/*
 * Story 4 stubs the terminal interior: a labelled placeholder standing in for the
 * wterm/Claude Code emulation, plus the live-looking input line. These tests
 * assert that user-visible presence — the placeholder label and the input-line
 * prompt affordance — not the flex layout or the caret animation (styling).
 */

describe("TerminalRegion", () => {
    it("shows a clearly labelled placeholder for the terminal interior", () => {
        render(<TerminalRegion />);
        expect(screen.getByText(/placeholder/i)).toBeInTheDocument();
    });

    it("shows the input-line prompt affordance", () => {
        render(<TerminalRegion />);
        expect(screen.getByText("❯")).toBeInTheDocument();
    });
});
