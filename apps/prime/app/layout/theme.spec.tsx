import { fireEvent, render, screen, within } from "@testing-library/react";

import App from "../app";

/*
 * Theme switching (Story 8) — the user-facing light/dark switch on top of Story
 * 1's dual-mode token mechanism. The mode is applied once at the shell root
 * (`data-theme`), so these tests treat that attribute as the user-perceived mode:
 * it is what re-resolves every region's tokens. They drive the toggle as a user
 * would (through the whole shell) and cover the first-load default, the OS
 * preference, the switch, and persistence across a reload.
 */

describe("Theme switching", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        // jsdom ships no matchMedia; drop any per-test stub so it can't leak.
        delete (window as { matchMedia?: unknown }).matchMedia;
    });

    const shellRoot = (container: HTMLElement): HTMLElement =>
        container.querySelector("[data-theme]") as HTMLElement;

    const toggle = (): HTMLElement =>
        screen.getByRole("button", { name: /theme/i });

    it("offers a theme toggle in the tools cluster beside the peek button", () => {
        render(<App />);
        const strip = within(screen.getByRole("banner"));
        expect(
            strip.getByRole("button", { name: /theme/i }),
        ).toBeInTheDocument();
        expect(strip.getByRole("button", { name: "⧉" })).toBeInTheDocument();
    });

    it("defaults to dark when there is no prior choice and no OS preference", () => {
        const { container } = render(<App />);
        expect(shellRoot(container)).toHaveAttribute("data-theme", "dark");
    });

    it("follows a light OS preference on first load with no stored choice", () => {
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query.includes("light"),
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));

        const { container } = render(<App />);
        expect(shellRoot(container)).toHaveAttribute("data-theme", "light");
    });

    it("switches the whole shell to the other mode when toggled", () => {
        const { container } = render(<App />);
        expect(shellRoot(container)).toHaveAttribute("data-theme", "dark");

        fireEvent.click(toggle());
        expect(shellRoot(container)).toHaveAttribute("data-theme", "light");

        fireEvent.click(toggle());
        expect(shellRoot(container)).toHaveAttribute("data-theme", "dark");
    });

    it("restores the previously chosen mode after a reload", () => {
        const first = render(<App />);
        fireEvent.click(toggle());
        expect(shellRoot(first.container)).toHaveAttribute(
            "data-theme",
            "light",
        );
        first.unmount();

        // A fresh mount stands in for a page reload — the choice is read back.
        const second = render(<App />);
        expect(shellRoot(second.container)).toHaveAttribute(
            "data-theme",
            "light",
        );
    });

    it("lets the stored choice override the OS preference on load", () => {
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query.includes("light"),
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));
        localStorage.setItem("prime-theme", "dark");

        const { container } = render(<App />);
        expect(shellRoot(container)).toHaveAttribute("data-theme", "dark");
    });
});
