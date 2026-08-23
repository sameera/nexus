/**
 * The structural payload-boundary check (decision record #277, "the acceptance harness moves
 * beside its library, and the payload boundary stays structural"). The vendoring rule stays "the
 * three component subtrees, whole" — no denylist. What keeps a checkout-bound file out of the
 * shipped payload is this composition check: no vendored component file may import a workspace
 * package (`@nexus/...`), because such an import only resolves through this checkout's pnpm
 * symlinks into `libs/`, never in an installed toolkit. A path enumerated in the waiver register
 * (`component-composition-waivers.ts`) is a declared, counted, expiring exception instead of a
 * silently-remembered one.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { listComponentFiles } from "./vendor-components.js";

/** One component file that imports a workspace package with no waiver on record. */
export interface CompositionViolation {
    /** Posix-style path relative to the `.claude/` root, e.g. "skills/nxs-example/scripts/x.ts". */
    relPath: string;
    /** Every distinct workspace-package specifier the file imports, in first-seen order. */
    imports: string[];
}

/** File extensions the check inspects; everything else (docs, config) cannot carry a live import. */
const CODE_EXTENSIONS: readonly string[] = [".ts", ".js", ".mjs", ".cjs"];

const IMPORT_RE = /(?:from\s+|require\(\s*)["'](@nexus\/[^"']+)["']/g;

/** Every distinct `@nexus/...` specifier a file's ESM `import ... from` or `require(...)` names. */
export function findWorkspaceImports(content: string): string[] {
    const found: string[] = [];
    for (const match of content.matchAll(IMPORT_RE)) {
        const specifier: string = match[1];
        if (!found.includes(specifier)) {
            found.push(specifier);
        }
    }
    return found;
}

/**
 * Walks every managed component file under `claudeDir` and flags any code file that imports a
 * workspace package, unless its relative path appears in `waivers`. Returns one entry per
 * violating file, sorted the way `listComponentFiles` already sorts (by relative path).
 */
export function checkComponentComposition(claudeDir: string, waivers: readonly string[]): CompositionViolation[] {
    const violations: CompositionViolation[] = [];
    for (const relPath of listComponentFiles(claudeDir)) {
        if (!CODE_EXTENSIONS.some((ext) => relPath.endsWith(ext))) {
            continue;
        }
        if (waivers.includes(relPath)) {
            continue;
        }
        const content: string = fs.readFileSync(path.join(claudeDir, ...relPath.split("/")), "utf8");
        const imports: string[] = findWorkspaceImports(content);
        if (imports.length > 0) {
            violations.push({ relPath, imports });
        }
    }
    return violations;
}
