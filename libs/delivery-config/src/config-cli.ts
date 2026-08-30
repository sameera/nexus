/**
 * The `config` capability — the shared delivery-configuration resolver, as a command line.
 *
 * The non-library consumers (a pipeline stage, a person at a shell) obtain a resolved value by
 * asking for it here, never by parsing settings themselves, so four consumers cannot disagree
 * about what a repository declared.
 *
 * Argument parsing is hand-rolled in the shape the executable already uses (D9): the contract to
 * preserve is the flags, the exit codes and the message content the acceptance criteria state — not
 * the incidental wording a parsing framework happens to generate.
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { BACKLOG_QUERY_FORMS, backlogQuery } from "./backlog.js";
import { type GhRunner, type RunResult, defaultGhRunner, repoHasIssueTypes } from "./gh.js";
import { type ToolkitIo } from "./io.js";
import { layersAt, resolvePublishingKey } from "./resolve.js";
import { type WriteReport, writeGithubBlock } from "./write.js";

/** The program name this capability reports; the executable is the only name it answers to. */
const PROGRAM_NAME = "nexus";

const CAPABILITY = "config";

/** One `--flag value` pair pulled off an argument vector, with the rest kept in order. */
export function takeOption(args: string[], flag: string): { value: string | null; rest: string[] } {
    const at: number = args.indexOf(flag);
    if (at === -1) return { value: null, rest: args };
    return { value: args[at + 1] ?? "", rest: [...args.slice(0, at), ...args.slice(at + 2)] };
}

export function configUsage(): string {
    return [
        `usage: ${`${PROGRAM_NAME} ${CAPABILITY}`} <command> [args...]`,
        "",
        "commands:",
        "  resolve <key> [--root <path>]   Resolve one github-block key through the precedence chain.",
        "  backlog-query [--form <form>]   Print the cross-feature backlog query (list | search | exclude).",
        "  detect-classification           Probe whether the repository exposes issue types.",
        "  write-github [--root <path>]    Seed absent github-block keys into settings.yml (add-only).",
        "",
        `Run \`${`${PROGRAM_NAME} ${CAPABILITY}`} <command> --help\` for a command's own arguments.`,
    ].join("\n");
}

function usageError(io: ToolkitIo, message: string): number {
    io.stderr(configUsage());
    io.stderr(`${`${PROGRAM_NAME} ${CAPABILITY}`}: ${message}`);
    return 2;
}

/** `config resolve <key> [--root <path>]` — print the resolved value, or an empty line. */
export function runConfigResolve(args: string[], io: ToolkitIo): number {
    const { value: root, rest } = takeOption(args, "--root");
    if (rest.length === 0) return usageError(io, "resolve requires a github-block key");
    if (rest.length > 1) return usageError(io, `resolve: unexpected argument '${rest[1]}'`);
    io.stdout(resolvePublishingKey(path.resolve(io.cwd, root ?? "."), rest[0]));
    return 0;
}

/** `config backlog-query [--form <form>] [--root <path>]` — the backlog as one query. */
export function runConfigBacklogQuery(args: string[], io: ToolkitIo): number {
    const { value: root, rest: afterRoot } = takeOption(args, "--root");
    const { value: form, rest } = takeOption(afterRoot, "--form");
    if (rest.length > 0) return usageError(io, `backlog-query: unexpected argument '${rest[0]}'`);
    const wanted: string = form ?? "list";
    if (!BACKLOG_QUERY_FORMS.includes(wanted)) {
        return usageError(
            io,
            `backlog-query: unknown form '${wanted}'; expected one of ${BACKLOG_QUERY_FORMS.join(", ")}`,
        );
    }
    io.stdout(backlogQuery(layersAt(path.resolve(io.cwd, root ?? ".")), wanted));
    return 0;
}

/** The client runner the capability runs with: the real client, never raising on an absent one. */
export const cliGhRunner: GhRunner = defaultGhRunner((args: string[]): RunResult => {
    const r = spawnSync("gh", args, { encoding: "utf8" });
    return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
});

/**
 * `config detect-classification [--root <path>]` — what the repository actually supports.
 *
 * A probe that cannot run at all reports `unavailable` and still exits 0: a bootstrap uses that to
 * seed safe defaults, and a non-zero exit here would fail a setup over a missing client.
 */
export function runConfigDetectClassification(
    args: string[],
    io: ToolkitIo,
    run: GhRunner = cliGhRunner,
): number {
    const { rest } = takeOption(args, "--root");
    if (rest.length > 0) return usageError(io, `detect-classification: unexpected argument '${rest[0]}'`);
    const hasTypes: boolean | null = repoHasIssueTypes(run);
    io.stdout(hasTypes === null ? "unavailable" : hasTypes ? "types" : "labels");
    return 0;
}

/** The keys `write-github` accepts, each as its own flag, named as the block spells them. */
export const WRITE_GITHUB_KEYS: readonly string[] = [
    "classification",
    "project",
    "issues-repo",
    "epic-repo",
    "story-repo",
];

/** `config write-github [--root <path>] [--<key> <value>…] [--comment <text>]`. */
export function runConfigWriteGithub(args: string[], io: ToolkitIo): number {
    let rest: string[] = args;
    const values: Record<string, string> = {};
    for (const key of WRITE_GITHUB_KEYS) {
        const taken = takeOption(rest, `--${key}`);
        rest = taken.rest;
        if (taken.value !== null) values[key] = taken.value;
    }
    const takenRoot = takeOption(rest, "--root");
    const takenComment = takeOption(takenRoot.rest, "--comment");
    if (takenComment.rest.length > 0) {
        return usageError(io, `write-github: unexpected argument '${takenComment.rest[0]}'`);
    }
    // The given root is the target: a bootstrap seeds *this* repository's settings, so no ancestor
    // is walked to and the configuration directory is created when it is absent.
    const root: string = path.resolve(io.cwd, takenRoot.value ?? ".");
    const report: WriteReport = writeGithubBlock(root, values, takenComment.value);
    io.stdout(
        report.added.length > 0
            ? `Seeded github block (${report.added.join(", ")}) into ${report.path}`
            : `No changes — every requested key is already declared in ${report.path}`,
    );
    return 0;
}

/** The commands this toolkit answers in process. Anything else is still the interpreter's. */
export const CONFIG_COMMANDS: Record<string, (args: string[], io: ToolkitIo) => number> = {
    resolve: runConfigResolve,
    "backlog-query": runConfigBacklogQuery,
    "detect-classification": runConfigDetectClassification,
    "write-github": runConfigWriteGithub,
};

export function runConfig(args: string[], io: ToolkitIo): number {
    if (args.length === 0) return usageError(io, "a command is required");
    if (args[0] === "-h" || args[0] === "--help") {
        io.stdout(configUsage());
        return 0;
    }
    const command = CONFIG_COMMANDS[args[0]];
    if (command === undefined) return usageError(io, `unknown command '${args[0]}'`);
    return command(args.slice(1), io);
}
