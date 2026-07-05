import { fireEvent, render, screen, within } from "@testing-library/react";

import App from "../app";

/*
 * The stage advance affordance (Story 7) is the single bar that appears at the
 * bottom of the terminal when a stage has completed and no gate demands a
 * decision, offering to run the next pipeline command without the user recalling
 * its name (mockup `.advance`). It is a presentational hand-off: triggering run
 * hides the bar and shows the next command running in the terminal placeholder —
 * this epic executes no real command. These tests drive it through the whole
 * shell as a user would and assert user-perceived state (the bar's presence, its
 * next-stage read-out, the terminal hand-off) — not CSS, layout, or animation.
 */

describe("Stage advance affordance", () => {
    const terminal = (): HTMLElement => screen.getByTestId("terminal-region");
    const advance = (): HTMLElement | null =>
        screen.queryByRole("region", { name: /stage advance/i });

    it("appears with the next stage name and a run control when a stage has completed", () => {
        render(<App />);
        const bar = screen.getByRole("region", { name: /stage advance/i });

        expect(within(bar).getByText(/stage complete/i)).toBeInTheDocument();
        expect(within(bar).getByText(/nxs\.hld/)).toBeInTheDocument();
        expect(
            within(bar).getByRole("button", { name: /run/i }),
        ).toBeInTheDocument();
    });

    it("is hidden while a gate is pending (a gate tray is surfaced)", () => {
        render(<App />);
        expect(advance()).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: /pending epic gate/i }),
        );
        expect(advance()).toBeNull();

        // Resolving the gate clears the surface, so the advance returns.
        fireEvent.click(screen.getByRole("button", { name: /accept size xl/i }));
        expect(advance()).toBeInTheDocument();
    });

    it("hides the bar and surfaces the next command in the terminal when run is triggered", () => {
        render(<App />);
        fireEvent.click(screen.getByRole("button", { name: /run/i }));

        expect(advance()).toBeNull();
        // The surfaced command echoes verbatim — no injected `/`, no status suffix.
        expect(within(terminal()).getByText("nxs.hld")).toBeInTheDocument();
    });
});
