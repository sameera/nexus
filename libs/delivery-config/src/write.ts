/**
 * The add-only settings writer (story #361).
 *
 * One merge persists resolved publishing decisions into a repository's settings, shared by the
 * bootstrap that seeds them with a human present and by the unattended write-back, so the two
 * producers cannot drift. It is a bounded line-oriented edit over the shallow two-level format
 * rather than a document round-trip: the contract it is judged on is that everything outside the
 * inserted lines — other sections, comments, ordering, trailing bytes — is identical afterwards,
 * which no re-emitting serialiser guarantees.
 *
 * It only ever *adds*. A key already declared is never rewritten, including an explicit `auto` or
 * `none`, and an empty value is never written, so an absent target is never pinned to a concrete
 * one. The target is the given root: this walks to no ancestor, and creates the configuration
 * directory and the file when they are absent.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { githubKeyFor } from "./keys.js";

export interface WriteReport {
    /** The github-block keys actually added, in the order they were written. */
    added: string[];
    /** The settings file the merge targeted, written or not. */
    path: string;
}

/** True for a `key:`-style line at column 0 — a top-level key rather than an indented child. */
export function isTopLevelLine(line: string): boolean {
    return line !== "" && !/^\s/.test(line) && !line.trimStart().startsWith("#") && line.includes(":");
}

export function writeGithubBlock(
    projectRoot: string,
    values: Record<string, string | null | undefined>,
    comment: string | null = null,
): WriteReport {
    const file: string = path.join(projectRoot, ".nexus", "config", "settings.yml");

    // Normalize to github-block spelling through the catalogue's derived inverse, dropping empties.
    const wanted: Map<string, string> = new Map();
    for (const [rawKey, rawValue] of Object.entries(values)) {
        const value: string = (rawValue ?? "").trim();
        if (value !== "") wanted.set(githubKeyFor(rawKey), value);
    }

    const text: string = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const lines: string[] = text.split("\n");
    const githubAt: number = lines.findIndex(
        (line) => isTopLevelLine(line) && line.slice(0, line.indexOf(":")).trim() === "github",
    );

    const added: string[] = [];
    let newText: string;

    if (githubAt === -1) {
        if (wanted.size === 0) return { added: [], path: file };
        const block: string[] = [];
        if (comment) block.push(`# ${comment}`);
        block.push("github:");
        for (const [key, value] of wanted) {
            block.push(`  ${key}: ${value}`);
            added.push(key);
        }
        let body: string = text;
        if (body !== "" && !body.endsWith("\n")) body += "\n";
        // A blank separator before the new block when the file already had content.
        const prefix: string = body.trim() !== "" ? "\n" : "";
        newText = body + prefix + block.join("\n") + "\n";
    } else {
        const end: number = (() => {
            for (let j = githubAt + 1; j < lines.length; j++) if (isTopLevelLine(lines[j])) return j;
            return lines.length;
        })();
        const existing: Set<string> = new Set();
        let lastChild: number = githubAt;
        for (let j = githubAt + 1; j < end; j++) {
            const stripped: string = lines[j].trim();
            if (stripped === "" || stripped.startsWith("#")) continue;
            if (lines[j].includes(":") && /^\s/.test(lines[j])) {
                existing.add(lines[j].slice(0, lines[j].indexOf(":")).trim());
                lastChild = j;
            }
        }
        const inserted: string[] = [];
        for (const [key, value] of wanted) {
            if (existing.has(key)) continue;
            inserted.push(`  ${key}: ${value}`);
            added.push(key);
        }
        if (added.length === 0) return { added: [], path: file };
        lines.splice(lastChild + 1, 0, ...inserted);
        newText = lines.join("\n");
    }

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, newText, "utf8");
    return { added, path: file };
}
