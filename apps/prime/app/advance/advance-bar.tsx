import type { ReactElement } from "react";
import { useOverlay } from "../layout/overlay";

/*
 * Stage advance affordance (mockup `.advance`) — the single bar that appears at
 * the bottom of the terminal region when a stage has completed and no gate
 * demands a decision, so the user can run the next pipeline command without
 * recalling its name. It shows only while a stage is ready to advance *and* no
 * overlay surface is up ("no gate pending" is exactly "no surface open"), reading
 * the shell's shared state; both conditions live there, not in this region.
 *
 * The run control is a presentational hand-off (this layout epic executes no real
 * command): triggering it hides the bar and marks the next command running in the
 * terminal placeholder. Real command execution belongs to the downstream
 * pipeline-integration work.
 */
export function AdvanceBar(): ReactElement | null {
    const { advanceReady, receded, nextCommand, runNext } = useOverlay();

    if (!advanceReady || receded) {
        return null;
    }

    return (
        <div
            role="region"
            aria-label="Stage advance"
            className="flex flex-none items-center gap-3 border-t border-advance-line bg-advance-surface px-5 py-[10px] font-mono text-[12.5px]"
        >
            <span className="text-ink-dim">Stage complete.</span>
            <span className="font-bold text-accent">Next: {nextCommand}</span>
            <span className="text-[11px] text-ink-faint">
                — runs in the terminal above; you watch it execute.
            </span>
            <button
                type="button"
                onClick={runNext}
                className="ml-auto cursor-pointer rounded-[6px] border-none bg-accent px-[14px] py-[6px] font-mono text-[12px] font-semibold text-on-accent"
            >
                Run ⏎
            </button>
        </div>
    );
}

export default AdvanceBar;
