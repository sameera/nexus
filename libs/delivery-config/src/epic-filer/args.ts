/**
 * The epic filer's own arguments (story #378).
 *
 * Hand-rolled in the shape the toolkit already uses (decision record #387): the flag names, their
 * meanings and their spellings are contract, because component bodies and pipeline stages invoke
 * this capability by name. The list below is the capability's whole surface — `--from` belongs to
 * the `/nxs.epic` command, not to this capability, which is why the promotion refusal quotes it
 * inside a message rather than accepting it as input.
 *
 * Spelling is frozen at what the Python filer accepted (Invariant 19), and that parser was argparse:
 * a long flag takes its value attached with `=` as readily as in the next token, and an unambiguous
 * prefix of a long flag names that flag. Both forms are part of the surface a caller may already be
 * using, so both are accepted here; an ambiguous prefix is refused naming the flags it could mean.
 */

import { programName } from "../registry.js";

export const CAPABILITY = "create-epic";

export interface EpicArgs {
    /** The `epic.md` draft to file. */
    draft: string;
    /** The repo root to file into. Null means the invoking working directory. */
    root: string | null;
    /** Skip the confirmation a draft that already carries a link would otherwise ask for. */
    yes: boolean;
    /** The invocation-time project target, which outranks any declared one. */
    project: string | null;
    noProject: boolean;
    /** The unplanned epic to populate in place, or null to create a new issue. */
    promote: string | null;
}

export type ArgsOutcome =
    | { kind: "ok"; args: EpicArgs }
    | { kind: "help" }
    | { kind: "error"; message: string };

export function epicUsage(): string {
    return [
        `usage: ${programName(CAPABILITY)} <path-to-epic.md> [options]`,
        "",
        "Create a GitHub issue from an Epic document.",
        "",
        "options:",
        "  --root <path>       Target repo root to file the epic into (default: the current working",
        "                      directory). Outranks the epic file's own location — the file must",
        "                      resolve inside this root.",
        "  -y, --yes           Skip confirmation if link already exists.",
        "  --project <target>  GitHub project to add the issue to (e.g. 'my-org/1' or a title).",
        "                      If omitted, the declared target decides.",
        "  --no-project        Skip adding the issue to any project.",
        "  --promote <issue>   Promote an unplanned epic (a backlog stub): populate THIS issue in",
        "                      place instead of creating a new one, and remove the unplanned label.",
        "                      Legal only while the target still carries that label.",
    ].join("\n");
}

/** Every long flag the capability accepts, which is also the set an abbreviation may name. */
const LONG_FLAGS: string[] = ["--help", "--no-project", "--project", "--promote", "--root", "--yes"];

/** The long flags whose presence is the whole argument — a value attached to one is an error. */
const VALUELESS: string[] = ["--help", "--no-project", "--yes"];

type FlagMatch = { flag: string } | { ambiguous: string[] };

/** The long flag `name` denotes, expanding an unambiguous prefix, or null when it names none. */
function longFlag(name: string): FlagMatch | null {
    if (LONG_FLAGS.includes(name)) return { flag: name };
    const matches: string[] = LONG_FLAGS.filter((flag) => flag.startsWith(name));
    if (matches.length === 1) return { flag: matches[0] };
    if (matches.length > 1) return { ambiguous: matches };
    return null;
}

export function parseEpicArgs(argv: string[]): ArgsOutcome {
    const args: EpicArgs = { draft: "", root: null, yes: false, project: null, noProject: false, promote: null };
    const positional: string[] = [];
    let invalid: string | null = null;
    let optionsEnded = false;

    /** The value belonging to the flag at `i`, or null when the flag was given none. */
    function value(i: number, flag: string): string | null {
        const next: string | undefined = argv[i];
        if (next === undefined) {
            invalid = `${flag} expects a value`;
            return null;
        }
        return next;
    }

    for (let i = 0; i < argv.length && invalid === null; i++) {
        const token: string = argv[i];

        if (!optionsEnded && token === "--") {
            optionsEnded = true;
            continue;
        }
        if (optionsEnded || !token.startsWith("-") || token === "-") {
            positional.push(token);
            continue;
        }
        if (!token.startsWith("--")) {
            if (token === "-h") return { kind: "help" };
            if (token === "-y") args.yes = true;
            else invalid = `unrecognized argument '${token}'`;
            continue;
        }

        const at: number = token.indexOf("=");
        const name: string = at === -1 ? token : token.slice(0, at);
        const attached: string | null = at === -1 ? null : token.slice(at + 1);
        const matched: FlagMatch | null = longFlag(name);
        if (matched === null) {
            invalid = `unrecognized argument '${token}'`;
            continue;
        }
        if ("ambiguous" in matched) {
            invalid = `ambiguous option: ${name} could match ${matched.ambiguous.join(", ")}`;
            continue;
        }
        const flag: string = matched.flag;

        if (VALUELESS.includes(flag)) {
            if (attached !== null) {
                invalid = `argument ${flag}: ignored explicit argument '${attached}'`;
                continue;
            }
            if (flag === "--help") return { kind: "help" };
            if (flag === "--yes") args.yes = true;
            else args.noProject = true;
            continue;
        }

        const given: string | null = attached ?? value(++i, flag);
        if (given === null) continue;
        if (flag === "--root") args.root = given;
        else if (flag === "--project") args.project = given;
        else args.promote = given;
    }

    if (invalid !== null) return { kind: "error", message: invalid };
    if (positional.length === 0) return { kind: "error", message: "an epic file is required" };
    if (positional.length > 1) return { kind: "error", message: `unexpected argument '${positional[1]}'` };
    args.draft = positional[0];
    return { kind: "ok", args };
}
