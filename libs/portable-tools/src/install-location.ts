/**
 * The install location (story #313): the one component set per user account lives at the Claude
 * configuration directory, resolved from `$CLAUDE_CONFIG_DIR` with `~/.claude` as the default.
 *
 * Resolution fails loudly and never falls back silently (decision record #339, invariant 8). A set
 * value that cannot be used is an error naming the variable and the remedy — it is never quietly
 * replaced by the default, because installing the components somewhere the harness is not reading
 * looks like success and produces a machine where nothing works and nothing reports an error.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { isNexusNamespacedPath } from "./nexus-namespace.js";
import { COMPONENT_SUBTREES } from "./vendor-components.js";

/** The environment variable that names the configuration directory. */
export const CONFIG_DIR_VAR = "CLAUDE_CONFIG_DIR";

/** The directory name the configuration directory takes under a home directory by default. */
export const DEFAULT_CONFIG_DIRNAME = ".claude";

/** Where the resolved location came from — reported so a user can see which rule applied. */
export type LocationSource = "environment" | "home-default";

export type InstallLocationResult =
    | { ok: true; path: string; source: LocationSource }
    | { ok: false; message: string };

export interface LocationScope {
    /** The environment to read; defaults to the process environment. */
    env?: Record<string, string | undefined>;
    /** The account home; defaults to the operating system's answer. */
    homedir?: () => string;
}

function unusable(reason: string): { ok: false; message: string } {
    return {
        ok: false,
        message:
            `${CONFIG_DIR_VAR} ${reason}. Set ${CONFIG_DIR_VAR} to an absolute path, or unset it to use ` +
            `${DEFAULT_CONFIG_DIRNAME} in your home directory. Nexus will not install to a different ` +
            `location than the one you named.`,
    };
}

/** Resolve the install location, or report why the value given cannot be used. */
export function resolveInstallLocation(scope: LocationScope = {}): InstallLocationResult {
    const env: Record<string, string | undefined> = scope.env ?? process.env;
    const raw: string | undefined = env[CONFIG_DIR_VAR];

    if (raw !== undefined) {
        const value: string = raw.trim();
        if (value === "") {
            return unusable("is set but empty");
        }
        if (!path.isAbsolute(value)) {
            return unusable(`is set to a relative path '${value}'`);
        }
        return { ok: true, path: path.resolve(value), source: "environment" };
    }

    let home = "";
    try {
        home = (scope.homedir ?? os.homedir)();
    } catch {
        home = "";
    }
    if (home === "" || !path.isAbsolute(home)) {
        return {
            ok: false,
            message:
                `no home directory could be resolved and ${CONFIG_DIR_VAR} is unset. ` +
                `Set ${CONFIG_DIR_VAR} to an absolute path.`,
        };
    }
    return { ok: true, path: path.join(home, DEFAULT_CONFIG_DIRNAME), source: "home-default" };
}

/** Create the resolved location when it does not exist yet. */
export function ensureInstallLocation(location: string): void {
    fs.mkdirSync(location, { recursive: true });
}

/** Either of the two contents an install location may hold (decision record #339). */
export type InstalledContent = "copy" | "checkout-pointer";

export interface InstallLocationState {
    /** True when at least one Nexus-namespaced component file sits at the location. */
    populated: boolean;
    /** Which of the two contents it holds; null when it holds no component set at all. */
    content: InstalledContent | null;
    /** In the pointer content, the component root the pointers name; null otherwise. */
    checkout: string | null;
    /** The component-root-relative paths Nexus owns there, sorted. */
    files: string[];
}

/**
 * What the install location currently holds. Pointers are examined with `lstat`/`readlink` and
 * never followed (invariant 6) — a pointing install is identified by the link itself.
 */
export function inspectInstallLocation(location: string): InstallLocationState {
    const files: string[] = [];
    let pointer = false;
    let checkout: string | null = null;

    for (const subtree of COMPONENT_SUBTREES) {
        const subtreeRoot: string = path.join(location, subtree);
        if (!fs.existsSync(subtreeRoot)) {
            continue;
        }
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const abs: string = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(abs);
                    continue;
                }
                const rel: string = path.relative(location, abs).split(path.sep).join("/");
                if (!isNexusNamespacedPath(rel)) {
                    continue;
                }
                files.push(rel);
                if (entry.isSymbolicLink()) {
                    pointer = true;
                    if (checkout === null) {
                        const target: string = path.resolve(path.dirname(abs), fs.readlinkSync(abs));
                        const suffix: string = path.sep + rel.split("/").join(path.sep);
                        checkout = target.endsWith(suffix) ? target.slice(0, -suffix.length) : path.dirname(target);
                    }
                }
            }
        };
        walk(subtreeRoot);
    }

    files.sort();
    return {
        populated: files.length > 0,
        content: files.length === 0 ? null : pointer ? "checkout-pointer" : "copy",
        checkout: pointer ? checkout : null,
        files,
    };
}

/** The line every verb prints before it changes anything (invariant 7). */
export function describeInstallLocation(resolved: { path: string; source: LocationSource }): string {
    const origin: string = resolved.source === "environment" ? `$${CONFIG_DIR_VAR}` : "home-directory default";
    return `install location: ${resolved.path} (${origin})`;
}

/**
 * The second half of invariant 7's disclosure: what the location holds, and — in the pointing mode
 * — the checkout it points at. One wording for every verb, so the user who empties a set reads the
 * same sentence about it as the user who migrates a repository away from one.
 */
export function describeInstalledContent(state: InstallLocationState): string {
    if (state.content === null) {
        return "install location holds: no Nexus component set";
    }
    return state.content === "checkout-pointer"
        ? `install location holds: pointers at the checkout ${state.checkout}`
        : `install location holds: a copied release (${state.files.length} component file(s))`;
}
