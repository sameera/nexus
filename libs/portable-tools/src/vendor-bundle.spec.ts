import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENTRY_POINTS } from "./build-bundles";
import { hashBundleCode } from "./parity";
import { parseArgs, vendorBundles } from "./vendor-bundle";
import { COMPONENT_PAYLOAD_DIRNAME, COMPONENT_PAYLOAD_KEY, hashComponentTree } from "./vendor-components";

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
});

describe("parseArgs", () => {
    it("defaults to no tools directory", () => {
        expect(parseArgs([])).toEqual({});
    });

    it("parses --tools-dir", () => {
        expect(parseArgs(["--tools-dir", "/some/hub/.nexus/tools"])).toEqual({ toolsDir: "/some/hub/.nexus/tools" });
    });
});

describe("vendorBundles", () => {
    it("writes a pin covering every entry point and the component payload, with sha256 hashes", async () => {
        const pinPath: string = path.join(makeTmpDir("vendor-pin-"), "bundle-fingerprint.json");

        const { fingerprint, copiedTo } = await vendorBundles({ srcDir: SRC_DIR, pinPath });

        expect(Object.keys(fingerprint).sort()).toEqual([...PIN_KEYS].sort());
        for (const key of PIN_KEYS) {
            expect(fingerprint[key]).toMatch(/^[0-9a-f]{64}$/);
        }
        expect(copiedTo).toEqual([]);
        // The pin file is written and parses back to the same fingerprint.
        expect(JSON.parse(fs.readFileSync(pinPath, "utf8"))).toEqual(fingerprint);
    });

    it("copies each artifact and the component payload into the tools directory, byte-matching the pin", async () => {
        const pinPath: string = path.join(makeTmpDir("vendor-pin-"), "bundle-fingerprint.json");
        const toolsDir: string = path.join(makeTmpDir("vendor-hub-"), ".nexus", "tools");

        const { fingerprint, copiedTo, payloadCopiedTo } = await vendorBundles({ srcDir: SRC_DIR, pinPath, toolsDir });

        expect(copiedTo.map((p) => path.basename(p)).sort()).toEqual([...ARTIFACTS].sort());
        for (const artifact of ARTIFACTS) {
            const vendored: string = fs.readFileSync(path.join(toolsDir, artifact), "utf8");
            // The copied artifact hashes to exactly what the pin recorded — build/pin/copy lockstep.
            expect(hashBundleCode(vendored)).toBe(fingerprint[artifact]);
        }
        // The vendored payload hashes to exactly the pinned payload fingerprint.
        expect(payloadCopiedTo.length).toBeGreaterThan(0);
        expect(hashComponentTree(path.join(toolsDir, COMPONENT_PAYLOAD_DIRNAME))).toBe(
            fingerprint[COMPONENT_PAYLOAD_KEY],
        );
    });

    it("produces a stable pin across repeated runs (cwd-independent build)", async () => {
        const first: string = path.join(makeTmpDir("vendor-pin-"), "pin.json");
        const second: string = path.join(makeTmpDir("vendor-pin-"), "pin.json");

        const a = await vendorBundles({ srcDir: SRC_DIR, pinPath: first });
        const b = await vendorBundles({ srcDir: SRC_DIR, pinPath: second });

        expect(a.fingerprint).toEqual(b.fingerprint);
    });
});
