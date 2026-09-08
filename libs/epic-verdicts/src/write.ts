/**
 * The per-story epic receipt file — the #171 placement contract, with the single analyzed head
 * replaced by a per-story list (decision record #505, key decision "The epic receipt is a written
 * file at the existing placement …"). Written beside the epic's materialized planning copy; never
 * committed, never linked from an issue (unchanged from #171).
 *
 * The close gate discriminates on shape: a receipt with no `stories:` list is a single-PR #171
 * receipt and gets today's comparison; one with a `stories:` list gets the per-story comparison.
 * `readEpicReceipt` therefore returns null — not a partially-filled result — for anything that
 * is not this shape, so a caller can fall through to the existing single-head reader.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type EpicReceipt, type EpicReceiptPr, type EpicReceiptStory, type FindingCounts } from "./receipt.js";

export const EPIC_RECEIPT_FILENAME = "analyze-receipt.md";

export interface WriteEpicReceiptMeta {
    date: string;
    nexusVersion?: string | null;
}

function renderStoriesTable(stories: EpicReceiptStory[]): string {
    return stories.map((s) => `  - { story: ${s.story}, repo: ${s.repo}, pr: ${s.pr}, head: ${s.head} }`).join("\n");
}

function renderPrsList(prs: EpicReceiptPr[]): string {
    return prs.map((p) => `  - { repo: ${p.repo}, pr: ${p.pr} }`).join("\n");
}

/** Write the aggregated epic receipt into `dir`, at the #171 placement (`analyze-receipt.md`). */
export function writeEpicReceipt(dir: string, receipt: EpicReceipt, meta: WriteEpicReceiptMeta): string {
    const outPath = path.join(dir, EPIC_RECEIPT_FILENAME);
    const f = receipt.findings;
    const lines = [
        "---",
        `epic: "${receipt.epic}"`,
        ...(meta.nexusVersion ? [`nexus_version: ${meta.nexusVersion}`] : []),
        `date: ${meta.date}`,
        "mode: full-aggregate",
        `findings: { critical: ${f.critical}, high: ${f.high}, medium: ${f.medium}, low: ${f.low} }`,
        "stories:",
        renderStoriesTable(receipt.stories),
        "prs:",
        renderPrsList(receipt.prs),
        "---",
        "",
    ];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, lines.join("\n"));
    return outPath;
}

function parseFrontmatter(body: string): Record<string, string> | null {
    const m = /^---\n([\s\S]*?)\n---/.exec(body);
    return m ? { __raw: m[1] } : null;
}

function parseInlineRecords(block: string, prefix: string): Array<Record<string, string>> {
    const section = new RegExp(`${prefix}:\\n((?:  - .*\\n?)*)`).exec(block + "\n");
    if (!section) return [];
    const out: Array<Record<string, string>> = [];
    for (const line of section[1].split("\n")) {
        const m = /^\s*-\s*\{(.*)\}\s*$/.exec(line);
        if (!m) continue;
        const rec: Record<string, string> = {};
        for (const pair of m[1].split(",")) {
            const [k, v] = pair.split(":").map((s) => s.trim());
            if (k && v !== undefined) rec[k] = v;
        }
        out.push(rec);
    }
    return out;
}

/** Read back an aggregated epic receipt, or null when `path` is not this per-story shape. */
export function readEpicReceipt(filePath: string): EpicReceipt | null {
    let body: string;
    try {
        body = fs.readFileSync(filePath, "utf8");
    } catch {
        return null;
    }
    const fm = parseFrontmatter(body);
    if (fm === null) return null;
    const raw = fm["__raw"];

    const epicMatch = /^epic:\s*"?([^"\n]+)"?\s*$/m.exec(raw);
    if (!epicMatch) return null;

    const storiesRecords = parseInlineRecords(raw, "stories");
    if (storiesRecords.length === 0) return null; // not the per-story shape

    const findingsMatch = /^findings:\s*\{([^}]*)\}/m.exec(raw);
    const findings: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    if (findingsMatch) {
        for (const [, k, v] of findingsMatch[1].matchAll(/([a-z]+)\s*:\s*(\d+)/g)) {
            if (k in findings) findings[k as keyof FindingCounts] = Number(v);
        }
    }

    const stories: EpicReceiptStory[] = storiesRecords.map((r) => ({
        story: Number(r["story"]),
        repo: r["repo"] ?? "",
        pr: Number(r["pr"]),
        head: r["head"] ?? "",
    }));
    const prs: EpicReceiptPr[] = parseInlineRecords(raw, "prs").map((r) => ({
        repo: r["repo"] ?? "",
        pr: Number(r["pr"]),
    }));

    return { epic: epicMatch[1], findings, stories, prs };
}
