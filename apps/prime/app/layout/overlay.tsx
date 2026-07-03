import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

/*
 * The shared overlay state owned by the shell (decision record: a single shared
 * overlay state with mutual-guard dismissal, mirroring the mockup's one `recede`
 * class on the terminal wrapper). Which ephemeral surfaces are open is held here,
 * once, so the terminal's recede is derived — not duplicated per region — and the
 * "unless the other surface is still open" rule has one home.
 *
 * Story 6 delivered the peek drawer, the first surface to land. The gate tray
 * (Story 5) composes into this same state: `receded` is now "drawer open OR gate
 * open", and closing one surface while the other stays open keeps the terminal
 * dimmed — the mutual guard lives here, once, with no region reaching into
 * another.
 *
 * Story 7 folds the mock stage-advance state into this same shell-owned state:
 * whether a stage has just completed (`advanceReady`) and, once the user runs the
 * next stage, which command is running in the terminal placeholder (`running`).
 * The advance bar reads `receded` to stay hidden while a surface is up — "no gate
 * pending" is exactly "no overlay surface open" — so its shown/hidden rule lives
 * here beside the surfaces it coordinates with, not duplicated in the region.
 */

/* Mock next-stage command the advance affordance offers (mockup `Next: nxs.hld`). */
const NEXT_COMMAND = "nxs.hld";

interface OverlayContextValue {
    /* The artifact key the peek drawer is showing, or `null` when it is closed. */
    artifact: string | null;
    /* Open the drawer on the given artifact (a stage id or artifact key). */
    openArtifact: (key: string) => void;
    /* Close the drawer. */
    closeArtifact: () => void;
    /* The id of the pending gate the tray is showing, or `null` when closed. */
    gate: string | null;
    /* Surface the gate for the given id (the stage id its rail segment carries). */
    openGate: (id: string) => void;
    /* Resolve/dismiss the open gate. */
    closeGate: () => void;
    /* Whether the terminal should recede — true while any overlay surface is open. */
    receded: boolean;
    /* Whether a stage has just completed, so the advance affordance is offered. */
    advanceReady: boolean;
    /* The next-stage command the advance affordance runs (mock). */
    nextCommand: string;
    /* The command shown running in the terminal placeholder, or `null` when idle. */
    running: string | null;
    /* Run the next stage: hide the affordance and mark its command running (mock). */
    runNext: () => void;
}

/*
 * A non-throwing default lets a region render in isolation (e.g. a region-level
 * test) without a provider: no overlay is open and the triggers are inert.
 */
const OverlayContext = createContext<OverlayContextValue>({
    artifact: null,
    openArtifact: () => undefined,
    closeArtifact: () => undefined,
    gate: null,
    openGate: () => undefined,
    closeGate: () => undefined,
    receded: false,
    advanceReady: false,
    nextCommand: NEXT_COMMAND,
    running: null,
    runNext: () => undefined,
});

export function OverlayProvider({
    children,
}: {
    children: ReactNode;
}): ReactElement {
    const [artifact, setArtifact] = useState<string | null>(null);
    const [gate, setGate] = useState<string | null>(null);
    // Seeded ready so the advance affordance demonstrates its shown state (mock
    // stage-complete fixture); running is idle until the user triggers the run.
    const [advanceReady, setAdvanceReady] = useState<boolean>(true);
    const [running, setRunning] = useState<string | null>(null);

    const openArtifact = useCallback((key: string) => setArtifact(key), []);
    const closeArtifact = useCallback(() => setArtifact(null), []);
    const openGate = useCallback((id: string) => setGate(id), []);
    const closeGate = useCallback(() => setGate(null), []);
    const runNext = useCallback(() => {
        setAdvanceReady(false);
        setRunning(NEXT_COMMAND);
    }, []);

    const value = useMemo<OverlayContextValue>(
        () => ({
            artifact,
            openArtifact,
            closeArtifact,
            gate,
            openGate,
            closeGate,
            receded: artifact !== null || gate !== null,
            advanceReady,
            nextCommand: NEXT_COMMAND,
            running,
            runNext,
        }),
        [
            artifact,
            openArtifact,
            closeArtifact,
            gate,
            openGate,
            closeGate,
            advanceReady,
            running,
            runNext,
        ],
    );

    return (
        <OverlayContext.Provider value={value}>
            {children}
        </OverlayContext.Provider>
    );
}

export function useOverlay(): OverlayContextValue {
    return useContext(OverlayContext);
}
