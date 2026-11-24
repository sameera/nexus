/**
 * `nexus feature-issue` (epic #998, decision record #1010): what the epic stage reads before the
 * digest, and the work item it files the feature issue from.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Runner } from "@nexus/workspace/run";
import { runFeatureIssue } from "./feature-issue-cli.js";
import { featureRef, parseFeaturePath, renderFeatureMeta } from "./feature-issue.js";

const FEATURE_PATH = "docs/features/issue-sourced-planning";

function repoWith(github: string, withReadme = false): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-issue-cli-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n${github}`);
    if (withReadme) {
        fs.mkdirSync(path.join(root, FEATURE_PATH), { recursive: true });
        fs.writeFileSync(path.join(root, FEATURE_PATH, "README.md"), "# Feature\n");
    }
    return root;
}

interface RestIssue {
    number: number;
    state: "open" | "closed";
    body: string;
    labels: { name: string }[];
    type: { name: string } | null;
    pull_request?: object;
}

function restIssue(number: number, featurePath: string | null, labels: string[] = ["feature"], state: "open" | "closed" = "open"): RestIssue {
    return { number, state, body: featurePath === null ? "" : `S\n\n${renderFeatureMeta(featurePath)}`, labels: labels.map((name) => ({ name })), type: null };
}

/** A runner answering `gh api` reads from a fixed set of issues, recording every call. */
function fakeGh(issues: RestIssue[]): { run: Runner; calls: string[][] } {
    const calls: string[][] = [];
    const run: Runner = (cmd, args) => {
        calls.push([cmd, ...args]);
        const endpoint: string = args.find((a) => a.startsWith("repos/")) ?? "";
        const one: RegExpExecArray | null = /\/issues\/(\d+)$/.exec(endpoint);
        if (one !== null) {
            const found: RestIssue | undefined = issues.find((i) => i.number === Number(one[1]));
            return found === undefined ? { status: 1, stdout: "", stderr: "Not Found" } : { status: 0, stdout: JSON.stringify(found), stderr: "" };
        }
        return { status: 0, stdout: JSON.stringify(issues), stderr: "" };
    };
    return { run, calls };
}

async function call(argv: string[], root: string, run: Runner): Promise<{ code: number; out: string; err: string }> {
    let out = "";
    let err = "";
    const code: number = await runFeatureIssue(argv, { cwd: root, stdout: (l) => (out += `${l}\n`), stderr: (l) => (err += `${l}\n`) }, run);
    return { code, out, err };
}

const OPTED_IN = "  classification: labels\n  features: labels\n";

describe("nexus feature-issue lookup", () => {
    it("answers off and reads nothing from GitHub when the repository has not opted in (G1)", async () => {
        const gh = fakeGh([]);
        const result = await call(["lookup", "--feature-path", FEATURE_PATH], repoWith("  classification: labels\n"), gh.run);
        expect(result.code).toBe(0);
        expect(JSON.parse(result.out)).toMatchObject({ outcome: "off", line: "" });
        expect(gh.calls).toEqual([]);
    });

    it("tells the stage to file a new issue, with the marker to file it under", async () => {
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(OPTED_IN), fakeGh([]).run)).out);
        expect(parsed).toMatchObject({ outcome: "file-new", classification: "labels", label: "feature" });
        expect(parsed.line).toMatch(/new feature issue will be filed/);
    });

    it("reuses the issue that records the feature path, read from the marker's own listing", async () => {
        const gh = fakeGh([restIssue(5, "docs/features/other"), restIssue(6, FEATURE_PATH, ["feature"], "closed")]);
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(OPTED_IN), gh.run)).out);
        expect(parsed).toMatchObject({ outcome: "reuse", issue: 6, state: "closed" });
        const listing: string = gh.calls[0].join(" ");
        expect(listing).toContain("labels=feature");
        expect(listing).toContain("state=all");
    });

    it("ignores pull requests the listing returns", async () => {
        const pr: RestIssue = { ...restIssue(8, FEATURE_PATH), pull_request: {} };
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(OPTED_IN), fakeGh([pr]).run)).out);
        expect(parsed.outcome).toBe("file-new");
    });

    it("files a new feature issue whether or not a README exists at the path (#1061 D7, retiring #998 G12)", async () => {
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(OPTED_IN, true), fakeGh([]).run)).out);
        expect(parsed.outcome).toBe("file-new");
    });

    it("reuses the issue its ledger recorded on a repeat (story #1007)", async () => {
        const root: string = repoWith(OPTED_IN);
        const ledger: string = path.join(root, "ledger.json");
        fs.writeFileSync(ledger, JSON.stringify({ [featureRef(FEATURE_PATH)]: { number: "11" } }));
        const gh = fakeGh([restIssue(11, FEATURE_PATH)]);
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH, "--ledger", ledger], root, gh.run)).out);
        expect(parsed).toMatchObject({ outcome: "reuse", issue: 11 });
        expect(gh.calls).toHaveLength(1);
    });

    it("exits 1 naming both issues when two record the same path", async () => {
        const gh = fakeGh([restIssue(3, FEATURE_PATH), restIssue(4, FEATURE_PATH)]);
        const result = await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(OPTED_IN), gh.run);
        expect(result.code).toBe(1);
        expect(JSON.parse(result.out).outcome).toBe("ambiguous");
        expect(result.err).toMatch(/#3 and #4/);
    });

    it("exits 1 when a named issue does not read as a feature", async () => {
        const gh = fakeGh([restIssue(9, FEATURE_PATH, ["epic"])]);
        const result = await call(["lookup", "--feature-path", FEATURE_PATH, "--named", "9"], repoWith(OPTED_IN), gh.run);
        expect(result.code).toBe(1);
        expect(JSON.parse(result.out)).toMatchObject({ outcome: "not-a-feature", issue: 9 });
    });

    it("exits 1 rather than filing a duplicate when the listing cannot be read", async () => {
        const failing: Runner = () => ({ status: 1, stdout: "", stderr: "HTTP 502" });
        const result = await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(OPTED_IN), failing);
        expect(result.code).toBe(1);
        expect(result.err).toContain("HTTP 502");
    });

    it("refuses a call without a feature path", async () => {
        expect((await call(["lookup"], repoWith(OPTED_IN), fakeGh([]).run)).code).toBe(2);
    });
});

describe("nexus feature-issue work-item", () => {
    it("writes the feature's work item into the batch folder", async () => {
        const root: string = repoWith(OPTED_IN);
        const dir: string = path.join(root, "feature-batch");
        const result = await call(
            ["work-item", "--name", "Issue-Sourced Planning", "--statement", "Plan from issues.", "--feature-path", FEATURE_PATH, "--dir", dir],
            root,
            fakeGh([]).run,
        );
        expect(result.code).toBe(0);
        const written: string = fs.readFileSync(JSON.parse(result.out).file, "utf8");
        expect(written).toContain("Plan from issues.");
        expect(parseFeaturePath(written)).toBe(FEATURE_PATH);
        expect(JSON.parse(result.out).ref).toBe(featureRef(FEATURE_PATH));
    });
});

describe("nexus feature-issue check-related — the read-back (D9, G18)", () => {
    function relatedGh(related: string[] | null, featureState: "open" | "closed" = "closed"): Runner {
        return (_cmd, args) => {
            if (related === null) return { status: 1, stdout: "", stderr: "Not Found" };
            if (!args.includes("graphql")) return { status: 0, stdout: JSON.stringify({ number: 5, state: featureState }), stderr: "" };
            const issue = {
                id: "ID_5",
                issueType: null,
                labels: { nodes: [{ name: "feature" }] },
                relatesTo: { nodes: related.map((r) => ({ number: Number(r.split("#")[1]), repository: { nameWithOwner: r.split("#")[0] } })) },
            };
            void args;
            return { status: 0, stdout: JSON.stringify({ data: { repository: { issue } } }), stderr: "" };
        };
    }
    const settings = "  classification: labels\n  features: labels\n  epic-repo: acme/tracker\n";

    it("passes when the feature lists every filed issue as related", async () => {
        const result = await call(["check-related", "--feature", "#5", "--issues", "9,10"], repoWith(settings), relatedGh(["acme/tracker#9", "acme/tracker#10"]));
        expect(result.code).toBe(0);
        expect(JSON.parse(result.out)).toEqual({ feature: "acme/tracker#5", missing: [] });
    });

    it("exits 1 naming each issue the feature does not list", async () => {
        const result = await call(["check-related", "--feature", "#5", "--issues", "9,10"], repoWith(settings), relatedGh(["acme/tracker#9"]));
        expect(result.code).toBe(1);
        expect(JSON.parse(result.out).missing).toEqual(["acme/tracker#10"]);
        expect(result.err).toContain("acme/tracker#10");
    });

    it("exits 1 when the feature cannot be read, never reporting complete", async () => {
        const result = await call(["check-related", "--feature", "#5", "--issues", "9"], repoWith(settings), relatedGh(null));
        expect(result.code).toBe(1);
    });

    it("with --filed, passes once the feature issue this run filed reads closed", async () => {
        const result = await call(["check-related", "--feature", "#5", "--issues", "9", "--filed"], repoWith(settings), relatedGh(["acme/tracker#9"], "closed"));
        expect(result.code).toBe(0);
        expect(JSON.parse(result.out)).toMatchObject({ missing: [], state: "closed" });
    });

    it("with --filed, reports the run incomplete when the feature issue this run filed is still open", async () => {
        const result = await call(["check-related", "--feature", "#5", "--issues", "9", "--filed"], repoWith(settings), relatedGh(["acme/tracker#9"], "open"));
        expect(result.code).toBe(1);
        expect(JSON.parse(result.out)).toMatchObject({ state: "open" });
        expect(result.err).toContain("open");
    });

    it("without --filed, never reads the feature issue's state", async () => {
        const result = await call(["check-related", "--feature", "#5", "--issues", "9"], repoWith(settings), relatedGh(["acme/tracker#9"], "open"));
        expect(result.code).toBe(0);
        expect(JSON.parse(result.out)).toEqual({ feature: "acme/tracker#5", missing: [] });
    });
});

describe("nexus feature-issue migrate", () => {
    it("rejects any flag but --apply with a usage error", async () => {
        const gh = fakeGh([]);
        expect((await call(["migrate", "--force"], repoWith(OPTED_IN), gh.run)).code).toBe(2);
    });

    it("refuses in a repository that has not opted in, reading nothing (G22)", async () => {
        const gh = fakeGh([]);
        const result = await call(["migrate"], repoWith("  classification: labels\n"), gh.run);
        expect(result.code).toBe(1);
        expect(result.out).toContain("github.features");
        expect(gh.calls).toEqual([]);
    });

    it("in legacy-auto mode lists epics marked only by issue type as well as by label (issue-kind invariant 2)", async () => {
        const typed: RestIssue = { number: 50, state: "open", body: "E\n\n<!-- nexus:epic-meta\nfeature_path: " + FEATURE_PATH + "\n-->\n", labels: [], type: { name: "Epic" } };
        const labelled: RestIssue = { number: 51, state: "open", body: "E\n\n<!-- nexus:epic-meta\nfeature_path: " + FEATURE_PATH + "\n-->\n", labels: [{ name: "epic" }], type: { name: "Epic" } };
        const all: RestIssue[] = [restIssue(42, FEATURE_PATH), typed, labelled];
        const run: Runner = (_cmd, args) => {
            const endpoint: string = args.find((a) => a.startsWith("repos/")) ?? "";
            const type: RegExpExecArray | null = /[?&]type=([^&]+)/.exec(endpoint);
            const label: RegExpExecArray | null = /[?&]labels=([^&]+)/.exec(endpoint);
            const hits: RestIssue[] = all.filter((i) =>
                (type === null || i.type?.name === decodeURIComponent(type[1])) && (label === null || i.labels.some((l) => l.name === decodeURIComponent(label[1]))));
            return { status: 0, stdout: JSON.stringify(endpoint.includes("?") ? hits : all), stderr: "" };
        };
        const result = await call(["migrate"], repoWith("  classification: legacy-auto\n  epic-type: Epic\n  features: labels\n", true), run);
        expect(result.out).toMatch(/#50: update/);
        expect(result.out.match(/#51: update/g)?.length).toBe(1);
    });

    it("prints the plan and exits 0 when every feature folder already has its feature issue (G5)", async () => {
        const gh = fakeGh([restIssue(42, FEATURE_PATH)]);
        const result = await call(["migrate"], repoWith(OPTED_IN, true), gh.run);
        expect(result.out).toContain("#42");
        expect(result.code).toBe(0);
    });
});
