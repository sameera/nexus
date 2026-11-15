/**
 * The template lookup (epic #1028, story #1029): a stage asks the installed release for a template
 * by name and is told where that template lives.
 *
 * The answer comes from one of two sources, and never from the repository the stage runs in:
 *
 * - **An ordinary install** answers from the travelling copy that ships beside the running
 *   executable (D1). The executable also holds the checks that validate a drafted record, so a
 *   template and its validator always come from the same release. When the executable runs from
 *   source and has no travelling copy, the source checkout's own template sources answer — the same
 *   rule that finds the component payload.
 * - **A pointer install** answers from the checkout the pointers name, whichever executable is
 *   running (D2), so a maintainer's template edit is live on the next request with no rebuild.
 *
 * The request takes only a name and reads no repository state, so it cannot return a repository
 * copy (D3). An unknown name, a source that lacks the template, and an install location that cannot
 * be read each fail with a message naming the cause. Nothing falls back to another source.
 *
 * Node builtins only; bundled into the `nexus` entrypoint.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { inspectInstallLocation, resolveInstallLocation, type InstallLocationResult, type InstallLocationState } from "./install-location.js";

/**
 * The release template set: the stage templates a release ships, declared here and nowhere else.
 * It decides what the release build packs and what the lookup answers to.
 *
 * The decision-record stage reads two: the approval-first template every new record is drafted
 * from, and the old-format one a revision of a record approved in that format keeps (epic #787,
 * D11). Setup reads the standards template.
 */
export const RELEASE_TEMPLATES: readonly string[] = [
    "decision-record-template.md",
    "decision-record-template-v1.md",
    "standard.template.md",
];

/** Directory name the travelling copy ships under, beside the bundled entrypoints. */
export const TEMPLATE_PAYLOAD_DIRNAME = "templates";

/** The checkout-root path segments holding the authored template sources. */
export const TEMPLATE_MASTER_SEGMENTS: readonly string[] = ["common", "templates"];

/** The authored template sources of a checkout whose `nexus` sources live under `srcDir`. */
export function authoredTemplateMasterDir(srcDir: string): string {
    return path.resolve(srcDir, "..", "..", "..", ...TEMPLATE_MASTER_SEGMENTS);
}

export type TemplateLookupProblem = "unknown-template" | "install-location-unreadable" | "template-missing";

export type TemplateLookupResult = { ok: true; path: string } | { ok: false; problem: TemplateLookupProblem; message: string };

export interface TemplateLookupScope {
    /** The directory the running executable lives in. */
    executableDir: string;
    /** The environment the install location is resolved from; defaults to the process environment. */
    env?: Record<string, string | undefined>;
}

interface TemplateSource {
    dir: string;
    description: string;
    remedy: string;
}

function fail(problem: TemplateLookupProblem, message: string): TemplateLookupResult {
    return { ok: false, problem, message };
}

/** The one source the lookup answers from, or why the install location could not be read. */
function chooseSource(scope: TemplateLookupScope): TemplateSource | { error: string } {
    const location: InstallLocationResult = resolveInstallLocation({ env: scope.env ?? process.env });
    if (!location.ok) {
        return { error: location.message };
    }
    let state: InstallLocationState;
    try {
        state = inspectInstallLocation(location.path);
    } catch (error) {
        const reason: string = error instanceof Error ? error.message : String(error);
        return { error: `the install location ${location.path} could not be read: ${reason}` };
    }
    if (state.content === "checkout-pointer" && state.checkout !== null) {
        const checkoutRoot: string = path.dirname(state.checkout);
        return {
            dir: path.join(checkoutRoot, ...TEMPLATE_MASTER_SEGMENTS),
            description: `the checkout ${checkoutRoot} the install location points at`,
            remedy: `restore the template in that checkout, or point the install location again with \`nexus install --from-checkout <checkout>\``,
        };
    }
    const travelling: string = path.join(scope.executableDir, TEMPLATE_PAYLOAD_DIRNAME);
    const fromSource: string = authoredTemplateMasterDir(scope.executableDir);
    if (!fs.existsSync(travelling) && fs.existsSync(fromSource)) {
        return {
            dir: fromSource,
            description: `the source checkout's template sources at ${fromSource}`,
            remedy: "restore the template in the checkout",
        };
    }
    return {
        dir: travelling,
        description: `the installed release's templates at ${travelling}`,
        remedy: "reinstall the release with `npm install -g @sameeraperera/nexus` and re-run `nexus install`",
    };
}

/** Where the named release template lives, or why the lookup refuses. */
export function lookupTemplate(name: string, scope: TemplateLookupScope): TemplateLookupResult {
    if (!RELEASE_TEMPLATES.includes(name)) {
        return fail("unknown-template", `the release ships no template named '${name}'. It ships: ${RELEASE_TEMPLATES.join(", ")}.`);
    }
    const source: TemplateSource | { error: string } = chooseSource(scope);
    if ("error" in source) {
        return fail("install-location-unreadable", `${source.error} No template was looked up, and nothing falls back to another source.`);
    }
    const file: string = path.join(source.dir, name);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return fail(
            "template-missing",
            `${name} is missing from ${source.description}. Nothing falls back to another source; ${source.remedy}.`,
        );
    }
    return { ok: true, path: path.resolve(file) };
}
