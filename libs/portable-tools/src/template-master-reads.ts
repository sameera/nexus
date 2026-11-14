/**
 * The template-master gate (story #324): a shipped component must never send a stage to read a
 * template out of the Nexus repository's own master directory.
 *
 * `common/templates/` belongs to the Nexus source checkout and ships in no payload, so a component
 * that reads it — or falls back to it when a project copy is absent — names a path that resolves
 * only for someone running inside this repository. That fallback was why close appeared to work
 * outside a Nexus checkout and did not. Story #323 gave the templates a way to arrive in the
 * project, so the fallback has nothing left to do and the gate keeps it from coming back.
 *
 * A *mention* is not a *read*. A body may name the master directory precisely to say it is not
 * what the stage reads, and that contrast is worth keeping — so classification asks whether the
 * mention is governed by a contrast marker, within the same sentence. The window is bounded by
 * sentence punctuation rather than by distance alone, so a negation from an earlier sentence
 * cannot vouch for a read in a later one.
 *
 * Node builtins only; this file is not a bundle entry point, so it is never itself vendored.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { RELEASE_TEMPLATES, TEMPLATE_MASTER_SEGMENTS } from "./template-lookup.js";
import { listComponentFiles } from "./vendor-components.js";

/** The directory no shipped component may read a template from. */
export const TEMPLATE_MASTER_PATH: string = TEMPLATE_MASTER_SEGMENTS.join("/");

/**
 * The repository's own template folder (epic #1028, D7). The stages read their templates from the
 * installed release, so no shipped component may read a release template from here. The folder's
 * other files, such as the workspace and hub templates, are not release templates and stay out of
 * the check.
 */
export const REPOSITORY_TEMPLATE_PATH = ".nexus/config/templates";

/** Words that turn a mention into a contrast — "this is not the thing the stage reads". */
export const CONTRAST_MARKERS: readonly string[] = ["not", "never", "rather than", "instead of", "no longer"];

/** How much text before a mention can still govern it, when no sentence boundary intervenes. */
const CONTRAST_WINDOW = 60;

export interface MasterMention {
    /** Component-root-relative path of the body the mention sits in. */
    file: string;
    /** 1-indexed line of the mention. */
    line: number;
    /** The line's text, for a failure that names what it found. */
    excerpt: string;
    /** True when a contrast marker governs the mention, so it is not a read. */
    excluded: boolean;
}

const CONTRAST_PATTERN = new RegExp(`\\b(${CONTRAST_MARKERS.join("|")})\\b`, "i");

/**
 * Classify one mention of the master directory at `index` within `text`. The governing window is
 * the text back to the nearest sentence boundary (`.`, `:`, `;`, `!`, `?` or a blank line), capped
 * at `CONTRAST_WINDOW` characters — a marker outside it belongs to another clause and vouches for
 * nothing here.
 */
export function classifyMasterMention(text: string, index: number): { excluded: boolean } {
    const start: number = Math.max(0, index - CONTRAST_WINDOW);
    let window: string = text.slice(start, index);
    const boundary: number = Math.max(
        window.lastIndexOf(". "),
        window.lastIndexOf(".\n"),
        window.lastIndexOf(":"),
        window.lastIndexOf(";"),
        window.lastIndexOf("!"),
        window.lastIndexOf("?"),
        window.lastIndexOf("\n\n"),
    );
    if (boundary >= 0) {
        window = window.slice(boundary + 1);
    }
    return { excluded: CONTRAST_PATTERN.test(window) };
}

/**
 * Every mention of `needle` across the shipped component payload, classified. The whole payload
 * is scanned, not only the markdown bodies: a path a stage is sent to read is a read whatever kind
 * of file carries it. `relevant` decides, from the text that follows a mention, whether it counts.
 *
 * Classification reads the whole text while the location is reported per line, because a contrast
 * marker and the mention it governs are one sentence that a body may well have wrapped.
 */
function scanMentions(componentRoot: string, needle: string, relevant: (after: string) => boolean): MasterMention[] {
    const mentions: MasterMention[] = [];
    for (const rel of listComponentFiles(componentRoot)) {
        const text: string = fs.readFileSync(path.join(componentRoot, ...rel.split("/")), "utf8");
        let offset = 0;
        text.split("\n").forEach((line: string, index: number) => {
            for (let at: number = line.indexOf(needle); at >= 0; at = line.indexOf(needle, at + 1)) {
                if (!relevant(line.slice(at + needle.length))) continue;
                mentions.push({
                    file: rel,
                    line: index + 1,
                    excerpt: line.trim(),
                    excluded: classifyMasterMention(text, offset + at).excluded,
                });
            }
            offset += line.length + 1;
        });
    }
    return mentions;
}

/** Every mention of the master directory across the shipped component payload, classified. */
export function scanTemplateMasterMentions(componentRoot: string): MasterMention[] {
    return scanMentions(componentRoot, TEMPLATE_MASTER_PATH, () => true);
}

/** The mentions that are reads — the gate fails when this is not empty. */
export function templateMasterReads(componentRoot: string): MasterMention[] {
    return scanTemplateMasterMentions(componentRoot).filter((mention) => !mention.excluded);
}

/**
 * True when the text after a mention of the repository's template folder names a release template,
 * or names no file at all, so the mention points at the folder as a whole.
 */
function namesReleaseTemplate(after: string): boolean {
    const file: RegExpMatchArray | null = after.match(/^\/([\w.-]+)/);
    return file === null || RELEASE_TEMPLATES.includes(file[1]);
}

/** Reads of a release template from the repository's template folder — none may ship (D7, G11). */
export function repositoryTemplateReads(componentRoot: string): MasterMention[] {
    return scanMentions(componentRoot, REPOSITORY_TEMPLATE_PATH, namesReleaseTemplate).filter((mention) => !mention.excluded);
}

const LOOKUP_PATTERN = /nexus template-path\s+["']?([^\s"'`)]+)/g;

/** Template lookups in the shipped payload that ask for a name the release does not ship (D7, G17). */
export function unshippedTemplateLookups(componentRoot: string): MasterMention[] {
    const found: MasterMention[] = [];
    for (const rel of listComponentFiles(componentRoot)) {
        const text: string = fs.readFileSync(path.join(componentRoot, ...rel.split("/")), "utf8");
        text.split("\n").forEach((line: string, index: number) => {
            for (const match of line.matchAll(LOOKUP_PATTERN)) {
                if (RELEASE_TEMPLATES.includes(match[1])) continue;
                found.push({ file: rel, line: index + 1, excerpt: line.trim(), excluded: false });
            }
        });
    }
    return found;
}

/** Every way the shipped payload breaks the release template set, one line per finding. */
export function releaseTemplateFindings(componentRoot: string): string[] {
    const where = (mention: MasterMention): string => `${mention.file}:${mention.line} — ${mention.excerpt}`;
    return [
        ...unshippedTemplateLookups(componentRoot).map(
            (m: MasterMention) => `asks for a template the release does not ship (it ships ${RELEASE_TEMPLATES.join(", ")}): ${where(m)}`,
        ),
        ...repositoryTemplateReads(componentRoot).map(
            (m: MasterMention) => `reads a release template from the repository's ${REPOSITORY_TEMPLATE_PATH}/: ${where(m)}`,
        ),
        ...templateMasterReads(componentRoot).map((m: MasterMention) => `reads a template from the checkout's ${TEMPLATE_MASTER_PATH}/: ${where(m)}`),
    ];
}

/** The build-time check: throws, naming every finding, when the payload breaks the template set. */
export function assertReleaseTemplates(componentRoot: string): void {
    const findings: string[] = releaseTemplateFindings(componentRoot);
    if (findings.length > 0) {
        throw new Error(`the release build stops: the component payload breaks the release template set.\n  ${findings.join("\n  ")}`);
    }
}
