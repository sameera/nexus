/**
 * The platform calls this capability makes that the story filer's layer does not already make
 * (stories #380 to #383).
 *
 * The shared call layer supplies issue creation, the node-id lookup and project membership, and is
 * reached through a runner that throws on failure — the shape it is written against — with no retry
 * decoration, because the epic filer has never retried anything and which calls retry is observable
 * as latency. Everything here returns its outcome; the run renders every line it prints.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type GhRunner, type RunResult } from "../gh.js";
import { GhError, type RetryingRunner } from "../story-filer/retry.js";

/** The shared layer's contract: succeed, or throw. Reused untouched, one attempt per call. */
export function throwingRunner(run: GhRunner): RetryingRunner {
    return (args: string[]): RunResult => {
        const result: RunResult = run(args);
        if (result.status !== 0) throw new GhError(args, result.status, result.stderr, 1);
        return result;
    };
}

/** The calls that belong to filing an epic rather than a story. */
export class EpicPlatform {
    constructor(
        private readonly run: GhRunner,
        private readonly repo: string | null,
    ) {}

    private targeted(args: string[]): string[] {
        return this.repo !== null ? [...args, "-R", this.repo] : args;
    }

    /**
     * The labels currently on an issue, or null when the number does not resolve at all.
     *
     * Null and an empty list are deliberately different answers: an unresolvable number is a bad
     * input, while a resolvable issue carrying no labels is an already-planned epic. Both refuse a
     * promotion, for reasons the lead needs told apart (Invariant 10).
     */
    issueLabels(issueNumber: string): string[] | null {
        const result: RunResult = this.run(
            this.targeted(["issue", "view", issueNumber, "--json", "number,title,labels"]),
        );
        if (result.status !== 0) return null;
        try {
            const data = JSON.parse(result.stdout) as { labels?: { name?: string }[] };
            return (data.labels ?? []).map((label) => label.name ?? "");
        } catch {
            return null;
        }
    }

    /**
     * Populate an existing unplanned epic issue in place, and report where it now lives.
     *
     * Nothing is created and nothing is closed, so the number the scope was deferred under is the
     * number it ships under. When the edit returns no usable address, one is constructed from the
     * target repository and the number rather than reporting none.
     */
    populateIssue(
        issueNumber: string,
        title: string,
        body: string,
        removeLabel: string,
        addLabel: string | null,
    ): { url: string | null; error: string | null } {
        const scratch: string = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nxs-epic-")), "body.md");
        fs.writeFileSync(scratch, body, "utf8");
        try {
            const args: string[] = [
                "issue", "edit", issueNumber,
                "--title", title,
                "--body-file", scratch,
                "--remove-label", removeLabel,
            ];
            if (addLabel !== null) args.push("--add-label", addLabel);
            const result: RunResult = this.run(this.targeted(args));
            if (result.status !== 0) return { url: null, error: result.stderr };
            const reported: string = result.stdout.trim();
            if (reported.startsWith("http")) return { url: reported, error: null };
            return { url: `https://github.com/${this.repo ?? "the repository"}/issues/${issueNumber}`, error: null };
        } finally {
            fs.rmSync(path.dirname(scratch), { recursive: true, force: true });
        }
    }

    /** Add one label to an issue that already exists. */
    addLabel(issueNumber: string, label: string): boolean {
        return this.run(this.targeted(["issue", "edit", issueNumber, "--add-label", label])).status === 0;
    }
}
