import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useOverlay } from "../layout/overlay";
import {
    resolveGate,
    storyRows,
    violations,
    type Gate,
    type StoryRow,
    type Violation,
} from "./gates";

/*
 * Gate tray (mockup `.gate-tray`) — the ephemeral surface that rises from the
 * bottom of the terminal region when a pipeline decision is required. It slides
 * up (a `max-height` transition) while the scrollback above stays visible and the
 * terminal recedes behind it; it carries two variants: a judgment gate (the
 * right-sizing decision — the inline story slice) and a validation gate (the
 * analyze block — the red-treated violation checklist).
 *
 * Which gate is pending comes from the shared overlay state (surfaced by a `gate`
 * rail segment); the tray resolves its content from local fixtures. Like the
 * drawer, it stays mounted and retains the last-shown gate so the collapse
 * animation plays out without the body blanking. Recede coordination is owned by
 * the shell (layout/overlay.tsx), so resolving a gate returns the terminal to
 * full fidelity only when no other surface remains open.
 *
 * Every action is presentational (the epic executes no real gate decisions): the
 * decision buttons resolve — collapse — the gate, the peek button opens the
 * artifact drawer, and a violation's fix affordance marks itself in-progress.
 */

const BTN_BASE =
    "cursor-pointer rounded-[6px] border px-4 py-2 font-mono text-[12.5px] font-semibold transition-colors";
const BTN = `${BTN_BASE} border-line bg-surface-btn text-ink hover:border-ink-faint`;
const BTN_PRIMARY = `${BTN_BASE} border-gate bg-gate text-on-gate hover:brightness-[1.08]`;
const BTN_WEIGHTY = `${BTN_PRIMARY} shadow-[inset_0_0_0_1px_var(--c-weighty-ring)]`;
const BTN_PEEK =
    "cursor-pointer rounded-[6px] border border-dashed border-line bg-transparent px-4 py-2 font-mono text-[11.5px] text-ink-dim hover:text-ink";

function StoryList(): ReactElement {
    return (
        <div className="mb-[14px] flex max-h-[22vh] flex-col gap-1 overflow-y-auto">
            {storyRows.map((row: StoryRow) => (
                <div
                    key={row.id}
                    className="flex items-center gap-[10px] rounded-[5px] border border-row-line bg-surface-row px-[10px] py-[5px] font-mono text-[12px]"
                >
                    <span className="w-[34px] flex-none text-ink-faint">
                        {row.id}
                    </span>
                    <span className="flex-1 text-ink">{row.text}</span>
                    {row.split && (
                        <span
                            title="Claude's suggested split boundary"
                            className="flex-none text-[11px] text-warn"
                        >
                            split ▸ B
                        </span>
                    )}
                    <span
                        className={`flex-none rounded-[4px] px-[7px] py-px text-[10px] font-bold tracking-[.03em] ${
                            row.type === "user"
                                ? "bg-badge-user text-blue"
                                : "bg-badge-system text-violet"
                        }`}
                    >
                        {row.type}
                    </span>
                </div>
            ))}
        </div>
    );
}

function ViolationList(): ReactElement {
    // Which failed rows the user has marked "fixing" — presentational only.
    const [fixing, setFixing] = useState<Record<number, boolean>>({});

    return (
        <div className="mb-[14px] flex max-h-[24vh] flex-col gap-[6px] overflow-y-auto">
            {violations.map((vio: Violation, index: number) => (
                <div
                    key={vio.detail}
                    className={`grid grid-cols-[18px_1fr_auto] items-center gap-[10px] rounded-[5px] border px-[10px] py-[7px] font-mono text-[12px] ${
                        vio.passed
                            ? "border-vio-passed-line bg-vio-passed-surface opacity-60"
                            : "border-vio-line bg-vio-surface"
                    }`}
                >
                    <span
                        className={`text-center font-bold ${
                            vio.passed ? "text-green" : "text-red"
                        }`}
                    >
                        {vio.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-ink">
                        {vio.rule}
                        <span className="text-ink-faint"> · </span>
                        <span className="text-[11px] text-ink-faint">
                            {vio.detail}
                        </span>
                    </span>
                    {vio.passed ? (
                        <span />
                    ) : (
                        <button
                            type="button"
                            disabled={fixing[index]}
                            onClick={() =>
                                setFixing((prev) => ({ ...prev, [index]: true }))
                            }
                            className="cursor-pointer rounded-[5px] border border-fix-line bg-transparent px-[9px] py-[3px] font-mono text-[11px] text-fix-ink hover:bg-fix-hover disabled:cursor-default"
                        >
                            {fixing[index] ? "fixing…" : "fix ▸"}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

function GateActions({ def }: { def: Gate }): ReactElement {
    const { closeGate, openArtifact } = useOverlay();

    if (def.variant === "judgment") {
        return (
            <div className="flex flex-wrap items-center gap-[9px]">
                <button
                    type="button"
                    onClick={closeGate}
                    className={BTN_WEIGHTY}
                >
                    Split into 2 epics
                    <span className="font-normal text-[10.5px] opacity-70">
                        {" "}
                        — spawns concurrent pipelines · confirm
                    </span>
                </button>
                <button type="button" onClick={closeGate} className={BTN}>
                    Accept size XL &amp; continue
                </button>
                <button type="button" onClick={closeGate} className={BTN}>
                    Revise scope
                </button>
                <button
                    type="button"
                    onClick={() => openArtifact(def.artifact)}
                    className={`ml-auto ${BTN_PEEK}`}
                >
                    {def.peekLabel}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-[9px]">
            <button type="button" onClick={closeGate} className={BTN_PRIMARY}>
                Re-run analyze after fixes
            </button>
            <button
                type="button"
                onClick={() => openArtifact(def.artifact)}
                className={BTN_PEEK}
            >
                {def.peekLabel}
            </button>
            <span className="ml-auto font-mono text-[11px] text-ink-faint">
                No proceed-anyway.{" "}
                <button
                    type="button"
                    className="cursor-pointer bg-transparent font-mono text-[11px] text-red underline decoration-dotted"
                >
                    Override w/ justification
                </button>{" "}
                if you must.
            </span>
        </div>
    );
}

export function GateTray(): ReactElement {
    const { gate } = useOverlay();
    const open = gate !== null;

    // Retain the last-surfaced gate so its content stays rendered while the tray
    // collapses (the shared state clears `gate` immediately on resolve).
    const [shown, setShown] = useState<string | null>(gate);
    useEffect(() => {
        if (gate !== null) {
            setShown(gate);
        }
    }, [gate]);

    const def = resolveGate(shown);

    return (
        <div
            role="region"
            aria-label={def ? def.title : "Pipeline gate"}
            aria-hidden={!open}
            className={`flex-none overflow-hidden border-t-2 transition-[max-height] duration-[320ms] ease-[cubic-bezier(.4,0,.2,1)] ${
                open ? "max-h-[46vh]" : "max-h-0"
            } ${
                def?.variant === "validation"
                    ? "gate-grad-validation border-red"
                    : "gate-grad-judgment border-gate"
            }`}
        >
            {def && (
                <div className="px-5 pb-4 pt-[13px]">
                    <div className="mb-1 flex items-baseline gap-[10px] font-mono">
                        <span
                            className={`rounded-[4px] px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-[.04em] ${
                                def.variant === "validation"
                                    ? "bg-red text-on-red"
                                    : "bg-gate text-on-gate"
                            }`}
                        >
                            {def.badge}
                        </span>
                        <span className="text-[14px] font-bold text-ink">
                            {def.title}
                        </span>
                        <span className="ml-auto font-mono text-[12px] text-ink-dim">
                            {def.sub}
                        </span>
                    </div>

                    <div className="mb-3 mt-[6px] border-l-2 border-line pl-3 font-mono text-[12px] text-ink-dim">
                        {def.why}
                    </div>

                    {def.variant === "judgment" ? (
                        <StoryList />
                    ) : (
                        <ViolationList />
                    )}

                    <GateActions def={def} />
                </div>
            )}
        </div>
    );
}

export default GateTray;
