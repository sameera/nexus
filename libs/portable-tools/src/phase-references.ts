/**
 * The teaching stage's phase boundary (epic #455, story #474).
 *
 * Planning a roadmap and writing a lesson need different reference material, and a session that
 * held both would be holding the material a lesson is written from while it is still ordering
 * concepts. A context window only appends, so a reference cannot be unloaded within one session by
 * any mechanism other than ending the session — which makes the phase boundary the **invocation**
 * boundary (record #478). The two phases are therefore separate adopter-facing entry points, each
 * naming its own reference set and neither naming the other's, and anything both need is reached
 * through a shared skill both declare rather than duplicated into both bodies.
 *
 * Story #474's third acceptance criterion is read on those terms: a phase change is a new
 * invocation whose reference set excludes the finished phase's references, verified by inspecting
 * each entry point's declared set. As filed it asked that references already loaded stop being
 * loaded mid-session, which no mechanism can do. What this module checks is the version that is
 * checkable — the planning body either contains a lesson-writing reference or it does not.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";

/** The adopter-facing entry point for each phase, named by its command file's stem. */
export const PLANNING_PHASE_ENTRY_POINT: string = "nxs.teach-plan";
export const LESSON_PHASE_ENTRY_POINT: string = "nxs.teach";

/**
 * What both phases need, declared here rather than inferred from the two sets overlapping. Inferring
 * it would make a body that wrongly declares the other phase's reference look like a body sharing
 * one, which is the failure this check exists to catch.
 */
export const SHARED_REFERENCES: readonly string[] = ["nxs-workbook"];

/** One phase's entry point: the phase it declares, the references it names, and its whole body. */
export interface PhaseEntryPoint {
    /** The command's file stem, e.g. "nxs.teach-plan". */
    command: string;
    /** The phase the body declares it runs. */
    phase: string;
    /** The reference set this phase declares, and the only one it loads. */
    references: string[];
    /** The body's full text, so a check can ask what it names as well as what it declares. */
    body: string;
}

/** Read one phase's entry point out of the authored component tree. */
export function readPhaseEntryPoint(componentRoot: string, command: string): PhaseEntryPoint {
    const file: string = path.join(componentRoot, "commands", `${command}.md`);
    const body: string = fs.readFileSync(file, "utf8");
    const front: Record<string, unknown> = frontmatter(body);
    const declared: unknown = front["references"];
    return {
        command,
        phase: String(front["phase"] ?? ""),
        references: Array.isArray(declared) ? declared.map((entry) => String(entry)) : [],
        body,
    };
}

/** The body's YAML frontmatter, or an empty record when it carries none. */
function frontmatter(body: string): Record<string, unknown> {
    const lines: string[] = body.split("\n");
    if (lines[0]?.trim() !== "---") return {};
    const end: number = lines.slice(1).findIndex((line) => line.trim() === "---");
    if (end === -1) return {};
    return (parse(lines.slice(1, end + 1).join("\n")) as Record<string, unknown> | null) ?? {};
}

/** The two phases, read together, so a check compares one against the other. */
export interface TeachingPhases {
    planning: PhaseEntryPoint;
    lesson: PhaseEntryPoint;
}

/**
 * Every way the declared reference sets fail the phase boundary. Empty means each phase declares
 * its own set, the planning set holds nothing exclusive to lesson writing, and the planning body
 * does not so much as name one — because in a body, naming a reference is loading it.
 */
export function phaseReferenceProblems(componentRoot: string, phases?: TeachingPhases): string[] {
    const { planning, lesson }: TeachingPhases = phases ?? {
        planning: readPhaseEntryPoint(componentRoot, PLANNING_PHASE_ENTRY_POINT),
        lesson: readPhaseEntryPoint(componentRoot, LESSON_PHASE_ENTRY_POINT),
    };

    const problems: string[] = [];
    for (const entry of [planning, lesson]) {
        if (entry.references.length === 0) {
            problems.push(`${entry.command} declares no reference set of its own; a phase loads the set it names and nothing else.`);
        }
        if (entry.phase === "") problems.push(`${entry.command} declares no phase, so nothing can say which references belong to it.`);
    }

    for (const reference of SHARED_REFERENCES) {
        for (const entry of [planning, lesson]) {
            if (!entry.references.includes(reference)) {
                problems.push(`${entry.command} does not declare the shared reference ${reference}; what both phases need is reached through a skill both load.`);
            }
        }
    }

    const lessonOnly: string[] = lesson.references.filter((reference) => !SHARED_REFERENCES.includes(reference));
    for (const reference of planning.references) {
        if (!lessonOnly.includes(reference)) continue;
        problems.push(`${planning.command} declares ${reference}, which belongs to ${lesson.command}.`);
    }
    for (const reference of lessonOnly) {
        if (planning.body.includes(reference)) {
            problems.push(
                `${planning.command} names ${reference}, which is a ${lesson.command} reference. ` +
                `A body that names a reference loads it, and a loaded reference cannot be unloaded.`,
            );
        }
    }
    return problems;
}
