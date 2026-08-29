/**
 * The epic filer's own arguments (story #378).
 *
 * Hand-rolled in the shape the toolkit already uses (decision record #387): the flag names, their
 * meanings and their spellings are contract, because component bodies and pipeline stages invoke
 * this capability by name. The list below is the capability's whole surface — `--from` belongs to
 * the `/nxs.epic` command, not to this capability, which is why the promotion refusal quotes it
 * inside a message rather than accepting it as input.
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

export function parseEpicArgs(argv: string[]): ArgsOutcome {
    const args: EpicArgs = { draft: "", root: null, yes: false, project: null, noProject: false, promote: null };
    const positional: string[] = [];
    let invalid: string | null = null;

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
        switch (token) {
            case "-h":
            case "--help":
                return { kind: "help" };
            case "-y":
            case "--yes":
                args.yes = true;
                break;
            case "--no-project":
                args.noProject = true;
                break;
            case "--root":
                args.root = value(++i, token) ?? args.root;
                break;
            case "--project":
                args.project = value(++i, token) ?? args.project;
                break;
            case "--promote":
                args.promote = value(++i, token) ?? args.promote;
                break;
            default:
                if (token.startsWith("-") && token !== "-") invalid = `unrecognized argument '${token}'`;
                else positional.push(token);
        }
    }

    if (invalid !== null) return { kind: "error", message: invalid };
    if (positional.length === 0) return { kind: "error", message: "an epic file is required" };
    if (positional.length > 1) return { kind: "error", message: `unexpected argument '${positional[1]}'` };
    args.draft = positional[0];
    return { kind: "ok", args };
}
