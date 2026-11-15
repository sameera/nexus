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

export const FEATURE_ISSUE_SUBVERBS: readonly string[] = ["lookup", "work-item"];

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
].join("\n");

interface FeatureIssueIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

export async function runFeatureIssue(argv: string[], io: FeatureIssueIo, run: Runner = defaultRunner): Promise<number> {
    const sub: string | undefined = argv[0];
    const flags: Map<string, string> | null = sub !== undefined && FEATURE_ISSUE_SUBVERBS.includes(sub) ? readFlags(argv.slice(1)) : null;
    if (flags === null) {
        io.stderr(`usage:\n${FEATURE_ISSUE_USAGE}`);
        return 2;
    }
    if (sub === "lookup") return runLookup(flags, io, run);
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
