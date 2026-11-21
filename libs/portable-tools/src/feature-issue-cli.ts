/**
 * `nexus feature-issue` — the readable face of the feature issue's rules (epic #998, decision record
 * #1010). The epic stage asks here whether a feature issue is used, which one, and what to file it
 * from, so the stage text never re-derives the opt-in, the marker or the lookup order.
 *
 * Nothing here writes to GitHub. The feature issue is filed by `nexus create-story`, from the work
 * item `work-item` writes, under the marker `lookup` prints.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Runner, defaultRunner } from "@nexus/workspace/run";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { type IssueAt, missingFromFeature, parseIssueAt } from "@nexus/delivery-config/feature-link";
import { type FilerEnvironment, defaultEnvironment } from "@nexus/delivery-config/story-filer/environment";
import { runCreateStory } from "@nexus/delivery-config/story-filer/run";
import { LEDGER_FILE, MIGRATION_DIR, type MigrationGh, type MigrationReport, migrateFeatures } from "./feature-migrate.js";
import {
    type FeatureIssueRef,
    type FeatureLookup,
    type FeatureSetting,
    describeLookup,
    featureRef,
    lookupFeature,
    readLedgerNumber,
    renderFeatureWorkItem,
    resolveFeatureSetting,
} from "./feature-issue.js";

export const FEATURE_ISSUE_SUBVERBS: readonly string[] = ["lookup", "work-item", "check-related", "migrate"];

export const FEATURE_ISSUE_USAGE: string = [
    "  nexus feature-issue lookup --feature-path <path> [--ledger <file>] [--named <N>]",
    "      Find the feature issue for one feature path: the run's ledger on a repeat, then the",
    "      issue a promoted stub names, then the epic repository's feature-marked issues matched",
    "      on the path they record. Prints { outcome, line, ... }: outcome is off, no-marker,",
    "      reuse, file-new or unmigrated, and line is the sentence the digest shows. When a feature",
    "      issue is used it also prints classification, label and type, the marker to file under.",
    "      Not opted in, it reads nothing from GitHub. ambiguous, not-a-feature or an unreadable",
    "      listing exits 1, naming why; nothing may be filed then.",
    "  nexus feature-issue work-item --name <name> --statement <text> --feature-path <path> --dir <folder>",
    "      Write the work item a new feature issue is filed from into <folder>. Prints { file, ref }.",
    "  nexus feature-issue check-related --feature <N|owner/repo#N> --issues <n,n,...>",
    "      Read the feature issue's related list and confirm every listed issue of the epic",
    "      repository is on it. Prints { feature, missing }; any missing issue, or a feature that",
    "      cannot be read, exits 1.",
    "  nexus feature-issue migrate [--apply]",
    "      Move existing feature folders onto feature issues. Without --apply it prints the",
    "      migration plan and writes nothing; with it, files each missing feature issue through",
    "      the guarded filer. Refuses unless the repository opted in to features as issues.",
    "      Exits 1 when anything is left to do or to fix by hand.",
].join("\n");

interface FeatureIssueIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

export async function runFeatureIssue(argv: string[], io: FeatureIssueIo, run: Runner = defaultRunner): Promise<number> {
    const sub: string | undefined = argv[0];
    if (sub === "migrate") return runMigrate(argv.slice(1), io, run);
    const flags: Map<string, string> | null = sub !== undefined && FEATURE_ISSUE_SUBVERBS.includes(sub) ? readFlags(argv.slice(1)) : null;
    if (flags === null) {
        io.stderr(`usage:\n${FEATURE_ISSUE_USAGE}`);
        return 2;
    }
    if (sub === "lookup") return runLookup(flags, io, run);
    if (sub === "check-related") return runCheckRelated(flags, io, run);
    return runWorkItem(flags, io);
}

function readFlags(argv: string[]): Map<string, string> | null {
    const flags: Map<string, string> = new Map();
    for (let i = 0; i < argv.length; i += 2) {
        const value: string | undefined = argv[i + 1];
        if (!argv[i].startsWith("--") || value === undefined || value === "") return null;
        flags.set(argv[i].slice(2), value);
    }
    return flags;
}

/** The checkout the feature path is relative to: the nearest ancestor that holds `.git`. */
function checkoutRoot(cwd: string): string {
    for (let dir: string = path.resolve(cwd); ; dir = path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, ".git"))) return dir;
        if (path.dirname(dir) === dir) return path.resolve(cwd);
    }
}

function runLookup(flags: Map<string, string>, io: FeatureIssueIo, run: Runner): number {
    const featurePath: string | undefined = flags.get("feature-path");
    const named: string | undefined = flags.get("named");
    if (featurePath === undefined || (named !== undefined && !/^#?[1-9]\d*$/.test(named))) {
        io.stderr(`usage:\n${FEATURE_ISSUE_USAGE}`);
        return 2;
    }
    const root: string = checkoutRoot(io.cwd);
    const setting: FeatureSetting = resolveFeatureSetting(root);
    const ledger: string | undefined = flags.get("ledger");
    const gh = new GhReader(run, root, resolvePublishingKey(root, "epic-repo"));
    const lookup: FeatureLookup = lookupFeature({
        setting,
        featurePath,
        hasReadme: fs.existsSync(path.resolve(root, featurePath, "README.md")),
        ledgerNumber: ledger === undefined ? null : readLedgerNumber(path.resolve(io.cwd, ledger), featurePath),
        namedNumber: named === undefined ? null : Number(named.replace(/^#/, "")),
        readIssue: (n) => gh.read(n),
        listIssues: () => (setting.state === "on" ? gh.list(setting) : []),
    });
    if (gh.failure !== null) {
        io.stderr(`feature-issue gh-failed: ${gh.failure}. Nothing may be filed; repeat the run once GitHub answers.`);
        return 1;
    }
    const line: string = describeLookup(lookup, featurePath);
    const marker = setting.state === "on" ? { classification: setting.markers.mode, label: setting.label, type: setting.type, ref: featureRef(featurePath) } : {};
    io.stdout(JSON.stringify({ ...lookup, line, ...marker }));
    if (lookup.outcome === "ambiguous" || lookup.outcome === "not-a-feature") {
        io.stderr(`feature-issue ${lookup.outcome}: ${line}`);
        return 1;
    }
    return 0;
}

function runCheckRelated(flags: Map<string, string>, io: FeatureIssueIo, run: Runner): number {
    const featureRef: string | undefined = flags.get("feature");
    const listed: string[] = (flags.get("issues") ?? "").split(",").map((n) => n.trim().replace(/^#/, "")).filter((n) => n !== "");
    if (featureRef === undefined || listed.length === 0 || listed.some((n) => !/^[1-9]\d*$/.test(n))) {
        io.stderr(`usage:\n${FEATURE_ISSUE_USAGE}`);
        return 2;
    }
    const root: string = checkoutRoot(io.cwd);
    const gh = (args: string[]) => run("gh", args, { cwd: root });
    const home = homeRepo(root, gh);
    const feature: IssueAt | null = home === null ? null : parseIssueAt(featureRef, home);
    if (home === null || feature === null) {
        io.stderr(`feature-issue unresolved: the epic repository or '${featureRef}' could not be resolved.`);
        return 1;
    }
    const featureKey = `${feature.owner}/${feature.name}#${feature.number}`;
    const missing: string[] | null = missingFromFeature(gh, feature, listed.map((number) => ({ ...home, number })));
    if (missing === null) {
        io.stderr(`feature-issue gh-failed: ${featureKey} could not be read, so its related list is unconfirmed. Report the run incomplete.`);
        return 1;
    }
    io.stdout(JSON.stringify({ feature: featureKey, missing }));
    if (missing.length === 0) return 0;
    io.stderr(`feature-issue incomplete: ${featureKey} does not list ${missing.join(", ")} as related. Repeat the filing to add the link.`);
    return 1;
}

/** The epic repository as owner and name: the declared one, or the checkout's own. */
function homeRepo(root: string, gh: (args: string[]) => { status: number; stdout: string }): { owner: string; name: string } | null {
    const declared: string[] = resolvePublishingKey(root, "epic-repo").trim().replace(/\.git$/, "").split("/").filter((p) => p !== "");
    if (declared.length >= 2) return { owner: declared[declared.length - 2], name: declared[declared.length - 1] };
    const viewed = gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    const [owner, name] = viewed.status === 0 ? viewed.stdout.trim().split("/") : [];
    return owner && name ? { owner, name } : null;
}

function runWorkItem(flags: Map<string, string>, io: FeatureIssueIo): number {
    const [name, statement, featurePath, dir] = ["name", "statement", "feature-path", "dir"].map((k) => flags.get(k));
    if (name === undefined || statement === undefined || featurePath === undefined || dir === undefined) {
        io.stderr(`usage:\n${FEATURE_ISSUE_USAGE}`);
        return 2;
    }
    const item = renderFeatureWorkItem(name, statement, featurePath);
    const folder: string = path.resolve(io.cwd, dir);
    fs.mkdirSync(folder, { recursive: true });
    const file: string = path.join(folder, item.fileName);
    fs.writeFileSync(file, item.content);
    io.stdout(JSON.stringify({ file, ref: featureRef(featurePath) }));
    return 0;
}

interface RestIssue {
    number: number;
    state: string;
    body: string | null;
    labels: ({ name: string } | string)[];
    type?: { name: string } | null;
    pull_request?: unknown;
}

/** Reads issues through the REST API, which filters by label or type without the search index (D5). */
class GhReader {
    failure: string | null = null;
    private readonly repo: string;

    constructor(
        private readonly run: Runner,
        private readonly root: string,
        epicRepo: string,
    ) {
        // An empty epic repository is the current one, which `gh api` fills in itself.
        const slug: string[] = epicRepo.trim().replace(/\.git$/, "").split("/").filter((p) => p !== "");
        this.repo = slug.length >= 2 ? slug.slice(-2).join("/") : "{owner}/{repo}";
    }

    read(number: number): FeatureIssueRef | null {
        const issue: RestIssue | null = this.api<RestIssue>([`repos/${this.repo}/issues/${number}`], false);
        return issue === null ? null : toRef(issue);
    }

    list(setting: Extract<FeatureSetting, { state: "on" }>): FeatureIssueRef[] {
        const filter: string = setting.markers.mode === "types" ? `type=${encodeURIComponent(setting.type)}` : `labels=${encodeURIComponent(setting.label)}`;
        const issues: RestIssue[] | null = this.api<RestIssue[]>(["--paginate", "--slurp", `repos/${this.repo}/issues?state=all&per_page=100&${filter}`], true);
        if (issues === null) return [];
        const flat: RestIssue[] = (issues as unknown[]).flat() as RestIssue[];
        return flat.filter((i) => i.pull_request === undefined).map(toRef);
    }

    private api<T>(args: string[], required: boolean): T | null {
        const result = this.run("gh", ["api", ...args], { cwd: this.root });
        if (result.status !== 0) {
            if (required) this.failure = result.stderr.trim() || `gh api exited ${result.status}`;
            return null;
        }
        try {
            return JSON.parse(result.stdout) as T;
        } catch {
            if (required) this.failure = "gh api returned output that is not JSON";
            return null;
        }
    }
}

function toRef(issue: RestIssue): FeatureIssueRef {
    return {
        number: issue.number,
        state: issue.state === "closed" ? "closed" : "open",
        body: issue.body ?? "",
        labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
        issueType: issue.type?.name ?? null,
    };
}

/** Parse `migrate`'s flags: only `--apply`, which takes no value. */
function runMigrate(argv: string[], io: FeatureIssueIo, run: Runner): number {
    if (argv.some((a) => a !== "--apply")) {
        io.stderr(`usage:\n${FEATURE_ISSUE_USAGE}`);
        return 2;
    }
    const root: string = checkoutRoot(io.cwd);
    const setting: FeatureSetting = resolveFeatureSetting(root);
    const report: MigrationReport = migrateFeatures({ root, setting, apply: argv.includes("--apply"), gh: realMigrationGh(root, setting, run) });
    for (const line of report.lines) io.stdout(line);
    return report.refused === null && report.complete ? 0 : 1;
}

/** The migration's GitHub side: the REST listing, and the guarded filer with a kept ledger (G3). */
export function realMigrationGh(root: string, setting: FeatureSetting, run: Runner, env?: FilerEnvironment): MigrationGh {
    const epicRepo: string = resolvePublishingKey(root, "epic-repo");
    const reader = new GhReader(run, root, epicRepo);
    return {
        listFeatures: () => {
            if (setting.state !== "on") return [];
            const listed: FeatureIssueRef[] = reader.list(setting);
            return reader.failure === null ? listed : null;
        },
        fileFeatures: (items) => {
            const on = setting as Extract<FeatureSetting, { state: "on" }>;
            const dir: string = path.join(root, MIGRATION_DIR);
            fs.mkdirSync(dir, { recursive: true });
            for (const name of fs.readdirSync(dir)) if (/^STORY-.*\.md$/.test(name)) fs.rmSync(path.join(dir, name));
            for (const item of items) {
                const work = renderFeatureWorkItem(item.name, item.statement, item.featurePath);
                fs.writeFileSync(path.join(dir, work.fileName), work.content);
            }
            const said: string[] = [];
            const args: string[] = [dir, "--root", root, "--keep-manifest"];
            if (epicRepo.trim() !== "") args.push("--issues-repo", epicRepo.trim());
            if (on.label !== "") args.push("--classification-label", on.label);
            if (on.type !== "") args.push("--classification-type", on.type);
            const code: number = runCreateStory(args, { cwd: root, stdout: () => undefined, stderr: (l) => said.push(l) }, env ?? defaultEnvironment);
            const numbers: Map<string, number> = new Map();
            for (const item of items) {
                const n: number | null = readLedgerNumber(path.join(dir, LEDGER_FILE), item.featurePath);
                if (n !== null) numbers.set(item.featurePath, n);
            }
            const failure: string | null = numbers.size === items.length ? null : said.filter((l) => l.trim() !== "").slice(-2).join(" ") || `the filer exited ${code}`;
            return { numbers, failure };
        },
    };
}
