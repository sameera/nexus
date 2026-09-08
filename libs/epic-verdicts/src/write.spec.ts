import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readEpicReceipt, writeEpicReceipt } from "./write.js";
import { type EpicReceipt } from "./receipt.js";

const dirs: string[] = [];
function tmpDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "epic-verdicts-"));
    dirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const RECEIPT: EpicReceipt = {
    epic: "#212",
    findings: { critical: 0, high: 1, medium: 2, low: 0 },
    stories: [
        { story: 496, repo: "acme/widget", pr: 501, head: "a".repeat(40) },
        { story: 497, repo: "acme/widget", pr: 502, head: "c".repeat(40) },
    ],
    prs: [
        { repo: "acme/widget", pr: 501 },
        { repo: "acme/widget", pr: 502 },
    ],
    excluded: [498],
};

describe("writeEpicReceipt / readEpicReceipt — the per-story receipt, at the #171 placement contract", () => {
    it("writes a receipt that reads back with the same stories, findings and pull requests", () => {
        const dir = tmpDir();
        const out = writeEpicReceipt(dir, RECEIPT, { date: "2026-09-08" });
        expect(out).toBe(path.join(dir, "analyze-receipt.md"));

        const read = readEpicReceipt(out);
        expect(read).not.toBeNull();
        expect(read?.epic).toBe("#212");
        expect(read?.findings).toEqual(RECEIPT.findings);
        expect(read?.stories).toEqual(RECEIPT.stories);
        expect(read?.prs).toEqual(RECEIPT.prs);
        expect(read?.excluded).toEqual(RECEIPT.excluded);
    });

    it("returns null for a file with no per-story stories list — a single-PR receipt from #171, not this shape", () => {
        const dir = tmpDir();
        const p = path.join(dir, "analyze-receipt.md");
        fs.writeFileSync(p, "---\nepic: \"#11\"\nhead: abc123\nmode: full\nfindings: { critical: 0, high: 0, medium: 0, low: 0 }\n---\n\nbody\n");
        expect(readEpicReceipt(p)).toBeNull();
    });

    it("returns null when the file does not exist", () => {
        expect(readEpicReceipt("/nonexistent/analyze-receipt.md")).toBeNull();
    });
});
