import type { ReactElement } from "react";
import { PipelineRail } from "./pipeline-rail";
import { useOverlay } from "../layout/overlay";
import { useTheme } from "../layout/theme";

/*
 * The persistent top strip — the only always-present chrome (mockup `.topstrip`).
 * Story 1 established the fixed-height frame region; Story 2 fills its two ends:
 * the epic-identity cluster (left) and the tools cluster (right); Story 3 adds the
 * pipeline rail (center, mockup `.rail`). Identity values are mock placeholders —
 * no real epic binding in this epic. Story 6 wires the peek affordances into the
 * shared overlay: the tools button opens the drawer on the last artifact (the
 * epic), and a `done` rail segment previews its stage's artifact. Story 5 wires
 * the rail's `gate` click into the shared overlay (`openGate`), surfacing the
 * pending gate tray; Story 8 adds the theme toggle beside the peek button, which
 * flips the shell's mode at the root (see layout/theme.tsx).
 */
export function TopStrip(): ReactElement {
    const { openArtifact, openGate } = useOverlay();
    const { theme, toggleTheme } = useTheme();
    const nextMode = theme === "dark" ? "light" : "dark";

    return (
        <header
            aria-label="Pipeline top strip"
            className="z-[5] flex h-[46px] flex-none items-center gap-[18px] border-b border-line bg-chrome px-[14px] text-[12.5px]"
        >
            <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[12px]">
                <span className="h-[7px] w-[7px] rounded-full bg-green shadow-[0_0_6px_var(--c-green)]" />
                <span className="font-semibold text-ink">auth-refactor</span>
                <span className="text-ink-faint">· main · a3f9</span>
                <button
                    type="button"
                    title="Splitting an epic spawns concurrent pipelines"
                    className="cursor-pointer rounded-[5px] border border-line bg-surface-input px-[7px] py-[2px] font-mono text-[11px] text-ink-dim hover:text-ink"
                >
                    ▾ 1 epic
                </button>
            </div>

            <PipelineRail
                onPreviewArtifact={openArtifact}
                onSurfaceGate={openGate}
            />

            <div className="flex items-center gap-[6px] whitespace-nowrap">
                <button
                    type="button"
                    title={`Switch to ${nextMode} theme`}
                    aria-label={`Switch to ${nextMode} theme`}
                    onClick={toggleTheme}
                    className="flex h-[28px] w-[30px] cursor-pointer items-center justify-center rounded-[6px] border border-line bg-transparent text-[14px] leading-none text-ink-dim transition-all hover:border-ink-faint hover:bg-surface-input hover:text-ink"
                >
                    {theme === "dark" ? "☀" : "☾"}
                </button>
                <button
                    type="button"
                    title="Peek last artifact"
                    onClick={() => openArtifact("epic")}
                    className="flex h-[28px] w-[30px] cursor-pointer items-center justify-center rounded-[6px] border border-line bg-transparent text-[14px] leading-none text-ink-dim transition-all hover:border-ink-faint hover:bg-surface-input hover:text-ink"
                >
                    ⧉
                </button>
            </div>
        </header>
    );
}

export default TopStrip;
