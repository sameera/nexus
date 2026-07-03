import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useOverlay } from "../layout/overlay";
import { resolveArtifact } from "./artifacts";

/*
 * Artifact peek drawer (mockup `.drawer` + `.scrim`) — the dismissible slide-over
 * that renders a mock artifact file over a scrim while the terminal recedes
 * behind it. It slides in from the right on a peek trigger (the tools button, a
 * `done` rail segment, or — once Story 5 lands — a gate "open artifact" action)
 * and closes on the close control, a scrim click, or ESC.
 *
 * The scrim and drawer stay mounted so the slide/fade play in both directions;
 * `open` (derived from the shared overlay state) drives the transform/opacity.
 * The last-shown artifact is retained during the close animation so the body
 * doesn't blank out mid-slide. Recede coordination is owned by the shell
 * (see layout/overlay.tsx), so closing here returns the terminal to full
 * fidelity only when no other surface remains open.
 */
export function PeekDrawer(): ReactElement {
    const { artifact, closeArtifact } = useOverlay();
    const open = artifact !== null;

    // Retain the last opened artifact so the body stays rendered while the
    // drawer slides out (the shared state clears `artifact` immediately on close).
    const [shown, setShown] = useState<string | null>(artifact);
    useEffect(() => {
        if (artifact !== null) {
            setShown(artifact);
        }
    }, [artifact]);

    useEffect(() => {
        if (!open) {
            return;
        }
        function onKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                closeArtifact();
            }
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open, closeArtifact]);

    const { path, body } = resolveArtifact(shown);

    return (
        <>
            {/* Scrim (mockup `.scrim`) — click-away target that fades in. */}
            <div
                data-testid="drawer-scrim"
                aria-hidden="true"
                onClick={() => closeArtifact()}
                className={`absolute inset-0 z-[18] bg-scrim transition-opacity duration-[250ms] ${
                    open ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
            />

            {/* Slide-over (mockup `.drawer`). */}
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Artifact preview"
                aria-hidden={!open}
                className={`absolute bottom-0 right-0 top-0 z-[19] flex w-[min(540px,80%)] flex-col border-l border-line bg-term shadow-drawer transition-transform duration-[280ms] ease-[cubic-bezier(.4,0,.2,1)] ${
                    open ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex flex-none items-center gap-[10px] border-b border-line px-4 py-3 font-mono text-[12px]">
                    <span className="flex-1 text-ink-dim">{path}</span>
                    <span className="rounded-[4px] border border-line px-[7px] py-px text-[10px] text-ink-faint">
                        raw file · read-only
                    </span>
                    <button
                        type="button"
                        aria-label="Close artifact"
                        onClick={() => closeArtifact()}
                        className="cursor-pointer border-none bg-transparent text-[16px] text-ink-dim hover:text-ink"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-[22px] py-[18px] font-mono text-[12.5px] leading-[1.7] text-ink-dim">
                    {body}
                </div>

                <div className="flex-none border-t border-line px-4 py-2 font-mono text-[10.5px] text-ink-faint">
                    The actual file Claude wrote — rendered, never re-summarized.
                    ESC or click-away to return to the terminal.
                </div>
            </aside>
        </>
    );
}

export default PeekDrawer;
