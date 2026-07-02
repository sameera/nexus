import { render, screen, within } from "@testing-library/react";

import App from "./app";

describe("App", () => {
    it("should render successfully", () => {
        const { baseElement } = render(<App />);
        expect(baseElement).toBeTruthy();
    });

    it("renders the shell with the persistent top strip region", () => {
        render(<App />);
        expect(screen.getByRole("banner")).toBeTruthy();
    });

    it("surfaces the epic-switch control with its split-spawns-pipelines affordance", () => {
        render(<App />);
        // The tooltip on the epic-switch is the AC3 affordance — assert it sits on
        // the switch button itself, not merely somewhere in the strip.
        expect(screen.getByRole("button", { name: /1 epic/ })).toHaveAttribute(
            "title",
            "Splitting an epic spawns concurrent pipelines",
        );
    });

    it("offers a peek control in the tools cluster", () => {
        render(<App />);
        expect(screen.getByRole("button", { name: "⧉" })).toHaveAttribute(
            "title",
            "Peek last artifact",
        );
    });

    it("shows the pipeline stage rail in order inside the top strip", () => {
        render(<App />);
        const strip = within(screen.getByRole("banner"));
        const stages = within(strip.getByRole("list")).getAllByRole(
            "listitem",
        );
        expect(stages).toHaveLength(6);
        ["setup", "epic", "hld", "tasks", "analyze", "close"].forEach(
            (label, i) => {
                expect(within(stages[i]).getByText(label)).toBeInTheDocument();
            },
        );
    });

    it("renders both top-strip controls inside the persistent strip", () => {
        render(<App />);
        const strip = within(screen.getByRole("banner"));
        expect(
            strip.getByRole("button", { name: /1 epic/ }),
        ).toBeInTheDocument();
        expect(strip.getByRole("button", { name: "⧉" })).toBeInTheDocument();
    });
});
