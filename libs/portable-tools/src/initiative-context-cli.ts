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
import { postParts, runRender } from "./initiative-context-store.js";
import { issuesRepoSlug, canonicalIssuesRepo, onIssuesHost, resolveVerdictRepos } from "@nexus/epic-verdicts/verdict-repos";

/** The subverbs `nexus initiative-context` dispatches. */
export const INITIATIVE_CONTEXT_SUBVERBS: readonly string[] = ["path", "pointer", "check-plan", "lookup", "render", "post-parts"];

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
    "      designing an epic, reading the initiative issue only. Prints { state, issue, initiative,",
    "      where, ignored }: state is no-initiative, context (kept in the body or in numbered",
    "      comments) or body-only. --out writes the initiative body and its context there, each",
    "      under a heading naming its origin. A missing or changed part, unreadable comments, or a",
    "      body that still names a context folder exits 1 (context-missing, context-changed,",
    "      comments-unreadable, legacy-folder), naming the initiative; nothing is written.",
    "  nexus initiative-context render --body <file> --context <file> --dir <folder>",
    "      Render the initiative body for the context summary in <file> and the full context text.",
    "      The context stays in the body, collapsed, when it fits; otherwise it is split into",
    "      numbered parts. Writes <folder>/body.md and <folder>/part-N.md; prints { body, parts, where }.",
    "  nexus initiative-context post-parts --issue <N> --dir <folder>",
    "      Post <folder>/part-N.md as comments on initiative N, in order. A part already on the",
    "      issue is skipped, and each part is read back after posting. Exits 1 on any failure.",
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
    if (sub === "render") return runRender(argv.slice(1), io);
    if (sub === "post-parts") return runPostParts(argv.slice(1), io);
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
    if (outcome.state === "context") {
        for (const i of outcome.ignored) io.stderr(`initiative-context ignored a context comment by ${i.author || "an unknown author"}: ${i.reason}.`);
    }
    io.stdout(
        JSON.stringify(
            outcome.state === "no-initiative"
                ? { state: outcome.state, issue: outcome.issue }
                : {
                      state: outcome.state,
                      issue: outcome.issue,
                      initiative: outcome.initiative,
                      ...(outcome.state === "context" ? { where: outcome.where, ignored: outcome.ignored } : {}),
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

function runPostParts(argv: string[], io: InitiativeContextIo): number {
    const issueRaw: string | undefined = argv.includes("--issue") ? argv[argv.indexOf("--issue") + 1] : undefined;
    const dir: string | undefined = argv.includes("--dir") ? argv[argv.indexOf("--dir") + 1] : undefined;
    if (issueRaw === undefined || !/^#?[1-9]\d*$/.test(issueRaw) || dir === undefined) {
        io.stderr(`usage:\n${INITIATIVE_CONTEXT_USAGE}`);
        return 2;
    }
    const root: string | null = contextRoot(io);
    if (root === null) return 1;
    const repos = resolveVerdictRepos(defaultRunner, root);
    if (!repos.ok) {
        io.stderr(`initiative-context gh-failed: ${repos.error.message}`);
        return 1;
    }
    const issuesRepo: string = canonicalIssuesRepo(repos.repos.issuesRepo);
    const folder: string = path.resolve(io.cwd, dir);
    const parts: string[] = fs
        .readdirSync(folder)
        .filter((f) => /^part-\d+\.md$/.test(f))
        .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))
        .map((f) => fs.readFileSync(path.join(folder, f), "utf8"));
    const result = postParts(onIssuesHost(defaultRunner, issuesRepo), root, issuesRepoSlug(issuesRepo), Number(issueRaw.replace(/^#/, "")), parts);
    if (!result.ok) {
        io.stderr(`initiative-context post-failed: ${result.message}`);
        return 1;
    }
    io.stdout(JSON.stringify({ parts: parts.length, posted: result.posted }));
    return 0;
}
