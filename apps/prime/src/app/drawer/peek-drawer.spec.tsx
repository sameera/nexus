import { fireEvent, render, screen, within } from "@testing-library/react";

import App from "../app";

/*
 * The artifact peek drawer (Story 6) is an ephemeral slide-over that renders a
 * mock artifact file over a scrim while the terminal recedes behind it. These
 * tests drive it through the whole shell (as a user would): a peek trigger opens
 * it, it shows the file identity + body, and every dismissal path closes it and
 * returns the terminal to full fidelity. They assert user-perceived state — the
 * dialog's presence, its content, the terminal's recede — not CSS or DOM shape.
 */

describe("Artifact peek drawer", () => {
    const peekButton = (): HTMLElement =>
        screen.getByRole("button", { name: "⧉" });

    it("stays closed until a peek trigger fires", () => {
        render(<App />);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("opens from the tools peek button with the artifact path, read-only tag, and rendered body", () => {
        render(<App />);
        fireEvent.click(peekButton());

        const drawer = screen.getByRole("dialog");
        expect(
            within(drawer).getByText(".nexus/temp/main/a3f9/epic.md"),
        ).toBeInTheDocument();
        expect(within(drawer).getByText(/read-only/i)).toBeInTheDocument();
        expect(
            within(drawer).getByRole("heading", { name: /passwordless/i }),
        ).toBeInTheDocument();
    });

    it("previews the artifact of a completed rail stage", () => {
        render(<App />);
        fireEvent.click(
            screen.getByRole("button", { name: /preview setup/i }),
        );

        const drawer = screen.getByRole("dialog");
        expect(
            within(drawer).getByText("docs/system/stack.md"),
        ).toBeInTheDocument();
    });

    it("recedes the terminal while open and restores it once closed", () => {
        render(<App />);
        const terminal = screen.getByTestId("terminal-region");
        expect(terminal).toHaveAttribute("data-receded", "false");

        fireEvent.click(peekButton());
        expect(terminal).toHaveAttribute("data-receded", "true");

        fireEvent.click(screen.getByRole("button", { name: /close/i }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(terminal).toHaveAttribute("data-receded", "false");
    });

    it("closes when the scrim is clicked", () => {
        render(<App />);
        fireEvent.click(peekButton());
        fireEvent.click(screen.getByTestId("drawer-scrim"));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes when ESC is pressed", () => {
        render(<App />);
        fireEvent.click(peekButton());
        // ESC is a document-level handler; keydown bubbles up from the drawer.
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("ignores other keys — only ESC dismisses it", () => {
        render(<App />);
        fireEvent.click(peekButton());
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});
