import type { ReactElement } from "react";
import { GateTray } from "../gate/gate-tray";
import { AdvanceBar } from "../advance/advance-bar";
import { useOverlay } from "../layout/overlay";

/*
 * The terminal region — the dominant, flex-filling area below the top strip
 * (mockup `.term-wrap`). It claims all remaining vertical space and is the
 * largest region of the surface. Its interior is the wterm/Claude Code seam:
 * Story 4 ships a labelled placeholder standing in for the emulation (no
 * terminal emulation is implemented here) plus the live-looking input line
 * (mockup `.term-input`), pinned at the bottom. The gate tray and advance bar
 * live inside this region (as in the mockup) and are home here from Story 1.
 *
 * When an overlay surface is open the terminal recedes — dims but stays visible
 * (mockup `.term-wrap.recede .term`). The recede is derived from the shell's
 * shared overlay state, so this region never tracks which surface is up; it only
 * reflects the shared `receded` flag (exposed as `data-receded` for the seam).
 */
export function TerminalRegion(): ReactElement {
    const { receded, running } = useOverlay();

    return (
        <div
            data-testid="terminal-region"
            data-receded={receded}
            className="relative flex min-h-0 flex-1 flex-col bg-term"
        >
            {/* Scrollback stand-in (mockup `.term`) — the wterm integration seam. */}
            <div
                className={`min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4 font-mono text-[13px] leading-[1.65] text-ink transition-[filter] duration-200 ${
                    receded ? "saturate-[.85] brightness-[.82]" : ""
                }`}
            >
                <p className="text-ink-dim">
                    Terminal placeholder — the wterm / Claude Code session mounts
                    here.
                </p>
                <p className="text-ink-faint">
                    No terminal emulation is implemented in the shell; this stub
                    marks the integration seam.
                </p>
                {/*
                 * Presentational hand-off from the advance affordance (Story 7):
                 * the next command shows as running here. No real command runs —
                 * that is the downstream pipeline-integration work.
                 */}
                {running !== null && (
                    <p className="mt-3">
                        <span className="text-accent">❯ /{running}</span>
                        <span className="text-ink-dim"> · running…</span>
                    </p>
                )}
            </div>

            {/* Live input line (mockup `.term-input`) — prompt char + blinking caret. */}
            <div className="flex flex-none items-center gap-[9px] border-t border-term-line bg-term px-5 pb-3 pt-[9px] font-mono text-[13px]">
                <span className="text-accent">❯</span>
                <span className="text-ink" />
                <span className="inline-block h-4 w-2 animate-blink bg-accent" />
            </div>

            <GateTray />
            <AdvanceBar />
        </div>
    );
}

export default TerminalRegion;
