/**
 * `nexus feature-issue` — the feature issue's rules, for the epic stage (epic #998, decision record
 * #1010). The epic stage resolves the opt-in, looks up a feature's issue, and renders the work item
 * it files here, so the stage and the readers cannot disagree on any of it.
 *
 * Nothing in this module writes to GitHub. Filing goes through the guarded batch filer
 * (`nexus create-story`), which this module only feeds.
 */

import * as fs from "node:fs";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { type KindClassification, featureMarkerMode, featureNeedsIssueType, isDeclaredFeature, readKindMarkers, resolveFeatureMode } from "@nexus/delivery-config/issue-kind";

/** The hidden block in a feature issue's body that records the feature path. Lookup matches on it. */
export const FEATURE_META_MARKER = "nexus:feature-meta";

const FEATURE_META: RegExp = /<!--\s*nexus:feature-meta\b\s*\n([\s\S]*?)\n?-->/;

/** The feature meta block for one feature path. */
export function renderFeatureMeta(featurePath: string): string {
    return `<!-- ${FEATURE_META_MARKER}\nfeature_path: ${JSON.stringify(featurePath)}\n-->`;
}

/** The feature path a feature issue's body records, or null when it records none. */
export function parseFeaturePath(body: string): string | null {
    const block: RegExpExecArray | null = FEATURE_META.exec(body);
    if (block === null) return null;
    const line: RegExpExecArray | null = /^feature_path:\s*(.+)$/m.exec(block[1]);
    if (line === null) return null;
    return line[1].trim().replace(/^["']|["']$/g, "");
}

/** The ref a feature path files under, one per distinct path, so a repeat finds it in the ledger. */
export function featureRef(featurePath: string): string {
    return `feature-${featurePath.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

/** What the repository declares about features as issues. */
export type FeatureSetting =
    /** Not opted in: every stage acts as it does without features as issues. */
    | { state: "off" }
    /** Opted in, but the repository files by issue type and declares no feature type. */
    | { state: "no-marker"; message: string }
    /** `features: types` names no feature type: nothing may be filed, not even the epic (#1061 D3). */
    | { state: "no-type"; message: string }
    /** `github.features` names a value other than docs, types or labels: nothing may be filed. */
    | { state: "unknown-mode"; message: string }
    | { state: "on"; markers: KindClassification; label: string; type: string };

/** Resolve the opt-in and the marker through the shared kind rule's own reading. */
export function resolveFeatureSetting(root: string): FeatureSetting {
    const declared: string = resolvePublishingKey(root, "features").trim();
    if (declared !== "" && !["docs", "types", "labels"].includes(declared.toLowerCase())) {
        return {
            state: "unknown-mode",
            message: `github.features is '${declared}', which is none of docs, types or labels; correct it in .nexus/config/settings.yml, and nothing is filed until then`,
        };
    }
    const mode = resolveFeatureMode(root);
    if (mode === "docs") return { state: "off" };
    const markers: KindClassification = readKindMarkers(root);
    if (mode === "types" && markers.featureType === "") {
        return {
            state: "no-type",
            message: "github.features is types but github.feature-type is not declared in .nexus/config/settings.yml; declare the feature issue type, and nothing is filed until then",
        };
    }
    // Under issue-type mode the type alone is the marker, and there is no built-in one.
    if (mode === "legacy" && markers.mode === "types" && markers.featureType === "") {
        return {
            state: "no-marker",
            message:
                "no feature issue is filed because github.feature-type is not declared in " +
                ".nexus/config/settings.yml; the epic is filed as it is without features as issues",
        };
    }
    return { state: "on", markers, label: markers.featureLabel, type: markers.featureType };
}

/** The classification mode the feature marker is filed under: the feature mode, else `classification`. */
export function featureClassification(setting: Extract<FeatureSetting, { state: "on" }>): string {
    const mode = featureMarkerMode(setting.markers);
    return mode === "legacy-auto" ? setting.markers.mode : mode;
}

/** One issue read from the epic repository's listing. */
export interface FeatureIssueRef {
    number: number;
    state: "open" | "closed";
    body: string;
    labels: string[];
    issueType: string | null;
}

export type FeatureLookup =
    | { outcome: "off" }
    | { outcome: "no-marker"; message: string }
    | { outcome: "no-type"; message: string }
    | { outcome: "unknown-mode"; message: string }
    /** `features: types` and the epic repository has no such type: nothing is filed (#1061 D3). */
    | { outcome: "type-missing"; type: string }
    | { outcome: "reuse"; issue: number; state: "open" | "closed"; source: "ledger" | "named" | "listing" }
    /** No issue records the path: this run files a new feature issue, README or not (#1061 D7). */
    | { outcome: "file-new" }
    | { outcome: "ambiguous"; issues: number[] }
    /** The issue the stub or ledger names does not read as a feature. */
    | { outcome: "not-a-feature"; issue: number };

export interface LookupInput {
    setting: FeatureSetting;
    featurePath: string;
    /** The number the run's own feature ledger holds for this path, on a repeat. */
    ledgerNumber: number | null;
    /** The number a promoted stub names as its feature issue. */
    namedNumber: number | null;
    /** Read one issue by number; null when it cannot be read. */
    readIssue: (number: number) => FeatureIssueRef | null;
    /** The repository's feature-marked issues, open and closed. Called only when an earlier step did not answer. */
    listIssues: () => FeatureIssueRef[] | null;
    /** Whether the epic repository has an issue type; asked only before filing a new typed feature. */
    hasIssueType?: (name: string) => boolean;
}

function readsAsFeature(markers: KindClassification, issue: FeatureIssueRef): boolean {
    return isDeclaredFeature(markers, { labels: issue.labels, issueType: issue.issueType });
}

/**
 * Find the feature issue for one feature path, in the order the record gives: the run's ledger, then
 * the stub's named issue, then a listing matched on the feature meta block. Off and no-marker answer
 * before any read, so a repository that has not opted in makes no feature call.
 */
export function lookupFeature(input: LookupInput): FeatureLookup {
    const { setting } = input;
    if (setting.state === "off") return { outcome: "off" };
    if (setting.state === "no-marker") return { outcome: "no-marker", message: setting.message };
    if (setting.state === "no-type") return { outcome: "no-type", message: setting.message };
    if (setting.state === "unknown-mode") return { outcome: "unknown-mode", message: setting.message };

    for (const [number, source] of [[input.ledgerNumber, "ledger"], [input.namedNumber, "named"]] as const) {
        if (number === null) continue;
        const issue: FeatureIssueRef | null = input.readIssue(number);
        if (issue === null || !readsAsFeature(setting.markers, issue)) return { outcome: "not-a-feature", issue: number };
        return { outcome: "reuse", issue: number, state: issue.state, source };
    }

    const listed: FeatureIssueRef[] = input.listIssues() ?? [];
    const matches: FeatureIssueRef[] = listed.filter(
        (issue) => readsAsFeature(setting.markers, issue) && parseFeaturePath(issue.body) === input.featurePath,
    );
    if (matches.length > 1) return { outcome: "ambiguous", issues: matches.map((m) => m.number).sort((a, b) => a - b) };
    if (matches.length === 1) return { outcome: "reuse", issue: matches[0].number, state: matches[0].state, source: "listing" };
    if (setting.markers.featureMode === "types" && input.hasIssueType !== undefined && !input.hasIssueType(setting.type)) {
        return { outcome: "type-missing", type: setting.type };
    }
    return { outcome: "file-new" };
}

/** The sentence the digest and the stubs consent text show for a lookup's outcome. */
export function describeLookup(lookup: FeatureLookup, featurePath: string): string {
    switch (lookup.outcome) {
        case "off":
            return "";
        case "no-marker":
        case "no-type":
        case "unknown-mode":
            return lookup.message;
        case "type-missing":
            return `Feature issue: the epic repository has no '${lookup.type}' issue type, which github.feature-type names; nothing is filed, not even the epic.`;
        case "reuse":
            return `Feature issue: #${lookup.issue} (${lookup.state}) is used for ${featurePath}; no new feature issue is filed.`;
        case "file-new":
            return `Feature issue: a new feature issue will be filed for ${featurePath}.`;
        case "ambiguous":
            return `Feature issue: ${lookup.issues.map((n) => `#${n}`).join(" and ")} both record ${featurePath}; nothing is filed.`;
        case "not-a-feature":
            return `Feature issue: #${lookup.issue} does not read as a feature; nothing is filed.`;
    }
}

/** The feature number a ledger file holds for a path, or null when there is no ledger or no entry. */
export function readLedgerNumber(ledgerFile: string, featurePath: string): number | null {
    try {
        const ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8")) as Record<string, { number?: string | number }>;
        const entry = ledger[featureRef(featurePath)];
        const number: number = Number(entry?.number);
        return Number.isInteger(number) && number > 0 ? number : null;
    } catch {
        return null;
    }
}

/**
 * The work item the feature issue is filed from: titled with the feature name, holding the one-line
 * capability statement and the feature meta block. It names no parent and no label, so the filer adds
 * only the feature marker it is handed, and the issue carries no other kind's marker.
 */
export function renderFeatureWorkItem(name: string, statement: string, featurePath: string): { fileName: string; content: string } {
    const ref: string = featureRef(featurePath);
    const content: string = [
        "---",
        `title: ${JSON.stringify(name)}`,
        `ref: ${ref}`,
        "---",
        "",
        statement.trim(),
        "",
        renderFeatureMeta(featurePath),
        "",
    ].join("\n");
    return { fileName: `STORY-${ref.toUpperCase()}.md`, content };
}

/** Whether a lookup should be able to use the issue type in its listing. */
export function listingNeedsType(setting: FeatureSetting): boolean {
    return setting.state === "on" && featureNeedsIssueType(setting.markers);
}
