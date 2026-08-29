/**
 * The platform calls the filer makes, each as its own argument vector (story #369).
 *
 * Every value travels as an element of a vector and is never interpolated into a shell string
 * (Invariant 11). Nothing here raises and nothing here prints: each call *returns* its outcome,
 * failure text included, and the caller renders its own line. That is what lets two filers with
 * two different output vocabularies share one call layer — a layer that printed would silently
 * rewrite the epic filer's wording and move some of its lines to another stream (#387).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { GhError, type RetryingRunner } from "./retry.js";

/**
 * What a platform call produced, or why it did not.
 *
 * A failure carries its text rather than printing it, because the caller — not this layer — knows
 * which vocabulary, which stream and which surrounding context the line belongs in.
 */
export interface Outcome<T> {
    value: T | null;
    error: string | null;
}

const succeeded = <T>(value: T): Outcome<T> => ({ value, error: null });
const failed = <T>(error: string): Outcome<T> => ({ value: null, error });

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
    ) {}

    /** Create one issue. Returns its URL, or the failure text when the create failed. */
    createIssue(title: string, labels: string[], body: string): Outcome<string> {
        return withBodyFile(body, (file: string): Outcome<string> => {
            const args: string[] = ["issue", "create", "--title", title, "--body-file", file];
            for (const label of labels) args.push("--label", label);
            if (this.repo !== null) args.push("-R", this.repo);
            try {
                return succeeded(this.gh(args).stdout.trim());
            } catch (error) {
                return failed(asGhError(error).stderr);
            }
        });
    }

    /** An issue's GraphQL node id — distinct from its number and from its database id. */
    issueNodeId(issueRef: string): Outcome<string> {
        const number: string = issueNumberOf(issueRef);
        const args: string[] =
            this.repo !== null
                ? ["issue", "view", number, "-R", this.repo, "--json", "id", "--jq", ".id"]
                : ["issue", "view", number, "--json", "id", "--jq", ".id"];
        try {
            return succeeded(this.gh(args).stdout.trim());
        } catch (error) {
            return failed(asGhError(error).stderr);
        }
    }

    /** An issue's REST database id — what the dependencies API takes. */
    issueDbId(issueNumber: string): Outcome<string> {
        try {
            return succeeded(this.gh(["api", issueApiPath(issueNumber, this.repo), "-q", ".id"]).stdout.trim());
        } catch (error) {
            return failed(asGhError(error).stderr);
        }
    }

    /** Link `child` as a sub-issue of `parent`. An already-linked pair is success, not failure. */
    assignParent(child: string, parent: string): Outcome<true> {
        const parentId: string | null = this.issueNodeId(parent).value;
        const childId: string | null = this.issueNodeId(child).value;
        if (parentId === null || childId === null || parentId === "" || childId === "") {
            return failed(`Could not resolve issue IDs (parent=${parentId}, child=${childId})`);
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
            return succeeded(true);
        } catch (error) {
            const failure: GhError = asGhError(error);
            if (failure.stderr.toLowerCase().includes("already")) return succeeded(true);
            return failed(failure.stderr);
        }
    }

    /** Add an existing issue to a project board. */
    addToProject(projectId: string, issueNodeId: string): Outcome<true> {
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
            return succeeded(true);
        } catch (error) {
            return failed(asGhError(error).stderr);
        }
    }

    /**
     * An issue's body as it currently stands on GitHub.
     *
     * Read back rather than reused from the local file: on a resumed run the issue may have been
     * created hours earlier and edited by a person since, and pushing the local body would silently
     * revert those edits (Invariant 7).
     */
    issueBody(issueNumber: string): Outcome<string> {
        const number: string = issueNumberOf(issueNumber);
        const args: string[] = ["issue", "view", number, "--json", "body", "--jq", ".body"];
        if (this.repo !== null) args.splice(2, 0, "-R", this.repo);
        try {
            return succeeded(this.gh(args).stdout);
        } catch (error) {
            return failed(asGhError(error).stderr);
        }
    }

    /** Overwrite an issue's body, written through a file so no quoting can corrupt it. */
    setIssueBody(issueNumber: string, body: string): Outcome<true> {
        return withBodyFile(body, (file: string): Outcome<true> => {
            const args: string[] = ["issue", "edit", issueNumberOf(issueNumber), "--body-file", file];
            if (this.repo !== null) args.push("-R", this.repo);
            try {
                this.gh(args);
                return succeeded(true);
            } catch (error) {
                return failed(asGhError(error).stderr);
            }
        });
    }

    /** The database ids an issue is already blocked by, or null when the set cannot be read. */
    blockedByDbIds(dependent: string): Outcome<Set<string>> {
        try {
            const result = this.gh(["api", `${issueApiPath(dependent, this.repo)}/dependencies/blocked_by`, "-q", ".[].id"]);
            return succeeded(
                new Set(
                    result.stdout
                        .split("\n")
                        .map((line) => line.trim())
                        .filter((line) => line !== ""),
                ),
            );
        } catch (error) {
            return failed(asGhError(error).stderr);
        }
    }

    /** Mark `dependent` blocked by the issue with database id `blockerDbId`. */
    addBlockedBy(dependent: string, blockerDbId: string): Outcome<true> {
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
            return succeeded(true);
        } catch (error) {
            const failure: GhError = asGhError(error);
            // Idempotent on resume: an already-recorded dependency is success, not failure.
            if (failure.stderr.toLowerCase().includes("already")) return succeeded(true);
            return failed(failure.stderr);
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
