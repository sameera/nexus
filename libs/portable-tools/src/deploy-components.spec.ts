/**
 * The component-deploy primitive (STORY-60.01). These specs pin the mirror semantics the
 * decision record fixes: the destination is made to match the managed set (create, overwrite,
 * and remove stale Nexus-namespaced files), a second run with no upstream change converges to
 * an identical component set, and user-owned files — the per-repo local settings file and any
 * non-Nexus file — are never touched.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deployComponents, EMPTY_PAYLOAD, INSTALL_LEDGER_FILE, payloadDirectory, readInstallLedger } from "./deploy-components";

let tmpDirs: string[] = [];

function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function makePayload(): string {
    const dir: string = makeTmpDir("deploy-payload-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(dir, "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "epic v2\n");
    fs.writeFileSync(path.join(dir, "agents", "nxs-pm.md"), "pm v2\n");
    fs.writeFileSync(path.join(dir, "skills", "nxs-setup", "SKILL.md"), "setup v2\n");
    return dir;
}

/** Walk a tree into { relPath: contentHash } for whole-tree equality assertions. */
function snapshot(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!fs.existsSync(root)) {
        return out;
    }
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs: string = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(abs);
            } else {
                const rel: string = path.relative(root, abs).split(path.sep).join("/");
                out[rel] = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
            }
        }
    };
    walk(root);
    return out;
}

describe("deployComponents", () => {
    it("installs the full managed set into a repo with no components", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");

        const result = deployComponents(payloadDirectory(payload), path.join(repo, ".claude"));

        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic v2\n");
        expect(fs.readFileSync(path.join(repo, ".claude", "agents", "nxs-pm.md"), "utf8")).toBe("pm v2\n");
        expect(fs.readFileSync(path.join(repo, ".claude", "skills", "nxs-setup", "SKILL.md"), "utf8")).toBe(
            "setup v2\n",
        );
        expect(result.written.sort()).toEqual([
            "agents/nxs-pm.md",
            "commands/nxs.epic.md",
            "skills/nxs-setup/SKILL.md",
        ]);
        expect(result.removed).toEqual([]);
    });

    it("a second run with no upstream change leaves the component set byte-identical", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");

        deployComponents(payloadDirectory(payload), path.join(repo, ".claude"));
        const first: Record<string, string> = snapshot(path.join(repo, ".claude"));
        deployComponents(payloadDirectory(payload), path.join(repo, ".claude"));
        const second: Record<string, string> = snapshot(path.join(repo, ".claude"));

        expect(second).toEqual(first);
    });

    it("overwrites a hand-edited managed file back to the payload content", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");
        deployComponents(payloadDirectory(payload), path.join(repo, ".claude"));
        fs.writeFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "local edit\n");

        deployComponents(payloadDirectory(payload), path.join(repo, ".claude"));

        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic v2\n");
    });

    it("leaves user-owned files untouched: settings.local.json and non-Nexus components", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");
        const claude: string = path.join(repo, ".claude");
        fs.mkdirSync(path.join(claude, "commands"), { recursive: true });
        fs.writeFileSync(path.join(claude, "settings.local.json"), '{"mine":true}\n');
        fs.writeFileSync(path.join(claude, "commands", "my-command.md"), "user command\n");

        deployComponents(payloadDirectory(payload), path.join(repo, ".claude"));

        expect(fs.readFileSync(path.join(claude, "settings.local.json"), "utf8")).toBe('{"mine":true}\n');
        expect(fs.readFileSync(path.join(claude, "commands", "my-command.md"), "utf8")).toBe("user command\n");
    });

    it("removes Nexus-namespaced files the payload no longer carries (convergence)", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");
        const claude: string = path.join(repo, ".claude");
        fs.mkdirSync(path.join(claude, "commands"), { recursive: true });
        fs.mkdirSync(path.join(claude, "skills", "nxs-oldskill"), { recursive: true });
        fs.writeFileSync(path.join(claude, "commands", "nxs.obsolete.md"), "gone upstream\n");
        fs.writeFileSync(path.join(claude, "skills", "nxs-oldskill", "SKILL.md"), "gone upstream\n");
        fs.writeFileSync(path.join(claude, "commands", "my-command.md"), "user command\n");

        const result = deployComponents(payloadDirectory(payload), path.join(repo, ".claude"));

        expect(fs.existsSync(path.join(claude, "commands", "nxs.obsolete.md"))).toBe(false);
        expect(fs.existsSync(path.join(claude, "skills", "nxs-oldskill"))).toBe(false);
        expect(fs.existsSync(path.join(claude, "commands", "my-command.md"))).toBe(true);
        expect(result.removed.sort()).toEqual(["commands/nxs.obsolete.md", "skills/nxs-oldskill/SKILL.md"]);
    });

    it("never follows a pointer standing where a managed subtree should be (invariant 6)", () => {
        const outside: string = makeTmpDir("deploy-outside-");
        fs.mkdirSync(path.join(outside, "nxs-elsewhere"), { recursive: true });
        fs.writeFileSync(path.join(outside, "nxs-elsewhere", "SKILL.md"), "not ours to remove\n");
        const repo: string = makeTmpDir("deploy-target-");
        const claude: string = path.join(repo, ".claude");
        fs.mkdirSync(claude, { recursive: true });
        fs.symlinkSync(outside, path.join(claude, "skills"));

        const result = deployComponents(EMPTY_PAYLOAD, claude);

        expect(result.removed).toEqual([]);
        expect(fs.readFileSync(path.join(outside, "nxs-elsewhere", "SKILL.md"), "utf8")).toBe("not ours to remove\n");
    });

    it("fails with a named error when the payload directory is missing", () => {
        const repo: string = makeTmpDir("deploy-target-");
        expect(() => deployComponents(payloadDirectory(path.join(repo, "no-such-payload")), path.join(repo, ".claude"))).toThrowError(/payload/i);
    });
});

/**
 * Two packages, one component root (epic #677's blocker). The mirror's sweep is "every
 * Nexus-namespaced file the payload no longer carries", and the namespace is shared by design — a
 * teaching stage a second package ships is still invoked as `/nxs.teach`. So the sweep cannot be
 * scoped by the prefix; it is scoped by what each package recorded placing, and a package never
 * removes a path another package's record claims.
 */
describe("two packages sharing one component root", () => {
    /** A second package's payload: one command and one skill, under the same namespace. */
    function makeOtherPayload(): string {
        const dir: string = makeTmpDir("deploy-other-payload-");
        fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
        fs.mkdirSync(path.join(dir, "skills", "nxs-workbook"), { recursive: true });
        fs.writeFileSync(path.join(dir, "commands", "nxs.teach.md"), "teach v1\n");
        fs.writeFileSync(path.join(dir, "skills", "nxs-workbook", "SKILL.md"), "workbook v1\n");
        return dir;
    }

    const NEXUS = "@sameeraperera/nexus";
    const TEACH = "@sameeraperera/nexus-teach";

    it("leaves the other package's files in place when one of them installs", () => {
        const root: string = makeTmpDir("deploy-root-");
        deployComponents(payloadDirectory(makePayload()), root, { owner: NEXUS });
        deployComponents(payloadDirectory(makeOtherPayload()), root, { owner: TEACH });

        const again = deployComponents(payloadDirectory(makePayload()), root, { owner: NEXUS });

        expect(fs.existsSync(path.join(root, "commands", "nxs.teach.md"))).toBe(true);
        expect(fs.existsSync(path.join(root, "skills", "nxs-workbook", "SKILL.md"))).toBe(true);
        expect(again.removed).toEqual([]);
        expect(again.claimedByOthers).toEqual([]);
    });

    it("still drops its own file that the new payload no longer carries", () => {
        const root: string = makeTmpDir("deploy-root-");
        const payload: string = makePayload();
        deployComponents(payloadDirectory(payload), root, { owner: NEXUS });
        deployComponents(payloadDirectory(makeOtherPayload()), root, { owner: TEACH });

        fs.rmSync(path.join(payload, "agents", "nxs-pm.md"));
        const result = deployComponents(payloadDirectory(payload), root, { owner: NEXUS });

        expect(result.removed).toEqual(["agents/nxs-pm.md"]);
        expect(fs.existsSync(path.join(root, "commands", "nxs.teach.md"))).toBe(true);
    });

    it("removes only its own files when one package is uninstalled", () => {
        const root: string = makeTmpDir("deploy-root-");
        deployComponents(payloadDirectory(makePayload()), root, { owner: NEXUS });
        deployComponents(payloadDirectory(makeOtherPayload()), root, { owner: TEACH });

        const result = deployComponents(EMPTY_PAYLOAD, root, { owner: NEXUS });

        expect(result.removed).toEqual(["agents/nxs-pm.md", "commands/nxs.epic.md", "skills/nxs-setup/SKILL.md"]);
        expect(fs.existsSync(path.join(root, "commands", "nxs.teach.md"))).toBe(true);
        expect(readInstallLedger(root)[NEXUS]).toBeUndefined();
        expect(readInstallLedger(root)[TEACH]).toEqual(["commands/nxs.teach.md", "skills/nxs-workbook/SKILL.md"]);
    });

    it("adopts what it finds when the root predates the record, and records it", () => {
        const root: string = makeTmpDir("deploy-root-");
        // An install from before the record existed: files on disk, no ledger.
        deployComponents(payloadDirectory(makePayload()), root);
        expect(fs.existsSync(path.join(root, INSTALL_LEDGER_FILE))).toBe(false);

        const payload: string = makePayload();
        fs.rmSync(path.join(payload, "agents", "nxs-pm.md"));
        const result = deployComponents(payloadDirectory(payload), root, { owner: NEXUS });

        expect(result.removed).toEqual(["agents/nxs-pm.md"]);
        expect(readInstallLedger(root)[NEXUS]).toEqual(["commands/nxs.epic.md", "skills/nxs-setup/SKILL.md"]);
    });

    it("names a path both packages ship, and overwrites without claiming it alone", () => {
        const root: string = makeTmpDir("deploy-root-");
        const shared: string = makeTmpDir("deploy-shared-payload-");
        fs.mkdirSync(path.join(shared, "commands"), { recursive: true });
        fs.writeFileSync(path.join(shared, "commands", "nxs.epic.md"), "epic from the other package\n");

        deployComponents(payloadDirectory(makePayload()), root, { owner: NEXUS });
        const result = deployComponents(payloadDirectory(shared), root, { owner: TEACH });

        expect(result.written).toEqual(["commands/nxs.epic.md"]);
        expect(result.claimedByOthers).toEqual(["commands/nxs.epic.md"]);
        expect(fs.readFileSync(path.join(root, "commands", "nxs.epic.md"), "utf8")).toBe("epic from the other package\n");
    });

    it("sweeps every namespaced file when no owner is named, which is what migration asks for", () => {
        const root: string = makeTmpDir("deploy-root-");
        deployComponents(payloadDirectory(makePayload()), root, { owner: NEXUS });
        deployComponents(payloadDirectory(makeOtherPayload()), root, { owner: TEACH });

        const result = deployComponents(EMPTY_PAYLOAD, root);

        expect(result.removed).toContain("commands/nxs.teach.md");
        expect(result.removed).toContain("commands/nxs.epic.md");
    });

    it("converges: a second run with the same payload changes nothing", () => {
        const root: string = makeTmpDir("deploy-root-");
        deployComponents(payloadDirectory(makePayload()), root, { owner: NEXUS });
        deployComponents(payloadDirectory(makeOtherPayload()), root, { owner: TEACH });
        const first = snapshot(root);

        deployComponents(payloadDirectory(makePayload()), root, { owner: NEXUS });
        deployComponents(payloadDirectory(makeOtherPayload()), root, { owner: TEACH });

        expect(snapshot(root)).toEqual(first);
    });
});
