import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildAllBundles, ENTRY_POINTS } from "./build-bundles";

const SRC_DIR: string = __dirname;
const LIB_ROOT: string = path.resolve(__dirname, "..");
const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");

let tmpDirs: string[] = [];

function makeTmpDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "build-bundles-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

describe("buildAllBundles", () => {
    it("writes one .mjs file per entry point with valid-looking ESM content", async () => {
        const outDir = makeTmpDir();
        const written = await buildAllBundles(SRC_DIR, outDir);

        expect(written).toHaveLength(Object.keys(ENTRY_POINTS).length);
        for (const file of written) {
            expect(file.endsWith(".mjs")).toBe(true);
            expect(fs.existsSync(file)).toBe(true);
            const content: string = fs.readFileSync(file, "utf8");
            expect(content.length).toBeGreaterThan(0);
            expect(content).toContain("export {");
        }
    });

    it("names each output file after its entry point key", async () => {
        const outDir = makeTmpDir();
        const written = await buildAllBundles(SRC_DIR, outDir);
        const names = written.map((f) => path.basename(f)).sort();
        expect(names).toEqual(Object.keys(ENTRY_POINTS).map((name) => `${name}.mjs`).sort());
    });
});

describe("CLI entry (matches the nx \"bundle\" target's invocation)", () => {
    it("builds both bundles into dist/bundle when launched via tsx", () => {
        const stdout: string = execFileSync(TSX_BIN, ["src/build-bundles.ts"], {
            cwd: LIB_ROOT,
            encoding: "utf8",
        });
        for (const name of Object.keys(ENTRY_POINTS)) {
            expect(stdout).toContain(`Bundled: `);
            expect(fs.existsSync(path.join(LIB_ROOT, "dist", "bundle", `${name}.mjs`))).toBe(true);
        }
    });
});
