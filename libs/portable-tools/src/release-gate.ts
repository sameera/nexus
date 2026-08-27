/**
 * The release tail's precondition (invariant 15, epic #252).
 *
 * The package definition is complete on its own, but the tag and the public publish must wait:
 * shipped component bodies still reach the Python toolkit's capabilities by an in-repository
 * script path rather than by the declared toolkit name. Those paths exist in no checkout, so a
 * release cut today would put bodies on the registry that cannot work — and the changelog's own
 * claim that a stage runs without a checkout would be false on the first release.
 *
 * The rule the gate enforces is narrow and checkable: a shipped body may name a path under the
 * component tree only when the payload itself carries that file. A path the payload carries
 * resolves wherever the components are deployed; a path it does not carry is a capability that
 * has moved into a toolkit and must be reached by the toolkit's declared name.
 *
 * This is a release-time gate, not a suite gate. It is expected to fail until the invocation
 * rewrite lands, which is exactly what makes it a precondition worth running.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { isDirectRun } from "./entry-point.js";
import { listComponentFiles, liveClaudeDir } from "./vendor-components.js";

/** What a releaser does about a finding — never an edit to the payload's path layout. */
export const RELEASE_GATE_REMEDIATION: string =
    "Rewrite the body to invoke the capability by its declared toolkit name (`nexus-gh <verb>` or " +
    "`nexus <verb>`), which resolves from any directory once the package is installed.";

/** A single place where a shipped body reaches outside the payload by path. */
export interface InRepoInvocation {
    /** The component file, relative to the component tree root, posix-style. */
    file: string;
    /** 1-based line the reference sits on. */
    line: number;
    /** The referenced path, normalised to start at the component tree. */
    reference: string;
}

/**
 * A path under `.claude/` naming an executable file. Both a command line and a prose mention
 * match, because both send a reader to a path rather than to a toolkit verb.
 */
const IN_REPO_PATH = /(?:\.\/)?\.claude\/[A-Za-z0-9_.\-/]+\.(?:py|ts|mjs|js|sh)/g;

/**
 * Every reference in the shipped component bodies to a path the payload does not carry, in file
 * order then line order. An empty array is the release tail's green light.
 */
export function findInRepoInvocations(claudeDir: string): InRepoInvocation[] {
    const shipped: Set<string> = new Set(listComponentFiles(claudeDir));
    const findings: InRepoInvocation[] = [];

    for (const file of shipped) {
        const text: string = fs.readFileSync(path.join(claudeDir, ...file.split("/")), "utf8");
        text.split("\n").forEach((content, index) => {
            for (const match of content.matchAll(IN_REPO_PATH)) {
                const reference: string = match[0].replace(/^\.\//, "");
                if (shipped.has(reference.slice(".claude/".length))) {
                    continue;
                }
                findings.push({ file, line: index + 1, reference });
            }
        });
    }
    return findings;
}

export function runCli(argv: string[]): number {
    if (argv.length > 0) {
        console.error(`Unrecognised option: ${argv[0]} — the release gate takes no arguments.`);
        return 1;
    }

    const claudeDir: string = liveClaudeDir(import.meta.dirname);
    const findings: InRepoInvocation[] = findInRepoInvocations(claudeDir);

    if (findings.length === 0) {
        console.log("Release gate: every shipped body reaches its capabilities by a declared toolkit name.");
        return 0;
    }

    console.error(
        `Release gate: ${findings.length} reference(s) in the shipped payload name an in-repository ` +
            "path the payload does not carry. The tag and the publish must not run.",
    );
    for (const finding of findings) {
        console.error(`  ${finding.file}:${finding.line}  ${finding.reference}`);
    }
    console.error(`\n${RELEASE_GATE_REMEDIATION}`);
    return 1;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
    process.exit(runCli(process.argv.slice(2)));
}
