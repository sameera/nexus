import { fireEvent, render, screen, within } from "@testing-library/react";

import App from "../app";

/*
 * The gate tray (Story 5) is the ephemeral surface that rises from the bottom of
 * the terminal region when a pipeline decision is required, dimming the terminal
 * behind it while the scrollback stays visible. It has two variants — a judgment
 * gate (right-sizing: the story list) and a validation gate (analyze: the blocked
 * violation checklist). These tests drive it through the whole shell as a user
 * would — surfacing each variant from its pending rail segment, exercising its
 * actions, and asserting the recede/dismiss coordination it shares with the
 * drawer. They assert user-perceived state (the region's presence, its content,
 * the terminal's recede) — not CSS, colors, or DOM shape.
 */

describe("Gate tray", () => {
    const terminal = (): HTMLElement => screen.getByTestId("terminal-region");
    const surfaceEpicGate = (): void => {
        fireEvent.click(
            screen.getByRole("button", { name: /pending epic gate/i }),
        );
    };
    const surfaceAnalyzeGate = (): void => {
        fireEvent.click(
            screen.getByRole("button", { name: /pending analyze gate/i }),
        );
    };

    it("stays closed until a gate is surfaced", () => {
        render(<App />);
        expect(
            screen.queryByRole("region", { name: /right-sizing gate/i }),
        ).toBeNull();
        expect(terminal()).toHaveAttribute("data-receded", "false");
    });

    it("surfaces the judgment gate from the pending epic rail segment", () => {
        render(<App />);
        surfaceEpicGate();

        const gate = screen.getByRole("region", { name: /right-sizing gate/i });
        // Judgment variant: badge, why rationale, the inline story slice.
        expect(within(gate).getByText(/decision · judgment/i)).toBeInTheDocument();
        expect(within(gate).getByText("S-1")).toBeInTheDocument();
        expect(within(gate).getByText("S-7")).toBeInTheDocument();
        // Type badges and a suggested split marker distinguish the rows.
        expect(within(gate).getAllByText("user").length).toBeGreaterThan(0);
        expect(within(gate).getAllByText("system").length).toBeGreaterThan(0);
        expect(within(gate).getAllByText(/split/i).length).toBeGreaterThan(0);
        // Decision actions.
        expect(
            within(gate).getByRole("button", { name: /split into 2 epics/i }),
        ).toBeInTheDocument();

        // The terminal recedes but its scrollback stays visible behind the tray.
        expect(terminal()).toHaveAttribute("data-receded", "true");
        expect(screen.getByText(/terminal placeholder/i)).toBeInTheDocument();
    });

    it("surfaces the validation gate from the pending analyze rail segment", () => {
        render(<App />);
        surfaceAnalyzeGate();

        const gate = screen.getByRole("region", { name: /consistency gate/i });
        expect(
            within(gate).getByText(/blocked · validation/i),
        ).toBeInTheDocument();
        // Violation checklist: a passed row and failed rows, each with detail.
        expect(
            within(gate).getByText(/every task has a story_ref/i),
        ).toBeInTheDocument();
        expect(within(gate).getAllByText(/orphan task/i).length).toBe(2);
        // Failed rows carry a fix affordance; the override note frames the exit.
        expect(
            within(gate).getAllByRole("button", { name: /fix/i }).length,
        ).toBeGreaterThan(0);
        expect(within(gate).getByText(/override/i)).toBeInTheDocument();

        // Its peek action opens the corresponding artifact in the drawer.
        fireEvent.click(
            within(gate).getByRole("button", { name: /open task-index\.md/i }),
        );
        expect(
            within(screen.getByRole("dialog")).getByText(
                ".nexus/temp/main/a3f9/task-index.md",
            ),
        ).toBeInTheDocument();
    });

    it("marks a violation fix affordance as in-progress when clicked", () => {
        render(<App />);
        surfaceAnalyzeGate();
        const gate = screen.getByRole("region", { name: /consistency gate/i });

        const fix = within(gate).getAllByRole("button", { name: /fix/i })[0];
        fireEvent.click(fix);
        expect(within(gate).getByText(/fixing/i)).toBeInTheDocument();
    });

    it("collapses and restores the terminal when the gate is resolved", () => {
        render(<App />);
        surfaceEpicGate();
        expect(terminal()).toHaveAttribute("data-receded", "true");

        fireEvent.click(
            screen.getByRole("button", { name: /accept size xl/i }),
        );
        expect(
            screen.queryByRole("region", { name: /right-sizing gate/i }),
        ).toBeNull();
        expect(terminal()).toHaveAttribute("data-receded", "false");
    });

    it("opens the artifact drawer from the gate's peek action", () => {
        render(<App />);
        surfaceEpicGate();
        fireEvent.click(screen.getByRole("button", { name: /open epic\.md/i }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("keeps the terminal receded while the other surface is still open", () => {
        render(<App />);
        surfaceEpicGate();

        // Open the drawer from the gate's peek action — both surfaces are now up.
        fireEvent.click(screen.getByRole("button", { name: /open epic\.md/i }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(terminal()).toHaveAttribute("data-receded", "true");

        // Closing the drawer leaves the gate open, so the terminal stays receded.
        fireEvent.click(screen.getByRole("button", { name: /close artifact/i }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(
            screen.getByRole("region", { name: /right-sizing gate/i }),
        ).toBeInTheDocument();
        expect(terminal()).toHaveAttribute("data-receded", "true");

        // Resolving the gate finally returns the terminal to full fidelity.
        fireEvent.click(
            screen.getByRole("button", { name: /accept size xl/i }),
        );
        expect(terminal()).toHaveAttribute("data-receded", "false");
    });
});
