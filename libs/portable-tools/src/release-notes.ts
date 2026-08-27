/**
 * The release changelog (story #312).
 *
 * Once the components leave every repository, an adopter no longer sees a component change in
 * their own diff. That review surface is gone, and of the three failure classes the one that
 * fails silently is a change in what a stage *decides* — no version check can detect it. The
 * changelog is the only thing that can report it, which is why its content is checked here
 * rather than left to release-day habit.
 *
 * The rules are about what an entry *says*, not how it is formatted: every item names a pipeline
 * stage or an adopter-visible behaviour, never a commit subject, a file path or a library
 * version; a release that touched a component body names the stage a lead will experience
 * differently; a release that changed no stage behaviour says so rather than going absent; and
 * below 1.0, where the version number cannot signal it, a breaking change is said in words.
 */

/** The pipeline stages an adopter runs. An item that names one is speaking adopter language. */
export const PIPELINE_STAGES: readonly string[] = [
    "setup",
    "discover",
    "epic",
    "decision-record",
    "analyze",
    "close",
    "distill",
];

/** The exact statement an entry uses when a release changed no stage behaviour (AC5). */
export const NO_BEHAVIOUR_CHANGE = "No change to how any pipeline stage behaves.";

export interface ReleaseEntry {
    version: string;
    items: string[];
}

/** Parses `## <version>` sections and their `- ` items, newest first, from a changelog. */
export function parseChangelog(text: string): ReleaseEntry[] {
    const entries: ReleaseEntry[] = [];
    let current: ReleaseEntry | null = null;
    for (const line of text.split("\n")) {
        const heading = /^##\s+(\S+)\s*$/.exec(line);
        if (heading) {
            current = { version: heading[1], items: [] };
            entries.push(current);
            continue;
        }
        const item = /^-\s+(.*\S)\s*$/.exec(line);
        if (item && current !== null) {
            current.items.push(item[1]);
            continue;
        }
        // An item may wrap across lines; the wrapped remainder is part of the same sentence, so
        // folding it in is what lets a rule read the whole of what the item says.
        const continuation = /^\s+(\S.*\S)\s*$/.exec(line);
        if (continuation && current !== null && current.items.length > 0) {
            current.items[current.items.length - 1] += ` ${continuation[1]}`;
        }
    }
    return entries;
}

const COMMIT_SUBJECT = /^(feat|fix|chore|docs|refactor|test|perf|build|ci|style)(\([^)]*\))?!?:/i;
const FILE_PATH = /(^|\s|`)[\w.-]+\/[\w./-]+\.\w+/;
const LIBRARY_VERSION = /\b(?:v?\d+\.\d+\.\d+|\w+@\d[\w.-]*)\b/;

/** True when the item names a pipeline stage — the adopter-language anchor. */
function namesAStage(item: string): boolean {
    return PIPELINE_STAGES.some((stage) => new RegExp(`\\b${stage}\\b`, "i").test(item));
}

export interface EntryContext {
    /** Whether the release's diff touched a component body. */
    touchedComponentBody: boolean;
    /** Whether the release changed how any pipeline stage behaves. */
    changedStageBehaviour: boolean;
    /** Whether the release breaks stage behaviour an adopter's pipeline relies on. */
    breakingChange: boolean;
}

/** A word that tells a pre-1.0 reader the release will break their pipeline. */
const BREAKING_WORD = /\bbreaking\b/i;

/** True while the version number itself carries no breaking-change signal (invariant 16). */
function belowOne(version: string): boolean {
    return /^0\./.test(version);
}

/**
 * Every rule an entry must satisfy, as one finding per violation. An empty array means the entry
 * reports the release in the language its reader has.
 */
export function checkReleaseEntry(entry: ReleaseEntry, context: EntryContext): string[] {
    const findings: string[] = [];

    if (entry.items.length === 0) {
        findings.push(`${entry.version}: the entry has no items — a release always says something`);
        return findings;
    }

    for (const item of entry.items) {
        if (COMMIT_SUBJECT.test(item)) {
            findings.push(`${entry.version}: "${item}" is a commit subject, not an adopter-visible change`);
        }
        if (FILE_PATH.test(item)) {
            findings.push(`${entry.version}: "${item}" names a file path, which an adopter does not run`);
        }
        if (LIBRARY_VERSION.test(item)) {
            findings.push(`${entry.version}: "${item}" names a library version, which an adopter does not run`);
        }
    }

    if (!context.changedStageBehaviour) {
        if (!entry.items.includes(NO_BEHAVIOUR_CHANGE)) {
            findings.push(
                `${entry.version}: the release changed no stage behaviour, so the entry must say so ` +
                    `explicitly — "${NO_BEHAVIOUR_CHANGE}"`,
            );
        }
        return findings;
    }

    const behaviourItems: string[] = entry.items.filter((item) => item !== NO_BEHAVIOUR_CHANGE);

    // Below 1.0 a minor bump may carry breaking change, so the number cannot signal it and the
    // words have to. Above 1.0 the major bump is the signal and the wording is left to the author.
    if (context.breakingChange && belowOne(entry.version) && !behaviourItems.some((item) => BREAKING_WORD.test(item))) {
        findings.push(
            `${entry.version}: the release breaks stage behaviour and the version is below 1.0, so an ` +
                `item must say "breaking" in words — the version number does not carry that signal`,
        );
    }

    if (context.touchedComponentBody && !behaviourItems.some(namesAStage)) {
        findings.push(
            `${entry.version}: the release touched a component body, so an item must name the stage ` +
                `a lead will now experience differently (one of: ${PIPELINE_STAGES.join(", ")})`,
        );
    }
    return findings;
}

export interface ReleaseIdentity {
    /** The single declaration in the VERSION file. */
    declared: string;
    /** The version the published manifest carries. */
    manifest: string;
    /** The version the newest changelog entry names. */
    changelog: string;
    /** The git tag cut for the release, with any leading `v`. */
    tag: string;
}

/** One tag, one registry version, one releases-page entry, all naming the same version (AC1). */
export function checkReleaseIdentity(identity: ReleaseIdentity): string[] {
    const tag: string = identity.tag.replace(/^v/, "");
    const findings: string[] = [];
    for (const [name, value] of [
        ["the published manifest", identity.manifest],
        ["the changelog entry", identity.changelog],
        ["the git tag", tag],
    ] as const) {
        if (value !== identity.declared) {
            findings.push(`${name} names ${value}, but VERSION declares ${identity.declared}`);
        }
    }
    return findings;
}
