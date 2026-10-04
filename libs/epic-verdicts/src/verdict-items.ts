/**
 * The ID step of the conformance gate's departure pass (epic #829, story #858, decision record
 * #871, D2; G6–G8).
 *
 * Analyze judges which places the code departs from the decision record. It does not number them:
 * the engineer answers a departure by its ID, so an ID must survive a re-run, and a model asked to
 * produce the same numbering twice will not. The numbering is done here instead, against a
 * registry — the items in the newest trusted verdict on the same pull request.
 *
 * - A departure found again keeps its ID. Two count as the same when they cite the same record
 *   element and share a file (or neither names a file).
 * - A new departure takes the next unused number. Every number ever issued stays in the registry,
 *   so none is reused and one ID never names two items on a pull request.
 * - A departure a later run does not find again stays listed as no longer found, with its answer.
 *   If it is found again it gets its ID back.
 *
 * Severity is decided here too, from the one fact the judgment supplies: an unanswered departure
 * that breaks a guarantee or an invariant is critical, any other is high (G14).
 */

import { type Departure, type Judgments, parseJudgmentsBlock, splitItemId } from "@nexus/pr-acceptance/judgments-block";
import { verifyReceipt } from "@nexus/pr-acceptance/verify";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

/** One departure as analyze judged it, before it has an ID. */
export interface DepartureDraft {
    departsFrom: string;
    summary: string;
    /** Whether it breaks a guarantee or an invariant — the one fact its severity follows from. */
    breaksGuarantee: boolean;
    files: string[];
    stub: { path: string; reason: string } | null;
    supersedes: { decision: string; instead: string } | null;
}

export type ParsedDraft = { ok: true; drafts: DepartureDraft[] } | { ok: false; message: string };

/** Read the draft analyze wrote: `{ "departures": [ ... ] }`. Every refusal names the entry. */
export function parseDepartureDraft(text: string): ParsedDraft {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch (e) {
        return { ok: false, message: `the draft is not valid JSON (${e instanceof Error ? e.message : String(e)})` };
    }
    if (!isRecord(doc) || !Array.isArray(doc["departures"])) return { ok: false, message: "the draft carries no departures list" };
    const drafts: DepartureDraft[] = [];
    for (const [i, raw] of doc["departures"].entries()) {
        const d = readDraft(raw);
        if (typeof d === "string") return { ok: false, message: `departure ${i} ${d}` };
        drafts.push(d);
    }
    return { ok: true, drafts };
}

function readDraft(raw: unknown): DepartureDraft | string {
    if (!isRecord(raw)) return "is not an object";
    const { departsFrom, summary, breaksGuarantee, files } = raw;
    const stub = raw["stub"] ?? null;
    const supersedes = raw["supersedes"] ?? null;
    if (!nonEmpty(departsFrom)) return "names nothing it departs from (departsFrom)";
    if (!nonEmpty(summary)) return "says nothing about what the code does (summary)";
    if (typeof breaksGuarantee !== "boolean") return "does not say whether it breaks a guarantee or an invariant (breaksGuarantee)";
    if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) return "has no file list (files)";
    if (stub !== null && !(isRecord(stub) && nonEmpty(stub["path"]) && nonEmpty(stub["reason"]))) {
        return "names a stub without its path and reason (stub)";
    }
    if (supersedes !== null && !(isRecord(supersedes) && nonEmpty(supersedes["decision"]) && nonEmpty(supersedes["instead"]))) {
        return "is marked superseding without naming the decision and what the code does instead (supersedes)";
    }
    return {
        departsFrom,
        summary,
        breaksGuarantee,
        files: files as string[],
        stub: stub === null ? null : { path: stub["path"] as string, reason: stub["reason"] as string },
        supersedes: supersedes === null ? null : { decision: supersedes["decision"] as string, instead: supersedes["instead"] as string },
    };
}

/**
 * Number `drafts` against `registry`, the judgments of the newest trusted verdict on the same pull
 * request, or null when it has none. Returns the complete judgments the new verdict carries.
 */
export function assignDepartureIds(registry: Judgments | null, drafts: readonly DepartureDraft[]): Judgments {
    const prior = registry?.items ?? [];
    let next = 1 + Math.max(0, ...prior.map((d) => splitItemId(d.id)?.n ?? 0));
    const claimed = new Set<string>();
    const found: Departure[] = [];
    for (const draft of drafts) {
        const match = bestMatch(prior, claimed, draft);
        const id = match?.id ?? `DV${next++}`;
        claimed.add(id);
        found.push({
            id,
            kind: "departure",
            found: true,
            severity: draft.breaksGuarantee ? "critical" : "high",
            departsFrom: draft.departsFrom,
            summary: draft.summary,
            files: draft.files,
            stub: draft.stub,
            supersedes: draft.supersedes,
            answer: match?.answer ?? null,
        });
    }
    const gone = prior.filter((d) => !claimed.has(d.id)).map((d) => ({ ...d, found: false }));
    const items = [...found, ...gone].sort((a, b) => (splitItemId(a.id)?.n ?? 0) - (splitItemId(b.id)?.n ?? 0));
    return { items, other: registry?.other ?? [] };
}

/**
 * The earlier departure `draft` is the same as: same cited element, and a shared file or no file
 * on either side. An identical file set beats a larger overlap, which beats a smaller one; a tie
 * goes to the lower number, so the choice never depends on the order the registry was written in.
 */
function bestMatch(prior: readonly Departure[], claimed: ReadonlySet<string>, draft: DepartureDraft): Departure | null {
    const anchor = normalizeAnchor(draft.departsFrom);
    const files = new Set(draft.files.map(normalizePath));
    let best: { d: Departure; score: number } | null = null;
    for (const d of prior) {
        if (claimed.has(d.id) || normalizeAnchor(d.departsFrom) !== anchor) continue;
        const theirs = new Set(d.files.map(normalizePath));
        const shared = [...files].filter((f) => theirs.has(f)).length;
        const same = shared === files.size && shared === theirs.size;
        if (shared === 0 && !same) continue;
        const score = same ? Number.MAX_SAFE_INTEGER : shared;
        const better =
            best === null || score > best.score || (score === best.score && (splitItemId(d.id)?.n ?? 0) < (splitItemId(best.d.id)?.n ?? 0));
        if (better) best = { d, score };
    }
    return best?.d ?? null;
}

const normalizeAnchor = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();
const normalizePath = (s: string): string => s.trim().replace(/^\.\//, "");

export type ReadItemRegistryResult =
    | { ok: true; source: "none" | "no-judgments" | "verdict"; registry: Judgments | null }
    | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * The registry pull request `pr` in `repo` carries: the judgments of its newest trusted verdict,
 * picked by the same reader the close gate and the merge pre-check use. No verdict, or one
 * published before the judgments block existed, is an empty registry. A newest verdict whose
 * judgments cannot be read stops the run: numbering past it could reuse an ID it issued.
 */
export function readItemRegistry(run: Runner, cwd: string, pr: number, repo: string, issuesRepo: string): ReadItemRegistryResult {
    const r = verifyReceipt(run, cwd, pr, repo, issuesRepo);
    if (!r.ok) return { ok: false, error: { problem: "gh-failed", message: r.error.message } };
    if (!r.value.found) return { ok: true, source: "none", registry: null };
    const parsed = parseJudgmentsBlock(r.value.rawBody);
    if (!parsed.ok) {
        return {
            ok: false,
            error: {
                problem: "judgments-malformed",
                message: `the newest verdict on PR #${pr} in ${repo} carries a judgments block that cannot be read (${parsed.message}), so its IDs cannot be reused. Re-run the full analyze after correcting or removing that verdict.`,
            },
        };
    }
    return parsed.judgments === null ? { ok: true, source: "no-judgments", registry: null } : { ok: true, source: "verdict", registry: parsed.judgments };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function nonEmpty(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0;
}
