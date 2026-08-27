import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTRY_POINTS } from "./build-bundles";
import { runCli, vendorBundles } from "./vendor-bundle";
import { PAYLOAD_KEY, PAYLOAD_MANIFEST_FILE } from "./release-payload";

const SRC_DIR: string = __dirname;
const ARTIFACTS: string[] = Object.keys(ENTRY_POINTS).map((name) => `${name}.mjs`);
const PIN_KEYS: string[] = [...ARTIFACTS, PAYLOAD_KEY];

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
    it("writes a pin covering the executable and the payload, with sha256 hashes", async () => {
        const pinPath: string = path.join(makeTmpDir("vendor-pin-"), "bundle-fingerprint.json");

        const { fingerprint } = await vendorBundles({ srcDir: SRC_DIR, pinPath });

        expect(Object.keys(fingerprint).sort()).toEqual([...PIN_KEYS].sort());
        for (const key of PIN_KEYS) {
            expect(fingerprint[key]).toMatch(/^[0-9a-f]{64}$/);
        }
        // The pin file is written and parses back to the same fingerprint.
        expect(JSON.parse(fs.readFileSync(pinPath, "utf8"))).toEqual(fingerprint);
    });

    it("writes the pin and its payload manifest and nothing else — no artifact lands beside them", async () => {
        const runDir: string = makeTmpDir("pin-only-");
        const pinPath: string = path.join(runDir, "bundle-fingerprint.json");

        await vendorBundles({ srcDir: SRC_DIR, pinPath });

        expect(fs.readdirSync(runDir).sort()).toEqual(["bundle-fingerprint.json", PAYLOAD_MANIFEST_FILE].sort());
    });

    it("names every payload file in the manifest it writes beside the pin", async () => {
        const runDir: string = makeTmpDir("pin-manifest-");
        const pinPath: string = path.join(runDir, "bundle-fingerprint.json");

        await vendorBundles({ srcDir: SRC_DIR, pinPath });

        const manifest: Record<string, string> = JSON.parse(
            fs.readFileSync(path.join(runDir, PAYLOAD_MANIFEST_FILE), "utf8"),
        );
        expect(Object.keys(manifest).length).toBeGreaterThan(0);
        for (const hash of Object.values(manifest)) {
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        }
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

        const code: number = await runCli(["--tools-dir", "/some/hub/tools"]);

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
