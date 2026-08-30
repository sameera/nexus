/**
 * Story #396 — the toolkit's capabilities become verbs on the one executable.
 *
 * The fold is additive: for the length of this story both names resolve the same handlers, so what
 * is asserted here is that every capability the toolkit declares is *also* reachable through the
 * executable, with the arguments, the output, the exit code and the failure signalling it had under
 * the toolkit name, and reporting the executable's program name in its own usage and error text.
 *
 * The exception is the toolkit's release-identity capability, which is deliberately not folded
 * (decision record #400): the executable's own `version` verb already reports everything it does
 * and more, so exactly one dispatch name reports release identity at this commit, not only after
 * the second name is withdrawn.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNexusGh } from "@nexus/delivery-config/dispatch";
import { CAPABILITY_NAMES } from "@nexus/delivery-config/registry";
import { type ToolkitIo } from "@nexus/delivery-config/io";
import { DISPATCH_NAMES, runNexusCli, VERB_NAMES, type CliIo } from "./nexus-cli";

let tmpDirs: string[] = [];

function makeTmpDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "fold-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

interface CapturedIo extends CliIo, ToolkitIo {
    out: string[];
    err: string[];
}

function makeIo(cwd: string): CapturedIo {
    const out: string[] = [];
    const err: string[] = [];
    return {
        cwd,
        out,
        err,
        stdout: (s: string): void => {
            out.push(s);
        },
        stderr: (s: string): void => {
            err.push(s);
        },
    };
}

/** The complete dispatch names the folded capabilities are reached by. */
const FOLDED: readonly string[] = [
    "config resolve",
    "config backlog-query",
    "config detect-classification",
    "config write-github",
    "create-epic",
    "create-story",
];

describe("the folded toolkit capabilities", () => {
    it("every capability the toolkit declared is a dispatch name on the executable", () => {
        expect(DISPATCH_NAMES).toEqual(expect.arrayContaining([...FOLDED]));
        expect(VERB_NAMES).toEqual(expect.arrayContaining(["config", "create-epic", "create-story"]));
    });

    it("the configuration resolver's own commands are declared as subverbs, not a third token", () => {
        for (const name of DISPATCH_NAMES) {
            expect(name.split(" ").length).toBeLessThanOrEqual(2);
        }
        expect(DISPATCH_NAMES).not.toContain("config");
    });

    it("exactly one dispatch name reports release identity", () => {
        expect(DISPATCH_NAMES.filter((name) => name === "version")).toEqual(["version"]);
        // The toolkit's narrower one is never folded: it is absent from the executable's surface
        // even though the second name still declares it during the overlap.
        expect(CAPABILITY_NAMES).toContain("version");
    });

    it("a folded capability resolves a key through the executable exactly as it did through the toolkit", async () => {
        const root: string = makeTmpDir();
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(root, ".nexus", "config", "settings.yml"),
            "github:\n  epic-repo: acme/epics\n",
        );

        const viaExecutable: CapturedIo = makeIo(root);
        const viaToolkit: CapturedIo = makeIo(root);
        const executableCode: number = await runNexusCli(["config", "resolve", "epic-repo"], viaExecutable);
        const toolkitCode: number = runNexusGh(["config", "resolve", "epic-repo"], viaToolkit);

        expect(executableCode).toBe(toolkitCode);
        expect(viaExecutable.out).toEqual(viaToolkit.out);
        expect(viaExecutable.out).toEqual(["acme/epics"]);
    });

    it("a folded capability that fails signals failure the same way through either name", async () => {
        const root: string = makeTmpDir();
        const viaExecutable: CapturedIo = makeIo(root);
        const viaToolkit: CapturedIo = makeIo(root);

        expect(await runNexusCli(["config", "resolve"], viaExecutable)).toBe(2);
        expect(runNexusGh(["config", "resolve"], viaToolkit)).toBe(2);
        expect(viaExecutable.err).toEqual(viaToolkit.err);
    });

    it("a folded capability reports the executable's program name in its usage and error text", async () => {
        const io: CapturedIo = makeIo(makeTmpDir());
        expect(await runNexusCli(["config"], io)).toBe(2);
        const text: string = io.err.join("\n");
        expect(text).toContain("usage: nexus config");
        expect(text).not.toContain("nexus-gh");
    });

    it("each folded filer reports the executable's program name in its own usage", async () => {
        for (const verb of ["create-epic", "create-story"]) {
            const io: CapturedIo = makeIo(makeTmpDir());
            expect(await runNexusCli([verb, "--help"], io)).toBe(0);
            const text: string = io.out.join("\n");
            expect(text).toContain(`nexus ${verb}`);
            expect(text).not.toContain("nexus-gh");
        }
    });
});
