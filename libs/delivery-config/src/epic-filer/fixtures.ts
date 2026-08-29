/**
 * The scaffolding the epic filer's specs share: a scratch checkout, a recording io, and a platform
 * client that answers from canned results.
 *
 * Nothing here contacts GitHub and nothing spawns a process — the seams the run resolves its
 * runner, its terminal and its clock through are handed fakes, which is the level the
 * carried-across Python cases assert at (Invariant 17).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type GhRunner, type RunResult } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type EpicEnvironment } from "./environment.js";

export const OK = (stdout = ""): RunResult => ({ status: 0, stdout, stderr: "" });
export const FAIL = (stderr = "boom"): RunResult => ({ status: 1, stdout: "", stderr });

export interface RecordingIo extends ToolkitIo {
    out: string[];
    err: string[];
    /** Everything written, in the order it was written, whichever stream it went to. */
    all: () => string;
}

export function recordingIo(cwd: string): RecordingIo {
    const out: string[] = [];
    const err: string[] = [];
    return {
        cwd,
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
        out,
        err,
        all: () => [...out, ...err].join("\n"),
    };
}

export interface FakeEnvironment {
    env: EpicEnvironment;
    /** Every argument vector handed to the platform client, in order. */
    calls: string[][];
    /** Every argument vector handed to the version-control client, in order. */
    gitCalls: string[][];
    /** The roots the run bound its runners to. */
    roots: string[];
    /** The questions the run asked at the prompt. */
    asked: string[];
}

export interface FakeOptions {
    /** Canned answers, by argument vector. Undefined means "succeed with empty output". */
    answer?: (args: string[]) => RunResult | undefined;
    /** Whether the platform client is installed. */
    hasGh?: boolean;
    /** Whether a terminal is attached. */
    interactive?: boolean;
    /** The line the prompt reads back, or null for an answer that cannot be read. */
    reply?: string | null;
    /** Whether the target root is a git repository. */
    isRepo?: boolean;
}

/**
 * The platform client the carried-across Python cases run against: it authenticates, names the
 * repository, reports no projects, upserts any label and mints issue #7. A case's own `answer` gets
 * first refusal, which is how it makes exactly one call fail.
 */
export function cannedGh(args: string[]): RunResult | undefined {
    if (args[0] === "repo" && args[1] === "view") return OK("acme/repo\n");
    if (args[0] === "api" && args[1] === "graphql") {
        return OK(JSON.stringify({ data: { repository: { projectsV2: { nodes: [] } } } }));
    }
    if (args[0] === "issue" && args[1] === "create") return OK("https://github.com/acme/repo/issues/7\n");
    return undefined;
}

export function fakeEnvironment(options: FakeOptions = {}): FakeEnvironment {
    const calls: string[][] = [];
    const gitCalls: string[][] = [];
    const roots: string[] = [];
    const asked: string[] = [];
    return {
        calls,
        gitCalls,
        roots,
        asked,
        env: {
            runnerFor: (root: string): GhRunner => {
                roots.push(root);
                return (args: string[]): RunResult => {
                    calls.push(args);
                    return options.answer?.(args) ?? cannedGh(args) ?? OK();
                };
            },
            gitFor: (root: string): GhRunner => {
                roots.push(root);
                return (args: string[]): RunResult => {
                    gitCalls.push(args);
                    return options.isRepo === false ? FAIL("not a git repository") : OK("true\n");
                };
            },
            hasGh: () => options.hasGh !== false,
            interactive: () => options.interactive === true,
            prompt: (question: string): string | null => {
                asked.push(question);
                return options.reply ?? null;
            },
        },
    };
}

/** A scratch checkout, with the given files written into it. */
export function checkout(files: Record<string, string> = {}): string {
    const root: string = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-epic-")));
    for (const [relative, content] of Object.entries(files)) {
        const file: string = path.join(root, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    }
    return root;
}

/** A checkout whose settings declare `github` keys. */
export function checkoutWith(github: Record<string, string>, extra: Record<string, string> = {}): string {
    const block: string =
        Object.keys(github).length === 0
            ? ""
            : ["github:", ...Object.entries(github).map(([key, value]) => `  ${key}: ${value}`), ""].join("\n");
    return checkout({ ".nexus/config/settings.yml": block, ...extra });
}

/** One ordinary epic draft, with `extra` frontmatter merged over the defaults. */
export function draft(extra: Record<string, string> = {}, body = "# Epic: Demo Epic\n\n## Description\n\nA demo.\n"): string {
    const fields: Record<string, string> = { feature: '"Demo"', epic: '"Demo Epic"', type: '""', ...extra };
    const lines: string[] = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
    return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

/** Write an epic draft into `root` and return its path. */
export function writeDraft(root: string, content: string, name = "epic.md"): string {
    const file: string = path.join(root, name);
    fs.writeFileSync(file, content, "utf8");
    return file;
}
