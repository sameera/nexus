/**
 * The template seed (story #323): the three tool-agnostic templates the pipeline stages read out of
 * the project's own configuration get there.
 *
 * Three stages read a template from `.nexus/config/templates/` — setup its standards template, the
 * decision-record stage its record template, close its close-record template — and nothing seeded
 * any of them. That gap was hidden by the Nexus checkout, where the files happen to be present; in
 * any other repository the stages read a path that never existed. So the masters now travel inside
 * the release (`TEMPLATE_PAYLOAD_DIRNAME`, beside the bundled entrypoints, exactly as the component
 * payload travels) and this module places a first copy into the repository.
 *
 * Two shapes are deliberate:
 *
 * - **Seed, never clobber.** A project may tune a template; a re-run must not discard that. Every
 *   destination that already exists is kept and reported as kept — the caller can see the
 *   difference between "written" and "already yours", which a silent skip would hide.
 * - **The whole set is validated before anything is written.** A master directory that cannot be
 *   found, or one missing a member of the set, throws naming it and leaves the repository
 *   untouched. A half-seeded configuration is the state that would send a stage looking for a file
 *   nobody will ever put there — the same reasoning that makes the component mirror throw on a
 *   missing payload rather than treat it as emptiness.
 *
 * Node builtins only; bundled into the `nexus` entrypoint.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * The tool-agnostic templates a project's stages read. One copy serves every project — there is no
 * per-tool variant — so this is the whole seeded set, named here and nowhere else.
 */
export const SEEDED_TEMPLATES: readonly string[] = [
    "close-record-template.md",
    "decision-record-template.md",
    "standard.template.md",
];

/** Directory name the template masters travel under, beside the bundled entrypoints. */
export const TEMPLATE_PAYLOAD_DIRNAME = "templates";

/** The repository-root path segments holding the template masters in a checkout. */
export const TEMPLATE_MASTER_SEGMENTS: readonly string[] = ["common", "templates"];

/** The project-root path segments the stages read their templates from. */
export const PROJECT_TEMPLATE_SEGMENTS: readonly string[] = [".nexus", "config", "templates"];

/** The authored master set in a checkout whose sources live under `srcDir`. */
export function authoredTemplateMasterDir(srcDir: string): string {
    return path.resolve(srcDir, "..", "..", "..", ...TEMPLATE_MASTER_SEGMENTS);
}

/** Where a repository's stages read their templates. */
export function projectTemplateDir(repoRoot: string): string {
    return path.join(repoRoot, ...PROJECT_TEMPLATE_SEGMENTS);
}

export interface SeedTemplatesResult {
    /** Filenames written, sorted — the templates the repository did not have. */
    seeded: string[];
    /** Filenames left as the project has them, sorted. */
    kept: string[];
}

/**
 * Place a first copy of every seeded template into `repoRoot`, never overwriting one that is
 * already there. Throws — before writing anything — when the master set cannot be read whole.
 */
export function seedTemplates(masterDir: string, repoRoot: string): SeedTemplatesResult {
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

    const destDir: string = projectTemplateDir(repoRoot);
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
