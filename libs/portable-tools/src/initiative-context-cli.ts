/**
 * `nexus initiative-context` — the readable face of the initiative context rules (epic #850,
 * decision record #961). Command bodies ask here for the folder and the pointer sentence rather than
 * writing either out, so the epic stage and the readers cannot disagree on where a context is kept.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { checkPlan, initiativeContextDir, renderPointer } from "./initiative-context.js";

/** The subverbs `nexus initiative-context` dispatches. */
export const INITIATIVE_CONTEXT_SUBVERBS: readonly string[] = ["path", "pointer", "check-plan"];

export const INITIATIVE_CONTEXT_USAGE: string = [
    "  nexus initiative-context path --initiative <N>",
    "      Print the repo-relative folder that keeps initiative N's planning context.",
    "  nexus initiative-context pointer [--initiative <N>]",
    "      Print the one sentence an initiative body carries to name that folder. With no number",
    "      it carries the <INITIATIVE> placeholder the epic stage fills once the initiative is filed.",
    "  nexus initiative-context check-plan --plan <path>",
    "      Check a design plan named to the epic stage before anything is drafted. Prints",
    "      { path, name, keptAs }; a missing or empty plan exits 1 as missing-plan or empty-plan,",
    "      naming the file.",
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
    if (sub === "check-plan") return runCheckPlan(argv.slice(1), io);
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

function runCheckPlan(argv: string[], io: InitiativeContextIo): number {
    if (argv.length !== 2 || argv[0] !== "--plan" || argv[1] === "") {
        io.stderr(`usage:\n${INITIATIVE_CONTEXT_USAGE}`);
        return 2;
    }
    const result = checkPlan(path.resolve(io.cwd, argv[1]), argv[1], fs);
    if (!result.ok) {
        io.stderr(`initiative-context ${result.problem}: ${result.message}`);
        return 1;
    }
    io.stdout(JSON.stringify({ path: result.path, name: result.name, keptAs: result.keptAs }));
    return 0;
}
