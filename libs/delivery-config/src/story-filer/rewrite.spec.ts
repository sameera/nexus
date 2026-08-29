/**
 * Story #372 — a prose reference to a sibling becomes a clickable issue number.
 *
 * The matching boundaries are the part that will actually break a batch, so they are asserted at
 * the unit the author sees: a body in, a body out.
 */

import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { OK, FAIL, checkoutWith, fakePlatform, recordingIo, scratch, story, writeItem } from "./fixtures";
import { rewriteStoryRefs } from "./rewrite";
import { runCreateStory } from "./run";

const REPO = "acme/tracker";
const NUMBERS = new Map([
    ["353.01", "100"],
    ["353.02", "101"],
]);

function rewrite(body: string): [string, string[]] {
    return rewriteStoryRefs(body, NUMBERS);
}

describe("rewriting a ref in prose", () => {
    it("replaces a bare ref with the issue number it resolves to", () => {
        expect(rewrite("Blocked by STORY-353.01 for now.")[0]).toBe("Blocked by #100 for now.");
    });

    it("drops the backticks around a code-spanned ref, so the number renders as a link", () => {
        expect(rewrite("Blocked by `STORY-353.01`.")[0]).toBe("Blocked by #100.");
    });

    it("leaves trailing punctuation outside the replacement", () => {
        expect(rewrite("See STORY-353.01.")[0]).toBe("See #100.");
        expect(rewrite("See STORY-353.01, then STORY-353.02;")[0]).toBe("See #100, then #101;");
    });

    it("never matches a bare <epic>.<seq> with no STORY- prefix", () => {
        expect(rewrite("Version 353.01 shipped.")[0]).toBe("Version 353.01 shipped.");
    });

    it("resolves a ref written in any letter case the same as the canonical casing", () => {
        expect(rewrite("see story-353.01 and Story-353.02")[0]).toBe("see #100 and #101");
    });

    it("leaves an unresolvable ref verbatim and reports it", () => {
        const [body, unresolved] = rewrite("Blocked by STORY-999.99.");
        expect(body).toBe("Blocked by STORY-999.99.");
        expect(unresolved).toEqual(["STORY-999.99"]);
    });

    it("changes nothing in a body that carries no refs", () => {
        expect(rewrite("Nothing to see here.")).toEqual(["Nothing to see here.", []]);
    });
});

/** The issue number in a `gh issue …` vector, wherever the repo flag pushed it. */
function issueNumber(args: string[]): string {
    return args.slice(2).find((arg) => /^\d+$/.test(arg)) ?? "";
}

/** A platform minting issues, serving each one the body it was created with. */
function platform(bodies: Record<string, string> = {}, options: { readFails?: boolean } = {}) {
    let next = 100;
    const stored: Record<string, string> = { ...bodies };
    const written: Record<string, string> = {};
    const gh = fakePlatform((args: string[]): RunResult | undefined => {
        if (args[0] === "issue" && args[1] === "create") {
            const number = String(next++);
            stored[number] = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
            return OK(`https://github.com/${REPO}/issues/${number}\n`);
        }
        if (args[0] === "issue" && args[1] === "view" && args.includes("body")) {
            if (options.readFails) return FAIL("HTTP 404: Not Found");
            return OK(stored[issueNumber(args)] ?? "");
        }
        if (args[0] === "issue" && args[1] === "edit") {
            written[issueNumber(args)] = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
            return OK("");
        }
        if (args[0] === "issue" && args[1] === "view") return OK("I_node\n");
        if (args[0] === "api" && args[3] === ".id") return OK(`900${/issues\/(\d+)/.exec(args[1])?.[1]}\n`);
        return undefined;
    });
    return { ...gh, stored, written };
}

function repo(): string {
    return checkoutWith({ classification: "labels", "story-repo": REPO, project: "none" });
}

describe("pass 3 over a filed batch", () => {
    it("rewrites a story body that names a sibling created later in the same batch", () => {
        const root: string = repo();
        writeItem(root, "STORY-353.01.md", story("353.01", {}, "Follows `STORY-353.02`.\n"));
        writeItem(root, "STORY-353.02.md", story("353.02", {}, "Nothing here.\n"));
        const io = recordingIo(root);
        const gh = platform();
        runCreateStory([scratch(root)], io, gh.env);
        expect(gh.written["100"]).toBe("Follows #101.");
        expect(io.out.join("\n")).toContain("#100 body refs rewritten");
    });

    it("rewrites the parent epic's own body alongside the story bodies", () => {
        const root: string = repo();
        writeItem(root, "STORY-353.01.md", story("353.01", { parent: '"#353"' }, "A story.\n"));
        const gh = platform({ "353": "The epic sequences STORY-353.01 first." });
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(gh.written["353"]).toBe("The epic sequences #100 first.");
    });

    it("leaves an unresolvable ref in place, reporting it against the issue that carries it", () => {
        const root: string = repo();
        writeItem(root, "STORY-353.01.md", story("353.01", {}, "Blocked by STORY-999.99.\n"));
        const io = recordingIo(root);
        const gh = platform();
        runCreateStory([scratch(root)], io, gh.env);
        expect(gh.written["100"]).toBeUndefined();
        expect(io.err.join("\n")).toContain("body ref 'STORY-999.99' in #100 not among created issues");
    });

    it("reads the body back from the platform and writes nothing when it needs no change", () => {
        const root: string = repo();
        writeItem(root, "STORY-353.01.md", story("353.01", {}, "Follows STORY-353.02.\n"));
        writeItem(root, "STORY-353.02.md", story("353.02", {}, "Nothing here.\n"));
        const first = platform();
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), first.env);
        // The rewritten body is what the platform now serves, as it would after a person edited it.
        const again = platform({ "100": first.written["100"], "101": first.stored["101"] });
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), again.env);
        expect(again.written).toEqual({});
    });

    it("never pushes the local file over a body it could not read", () => {
        const root: string = repo();
        writeItem(root, "STORY-353.01.md", story("353.01", {}, "Follows STORY-353.02.\n"));
        writeItem(root, "STORY-353.02.md", story("353.02"));
        const io = recordingIo(root);
        const gh = platform({}, { readFails: true });
        runCreateStory([scratch(root)], io, gh.env);
        expect(gh.written).toEqual({});
        expect(io.err.join("\n")).toContain("Error reading body of #100");
    });
});
