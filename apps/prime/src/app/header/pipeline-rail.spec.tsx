import { fireEvent, render, screen, within } from "@testing-library/react";

import { PipelineRail } from "./pipeline-rail";
import type { Stage } from "./pipeline-stages";

/*
 * The rail is a passive segmented read-out of mock stage state. Its user-visible
 * behavior is the ordered stage sequence, each stage's status glyph, and the
 * preview/gate affordances on the interactive stages — so that is what these
 * tests assert (not CSS classes or the pulse animation, which are styling).
 */

const allStates: Stage[] = [
    { id: "setup", label: "setup", status: "done" },
    { id: "epic", label: "epic", status: "gate" },
    { id: "hld", label: "hld", status: "active" },
    { id: "tasks", label: "tasks", status: "upcoming" },
];

describe("PipelineRail", () => {
    it("renders the six pipeline stages in order as a list", () => {
        render(<PipelineRail />);
        const items = within(screen.getByRole("list")).getAllByRole(
            "listitem",
        );
        expect(items).toHaveLength(6);
        ["setup", "epic", "hld", "tasks", "analyze", "close"].forEach(
            (label, i) => {
                expect(within(items[i]).getByText(label)).toBeInTheDocument();
            },
        );
    });

    it("shows each status with its matching glyph", () => {
        render(<PipelineRail stages={allStates} />);
        const items = screen.getAllByRole("listitem");
        expect(within(items[0]).getByText("✓")).toBeInTheDocument(); // done
        expect(within(items[1]).getByText("!")).toBeInTheDocument(); // gate
        expect(within(items[2]).getByText("●")).toBeInTheDocument(); // active
        expect(within(items[3]).getByText("○")).toBeInTheDocument(); // upcoming
    });

    it("presents a done stage as an artifact-preview affordance", () => {
        const onPreviewArtifact = vi.fn();
        render(
            <PipelineRail
                stages={allStates}
                onPreviewArtifact={onPreviewArtifact}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /preview setup/i }));
        expect(onPreviewArtifact).toHaveBeenCalledWith("setup");
    });

    it("surfaces the pending gate when a gate stage is activated", () => {
        const onSurfaceGate = vi.fn();
        render(
            <PipelineRail stages={allStates} onSurfaceGate={onSurfaceGate} />,
        );
        fireEvent.click(
            screen.getByRole("button", { name: /pending epic gate/i }),
        );
        expect(onSurfaceGate).toHaveBeenCalledWith("epic");
    });

    it("keeps active and upcoming stages non-interactive", () => {
        render(<PipelineRail stages={allStates} />);
        const buttons = screen.getAllByRole("button");
        // Only the done + gate stages are interactive; active/upcoming never navigate.
        expect(buttons).toHaveLength(2);
    });
});
