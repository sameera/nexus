/**
 * The kind rule — the one shared reading of what an issue is filed as (decision record #786, R1).
 *
 * An issue's kind comes only from the marker the repository declares for it: a label, or a GitHub
 * issue type, whichever the declared classification mode selects. The kinds are initiative, epic,
 * story, decision record, and none of these. The rule lives in the settings layer, beside the
 * resolver that reads those markers, because both the epic resolver and the batch filer need it and
 * the filer cannot reach up into the resolver's package. A second copy inside the filer would let
 * filing and reading disagree about the same issue.
 *
 * The markers are resolved **only** through the shared publishing resolver. This module never
 * parses `settings.yml` and carries no default of its own — an unresolvable classification is a
 * named diagnostic, never a guess.
 */

import { resolvePublishingKey } from "./resolve.js";

/** The two ways this rule fails, each a fixed problem plus one sentence naming the fix. */
export interface KindDiagnostic {
    problem: "record-classification-unresolved" | "classification-mode-mismatch";
    message: string;
}

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

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: KindDiagnostic };

const MODES: ReadonlySet<string> = new Set<string>(["types", "labels", "legacy-auto"]);

function unresolved(message: string): Err {
    return { ok: false, error: { problem: "record-classification-unresolved", message } };
}

/**
 * Read one publishing key through the shared resolver.
 *
 * The resolver is a library in the same workspace now, so there is nothing to locate and no process
 * to spawn — and no question of how a checkout with nothing installed reaches it.
 */
function resolveKey(targetRoot: string, key: string): string {
    return resolvePublishingKey(targetRoot, key).trim();
}

/**
 * Resolve how this repo marks a decision-record sub-issue, through the shared publishing resolver.
 *
 * An unrecognised or unset mode is the resolver's own `legacy-auto` default (a repo with no
 * declared `github:` block behaves exactly as it always has). A missing record label or type,
 * however, means the resolver in this checkout predates the record contract — that is reported,
 * not defaulted, so no second source of the record marker can ever exist.
 */
export function resolveRecordClassification(targetRoot: string): Ok<{ classification: RecordClassification }> | Err {
    const mode: string = resolveKey(targetRoot, "classification");
    const label: string = resolveKey(targetRoot, "record-label");
    const type: string = resolveKey(targetRoot, "record-type");

    if (label.length === 0 || type.length === 0) {
        return unresolved(
            "the shared publishing resolver returned no record label/type; the installed " +
                "resolver predates the decision-record sub-issue contract — update Nexus",
        );
    }
    const normalized: string = mode.toLowerCase();
    return {
        ok: true,
        classification: {
            mode: (MODES.has(normalized) ? normalized : "legacy-auto") as ClassificationMode,
            recordLabel: label,
            recordType: type,
        },
    };
}

/**
 * What an issue is filed as. `other` is a real answer, not a failure: a bug, a chore — anything the
 * repository does not mark as initiative, epic, story or record. Naming it keeps every caller from
 * inferring a kind from the issue graph's *shape*, which is what a walk up the parent link does,
 * and which reads an epic as a story the moment a repo files epics under initiatives.
 *
 * An `initiative` is the planning container a coherent decomposition's stubs are filed under
 * (decision record #786, D5). It is its own kind so that a stage can refuse it by name and the
 * filer can allow it as a stub's parent, each from the marker rather than from where it sits.
 */
export type IssueKind = "initiative" | "epic" | "story" | "record" | "other";

/** How this repo marks each kind of issue, under the one declared classification mode. */
export interface KindClassification {
    mode: ClassificationMode;
    epicLabel: string;
    epicType: string;
    storyLabel: string;
    storyType: string;
    recordLabel: string;
    recordType: string;
    initiativeLabel: string;
    /** Empty when the repository declares none: no issue is then an initiative by its type. */
    initiativeType: string;
}

/** The classification-relevant markers carried by one issue, with the number to name it by. */
export interface IssueMarkers extends SubIssueMarkers {
    number: number;
}

function matches(value: string | null, wanted: string): boolean {
    return value !== null && wanted.length > 0 && value.toLowerCase() === wanted.toLowerCase();
}

/** The markers one kind is recognised by, with every kind that outranks it. */
type KindMarkers = Pick<
    KindClassification,
    "epicLabel" | "epicType" | "storyLabel" | "storyType" | "recordLabel" | "recordType" | "initiativeLabel" | "initiativeType"
>;

function kindFrom(c: KindMarkers, by: (label: string, type: string) => boolean): IssueKind {
    if (by(c.epicLabel, c.epicType)) return "epic";
    if (by(c.storyLabel, c.storyType)) return "story";
    if (by(c.recordLabel, c.recordType)) return "record";
    // Last, so an issue the repository marks as an epic stays one even where the two markers share
    // a name — a repository whose epic label is `initiative` loses no epic to this kind.
    if (by(c.initiativeLabel, c.initiativeType)) return "initiative";
    return "other";
}

/**
 * Resolve how this repo marks an epic, a story and a record, through the shared publishing
 * resolver — the same single reader {@link resolveRecordClassification} goes through.
 *
 * `epic-label` and `story-label` carry built-ins, so label mode always resolves. `epic-type` and
 * `story-type` deliberately carry none: under `classification: types` there would be nothing to
 * classify against, and a guessed type name mis-files every candidate silently. That is reported.
 */
export function resolveKindClassification(targetRoot: string): Ok<{ classification: KindClassification }> | Err {
    const record = resolveRecordClassification(targetRoot);
    if (!record.ok) return record;

    const epicLabel: string = resolveKey(targetRoot, "epic-label");
    const epicType: string = resolveKey(targetRoot, "epic-type");
    const storyLabel: string = resolveKey(targetRoot, "story-label");
    const storyType: string = resolveKey(targetRoot, "story-type");
    const mode: ClassificationMode = record.classification.mode;

    if (mode === "types") {
        const missing: string[] = [];
        if (epicType.length === 0) missing.push("github.epic-type");
        if (storyType.length === 0) missing.push("github.story-type");
        if (missing.length > 0) {
            return unresolved(
                `settings declare 'classification: types' but ${missing.join(" and ")} resolve to nothing; ` +
                    "declare the issue-type names, or set 'classification: labels'",
            );
        }
    }
    if (mode !== "types" && (epicLabel.length === 0 || storyLabel.length === 0)) {
        return unresolved(
            "the shared publishing resolver returned no epic/story label; the installed " +
                "resolver predates the epic-label contract — update Nexus",
        );
    }

    return {
        ok: true,
        classification: {
            mode,
            epicLabel,
            epicType,
            storyLabel,
            storyType,
            recordLabel: record.classification.recordLabel,
            recordType: record.classification.recordType,
            // Neither is required. A repository that declares no initiative marker has no
            // initiatives to recognise, which is an answer and not a failure.
            initiativeLabel: resolveKey(targetRoot, "initiative-label"),
            initiativeType: resolveKey(targetRoot, "initiative-type"),
        },
    };
}

/**
 * What one issue is filed as, under the declared classification.
 *
 * The declared mode is the repository's own statement of how it files issues, so this reads only
 * that mode's marker. When the mode's marker says nothing and the *other* mode's marker would
 * have answered, the settings are inaccurate — reported by name rather than quietly worked
 * around, because a stage that falls back here and a stage that trusts `classification:` would
 * then disagree about the same issue. `legacy-auto` declares nothing, so it cannot be inaccurate:
 * it reads whichever marker is present, label first.
 */
export function classifyIssueKind(c: KindClassification, markers: IssueMarkers): Ok<{ kind: IssueKind }> | Err {
    const byLabel: IssueKind = kindFrom(c, (label) => markers.labels.some((name) => matches(name, label)));
    const byType: IssueKind = kindFrom(c, (_label, type) => matches(markers.issueType, type));

    if (c.mode === "legacy-auto") return { ok: true, kind: byLabel !== "other" ? byLabel : byType };

    const declared: IssueKind = c.mode === "labels" ? byLabel : byType;
    const other: IssueKind = c.mode === "labels" ? byType : byLabel;
    if (declared !== "other") return { ok: true, kind: declared };
    // An initiative marked the undeclared way was `other` before the kind existed, and stays so:
    // the mismatch below is about how the repository files epics, stories and records.
    if (other !== "other" && other !== "initiative") {
        const found: string = c.mode === "labels" ? `issue type '${markers.issueType ?? ""}'` : `label '${other}'`;
        return {
            ok: false,
            error: {
                problem: "classification-mode-mismatch",
                message:
                    `settings declare 'classification: ${c.mode}', but #${markers.number} carries no ` +
                    `${c.mode === "labels" ? "epic/story/record label" : "epic/story/record issue type"} and is ` +
                    `classified by ${found} instead — the declared classification does not match how this ` +
                    "repository files issues; fix github.classification in settings.yml",
            },
        };
    }
    return { ok: true, kind: "other" };
}

/**
 * How this repo marks each kind, read as declared and never validated.
 *
 * {@link resolveKindClassification} refuses a classification it cannot classify epics and stories
 * against. This one refuses nothing: a marker the repository does not declare reads as empty, and an
 * empty marker matches no issue. It exists for {@link isDeclaredInitiative}, whose callers must not
 * gain a failure for an issue that is not an initiative.
 */
export function readKindMarkers(targetRoot: string): KindClassification {
    const mode: string = resolveKey(targetRoot, "classification").toLowerCase();
    return {
        mode: (MODES.has(mode) ? mode : "legacy-auto") as ClassificationMode,
        epicLabel: resolveKey(targetRoot, "epic-label"),
        epicType: resolveKey(targetRoot, "epic-type"),
        storyLabel: resolveKey(targetRoot, "story-label"),
        storyType: resolveKey(targetRoot, "story-type"),
        recordLabel: resolveKey(targetRoot, "record-label"),
        recordType: resolveKey(targetRoot, "record-type"),
        initiativeLabel: resolveKey(targetRoot, "initiative-label"),
        initiativeType: resolveKey(targetRoot, "initiative-type"),
    };
}

/** Whether deciding {@link isDeclaredInitiative} needs the issue's type, or its labels alone answer. */
export function initiativeNeedsIssueType(c: KindClassification): boolean {
    return c.mode !== "labels" && c.initiativeType.length > 0;
}

/**
 * Whether an issue is declared an initiative: the same reading {@link classifyIssueKind} makes of
 * the declared mode's marker, without the mismatch check and so without a way to fail.
 *
 * Every stage refuses an initiative as its epic, and the filer allows one as a stub's parent
 * (decision record #786, D8 and D11). Both ask this, so the two cannot disagree. A repository that
 * declares no initiative marker has no initiatives, and an issue that also carries the epic, story
 * or record marker is that kind first.
 */
export function isDeclaredInitiative(c: KindClassification, markers: SubIssueMarkers): boolean {
    const byLabel: IssueKind = kindFrom(c, (label) => markers.labels.some((name) => matches(name, label)));
    const byType: IssueKind = kindFrom(c, (_label, type) => matches(markers.issueType, type));
    if (c.mode === "labels") return byLabel === "initiative";
    if (c.mode === "types") return byType === "initiative";
    return (byLabel !== "other" ? byLabel : byType) === "initiative";
}
