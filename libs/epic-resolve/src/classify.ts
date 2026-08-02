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
 * Closure reasons that mark a story sub-issue as withdrawn — GitHub's own `IssueStateReason` values
 * for a cancelled or misfiled issue. `completed` is deliberately absent: a delivered story is closed
 * too, and closure alone must never withdraw it.
 */
const WITHDRAWAL_STATE_REASONS: ReadonlySet<string> = new Set<string>(["not_planned", "duplicate"]);

/**
 * Whether a story sub-issue has been withdrawn from the epic's scope.
 *
 * A re-scoped epic keeps its cancelled stories as closed sub-issues — the supersession trail lives on
 * them — but the materialized epic must not present them as live scope, or every stage that iterates
 * stories checks acceptance criteria for work that will never ship. The signal is either of two,
 * either alone sufficing: an explicit label (matched exact and case-folded — a substring rule would
 * let `wontfix-followup` silently delete live scope), or a closure with a reason of *not planned* or
 * *duplicate* — the declaration a lead makes by closing a story through GitHub's own close dialogue.
 * Closure state alone still cannot carry this without the reason: a *delivered* story is closed too,
 * as *completed*. A reason is only recordable at closure, so while a story is still open the label is
 * the only signal; once a withdrawn story is reopened its state is no longer closed, so it reads as
 * live scope again with no special-casing needed.
 */
export function isWithdrawnStory(labels: string[], state: string, stateReason: string): boolean {
    const byLabel = labels.some((name) => WITHDRAWAL_LABELS.has(name.toLowerCase()));
    const byClosure = state.toUpperCase() === "CLOSED" && WITHDRAWAL_STATE_REASONS.has(stateReason.toLowerCase());
    return byLabel || byClosure;
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

/**
 * The label this repository uses to mark an epic that has been identified but not yet planned — a
 * backlog stub (epic #185). Resolved through the same shared publishing resolver as every other
 * publishing key, so no call site carries a second source of the name (Invariant 18).
 *
 * A resolver that answers nothing predates the stub contract; that is reported rather than
 * defaulted, exactly as the record marker is.
 */
export function resolveUnplannedLabel(run: Runner, targetRoot: string): Ok<{ label: string }> | Err {
    const label = resolveKey(run, targetRoot, "unplanned-label");
    if (!label.ok) return label;
    if (label.value.length === 0) {
        return unresolved(
            "the shared publishing resolver returned no unplanned label; the vendored " +
                `${RESOLVER_SCRIPT} predates the backlog-stub contract — redeploy the Nexus components`,
        );
    }
    return { ok: true, label: label.value };
}

/** Whether an epic issue is still an unplanned stub, under the resolved unplanned label. */
export function isUnplannedEpic(labels: string[], unplannedLabel: string): boolean {
    const wanted: string = unplannedLabel.toLowerCase();
    return labels.some((name) => name.toLowerCase() === wanted);
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
