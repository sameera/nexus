/**
 * Sub-issue classification for the epic resolver — telling the epic's **decision record** apart
 * from its **user stories** (epic #139, STORY-139.01).
 *
 * The decision record's durable home is a sub-issue of the epic issue, so the sub-issue set the
 * resolver walks is no longer homogeneous. Classification is **record-positive**: a sub-issue is
 * the decision record only when it carries the configured record marker; everything else stays a
 * story exactly as before. That is what keeps an epic with no record sub-issue — and a hand-filed
 * epic whose stories carry no story marker — resolving byte-identically to the pre-change output.
 *
 * The marker (a label, or a GitHub issue type, whichever the declared classification mode selects)
 * is resolved **only** through the shared publishing resolver, invoked across a process seam
 * (decision-record Invariant 4). The resolver is the single reader of the publishing configuration;
 * this module never parses `settings.yml` and carries no default of its own — an unresolvable
 * classification is a named diagnostic, never a guess, because guessing wrong silently injects the
 * record into the story set, which is the exact corruption this story exists to prevent.
 */

import * as path from "node:path";
import { type EpicResolveDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

/** The declared publishing classification mode, as the shared resolver reports it. */
export type ClassificationMode = "types" | "labels" | "legacy-auto";

/** How a record sub-issue is recognised in this repo. */
export interface RecordClassification {
    mode: ClassificationMode;
    /** The label that marks a sub-issue as the decision record (label and legacy-auto modes). */
    recordLabel: string;
    /** The GitHub issue type that marks a sub-issue as the decision record (type and legacy-auto). */
    recordType: string;
}

/** The classification-relevant markers carried by one fetched sub-issue. */
export interface SubIssueMarkers {
    labels: string[];
    /** The issue's GitHub issue type name, or null when it has none / none was fetched. */
    issueType: string | null;
}

export type SubIssueKind = "record" | "story";

/**
 * Labels that mark a story sub-issue as **withdrawn** — cancelled or misfiled work that is no longer
 * part of the epic's scope. GitHub's own default label names, so no repo has to declare anything.
 */
const WITHDRAWAL_LABELS: ReadonlySet<string> = new Set<string>(["wontfix", "invalid"]);

/**
 * Whether a story sub-issue has been withdrawn from the epic's scope.
 *
 * A re-scoped epic keeps its cancelled stories as closed sub-issues — the supersession trail lives on
 * them — but the materialized epic must not present them as live scope, or every stage that iterates
 * stories checks acceptance criteria for work that will never ship. Closure state alone cannot carry
 * this: a *delivered* story is closed too. So the signal is an explicit label, and the match is exact
 * (case-folded, as GitHub's label namespace is) — a substring rule would let `wontfix-followup`
 * silently delete live scope.
 */
export function isWithdrawnStory(labels: string[]): boolean {
    return labels.some((name) => WITHDRAWAL_LABELS.has(name.toLowerCase()));
}

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: EpicResolveDiagnostic };

/** Where the shared publishing resolver lives inside a checkout's vendored component tree. */
const RESOLVER_SCRIPT: string = path.join(".claude", "skills", "nxs-gh-shared", "delivery_config.py");

const MODES: ReadonlySet<string> = new Set<string>(["types", "labels", "legacy-auto"]);

function unresolved(message: string): Err {
    return { ok: false, error: { problem: "record-classification-unresolved", message } };
}

/** Read one publishing key through the shared resolver CLI (the process seam, Invariant 4). */
function resolveKey(run: Runner, targetRoot: string, key: string): Ok<{ value: string }> | Err {
    const script: string = path.join(targetRoot, RESOLVER_SCRIPT);
    const r = run("python3", [script, "resolve", key, "--root", targetRoot], { cwd: targetRoot });
    if (r.status !== 0) {
        return unresolved(
            `the shared publishing resolver could not resolve '${key}': ${r.stderr.trim() || "unknown error"} ` +
                `(expected ${RESOLVER_SCRIPT} in the target repo)`,
        );
    }
    return { ok: true, value: r.stdout.trim() };
}

/**
 * Resolve how this repo marks a decision-record sub-issue, through the shared publishing resolver.
 *
 * An unrecognised or unset mode is the resolver's own `legacy-auto` default (a repo with no
 * declared `github:` block behaves exactly as it always has). A missing record label or type,
 * however, means the resolver in this checkout predates the record contract — that is reported,
 * not defaulted, so no second source of the record marker can ever exist.
 */
export function resolveRecordClassification(
    run: Runner,
    targetRoot: string,
): Ok<{ classification: RecordClassification }> | Err {
    const mode = resolveKey(run, targetRoot, "classification");
    if (!mode.ok) return mode;
    const label = resolveKey(run, targetRoot, "record-label");
    if (!label.ok) return label;
    const type = resolveKey(run, targetRoot, "record-type");
    if (!type.ok) return type;

    if (label.value.length === 0 || type.value.length === 0) {
        return unresolved(
            "the shared publishing resolver returned no record label/type; the vendored " +
                `${RESOLVER_SCRIPT} predates the decision-record sub-issue contract — redeploy the Nexus components`,
        );
    }
    const normalized: string = mode.value.toLowerCase();
    return {
        ok: true,
        classification: {
            mode: (MODES.has(normalized) ? normalized : "legacy-auto") as ClassificationMode,
            recordLabel: label.value,
            recordType: type.value,
        },
    };
}

/** Whether one sub-issue is the epic's decision record, under the resolved classification. */
export function classifySubIssue(classification: RecordClassification, markers: SubIssueMarkers): SubIssueKind {
    // Both comparisons fold case. GitHub label names are case-insensitively unique, and
    // `gh label create --force` updates an existing label without renaming it — so a repo that
    // already carries `Decision-Record` keeps that stored casing and reads back with it. An
    // exact-match test would miss, classify the record as a story, and inject it into the story
    // set: the exact corruption this module exists to prevent, reached silently.
    const wanted: string = classification.recordLabel.toLowerCase();
    const byLabel: boolean = markers.labels.some((name) => name.toLowerCase() === wanted);
    const byType: boolean =
        markers.issueType !== null && markers.issueType.toLowerCase() === classification.recordType.toLowerCase();

    // `types` and `labels` each trust only their declared marker. `legacy-auto` names the
    // probe-then-fallback filing path, which applies whichever of the two the repo supports — so it
    // must recognise both, or a record filed under the path it took would read back as a story.
    if (classification.mode === "types") return byType ? "record" : "story";
    if (classification.mode === "labels") return byLabel ? "record" : "story";
    return byLabel || byType ? "record" : "story";
}
