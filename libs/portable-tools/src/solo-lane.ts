/**
 * The solo lane's gate (epic #799): the workspace-shape check and the solo declaration reader
 * `/nxs.ship` calls before it reads anything else.
 *
 * The declaration is one value in the repository's own `.nexus/config/settings.yml` (decision
 * record #806, D2). It is read here and nowhere else — never inherited from workspace defaults,
 * never inferred from the absence of pull requests or of an upstream — and the `--pr` stages
 * never call this reader. The workspace shape is asked of the shared close-role resolver first,
 * so a hub or member refuses before the declaration is read (D3).
 *
 * Node builtins and the workspace runner only; bundled into the `nexus` entrypoint.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { closePreflight, type CloseRole } from "@nexus/workspace/close-role";
import { defaultRunner, type Runner } from "@nexus/workspace/run";

/** The section and key that declare a repository solo. */
export const SOLO_SECTION: string = "delivery";
export const SOLO_KEY: string = "solo";

/** The settings change a refusal names, verbatim. */
export const SOLO_DECLARATION: string = `${SOLO_SECTION}:\n    ${SOLO_KEY}: true`;

export type SoloProblem = "not-a-git-repo" | "workspace-not-single-repo" | "solo-undeclared";

export interface SoloDiagnostic {
    problem: SoloProblem;
    message: string;
}

export type SoloCheckResult =
    | { ok: true; repoRoot: string; shape: CloseRole }
    | { ok: false; error: SoloDiagnostic; shape?: CloseRole };

/**
 * Whether the repository's own settings declare it solo. Only `delivery.solo: true` counts; a
 * missing file, a missing key or any other value means not solo.
 */
export function readSoloDeclaration(repoRoot: string): boolean {
    const settingsPath: string = path.join(repoRoot, ".nexus", "config", "settings.yml");
    if (!fs.existsSync(settingsPath)) return false;
    let section: string | null = null;
    for (const line of fs.readFileSync(settingsPath, "utf8").split(/\r?\n/)) {
        const stripped: string = line.replace(/\s+#.*$/, "").trim();
        if (stripped === "" || stripped.startsWith("#")) continue;
        if (!/^\s/.test(line)) {
            section = stripped.endsWith(":") ? stripped.slice(0, -1).trim() : null;
            continue;
        }
        if (section !== SOLO_SECTION) continue;
        const idx: number = stripped.indexOf(":");
        if (idx === -1) continue;
        if (stripped.slice(0, idx).trim() !== SOLO_KEY) continue;
        return stripped.slice(idx + 1).trim().replace(/^["']|["']$/g, "") === "true";
    }
    return false;
}

/**
 * The solo lane's first two checks, in order: the workspace shape through the shared resolver,
 * then the declaration. A hub or member refuses before the declaration is read.
 */
export function soloCheck(startDir: string, run: Runner = defaultRunner): SoloCheckResult {
    const pre = closePreflight(startDir, run);
    if (!pre.ok) {
        return { ok: false, error: { problem: "not-a-git-repo", message: `${startDir} is not inside a git checkout; /nxs.ship must run inside one` } };
    }
    const { role, repoRoot } = pre.preflight;
    if (role !== "single-repo") {
        return {
            ok: false,
            shape: role,
            error: {
                problem: "workspace-not-single-repo",
                message: `this checkout is a workspace ${role}; the solo lane runs only in a single repository. Use /nxs.analyze --pr <N> and /nxs.close --pr <N> here.`,
            },
        };
    }
    if (!readSoloDeclaration(repoRoot)) {
        return {
            ok: false,
            shape: role,
            error: {
                problem: "solo-undeclared",
                message:
                    `this repository has not declared solo mode. To declare it, add these lines to ` +
                    `.nexus/config/settings.yml and commit them:\n${SOLO_DECLARATION}`,
            },
        };
    }
    return { ok: true, repoRoot, shape: role };
}
