/** Shared account templates for setup and decision-record; seed absent files without overwriting edits. */
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * The tool-agnostic templates the stages read. One copy serves every project — there is no
 * per-tool variant — so this is the whole seeded set, named here and nowhere else.
 *
 * The decision-record stage reads two: the approval-first template every new record is drafted
 * from, and the old-format one a revision of a record approved in that format keeps (epic #787,
 * D11), because a revision's frozen lines match only in the format they were approved in.
 */
export const SEEDED_TEMPLATES: readonly string[] = [
    "decision-record-template.md",
    "decision-record-template-v1.md",
    "standard.template.md",
];

/** Directory name the template masters travel under, beside the bundled entrypoints. */
export const TEMPLATE_PAYLOAD_DIRNAME = "templates";

/** The repository-root path segments holding the template masters in a checkout. */
export const TEMPLATE_MASTER_SEGMENTS: readonly string[] = ["common", "templates"];

/** The account-home path segments the stages read their templates from. */
export const SHARED_TEMPLATE_SEGMENTS: readonly string[] = [".agents", "common", "templates"];

/** The authored master set in a checkout whose sources live under `srcDir`. */
export function authoredTemplateMasterDir(srcDir: string): string {
    return path.resolve(srcDir, "..", "..", "..", ...TEMPLATE_MASTER_SEGMENTS);
}

/** Shared templates, rooted in the account home rather than the working repository. */
export function sharedTemplateDir(accountHome: string): string {
    return path.join(accountHome, ...SHARED_TEMPLATE_SEGMENTS);
}

export interface SeedTemplatesResult {
    /** Filenames written, sorted — the templates the account did not have. */
    seeded: string[];
    /** Filenames left as the account has them, sorted. */
    kept: string[];
}

/**
 * Place a first copy of every seeded template under `accountHome`, never overwriting one that is
 * already there. Throws — before writing anything — when the master set cannot be read whole.
 */
export function seedTemplates(masterDir: string, accountHome: string): SeedTemplatesResult {
    if (!fs.existsSync(masterDir) || !fs.statSync(masterDir).isDirectory()) {
        throw new Error(
            `no template master set at ${masterDir}. The templates travel inside the Nexus release; ` +
                "reinstall the package, or name the master set with --masters.",
        );
    }
    const masters: Map<string, Buffer> = new Map();
    for (const name of SEEDED_TEMPLATES) {
        const master: string = path.join(masterDir, name);
        if (!fs.existsSync(master)) {
            throw new Error(
                `the template master set at ${masterDir} is missing ${name}. Nexus seeds the whole set ` +
                    "or none of it, so that no stage is left reading a template nothing will place.",
            );
        }
        masters.set(name, fs.readFileSync(master));
    }

    const destDir: string = sharedTemplateDir(accountHome);
    const seeded: string[] = [];
    const kept: string[] = [];
    for (const [name, content] of masters) {
        const dest: string = path.join(destDir, name);
        if (fs.existsSync(dest)) {
            kept.push(name);
            continue;
        }
        fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(dest, content);
        seeded.push(name);
    }
    return { seeded: seeded.sort(), kept: kept.sort() };
}
