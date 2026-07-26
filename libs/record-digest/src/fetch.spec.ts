import { describe, expect, it } from "vitest";
import { recordDigest } from "./digest.js";
import { fetchRecord } from "./fetch.js";
import { type RunResult, type Runner } from "./run.js";

const BODY = "# Decision Record\n\nWe chose A over B.\n";

function ghRunner(
    issue: Record<string, unknown>,
    opts: { status?: number; stderr?: string; stdout?: string } = {},
): { run: Runner; calls: string[][] } {
    const calls: string[][] = [];
    const run: Runner = (cmd: string, args: string[]): RunResult => {
        calls.push([cmd, ...args]);
        if (opts.status !== undefined && opts.status !== 0) {
            return { status: opts.status, stdout: "", stderr: opts.stderr ?? "" };
        }
        return { status: 0, stdout: opts.stdout ?? JSON.stringify(issue), stderr: "" };
    };
    return { run, calls };
}

describe("fetchRecord — the digest is taken over the body as GitHub returns it", () => {
    it("hashes the fetched body and reports it as approved when the record is closed", () => {
        const { run, calls } = ghRunner({ body: BODY, state: "closed", state_reason: "completed" });
        const r = fetchRecord(run, "/repo", 141);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record.digest).toBe(recordDigest(BODY));
        expect(r.record.state).toBe("closed");
        expect(r.record.approved).toBe(true);
        expect(calls[0].join(" ")).toContain("repos/{owner}/{repo}/issues/141");
    });

    it("reads an open record as unapproved", () => {
        const { run } = ghRunner({ body: BODY, state: "open", state_reason: null });
        const r = fetchRecord(run, "/repo", 141);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record.approved).toBe(false);
        expect(r.record.stateReason).toBeNull();
    });

    it("reads a not-planned closure as unapproved — a withdrawn design is not an approval", () => {
        const { run } = ghRunner({ body: BODY, state: "closed", state_reason: "not_planned" });
        const r = fetchRecord(run, "/repo", 141);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record.state).toBe("closed");
        expect(r.record.stateReason).toBe("not_planned");
        expect(r.record.approved).toBe(false);
    });

    it("targets another repository when one is given", () => {
        const { run, calls } = ghRunner({ body: BODY, state: "closed" });
        const r = fetchRecord(run, "/repo", 141, "acme/hub");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record.repo).toBe("acme/hub");
        expect(calls[0].join(" ")).toContain("repos/acme/hub/issues/141");
    });

    it("hashes an empty body rather than treating it as a fetch failure", () => {
        const { run } = ghRunner({ state: "open" });
        const r = fetchRecord(run, "/repo", 141);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record.digest).toBe(recordDigest(""));
    });

    it("names a missing record issue", () => {
        const { run } = ghRunner({}, { status: 1, stderr: "gh: Not Found (HTTP 404)" });
        const r = fetchRecord(run, "/repo", 999);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("issue-not-found");
    });

    it("names a generic gh failure", () => {
        const { run } = ghRunner({}, { status: 1, stderr: "API rate limit exceeded" });
        const r = fetchRecord(run, "/repo", 141);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });

    it("names unparseable output rather than hashing it", () => {
        const { run } = ghRunner({}, { stdout: "not json" });
        const r = fetchRecord(run, "/repo", 141);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-json");
    });

    it("rejects well-formed JSON that is not an issue object", () => {
        for (const stdout of ["[]", "null"]) {
            const { run } = ghRunner({}, { stdout });
            const r = fetchRecord(run, "/repo", 141);
            expect(r.ok).toBe(false);
            if (r.ok) return;
            expect(r.error.problem).toBe("malformed-json");
        }
    });

    it("reads a response with no state field as an open, unapproved record", () => {
        const { run } = ghRunner({ body: BODY });
        const r = fetchRecord(run, "/repo", 141);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record.state).toBe("open");
        expect(r.record.approved).toBe(false);
    });
});
