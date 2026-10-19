/**
 * `nexus initiative-context` — the readable face of the initiative context rules (epic #850,
 * decision record #961). Command bodies ask here for the folder and the pointer sentence rather than
 * writing either out, so the epic stage and the readers cannot disagree on where a context is kept.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { defaultRunner } from "@nexus/workspace/run";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";
import { checkPlan, initiativeContextDir, renderPointer } from "./initiative-context.js";
import { lookupInitiativeContext, renderContextSource } from "./initiative-context-lookup.js";

/** The subverbs `nexus initiative-context` dispatches. */
export const INITIATIVE_CONTEXT_SUBVERBS: readonly string[] = ["path", "pointer", "check-plan", "lookup"];

export const INITIATIVE_CONTEXT_USAGE: string = [
    "  nexus initiative-context path --initiative <N>",
    "      Print the folder that keeps initiative N's planning context: the initiative store of",
    "      the checkout the issues are filed from (the hub, in a workspace).",
    "  nexus initiative-context pointer [--initiative <N>]",
    "      Print the one sentence an initiative body carries to name that folder. With no number",
    "      it carries the <INITIATIVE> placeholder the epic stage fills once the initiative is filed.",
    "  nexus initiative-context check-plan --plan <path>",
    "      Check a design plan named to the epic stage before anything is drafted. Prints",
    "      { path, name, keptAs }; a missing or empty plan exits 1 as missing-plan or empty-plan,",
    "      naming the file.",
    "  nexus initiative-context lookup --issue <N> [--out <file>]",
    "      Find the kept context of the initiative above issue N, for planning a stub or",
    "      designing an epic. Prints { state, issue, initiative, folder, files }: state is",
    "      no-initiative, context (the body and every file in the folder) or body-only.",
    "      --out writes the initiative body and each context file there, each under a heading",
    "      naming its origin. A body that names a context this checkout lacks exits 1 as",
    "      context-missing, naming the expected folder; nothing is written.",
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
    if (sub === "lookup") return runLookup(argv.slice(1), io);
    const initiative = takeInitiative(argv.slice(1), io);
    if (initiative === null) return 2;

    if (sub === "path") {
        if (initiative === undefined) {
            io.stderr(`usage:\n${INITIATIVE_CONTEXT_USAGE}`);
            return 2;
        }
        const root: string | null = contextRoot(io);
        if (root === null) return 1;
        io.stdout(path.join(root, initiativeContextDir(initiative)));
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

function runLookup(argv: string[], io: InitiativeContextIo): number {
    let issue: number | undefined;
    let out: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--issue" && /^#?[1-9]\d*$/.test(argv[i + 1] ?? "")) issue = Number(argv[++i].replace(/^#/, ""));
        else if (argv[i] === "--out" && (argv[i + 1] ?? "") !== "") out = argv[++i];
        else {
            io.stderr(`usage:\n${INITIATIVE_CONTEXT_USAGE}`);
            return 2;
        }
    }
    if (issue === undefined) {
        io.stderr(`usage:\n${INITIATIVE_CONTEXT_USAGE}`);
        return 2;
    }
    const root: string | null = contextRoot(io);
    if (root === null) return 1;
    const result = lookupInitiativeContext(defaultRunner, root, issue);
    if (!result.ok) {
        io.stderr(`initiative-context ${result.problem}: ${result.message}`);
        return 1;
    }
    const outcome = result.outcome;
    let written: string | undefined;
    if (out !== undefined && outcome.state !== "no-initiative") {
        written = path.resolve(io.cwd, out);
        fs.mkdirSync(path.dirname(written), { recursive: true });
        fs.writeFileSync(written, renderContextSource(outcome));
    }
    io.stdout(
        JSON.stringify(
            outcome.state === "no-initiative"
                ? { state: outcome.state, issue: outcome.issue }
                : {
                      state: outcome.state,
                      issue: outcome.issue,
                      initiative: outcome.initiative,
                      folder: outcome.folder,
                      files: outcome.state === "context" ? outcome.files.map((f) => f.name) : [],
                      ...(written === undefined ? {} : { out: written }),
                  },
        ),
    );
    return 0;
}

/**
 * The checkout whose initiative store holds the contexts: the one the issues are filed from, so the
 * writer and every reader resolve the same folder from anywhere in a workspace.
 */
function contextRoot(io: InitiativeContextIo): string | null {
    const resolved = resolveWorkspace(io.cwd);
    if (!resolved.ok) {
        io.stderr(renderWorkspaceStatus(resolved));
        return null;
    }
    return resolved.workspace.mode === "workspace" ? resolved.workspace.hubRoot : resolved.workspace.root;
}
