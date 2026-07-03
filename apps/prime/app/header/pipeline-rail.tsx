import type { ReactElement } from "react";
import {
    defaultStages,
    type Stage,
    type StageStatus,
} from "./pipeline-stages";

/*
 * The pipeline stage rail (mockup `.rail`) — the passive segmented read-out
 * centered in the top strip. It shows where the run stands without acting like a
 * wizard: `done` and `gate` segments are affordances (preview an artifact /
 * surface the pending gate), never pipeline navigation. All color resolves
 * through semantic tokens, so the rail renders correctly in either theme with no
 * per-region branching.
 *
 * Click wiring to the real drawer/gate surfaces composes with Stories 6 and 5;
 * this story exposes `onPreviewArtifact` / `onSurfaceGate` as the seam and leaves
 * them optional, so the top strip can render the rail before those surfaces exist.
 */

export interface PipelineRailProps {
    stages?: Stage[];
    onPreviewArtifact?: (id: string) => void;
    onSurfaceGate?: (id: string) => void;
}

const GLYPH: Record<StageStatus, string> = {
    done: "✓",
    active: "●",
    gate: "!",
    upcoming: "○",
};

const SEGMENT: Record<StageStatus, string> = {
    done: "text-green cursor-pointer hover:bg-seg-done-hover",
    active: "text-ink",
    gate: "animate-gate-pulse cursor-pointer bg-gate font-bold text-on-gate",
    upcoming: "text-ink-faint",
};

const GLYPH_STYLE: Record<StageStatus, string> = {
    done: "border-green bg-green text-on-green",
    active: "border-accent text-accent",
    gate: "border-on-gate text-on-gate",
    upcoming: "border-ink-faint border-dashed",
};

const SEGMENT_BASE =
    "flex items-center gap-[7px] rounded-[6px] px-3 py-[5px] font-mono text-[12px] transition-colors";
const GLYPH_BASE =
    "grid h-[14px] w-[14px] place-items-center rounded-full border-[1.5px] border-current text-[9px] font-bold";

function Segment({
    stage,
    onPreviewArtifact,
    onSurfaceGate,
}: {
    stage: Stage;
    onPreviewArtifact?: (id: string) => void;
    onSurfaceGate?: (id: string) => void;
}): ReactElement {
    const inner = (
        <>
            <span className={`${GLYPH_BASE} ${GLYPH_STYLE[stage.status]}`}>
                {GLYPH[stage.status]}
            </span>
            <span>{stage.label}</span>
        </>
    );
    const className = `${SEGMENT_BASE} ${SEGMENT[stage.status]}`;

    if (stage.status === "done") {
        return (
            <button
                type="button"
                aria-label={`Preview ${stage.label} artifact`}
                className={className}
                onClick={() => onPreviewArtifact?.(stage.id)}
            >
                {inner}
            </button>
        );
    }
    if (stage.status === "gate") {
        return (
            <button
                type="button"
                aria-label={`Open pending ${stage.label} gate`}
                className={className}
                onClick={() => onSurfaceGate?.(stage.id)}
            >
                {inner}
            </button>
        );
    }
    return <span className={className}>{inner}</span>;
}

export function PipelineRail({
    stages = defaultStages,
    onPreviewArtifact,
    onSurfaceGate,
}: PipelineRailProps): ReactElement {
    return (
        <ol
            aria-label="Pipeline stages"
            className="mx-auto flex items-center gap-[2px]"
        >
            {stages.map((stage, index) => (
                <li key={stage.id} className="flex items-center gap-[2px]">
                    {index > 0 && (
                        <span
                            aria-hidden="true"
                            className="text-[11px] text-ink-faint"
                        >
                            ›
                        </span>
                    )}
                    <Segment
                        stage={stage}
                        onPreviewArtifact={onPreviewArtifact}
                        onSurfaceGate={onSurfaceGate}
                    />
                </li>
            ))}
        </ol>
    );
}

export default PipelineRail;
