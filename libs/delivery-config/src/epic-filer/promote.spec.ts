/**
 * Story #382 — a backlog stub is promoted in place, keeping its number.
 *
 * These are `test_stub_promotion`'s cases, carried across one for one and driven through the
 * handler with the platform client faked, asserting on the argument vectors it was handed. A stub
 * is an epic born unplanned, so promoting it is not a create-and-close hop: the epic body, the
 * meta block and the classification land on the issue that already exists.
 */

import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FAIL, OK, checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { runCreateEpic } from "./run";

/** The stub as GitHub reports it: number 42, titled, carrying `labels`. */
function stub(labels: string[], missing = false) {
    return (args: string[]) => {
        if (args[0] === "issue" && args[1] === "view" && args.includes("number,title,labels")) {
            if (missing) return FAIL("GraphQL: Could not resolve to an Issue");
            return OK(JSON.stringify({ number: 42, title: "A deferred goal", labels: labels.map((name) => ({ name })) }));
        }
        return undefined;
    };
}

function promote(options: { labels?: string[]; missing?: boolean; complexity?: string; unplanned?: string } = {}) {
    const github: Record<string, string> = { classification: "labels", project: "none" };
    if (options.unplanned !== undefined) github["unplanned-label"] = options.unplanned;
    const root: string = checkoutWith(github);
    const file: string = writeDraft(root, draft({ epic: '"The Promoted Epic"', complexity: options.complexity ?? "S" }));
    const fake = fakeEnvironment({ answer: stub(options.labels ?? ["backlog"], options.missing) });
    const io = recordingIo(root);
    const code: number = runCreateEpic([file, "--promote", "42"], io, fake.env);
    return { code, io, calls: fake.calls.map((call) => call.join(" ")), read: () => fs.readFileSync(file, "utf8") };
}

describe("promotion populates the issue that already exists", () => {
    it("edits the stub and creates no second issue", () => {
        const run = promote();
        expect(run.code).toBe(0);
        expect(run.calls.filter((call) => call.startsWith("issue create"))).toEqual([]);
        expect(run.calls.some((call) => call.startsWith("issue edit 42") && call.includes("--body-file"))).toBe(true);
        expect(run.calls.some((call) => call.includes("--title The Promoted Epic"))).toBe(true);
    });

    it("removes the unplanned label", () => {
        expect(promote().calls.some((call) => call.includes("--remove-label backlog"))).toBe(true);
    });

    it("removes the label the repository declared, when it declares its own", () => {
        const run = promote({ unplanned: "icebox", labels: ["icebox"] });
        expect(run.calls.some((call) => call.includes("--remove-label icebox"))).toBe(true);
    });

    it("never closes the stub", () => {
        expect(promote().calls.filter((call) => call.startsWith("issue close"))).toEqual([]);
    });

    it("links the draft to the issue that already existed", () => {
        expect(promote().read()).toContain('link: "#42"');
    });

    it("reports that the number was kept, with nothing created and nothing closed", () => {
        const said: string = promote().io.all();
        expect(said).toContain("Unplanned Epic Promoted");
        expect(said).toContain("#42 kept — no second issue, nothing closed");
    });

    it("reports an address built from the repository when the edit returns none", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none", "epic-repo": "acme/epics" });
        const file: string = writeDraft(root, draft());
        const answers = stub(["backlog"]);
        const fake = fakeEnvironment({
            answer: (args: string[]) =>
                args[0] === "issue" && args[1] === "edit" ? OK("done\n") : answers(args),
        });
        const io = recordingIo(root);
        expect(runCreateEpic([file, "--promote", "42"], io, fake.env)).toBe(0);
        expect(io.all()).toContain("https://github.com/acme/epics/issues/42");
    });
});

describe("promotion is refused before any write", () => {
    it("refuses an already-planned epic, naming the command form that loads one", () => {
        const run = promote({ labels: ["epic"] });
        expect(run.code).not.toBe(0);
        expect(run.io.all()).toContain("--from");
        expect(run.calls.filter((call) => call.startsWith("issue create"))).toEqual([]);
        expect(run.calls.filter((call) => call.startsWith("issue edit"))).toEqual([]);
    });

    it("refuses an unresolvable number differently, writing nothing", () => {
        const run = promote({ missing: true });
        expect(run.code).not.toBe(0);
        expect(run.io.all()).toContain("no such issue in the target repository");
        expect(run.io.all()).not.toContain("--from");
        expect(run.calls.filter((call) => call.startsWith("issue create"))).toEqual([]);
        expect(run.calls.filter((call) => call.startsWith("issue edit"))).toEqual([]);
        expect(run.read()).not.toContain("link:");
    });
});
