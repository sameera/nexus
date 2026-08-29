/**
 * Story #378 — a bad invocation costs an error message, never a write.
 *
 * Everything here is about what happens *before* the first remote call, so the assertion that
 * matters most in each case is the same one: the platform client was never reached.
 */

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { FAIL, checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { parseEpicArgs } from "./args";
import { runCreateEpic } from "./run";

describe("the flags the capability accepts", () => {
    it("accepts every flag it accepts today, with the same spelling and meaning", () => {
        const parsed = parseEpicArgs([
            "epic.md",
            "--root",
            "/repo",
            "-y",
            "--project",
            "acme/1",
            "--no-project",
            "--promote",
            "42",
        ]);
        expect(parsed).toEqual({
            kind: "ok",
            args: {
                draft: "epic.md",
                root: "/repo",
                yes: true,
                project: "acme/1",
                noProject: true,
                promote: "42",
            },
        });
    });

    it("reads --yes under its long spelling too", () => {
        expect(parseEpicArgs(["epic.md", "--yes"])).toMatchObject({ kind: "ok", args: { yes: true } });
    });

    it("refuses an unrecognised flag", () => {
        expect(parseEpicArgs(["epic.md", "--nope"])).toEqual({
            kind: "error",
            message: "unrecognized argument '--nope'",
        });
    });

    it("requires the draft, and refuses a second positional", () => {
        expect(parseEpicArgs([])).toMatchObject({ kind: "error" });
        expect(parseEpicArgs(["a.md", "b.md"])).toEqual({ kind: "error", message: "unexpected argument 'b.md'" });
    });

    it("refuses a flag given no value", () => {
        expect(parseEpicArgs(["epic.md", "--root"])).toEqual({ kind: "error", message: "--root expects a value" });
    });
});

describe("the run refuses before it reaches GitHub", () => {
    it("exits non-zero for a draft that does not resolve to a file, making no remote call", () => {
        const root: string = checkoutWith({});
        const fake = fakeEnvironment();
        const io = recordingIo(root);
        expect(runCreateEpic([path.join(root, "absent.md")], io, fake.env)).toBe(1);
        expect(io.all()).toContain("Epic file not found");
        expect(fake.calls).toEqual([]);
    });

    it("refuses a bad invocation with a non-zero exit and no remote call", () => {
        const fake = fakeEnvironment();
        const io = recordingIo("/tmp");
        expect(runCreateEpic(["epic.md", "--nope"], io, fake.env)).not.toBe(0);
        expect(fake.calls).toEqual([]);
    });

    it("refuses a draft that resolves outside the target root, naming both paths and --root", () => {
        const root: string = checkoutWith({});
        const elsewhere: string = checkoutWith({});
        const file: string = writeDraft(elsewhere, draft());
        const fake = fakeEnvironment();
        const io = recordingIo(root);
        expect(runCreateEpic([file, "--root", root], io, fake.env)).toBe(1);
        const said: string = io.all();
        expect(said).toContain(file);
        expect(said).toContain(root);
        expect(said).toContain("--root");
        expect(fake.calls).toEqual([]);
    });

    it("resolves the target root from the working directory, never from the draft's own location", () => {
        const root: string = checkoutWith({});
        const elsewhere: string = checkoutWith({});
        const file: string = writeDraft(elsewhere, draft());
        const fake = fakeEnvironment();
        // The draft sits inside its own checkout, but the run was invoked from another one.
        expect(runCreateEpic([file], recordingIo(root), fake.env)).toBe(1);
    });

    it("runs every platform and version-control command with the target root as its directory", () => {
        const root: string = checkoutWith({});
        const file: string = writeDraft(root, draft());
        const fake = fakeEnvironment();
        expect(runCreateEpic([file], recordingIo(root), fake.env)).toBe(0);
        expect(new Set(fake.roots)).toEqual(new Set([root]));
    });
});

describe("the three prerequisite failures are told apart", () => {
    const cases: [string, Parameters<typeof fakeEnvironment>[0], string][] = [
        ["an absent platform client", { hasGh: false }, "GitHub CLI (gh) is not installed"],
        [
            "an unauthenticated one",
            { answer: (args: string[]) => (args[0] === "auth" ? FAIL("gh auth") : undefined) },
            "Not authenticated with GitHub CLI",
        ],
        ["a directory that is not a repository", { isRepo: false }, "Not in a git repository"],
    ];

    for (const [name, options, message] of cases) {
        it(`reports ${name} distinctly and exits non-zero`, () => {
            const root: string = checkoutWith({});
            const file: string = writeDraft(root, draft());
            const fake = fakeEnvironment(options);
            const io = recordingIo(root);
            expect(runCreateEpic([file], io, fake.env)).toBe(1);
            expect(io.err.join("\n")).toContain(message);
        });
    }
});
