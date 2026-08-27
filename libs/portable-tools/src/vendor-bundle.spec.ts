import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTRY_POINTS } from "./build-bundles";
import { runCli, vendorBundles } from "./vendor-bundle";
import { COMPONENT_PAYLOAD_KEY } from "./vendor-components";

const SRC_DIR: string = __dirname;
const ARTIFACTS: string[] = Object.keys(ENTRY_POINTS).map((name) => `${name}.mjs`);
const PIN_KEYS: string[] = [...ARTIFACTS, COMPONENT_PAYLOAD_KEY];

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
    vi.restoreAllMocks();
});

describe("vendorBundles", () => {
    it("writes a pin covering every entry point and the component payload, with sha256 hashes", async () => {
        const pinPath: string = path.join(makeTmpDir("vendor-pin-"), "bundle-fingerprint.json");

        const { fingerprint } = await vendorBundles({ srcDir: SRC_DIR, pinPath });

        expect(Object.keys(fingerprint).sort()).toEqual([...PIN_KEYS].sort());
        for (const key of PIN_KEYS) {
            expect(fingerprint[key]).toMatch(/^[0-9a-f]{64}$/);
        }
        // The pin file is written and parses back to the same fingerprint.
        expect(JSON.parse(fs.readFileSync(pinPath, "utf8"))).toEqual(fingerprint);
    });

    it("writes the pin and nothing else — no directory and no artifact lands beside it", async () => {
        const runDir: string = makeTmpDir("pin-only-");
        const pinPath: string = path.join(runDir, "bundle-fingerprint.json");

        await vendorBundles({ srcDir: SRC_DIR, pinPath });

        expect(fs.readdirSync(runDir)).toEqual(["bundle-fingerprint.json"]);
    });

    it("produces a stable pin across repeated runs (cwd-independent build)", async () => {
        const first: string = path.join(makeTmpDir("vendor-pin-"), "pin.json");
        const second: string = path.join(makeTmpDir("vendor-pin-"), "pin.json");

        const a = await vendorBundles({ srcDir: SRC_DIR, pinPath: first });
        const b = await vendorBundles({ srcDir: SRC_DIR, pinPath: second });

        expect(a.fingerprint).toEqual(b.fingerprint);
    });
});

describe("runCli", () => {
    it("rejects a destination-directory option by name, without writing a pin", async () => {
        const errors: string[] = [];
        vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
            errors.push(args.join(" "));
        });
        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const code: number = await runCli(["--tools-dir", "/some/hub/.nexus/tools"]);

        expect(code).not.toBe(0);
        expect(errors.join("\n")).toContain("--tools-dir");
    });

    it("rejects any unrecognised argument by name", async () => {
        const errors: string[] = [];
        vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
            errors.push(args.join(" "));
        });
        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const code: number = await runCli(["--wat"]);

        expect(code).not.toBe(0);
        expect(errors.join("\n")).toContain("--wat");
    });
});
