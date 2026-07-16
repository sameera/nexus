/**
 * The single portable `nexus` entrypoint (epic #60): the structural half of getting Nexus into
 * a repo or a whole workspace. A thin writer/orchestrator over two capabilities it must not
 * duplicate — the workspace resolver (`@nexus/workspace`, the single authority on workspace
 * shape) and the component-deploy primitive (`deploy-components.ts`, the sole `.claude/`
 * installer). Judgment stays with `/nxs.setup`.
 *
 * Bundled as `nexus.mjs` on the portable distributable (ENTRY_POINTS in build-bundles.ts) with
 * the vendored component payload carried beside it as plain files, so every verb runs to
 * completion on a bare `node` binary with no install step.
 *
 * Verbs:
 *   nexus deploy                       install the Nexus components into the invoking repo
 *   nexus workspace init               declare a multi-repo workspace (STORY-60.02)
 *   nexus workspace status             read-only workspace status (STORY-60.03)
 *   nexus workspace add-repo           add one member to an existing workspace (STORY-60.04)
 */

import * as path from "node:path";
import { deployComponents, type DeployResult } from "./deploy-components.js";
import { COMPONENT_PAYLOAD_DIRNAME } from "./vendor-components.js";

export interface CliIo {
    /** The invoking working directory (the repo a verb acts on / resolves from). */
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

const USAGE: string = [
    "usage: nexus <verb>",
    "",
    "  nexus deploy [--payload <dir>] [--target <dir>]",
    "      Install the Nexus Claude components (.claude/ commands, agents, skills) into the",
    "      target repo (default: the current directory), mirroring the vendored payload",
    "      (default: the claude-components directory beside this artifact). Idempotent;",
    "      user-owned files such as .claude/settings.local.json are never touched.",
    "",
    "  nexus workspace init        Declare a multi-repo workspace (hub + members).",
    "  nexus workspace status      Read-only workspace status from any checkout.",
    "  nexus workspace add-repo    Add the invoking checkout to an existing workspace.",
].join("\n");

/** Where the vendored payload lives when running as a distributed artifact. */
export function defaultPayloadDir(): string {
    return path.join(import.meta.dirname, COMPONENT_PAYLOAD_DIRNAME);
}

/** Extract `--flag value` pairs; returns null (after reporting) on a flag missing its value. */
function takeOption(argv: string[], flag: string, io: CliIo): { present: boolean; value?: string } | null {
    const index: number = argv.indexOf(flag);
    if (index === -1) {
        return { present: false };
    }
    const value: string | undefined = argv[index + 1];
    if (value === undefined) {
        io.stderr(`${flag} requires a value`);
        return null;
    }
    argv.splice(index, 2);
    return { present: true, value };
}

async function runDeploy(argv: string[], io: CliIo): Promise<number> {
    const rest: string[] = [...argv];
    const payloadOpt = takeOption(rest, "--payload", io);
    if (payloadOpt === null) {
        return 2;
    }
    const targetOpt = takeOption(rest, "--target", io);
    if (targetOpt === null) {
        return 2;
    }
    if (rest.length > 0) {
        io.stderr(`unknown argument for deploy: ${rest[0]}\n${USAGE}`);
        return 2;
    }

    const payloadDir: string = payloadOpt.value ?? defaultPayloadDir();
    const targetRepoRoot: string = targetOpt.value ?? io.cwd;

    let result: DeployResult;
    try {
        result = deployComponents(payloadDir, targetRepoRoot);
    } catch (error) {
        io.stderr(error instanceof Error ? error.message : String(error));
        return 1;
    }
    io.stdout(
        `deployed ${result.written.length} component file(s) into ${path.join(targetRepoRoot, ".claude")}` +
            (result.removed.length > 0 ? `; removed ${result.removed.length} stale component file(s)` : ""),
    );
    return 0;
}

/** Run the CLI against explicit argv (no leading node/script segments) and IO. */
export async function runNexusCli(argv: string[], io: CliIo): Promise<number> {
    const [verb, ...rest] = argv;

    if (verb === "--help" || verb === "help") {
        io.stdout(USAGE);
        return 0;
    }
    if (verb === undefined) {
        io.stderr(USAGE);
        return 2;
    }
    if (verb === "deploy") {
        return runDeploy(rest, io);
    }
    io.stderr(`unknown verb '${verb}'\n${USAGE}`);
    return 2;
}

async function main(): Promise<void> {
    const io: CliIo = {
        cwd: process.cwd(),
        stdout: (line: string): void => {
            process.stdout.write(line + "\n");
        },
        stderr: (line: string): void => {
            process.stderr.write(line + "\n");
        },
    };
    process.exit(await runNexusCli(process.argv.slice(2), io));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
