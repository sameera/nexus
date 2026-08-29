/**
 * The platform calls the filer makes, each as its own argument vector (story #369).
 *
 * Every value travels as an element of a vector and is never interpolated into a shell string
 * (Invariant 11). Nothing here raises: a failure is reported to the caller, which is what lets the
 * run decide whether it is fatal — an issue that already exists is never abandoned over its
 * decoration (Invariant 8).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type ToolkitIo } from "../io.js";
import { GhError, type RetryingRunner } from "./retry.js";

/** The gh-api path for an issue, using gh's own placeholders when the run targets the current repo. */
export function issueApiPath(issueNumber: string, repo: string | null): string {
    return `${repo !== null ? `repos/${repo}` : "repos/{owner}/{repo}"}/issues/${issueNumber}`;
}

/** Write `text` to a scratch file, hand its path to `use`, and remove it however `use` ends. */
function withBodyFile<T>(text: string, use: (file: string) => T): T {
    const file: string = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nxs-body-")), "body.md");
    fs.writeFileSync(file, text, "utf8");
    try {
        return use(file);
    } finally {
        fs.rmSync(path.dirname(file), { recursive: true, force: true });
    }
}

/** The issue number at the end of an issue URL. */
export function extractIssueNumber(issueUrl: string): string | null {
    return /\/issues\/(\d+)$/.exec(issueUrl.trim())?.[1] ?? null;
}

export class Platform {
    constructor(
        private readonly gh: RetryingRunner,
        private readonly repo: string | null,
        private readonly io: ToolkitIo,
    ) {}

    /** Create one issue. Returns its URL, or null when the create failed. */
    createIssue(title: string, labels: string[], body: string): string | null {
        return withBodyFile(body, (file: string): string | null => {
            const args: string[] = ["issue", "create", "--title", title, "--body-file", file];
            for (const label of labels) args.push("--label", label);
            if (this.repo !== null) args.push("-R", this.repo);
            try {
                return this.gh(args).stdout.trim();
            } catch (error) {
                this.io.stderr(`Error creating issue: ${asGhError(error).stderr}`);
                return null;
            }
        });
    }

    /** An issue's GraphQL node id — distinct from its number and from its database id. */
    issueNodeId(issueRef: string): string | null {
        const number: string = issueNumberOf(issueRef);
        const args: string[] =
            this.repo !== null
                ? ["issue", "view", number, "-R", this.repo, "--json", "id", "--jq", ".id"]
                : ["issue", "view", number, "--json", "id", "--jq", ".id"];
        try {
            return this.gh(args).stdout.trim();
        } catch (error) {
            this.io.stderr(`Error getting issue ID for ${issueRef}: ${asGhError(error).stderr}`);
            return null;
        }
    }

    /** An issue's REST database id — what the dependencies API takes. */
    issueDbId(issueNumber: string): string | null {
        try {
            return this.gh(["api", issueApiPath(issueNumber, this.repo), "-q", ".id"]).stdout.trim();
        } catch (error) {
            this.io.stderr(`Error getting database id for #${issueNumber}: ${asGhError(error).stderr}`);
            return null;
        }
    }

    /** Link `child` as a sub-issue of `parent`. An already-linked pair is success, not failure. */
    assignParent(child: string, parent: string): boolean {
        const parentId: string | null = this.issueNodeId(parent);
        const childId: string | null = this.issueNodeId(child);
        if (parentId === null || childId === null || parentId === "" || childId === "") {
            this.io.stderr(`Error: Could not resolve issue IDs (parent=${parentId}, child=${childId})`);
            return false;
        }
        const mutation = `
    mutation {
        addSubIssue(input: {
            issueId: "${parentId}",
            subIssueId: "${childId}"
        }) {
            issue { title }
            subIssue { title }
        }
    }
    `;
        try {
            this.gh(["api", "graphql", "-H", "GraphQL-Features: sub_issues", "-f", `query=${mutation}`]);
            return true;
        } catch (error) {
            const failure: GhError = asGhError(error);
            if (failure.stderr.toLowerCase().includes("already")) return true;
            this.io.stderr(`Error creating sub-issue relationship: ${failure.stderr}`);
            return false;
        }
    }

    /** Add an existing issue to a project board. */
    addToProject(projectId: string, issueNodeId: string): boolean {
        const mutation = `
    mutation {
        addProjectV2ItemById(input: {
            projectId: "${projectId}",
            contentId: "${issueNodeId}"
        }) {
            item {
                id
            }
        }
    }
    `;
        try {
            this.gh(["api", "graphql", "-f", `query=${mutation}`]);
            return true;
        } catch (error) {
            this.io.stderr(`Error adding issue to project: ${asGhError(error).stderr}`);
            return false;
        }
    }

    /**
     * An issue's body as it currently stands on GitHub.
     *
     * Read back rather than reused from the local file: on a resumed run the issue may have been
     * created hours earlier and edited by a person since, and pushing the local body would silently
     * revert those edits (Invariant 7).
     */
    issueBody(issueNumber: string): string | null {
        const number: string = issueNumberOf(issueNumber);
        const args: string[] = ["issue", "view", number, "--json", "body", "--jq", ".body"];
        if (this.repo !== null) args.splice(2, 0, "-R", this.repo);
        try {
            return this.gh(args).stdout;
        } catch (error) {
            this.io.stderr(`Error reading body of #${issueNumber}: ${asGhError(error).stderr}`);
            return null;
        }
    }

    /** Overwrite an issue's body, written through a file so no quoting can corrupt it. */
    setIssueBody(issueNumber: string, body: string): boolean {
        return withBodyFile(body, (file: string): boolean => {
            const args: string[] = ["issue", "edit", issueNumberOf(issueNumber), "--body-file", file];
            if (this.repo !== null) args.push("-R", this.repo);
            try {
                this.gh(args);
                return true;
            } catch (error) {
                this.io.stderr(`Error rewriting body of #${issueNumber}: ${asGhError(error).stderr}`);
                return false;
            }
        });
    }

    /** The database ids an issue is already blocked by, or null when the set cannot be read. */
    blockedByDbIds(dependent: string): Set<string> | null {
        try {
            const result = this.gh(["api", `${issueApiPath(dependent, this.repo)}/dependencies/blocked_by`, "-q", ".[].id"]);
            return new Set(
                result.stdout
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line !== ""),
            );
        } catch (error) {
            this.io.stderr(
                `Warning: could not read existing blocked_by for #${dependent}: ${asGhError(error).stderr}`,
            );
            return null;
        }
    }

    /** Mark `dependent` blocked by the issue with database id `blockerDbId`. */
    addBlockedBy(dependent: string, blockerDbId: string): boolean {
        const args: string[] = [
            "api",
            "--method",
            "POST",
            `${issueApiPath(dependent, this.repo)}/dependencies/blocked_by`,
            "-F",
            `issue_id=${blockerDbId}`,
        ];
        try {
            this.gh(args);
            return true;
        } catch (error) {
            const failure: GhError = asGhError(error);
            // Idempotent on resume: an already-recorded dependency is success, not failure.
            if (failure.stderr.toLowerCase().includes("already")) return true;
            this.io.stderr(
                `Error adding blocked_by for #${dependent} (blocker id ${blockerDbId}): ${failure.stderr}`,
            );
            return false;
        }
    }
}

/** The issue number in a `#n`, a bare number, or an issue URL. */
export function issueNumberOf(issueRef: string): string {
    const reference: string = issueRef.trim();
    if (reference.startsWith("#")) return reference.slice(1);
    return /\/issues\/(\d+)/.exec(reference)?.[1] ?? reference;
}

/** Every throw on these paths is a `GhError`; anything else is surfaced with its own text. */
function asGhError(error: unknown): GhError {
    return error instanceof GhError ? error : new GhError([], 1, String(error), 1);
}
