/**
 * `nexus initiative-context` — the readable face of the initiative context rules (epic #850,
 * decision record #961). Command bodies ask here for the folder and the pointer sentence rather than
 * writing either out, so the epic stage and the readers cannot disagree on where a context is kept.
 */

import { initiativeContextDir, renderPointer } from "./initiative-context.js";

/** The subverbs `nexus initiative-context` dispatches. */
export const INITIATIVE_CONTEXT_SUBVERBS: readonly string[] = ["path", "pointer"];

export const INITIATIVE_CONTEXT_USAGE: string = [
    "  nexus initiative-context path --initiative <N>",
    "      Print the repo-relative folder that keeps initiative N's planning context.",
    "  nexus initiative-context pointer [--initiative <N>]",
    "      Print the one sentence an initiative body carries to name that folder. With no number",
    "      it carries the <INITIATIVE> placeholder the epic stage fills once the initiative is filed.",
].join("\n");

interface InitiativeContextIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/** Parse `--initiative <N>`; undefined when absent, null (after reporting) when malformed. */
function takeInitiative(argv: string[], io: InitiativeContextIo): number | undefined | null {
    let value: number | undefined;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--initiative") {
            const raw: string = (argv[++i] ?? "").replace(/^#/, "");
            if (!/^[1-9]\d*$/.test(raw)) {
                io.stderr(`--initiative needs an issue number, got: ${argv[i] ?? "(nothing)"}`);
                return null;
            }
            value = Number(raw);
        } else {
            io.stderr(`unknown argument for initiative-context: ${argv[i]}\n${INITIATIVE_CONTEXT_USAGE}`);
            return null;
        }
    }
    return value;
}

export async function runInitiativeContext(argv: string[], io: InitiativeContextIo): Promise<number> {
    const sub: string | undefined = argv[0];
    if (sub === undefined || !INITIATIVE_CONTEXT_SUBVERBS.includes(sub)) {
        io.stderr(`usage:\n${INITIATIVE_CONTEXT_USAGE}`);
        return 2;
    }
    const initiative = takeInitiative(argv.slice(1), io);
    if (initiative === null) return 2;

    if (sub === "path") {
        if (initiative === undefined) {
            io.stderr(`usage:\n${INITIATIVE_CONTEXT_USAGE}`);
            return 2;
        }
        io.stdout(initiativeContextDir(initiative));
        return 0;
    }
    io.stdout(renderPointer(initiative));
    return 0;
}
