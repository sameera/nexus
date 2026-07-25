/**
 * Evidence emission — what the harness leaves for a human to transcribe.
 *
 * The acceptance record's value is "what real GitHub did, on this date, at this
 * commit". So every recorded outcome carries **both** the toolchain commit it was
 * produced against and the date it was observed: an entry missing either is not
 * evidence, and `writeEvidence` refuses it rather than letting an unpinned claim
 * into the record where it could never be re-checked.
 *
 * Records are appended to a scratch directory that survives teardown, one file
 * per stage-observation, and rendered as a markdown fragment the maintainer
 * pastes into `live-acceptance-record.md`. Re-running appends a new dated run
 * rather than overwriting — an overwritten record destroys the comparison that
 * makes a re-run worth doing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Result, fail, ok } from "./diagnostic.js";

export type Verdict = "pass" | "fail" | "not-exercised";

export interface EvidenceRecord {
    /** The stage or strategy this outcome is about, e.g. "analyze" or "range:rebase". */
    stage: string;
    /** ISO date the outcome was observed. Required — an undated claim is not evidence. */
    observedAt: string;
    /** The toolchain commit under test. Required — an unpinned claim cannot be re-checked. */
    toolchainCommit: string;
    scratchRepo: string;
    verdict: Verdict;
    /** Observed identifiers — SHAs, issue and PR numbers, file sets. */
    detail: Record<string, unknown>;
    /** Diagnostic text, verbatim as the tool printed it. */
    diagnostics: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

export function writeEvidence(dir: string, record: EvidenceRecord): Result<string> {
    if (!ISO_DATE.test(record.observedAt)) {
        return fail(
            "usage",
            `evidence for "${record.stage}" has no observation date; an entry missing one is not evidence and cannot go in the record.`,
        );
    }
    if (record.toolchainCommit.trim() === "") {
        return fail(
            "usage",
            `evidence for "${record.stage}" names no toolchain commit; an unpinned outcome cannot be re-checked and does not count.`,
        );
    }
    fs.mkdirSync(dir, { recursive: true });
    const slug = record.stage.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "stage";
    const file = path.join(dir, `${record.observedAt.slice(0, 10)}-${slug}.json`);
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
    return ok(file);
}

/** Every valid record in `dir`, oldest first. Entries missing their pins are dropped. */
export function readEvidence(dir: string): EvidenceRecord[] {
    if (!fs.existsSync(dir)) return [];
    const out: EvidenceRecord[] = [];
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith(".json")) continue;
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
            if (parsed === null || typeof parsed !== "object") continue;
            const r = parsed as EvidenceRecord;
            if (!ISO_DATE.test(r.observedAt ?? "") || !(r.toolchainCommit ?? "").trim()) continue;
            out.push(r);
        } catch {
            // A corrupt file is not evidence; it is skipped rather than failing the render.
        }
    }
    return out;
}

function renderDetail(detail: Record<string, unknown>): string[] {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(detail)) {
        const value = Array.isArray(v) ? (v.length === 0 ? "(none)" : v.join(", ")) : String(v);
        lines.push(`| \`${k}\` | ${value} |`);
    }
    return lines;
}

const SYMBOL: Record<Verdict, string> = { pass: "PASS", fail: "FAIL", "not-exercised": "NOT EXERCISED" };

/** A markdown fragment for the acceptance record — one dated run, one section per stage. */
export function renderEvidence(records: EvidenceRecord[]): string {
    if (records.length === 0) return "_No evidence recorded._\n";

    const commits = [...new Set(records.map((r) => r.toolchainCommit))];
    const dates = [...new Set(records.map((r) => r.observedAt.slice(0, 10)))].sort();
    const repos = [...new Set(records.map((r) => r.scratchRepo))];

    const out: string[] = [
        `## Run ${dates[dates.length - 1]}`,
        "",
        `- **toolchain commit:** ${commits.map((c) => `\`${c}\``).join(", ")}`,
        `- **scratch repo:** ${repos.join(", ")}`,
        `- **observed:** ${dates.join(", ")}`,
        "",
        "| Stage | Verdict |",
        "|---|---|",
    ];
    for (const r of records) out.push(`| ${r.stage} | ${SYMBOL[r.verdict] ?? r.verdict} |`);
    out.push("");

    for (const r of records) {
        out.push(`### ${r.stage} — ${SYMBOL[r.verdict] ?? r.verdict}`, "");
        out.push(`Observed ${r.observedAt.slice(0, 10)} against \`${r.toolchainCommit}\`.`, "");
        const detail = renderDetail(r.detail);
        if (detail.length > 0) {
            out.push("| Observation | Value |", "|---|---|", ...detail, "");
        }
        if (r.diagnostics.length > 0) {
            out.push("Diagnostics, verbatim:", "", "```", ...r.diagnostics, "```", "");
        }
    }
    return out.join("\n");
}
