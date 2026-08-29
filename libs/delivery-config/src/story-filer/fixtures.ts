/**
 * The scaffolding the filer's specs share: a scratch checkout, a recording io, and a platform
 * client that answers from canned results.
 *
 * Nothing here contacts GitHub and nothing spawns a process — the seam the run resolves its runner
 * through is handed a fake, which is the same level the carried-across Python cases assert at.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type GhRunner, type RunResult } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type FilerEnvironment } from "./environment.js";

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

export interface FakePlatform {
    env: FilerEnvironment;
    run: GhRunner;
    /** Every argument vector handed to the client, in order. */
    calls: string[][];
    /** The roots the run bound its runner to. */
    roots: string[];
    /** Every wait the retry path asked for, in seconds. */
    waits: number[];
}

/**
 * A platform client answering `answer`, or succeeding with empty output when it declines.
 *
 * The clock is injected too, so a case that exercises the retry path asserts the backoff it asked
 * for instead of waiting it out.
 */
export function fakePlatform(answer: (args: string[]) => RunResult | undefined = () => undefined): FakePlatform {
    const calls: string[][] = [];
    const roots: string[] = [];
    const waits: number[] = [];
    const run: GhRunner = (args: string[]): RunResult => {
        calls.push(args);
        return answer(args) ?? OK();
    };
    return {
        run,
        calls,
        roots,
        waits,
        env: {
            runnerFor: (root: string): GhRunner => {
                roots.push(root);
                return run;
            },
            sleep: (seconds: number) => waits.push(seconds),
            random: () => 0,
        },
    };
}

/** A scratch checkout declaring `settings`, with an empty `scratch/` folder for work items. */
export function checkout(files: Record<string, string> = {}): string {
    const root: string = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-filer-")));
    for (const [relative, content] of Object.entries(files)) {
        const file: string = path.join(root, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    }
    fs.mkdirSync(path.join(root, "scratch"), { recursive: true });
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

export function writeItem(root: string, name: string, content: string): string {
    const file: string = path.join(root, "scratch", name);
    fs.writeFileSync(file, content);
    return file;
}

export function scratch(root: string): string {
    return path.join(root, "scratch");
}

/** One ordinary work item. */
export function story(ref: string, extra: Record<string, string> = {}, body = "A story body.\n"): string {
    const lines: string[] = [`ref: STORY-${ref}`, `title: "Story ${ref}"`];
    for (const [key, value] of Object.entries(extra)) lines.push(`${key}: ${value}`);
    return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

/**
 * A platform that files a batch cleanly: it mints issue numbers from 100 up, serves each issue the
 * body it was created with, and answers every probe the filer makes. `answers` gets first refusal,
 * which is how a case makes exactly one call fail.
 */
export function filingPlatform(answers: (args: string[]) => RunResult | undefined = () => undefined): FakePlatform {
    let next = 100;
    const stored: Record<string, string> = {};
    const numberIn = (args: string[]): string => args.slice(2).find((arg) => /^\d+$/.test(arg)) ?? "";
    return fakePlatform((args: string[]): RunResult | undefined => {
        const answer: RunResult | undefined = answers(args);
        if (answer !== undefined) return answer;
        if (args[0] === "issue" && args[1] === "create") {
            const number = String(next++);
            stored[number] = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
            return OK(`https://github.com/acme/tracker/issues/${number}\n`);
        }
        if (args[0] === "issue" && args[1] === "view" && args.includes("body")) return OK(stored[numberIn(args)] ?? "");
        if (args[0] === "issue" && args[1] === "view") return OK("I_node\n");
        if (args[0] === "issue" && args[1] === "edit") return OK("");
        if (args[0] === "api" && args[3] === ".id") return OK(`900${/issues\/(\d+)/.exec(args[1])?.[1]}\n`);
        if (args[0] === "api" && args[1] === "--method") return OK("{}");
        if (args[0] === "api" && args[1].endsWith("/dependencies/blocked_by")) return OK("");
        return undefined;
    });
}
