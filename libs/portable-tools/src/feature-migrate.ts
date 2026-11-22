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
import { extractMeta } from "@nexus/epic-resolve/meta";
import { serializeEpic } from "@nexus/epic-resolve/serialize";
import { type KindClassification, isDeclaredFeature, isDeclaredInitiative, readKindMarkers } from "@nexus/delivery-config/issue-kind";
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
    /** Close a feature issue this run filed (D9). False when it could not be closed. */
    closeFeature?: (number: number) => boolean;
    /** Every issue carrying the feature marker, open and closed. Null when GitHub did not answer. */
    listFeatures(): FeatureIssueRef[] | null;
    /** File the feature issues through the guarded filer. `numbers` maps feature path to issue. */
    fileFeatures(items: FeatureToFile[]): { numbers: Map<string, number>; failure: string | null };
    /** Every issue carrying the epic marker, open and closed, stubs included. Null when unanswered. */
    listMembers?(): MemberIssue[] | null;
    /** Write `body` over `expected` through the shared feature step, which reads it back (G3). */
    editBody?(number: number, expected: string, body: string): boolean;
    /** Add the relates-to link through the shared link step (#998). */
    link?(number: number, feature: number): "linked" | "present" | "failed";
    /** Which of `numbers` the feature issue does not list as related. Null when it cannot be read. */
    missingRelated?(feature: number, numbers: number[]): number[] | null;
}

/** An epic or stub as listed. Only its body is ever written. */
export interface MemberIssue {
    number: number;
    title: string;
    state: "open" | "closed";
    body: string;
    labels: string[];
    issueType: string | null;
    parent: number | null;
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
    members?: MemberPlan[];
}

export type MemberAction = "update" | "updated" | "done" | "unplaced" | "conflict" | "no-feature-issue" | "failed";

export interface MemberPlan {
    number: number;
    path: string | null;
    feature: number | null;
    action: MemberAction;
    note?: string;
}

const EPIC_META: RegExp = /<!--\s*nexus:epic-meta\b\s*\n([\s\S]*?)\n?-->/;
const STUB_FEATURE: RegExp = /^- \*\*feature:\*\*\s*(.+?)\s*$/m;
const STUB_ISSUE: RegExp = /^- \*\*feature issue:\*\*\s*#?(\d+)\s*$/m;

/** The feature path an issue's own body records: its meta block's, else its stub Meta line's. */
export function ownFeaturePath(body: string): string | null {
    const meta: RegExpExecArray | null = EPIC_META.exec(body);
    const line: RegExpExecArray | null = meta === null ? null : /^feature_path:\s*(.+)$/m.exec(meta[1]);
    if (line !== null) return unquote(line[1]);
    const stubLine: RegExpExecArray | null = STUB_FEATURE.exec(body);
    return stubLine === null ? null : unquote(stubLine[1]);
}

/** The feature issue an issue's body already names, or null. */
export function namedFeatureIssue(body: string): number | null {
    const meta: RegExpExecArray | null = EPIC_META.exec(body);
    const field: RegExpExecArray | null = meta === null ? null : /^feature_issue:\s*["']?#?(\d+)["']?\s*$/m.exec(meta[1]);
    if (field !== null) return Number(field[1]);
    const line: RegExpExecArray | null = STUB_ISSUE.exec(body);
    return line === null ? null : Number(line[1]);
}

/**
 * The body with the feature reference added and nothing else changed (D5): a stub's Meta line under
 * its feature line, an epic's field in its meta block, or a block carrying only the reference.
 */
export function withFeatureReference(body: string, feature: number): string {
    if (STUB_FEATURE.test(body) && EPIC_META.exec(body) === null) {
        return body.replace(STUB_FEATURE, (line) => `${line}\n- **feature issue:** #${feature}`);
    }
    const meta: RegExpExecArray | null = EPIC_META.exec(body);
    if (meta === null && STUB_META.test(body)) return withStubMetaLine(body, `- **feature issue:** #${feature}`);
    const field = `feature_issue: "#${feature}"`;
    if (meta === null) return `${body}${body.endsWith("\n") ? "\n" : "\n\n"}<!-- nexus:epic-meta\n${field}\n-->\n`;
    const lines: string[] = meta[1].split("\n");
    const at: number = lines.findIndex((l) => /^feature_path:/.test(l));
    lines.splice(at === -1 ? lines.length : at + 1, 0, field);
    const start: number = meta.index + meta[0].indexOf(meta[1]);
    return body.slice(0, start) + lines.join("\n") + body.slice(start + meta[1].length);
}

/** A stub's `## Meta` section heading. */
const STUB_META: RegExp = /^## Meta[ \t]*$/m;

/** The body with `line` added as the last list item of its `## Meta` section, nothing else changed. */
function withStubMetaLine(body: string, line: string): string {
    const heading: RegExpExecArray = STUB_META.exec(body) as RegExpExecArray;
    const after: number = heading.index + heading[0].length;
    const next: RegExpExecArray | null = /^#{1,2}\s/m.exec(body.slice(after));
    const end: number = next === null ? body.length : after + next.index;
    const section: string = body.slice(after, end);
    const lastItem: RegExpExecArray | null = /^- .*$(?![\s\S]*^- )/m.exec(section);
    if (lastItem === null) return body.slice(0, end).replace(/\n*$/, "\n\n") + `${line}\n` + body.slice(end);
    const at: number = after + lastItem.index + lastItem[0].length;
    return `${body.slice(0, at)}\n${line}${body.slice(at)}`;
}

/** How the resolver reads an issue body back as an epic, with its feature issue reference removed. */
function resolvedWithoutFeatureIssue(number: number, title: string, body: string): string {
    const { rawFrontmatter, body: rest } = extractMeta(body);
    const markdown: string = serializeEpic({ epic: { number, title, body: rest, rawFrontmatter }, stories: [], blockedBy: new Map() });
    return markdown.replace(/^feature_issue:.*\n/m, "").replace(/^- \*\*feature issue:\*\*.*\n/m, "");
}

/** The epics each feature README lists, as issue number to feature path. */
function readmeMembership(root: string, folders: FeatureFolder[]): Map<number, string[]> {
    const listed: Map<number, string[]> = new Map();
    for (const folder of folders) {
        const text: string = fs.readFileSync(path.join(root, folder.path, "README.md"), "utf8");
        for (const m of text.matchAll(/\[#(\d+)\]\(/g)) {
            const paths: string[] = listed.get(Number(m[1])) ?? [];
            if (!paths.includes(folder.path)) paths.push(folder.path);
            listed.set(Number(m[1]), paths);
        }
    }
    return listed;
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

/** The line that names a README's feature issue (D11). Matched on its prefix, so a repeat adds none. */
const POINTER_PREFIX = "> Feature issue:";

/** Add the pointer line under the README's title once; every other line is left as it is. */
function addPointerLine(root: string, featurePath: string, issue: number): void {
    const file: string = path.join(root, featurePath, "README.md");
    const text: string = fs.readFileSync(file, "utf8");
    if (text.split("\n").some((l) => l.startsWith(POINTER_PREFIX))) return;
    const line = `${POINTER_PREFIX} #${issue}. This README is no longer updated; the feature's epics are listed by \`nexus feature-issue epics --feature ${issue}\`.`;
    const title: RegExpExecArray | null = /^# .*$/m.exec(text);
    const at: number = title === null ? 0 : title.index + title[0].length;
    const next: string = title === null ? `${line}\n\n${text}` : `${text.slice(0, at)}\n\n${line}${text.slice(at)}`;
    fs.writeFileSync(file, next);
}

function refusal(setting: FeatureSetting): string | null {
    if (setting.state === "off") return "the repository has not opted in to features as issues: set github.features-as-issues: true in .nexus/config/settings.yml";
    if (setting.state === "no-type") return setting.message;
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
            if (number !== undefined && input.gh.closeFeature !== undefined && !input.gh.closeFeature(number)) {
                failure = failure ?? `#${number} was filed but could not be closed`;
            }
        }
    }

    if (input.apply) for (const p of plans) if (p.action === "reuse" || p.action === "filed") addPointerLine(input.root, p.path, p.issue as number);

    const lines: string[] = [input.apply ? "Feature issues:" : "Feature issues (plan only; re-run with --apply to carry it out):"];
    for (const p of plans) lines.push(`  ${describe(p)}`);
    if (failure !== null) lines.push(`Stopped filing: ${failure}. Re-run with --apply; it files only the feature issues still missing.`);
    let open: boolean = plans.some((p) => p.action !== "reuse" && p.action !== "filed");
    if (input.gh.listMembers === undefined || failure !== null) return { refused: null, features: plans, lines, complete: !open };

    const members = migrateMembers(input, plans, lines);
    open = open || members === null || members.some((m) => m.action !== "done" && m.action !== "updated");
    return { refused: null, features: plans, lines, complete: !open, members: members ?? [] };
}

/** Name each epic and stub's feature issue in its body and link the two (D4, D5). */
function migrateMembers(input: MigrationInput, plans: FeaturePlan[], lines: string[]): MemberPlan[] | null {
    const gh = input.gh as Required<MigrationGh>;
    const listed: MemberIssue[] | null = gh.listMembers();
    if (listed === null) {
        lines.push("Stopped: the epics and stubs could not be listed. Re-run once GitHub answers.");
        return null;
    }
    const markers: KindClassification = readKindMarkers(input.root);
    const readme: Map<number, string[]> = readmeMembership(input.root, readFeatureFolders(input.root));
    const issueOf: Map<string, number | null> = new Map(plans.map((p) => [p.path, p.issue ?? null]));
    const planned: Set<string> = new Set(plans.filter((p) => p.action === "file").map((p) => p.path));

    const members: MemberPlan[] = [];
    for (const issue of [...listed].sort((a, b) => a.number - b.number)) {
        const kind = { labels: issue.labels, issueType: issue.issueType };
        if (isDeclaredInitiative(markers, kind) || isDeclaredFeature(markers, kind)) continue;
        const own: string | null = ownFeaturePath(issue.body);
        const fromReadme: string[] = readme.get(issue.number) ?? [];
        const notes: string[] = [];
        let placed: string | null = own;
        if (own !== null) {
            const other = fromReadme.filter((p) => p !== own);
            if (other.length > 0) notes.push(`its body names ${own} but ${other.join(", ")} lists it; its body wins`);
        } else if (fromReadme.length === 1) placed = fromReadme[0];
        else if (fromReadme.length > 1) {
            members.push({ number: issue.number, path: null, feature: null, action: "unplaced", note: `${fromReadme.join(" and ")} both list it` });
            continue;
        }
        if (placed === null) {
            members.push({ number: issue.number, path: null, feature: null, action: "unplaced", note: "neither its body nor any README names its feature" });
            continue;
        }
        const feature: number | null = issueOf.get(placed) ?? null;
        const named: number | null = namedFeatureIssue(issue.body);
        if (feature === null) {
            const note = planned.has(placed) ? `would name the feature issue filed for ${placed}` : `${placed} has no feature issue`;
            members.push({ number: issue.number, path: placed, feature: null, action: planned.has(placed) ? "update" : "no-feature-issue", note });
            continue;
        }
        if (named !== null && named !== feature) {
            members.push({ number: issue.number, path: placed, feature, action: "conflict", note: `it names #${named}, not #${feature}; left unchanged` });
            continue;
        }
        const plan: MemberPlan = { number: issue.number, path: placed, feature, action: named === null ? "update" : "done", ...(notes.length > 0 ? { note: notes.join("; ") } : {}) };
        members.push(plan);
        if (!input.apply) continue;
        if (named === null) {
            const next: string = withFeatureReference(issue.body, feature);
            if (namedFeatureIssue(next) !== feature || resolvedWithoutFeatureIssue(issue.number, issue.title, next) !== resolvedWithoutFeatureIssue(issue.number, issue.title, issue.body)) {
                Object.assign(plan, { action: "failed", note: "the reference could not be added without changing anything else" });
                continue;
            }
            if (!gh.editBody(issue.number, issue.body, next)) {
                Object.assign(plan, { action: "failed", note: "its body did not read back as written; check it by hand" });
                continue;
            }
            plan.action = "updated";
        }
        if (gh.link(issue.number, feature) === "failed") plan.note = [plan.note, "the related link failed; re-run to retry"].filter(Boolean).join("; ");
    }

    lines.push(input.apply ? "Epics and stubs:" : "Epics and stubs (plan only):");
    for (const m of members) lines.push(`  #${m.number}: ${m.action}${m.feature !== null ? ` → #${m.feature}` : ""}${m.path !== null ? ` (${m.path})` : ""}${m.note ? ` — ${m.note}` : ""}`);

    if (input.apply) {
        // The final check: every member that names a feature issue is on its related list (G13).
        const byFeature: Map<number, number[]> = new Map();
        for (const m of members) if (m.feature !== null && (m.action === "updated" || m.action === "done")) byFeature.set(m.feature, [...(byFeature.get(m.feature) ?? []), m.number]);
        for (const [feature, numbers] of byFeature) {
            const missing: number[] = gh.missingRelated(feature, numbers) ?? numbers;
            for (const n of missing) {
                lines.push(`  Incomplete: feature issue #${feature} does not list #${n} as related. Re-run with --apply to add the link.`);
                const m = members.find((x) => x.number === n) as MemberPlan;
                m.action = "failed";
            }
        }
    }
    return members;
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
