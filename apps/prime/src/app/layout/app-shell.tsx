import type { ReactElement } from "react";
import { TopStrip } from "../header/top-strip";
import { TerminalRegion } from "../terminal/terminal-region";
import { PeekDrawer } from "../drawer/peek-drawer";
import { OverlayProvider } from "./overlay";
import { ThemeProvider, useTheme } from "./theme";

/*
 * The application shell — the full-height frame that wraps the Claude Code
 * session (mockup `.app`). A single `100vh` flex column: a fixed-height top
 * strip over the flex-filling terminal region, with the peek drawer as an
 * overlay anchored to the (relative) shell root.
 *
 * The theme mode is applied here, once, via `data-theme` — every region resolves
 * its semantic tokens through inheritance, so no region branches on theme. Story
 * 1 built the dual-mode token mechanism; Story 8 makes the mode a runtime,
 * persisted, user-facing switch (the theme provider), with the toggle living in
 * the top strip's tools cluster.
 *
 * The overlay provider holds the shared recede/dim state (Story 6): which
 * ephemeral surfaces are open drives the terminal recede, so no region tracks it
 * on its own. The peek drawer and the gate tray compose into it.
 */
export function AppShell(): ReactElement {
    return (
        <ThemeProvider>
            <OverlayProvider>
                <ShellFrame />
            </OverlayProvider>
        </ThemeProvider>
    );
}

/* The framed shell, split out so it can read the active mode from the provider. */
function ShellFrame(): ReactElement {
    const { theme } = useTheme();

    return (
        <div
            data-theme={theme}
            className="shell-bg relative flex h-screen flex-col overflow-hidden font-sans text-ink"
        >
            <TopStrip />
            <TerminalRegion />
            <PeekDrawer />
        </div>
    );
}

export default AppShell;
