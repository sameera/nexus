/**
 * `nexus feature-issue migrate` — move existing feature folders onto feature issues (epic #999,
 * decision record #1049).
 *
 * The run works out a migration plan first and writes nothing. Only `--apply` carries it out. It
 * reads the feature folders and never writes to them (D6). It finds each folder's feature issue by
 * the feature meta block, through the filing ledger and then a listing in both states (D2), and
 * files a missing one, open, from the feature's name and one-line statement (D3, D7). Every GitHub
 * call goes through `MigrationGh`, so the planner holds the rules and the CLI holds the wiring.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { type FeatureIssueRef, type FeatureLookup, type FeatureSetting, lookupFeature, readLedgerNumber } from "./feature-issue.js";

/** Where the features live, relative to the checkout. */
export const FEATURES_DIR = "docs/features";

/** The scratch folder the feature batch is filed from. Its kept ledger is the filing ledger. */
export const MIGRATION_DIR = ".nexus/tmp/feature-migration";

export const LEDGER_FILE = ".nxs-created.json";

export interface FeatureFolder {
    path: string;
    name: string;
    statement: string | null;
}

export interface FeatureToFile {
    featurePath: string;
    name: string;
    statement: string;
}

/** The GitHub side of a run. Each method answers null or a failure rather than throwing. */
export interface MigrationGh {
    /** Every issue carrying the feature marker, open and closed. Null when GitHub did not answer. */
    listFeatures(): FeatureIssueRef[] | null;
    /** File the feature issues through the guarded filer. `numbers` maps feature path to issue. */
    fileFeatures(items: FeatureToFile[]): { numbers: Map<string, number>; failure: string | null };
}

export type FeatureAction = "file" | "filed" | "reuse" | "ambiguous" | "no-statement" | "failed";

export interface FeaturePlan {
    path: string;
    name: string;
    action: FeatureAction;
    issue?: number;
    issues?: number[];
    retired?: boolean;
}

export interface MigrationReport {
    /** Why the run refused before reading any issue, or null. */
    refused: string | null;
    features: FeaturePlan[];
    lines: string[];
    /** True when nothing is left to do or to fix by hand. */
    complete: boolean;
}

export interface MigrationInput {
    root: string;
    setting: FeatureSetting;
    apply: boolean;
    gh: MigrationGh;
}

function unquote(value: string): string {
    return value.trim().replace(/^["']|["']$/g, "");
}

/** The feature's name: the README's `feature:` key, else its first heading, else the folder name. */
function readName(text: string, slug: string): string {
    const fm: RegExpExecArray | null = /^---\n([\s\S]*?)\n---/.exec(text);
    const key: RegExpExecArray | null = fm === null ? null : /^feature:\s*(.+)$/m.exec(fm[1]);
    if (key !== null) return unquote(key[1]);
    const heading: RegExpExecArray | null = /^#\s+(.+)$/m.exec(text);
    return heading !== null ? heading[1].trim() : slug;
}

/** The first paragraph under the README's title, before any section, joined onto one line. */
function readStatement(text: string): string | null {
    const body: string = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
    const lines: string[] = body.split(/\r?\n/);
    const title: number = lines.findIndex((l) => /^#\s+/.test(l));
    const paragraph: string[] = [];
    for (const line of lines.slice(title + 1)) {
        if (/^#{1,6}\s/.test(line)) break;
        if (line.trim() === "") {
            if (paragraph.length > 0) break;
            continue;
        }
        paragraph.push(line.trim());
    }
    return paragraph.length === 0 ? null : paragraph.join(" ");
}

/** A statement the features index gives a folder: a list line linking it, after a dash. */
function indexStatement(index: string, slug: string): string | null {
    const link = new RegExp(`\\]\\((?:\\./)?${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/[^)]*)?\\)\\s*[—–-]+\\s*(.+)$`, "m");
    const match: RegExpExecArray | null = link.exec(index);
    return match === null ? null : match[1].trim();
}

/** Every feature folder under the features directory that holds a README, in name order. */
export function readFeatureFolders(root: string): FeatureFolder[] {
    const dir: string = path.join(root, FEATURES_DIR);
    if (!fs.existsSync(dir)) return [];
    const indexFile: string = path.join(dir, "README.md");
    const index: string = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, "utf8") : "";
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "README.md")))
        .map((e) => e.name)
        .sort()
        .map((slug) => {
            const text: string = fs.readFileSync(path.join(dir, slug, "README.md"), "utf8");
            return { path: `${FEATURES_DIR}/${slug}`, name: readName(text, slug), statement: readStatement(text) ?? indexStatement(index, slug) };
        });
}

function refusal(setting: FeatureSetting): string | null {
    if (setting.state === "off") return "the repository has not opted in to features as issues: set github.features-as-issues: true in .nexus/config/settings.yml";
    if (setting.state === "no-marker") return "the repository classifies issues by type and declares no feature type: set github.feature-type in .nexus/config/settings.yml";
    return null;
}

/** Find, and with `apply` file, the feature issue of every feature folder. */
export function migrateFeatures(input: MigrationInput): MigrationReport {
    const refused: string | null = refusal(input.setting);
    if (refused !== null) return { refused, features: [], lines: [`Refused: ${refused}. Nothing was read or written.`], complete: false };
    const setting = input.setting as Extract<FeatureSetting, { state: "on" }>;

    const listed: FeatureIssueRef[] | null = input.gh.listFeatures();
    if (listed === null) {
        return { refused: null, features: [], lines: ["Stopped: the feature issues could not be listed. Nothing was written; re-run once GitHub answers."], complete: false };
    }
    const retiredLabel: string = resolvePublishingKey(input.root, "retired-feature-label").trim().toLowerCase();
    const ledger: string = path.join(input.root, MIGRATION_DIR, LEDGER_FILE);
    const byNumber: Map<number, FeatureIssueRef> = new Map(listed.map((i) => [i.number, i]));

    const plans: FeaturePlan[] = readFeatureFolders(input.root).map((folder) => {
        const lookup: FeatureLookup = lookupFeature({
            setting,
            featurePath: folder.path,
            hasReadme: false,
            ledgerNumber: readLedgerNumber(ledger, folder.path),
            namedNumber: null,
            readIssue: (n) => byNumber.get(n) ?? null,
            listIssues: () => listed,
        });
        if (lookup.outcome === "reuse") {
            const issue: FeatureIssueRef | undefined = byNumber.get(lookup.issue);
            const retired: boolean = retiredLabel !== "" && (issue?.labels ?? []).some((l) => l.toLowerCase() === retiredLabel);
            return { path: folder.path, name: folder.name, action: "reuse", issue: lookup.issue, ...(retired ? { retired } : {}) };
        }
        if (lookup.outcome === "ambiguous") return { path: folder.path, name: folder.name, action: "ambiguous", issues: lookup.issues };
        // A ledger entry the listing no longer shows is stale: fall through to filing.
        if (folder.statement === null) return { path: folder.path, name: folder.name, action: "no-statement" };
        return { path: folder.path, name: folder.name, action: "file" };
    });

    const toFile: FeatureToFile[] = [];
    for (const plan of plans) {
        if (plan.action !== "file") continue;
        const folder = readFeatureFolders(input.root).find((f) => f.path === plan.path) as FeatureFolder;
        toFile.push({ featurePath: plan.path, name: plan.name, statement: folder.statement as string });
    }
    let failure: string | null = null;
    if (input.apply && toFile.length > 0) {
        const filed = input.gh.fileFeatures(toFile);
        failure = filed.failure;
        for (const plan of plans) {
            if (plan.action !== "file") continue;
            const number: number | undefined = filed.numbers.get(plan.path);
            Object.assign(plan, number === undefined ? { action: "failed" } : { action: "filed", issue: number });
        }
    }

    const lines: string[] = [input.apply ? "Feature issues:" : "Feature issues (plan only; re-run with --apply to carry it out):"];
    for (const p of plans) lines.push(`  ${describe(p)}`);
    if (failure !== null) lines.push(`Stopped filing: ${failure}. Re-run with --apply; it files only the feature issues still missing.`);
    const open: boolean = plans.some((p) => p.action !== "reuse" && p.action !== "filed");
    return { refused: null, features: plans, lines, complete: !open };
}

function describe(p: FeaturePlan): string {
    switch (p.action) {
        case "reuse":
            return `${p.path}: uses #${p.issue}${p.retired ? " (retired)" : ""}`;
        case "filed":
            return `${p.path}: filed #${p.issue} "${p.name}"`;
        case "file":
            return `${p.path}: would file "${p.name}"`;
        case "ambiguous":
            return `${p.path}: ambiguous — ${(p.issues ?? []).map((n) => `#${n}`).join(" and ")} both record it; nothing is filed. Remove the meta block from all but one.`;
        case "no-statement":
            return `${p.path}: no one-line capability statement in its README or the features index; nothing is filed. Add one.`;
        case "failed":
            return `${p.path}: not filed`;
    }
}
