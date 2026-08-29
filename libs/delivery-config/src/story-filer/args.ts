/**
 * The story filer's own arguments (story #367).
 *
 * Hand-rolled in the shape the executable already uses (decision record #375, D9): the flag names,
 * their meanings and their defaults are contract, because component bodies and pipeline stages
 * invoke this capability by name. The wording a parsing framework generated for malformed input is
 * not — only the non-zero exit is.
 */

import { programName } from "../registry.js";

export const CAPABILITY = "create-story";

export interface FilerArgs {
    /** The folder holding the `STORY-*.md` work items. */
    targetFolder: string;
    /** The repo root to file into. Null means the invoking working directory. */
    root: string | null;
    dryRun: boolean;
    noProject: boolean;
    retries: number;
    retryBaseDelay: number;
    keepManifest: boolean;
    classificationLabel: string | null;
    classificationType: string | null;
}

export const DEFAULT_RETRIES = 3;
export const DEFAULT_RETRY_BASE_DELAY = 1.0;

export type ArgsOutcome =
    | { kind: "ok"; args: FilerArgs }
    | { kind: "help" }
    | { kind: "error"; message: string };

export function filerUsage(): string {
    return [
        `usage: ${programName(CAPABILITY)} <target-folder> [options]`,
        "",
        "Create GitHub issues from STORY-*.md work-item files.",
        "",
        "options:",
        "  --root <path>                 Target repo root to file the stories into (default: the",
        "                                current working directory). The target folder must resolve",
        "                                inside this root.",
        "  --dry-run                     Show what would be done without creating issues.",
        "  --no-project                  Skip adding issues to any project.",
        `  --retries <n>                 Retries for transient gh/GitHub failures. Default: ${DEFAULT_RETRIES}.`,
        `  --retry-base-delay <seconds>  Backoff base between retries. Default: ${DEFAULT_RETRY_BASE_DELAY}.`,
        "  --keep-manifest               Keep the resume ledger after a fully successful run.",
        "  --classification-label <name> Canonical label applied to every issue this run creates.",
        "  --classification-type <name>  Canonical GitHub issue-type applied in `types` mode.",
    ].join("\n");
}

export function parseFilerArgs(argv: string[]): ArgsOutcome {
    const args: FilerArgs = {
        targetFolder: "",
        root: null,
        dryRun: false,
        noProject: false,
        retries: DEFAULT_RETRIES,
        retryBaseDelay: DEFAULT_RETRY_BASE_DELAY,
        keepManifest: false,
        classificationLabel: null,
        classificationType: null,
    };
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

    /**
     * Numeric tuning. A negative value is clamped rather than refused, as it always has been — it is
     * a nonsensical setting, not an illegal one — while text that is no number at all is refused.
     */
    function tuning(raw: string | null, flag: string, whole: boolean): number | null {
        if (raw === null) return null;
        const parsed = Number(raw);
        if (raw.trim() === "" || !Number.isFinite(parsed)) {
            invalid = `${flag}: invalid value '${raw}'`;
            return null;
        }
        return Math.max(0, whole ? Math.trunc(parsed) : parsed);
    }

    for (let i = 0; i < argv.length && invalid === null; i++) {
        const token: string = argv[i];
        switch (token) {
            case "-h":
            case "--help":
                return { kind: "help" };
            case "--dry-run":
                args.dryRun = true;
                break;
            case "--no-project":
                args.noProject = true;
                break;
            case "--keep-manifest":
                args.keepManifest = true;
                break;
            case "--root":
                args.root = value(++i, token) ?? args.root;
                break;
            case "--classification-label":
                args.classificationLabel = value(++i, token) ?? args.classificationLabel;
                break;
            case "--classification-type":
                args.classificationType = value(++i, token) ?? args.classificationType;
                break;
            case "--retries":
                args.retries = tuning(value(++i, token), token, true) ?? args.retries;
                break;
            case "--retry-base-delay":
                args.retryBaseDelay = tuning(value(++i, token), token, false) ?? args.retryBaseDelay;
                break;
            default:
                if (token.startsWith("--")) invalid = `unrecognized argument '${token}'`;
                else positional.push(token);
        }
    }

    if (invalid !== null) return { kind: "error", message: invalid };
    if (positional.length === 0) return { kind: "error", message: "a target folder is required" };
    if (positional.length > 1) return { kind: "error", message: `unexpected argument '${positional[1]}'` };
    args.targetFolder = positional[0];
    return { kind: "ok", args };
}

/**
 * The flags this run was given, back as an argument vector (story #373).
 *
 * Reconstructed from the parsed arguments rather than from the raw vector, so the resume hint names
 * every flag in one canonical spelling — and so a flag added to the capability is added here with it
 * (decision record #375, Invariant 13).
 */
export function reconstructFlags(args: FilerArgs): string[] {
    const flags: string[] = [];
    if (args.root !== null) flags.push("--root", args.root);
    if (args.noProject) flags.push("--no-project");
    if (args.keepManifest) flags.push("--keep-manifest");
    if (args.classificationLabel !== null) flags.push("--classification-label", args.classificationLabel);
    if (args.classificationType !== null) flags.push("--classification-type", args.classificationType);
    if (args.retries !== DEFAULT_RETRIES) flags.push("--retries", String(args.retries));
    if (args.retryBaseDelay !== DEFAULT_RETRY_BASE_DELAY) {
        flags.push("--retry-base-delay", String(args.retryBaseDelay));
    }
    return flags;
}
