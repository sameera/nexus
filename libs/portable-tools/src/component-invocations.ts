/**
 * The component-invocation gate (story #301, decision record #325): every invocation written in a
 * shipped component body must name the executable and a dispatch name it declares, and the
 * migration to that shape cannot silently regress.
 *
 * One scanner walks the same set of shipped bodies the payload-composition boundary already walks,
 * extracts every invocation written in a code span — fenced or inline, because a legacy path one
 * backtick away is still an instruction — and classifies it against a closed set of addressing
 * forms: the named-executable form, and the legacy repository-bound ones (a transpiler run against
 * a script, a runtime run against a bundle, and a workspace script alias). Being unrecognised is
 * itself reportable.
 *
 * A named form is resolved against the executable's own declared surface, which the caller obtains
 * from that surface and never from a copy. A legacy form fails the gate by name, wherever it sits.
 * The pending register that carried the migration is gone: it reached empty when story #303
 * rewrote the last body, which was epic #250's completion condition for it, so enforcement is
 * unconditional and a reintroduced path fails the build immediately.
 *
 * Story #399 narrowed the form set with the runtime it described. The interpreter leader tokens and
 * the interpreter-script form are gone, and so is the form that recognised the second toolkit,
 * because neither names anything the release still has. That is a real reduction: an interpreter
 * invoked against a script *outside* the component tree stops being a gate failure. It removes no
 * enforcement the gate exists for — the recogniser for repository-bound artefacts is untouched, so
 * a script path under the component tree, a bundle named by filename and a workspace script alias
 * all still fail exactly as before. Once no Nexus capability has a Python implementation, an
 * interpreter invocation in a body can only be the adopting project's own tooling, which the gate
 * has no standing to fail.
 *
 * Node builtins only; this file is not a bundle entry point, so it is never itself vendored.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { DISPATCH_NAMES } from "./nexus-cli.js";
import { listComponentFiles } from "./vendor-components.js";

/** The closed set of addressing forms a code-span invocation can take. */
export type AddressingForm =
    /** `nexus <verb> [<subverb>]` — the named executable. */
    | "named-executable"
    /** `tsx <script>` / `npx tsx <script>` — a transpiler run against a repository-relative script. */
    | "transpiler-script"
    /** `node <bundle>.mjs` — a runtime run against a vendored bundle. */
    | "bundle-runtime"
    /** `pnpm <script>` — a workspace script alias, which resolves only inside a Nexus checkout. */
    | "workspace-alias"
    /** A repository-bound artifact named in a code span with no command around it. */
    | "unrecognised";

/** Every form other than the named one is repository-bound and must not survive this epic. */
export const LEGACY_FORMS: readonly AddressingForm[] = [
    "transpiler-script",
    "bundle-runtime",
    "workspace-alias",
    "unrecognised",
];

/** How one invocation stands against the declared surfaces. */
export type Classification =
    /** A named form whose dispatch name the executable declares. */
    | "resolving"
    /** A named form whose dispatch name the executable does not declare — always a failure. */
    | "undeclared"
    /** A legacy repository-bound form — a failure unless the body is still on the register. */
    | "unmigrated";

/** The declared surface, read from that surface and never from a duplicate. */
export interface ToolkitSurfaces {
    /** Complete dispatch names the `nexus` executable answers to, subverbs included. */
    nexus: readonly string[];
}

/** One invocation found in one code span of one body. */
export interface Invocation {
    /** Posix-style path relative to the component root; empty from the content-only entry point. */
    relPath: string;
    /** 1-indexed line of the body the code span sits on. */
    line: number;
    /** The invocation as written, trimmed. */
    text: string;
    form: AddressingForm;
    /** The dispatch name a named form addresses; absent on the legacy forms. */
    name?: string;
    /** Absent until the invocation is classified against the surfaces. */
    classification?: Classification;
}

/** One gate failure: a body, a name, and why it fails. */
export interface InvocationProblem {
    relPath: string;
    message: string;
}

/** Bodies the gate reads; everything else in a component subtree carries no instruction. */
const BODY_EXTENSION = ".md";

/** A dispatch name or a workspace script alias — never a path or a flag. */
const NAME_RE = /^[a-z][a-z0-9:-]*$/;

/** Repository-bound artifacts, recognised even when no command surrounds them. */
const REPO_BOUND_ARTIFACT_RE = /(?:\.claude\/[^\s`"']*\.(?:ts|py)|[^\s`"']*\.mjs|\bpnpm\s+nexus:)/;

/** Shell punctuation that starts a fresh command position within one code span. */
const SEGMENT_SPLIT_RE = /\$\(|[|;&()<>]|&&|\|\|/;

interface Leader {
    token: string;
    form: AddressingForm;
    /** How many name-shaped tokens after the leader can make up the dispatch name. */
    nameTokens: number;
}

const LEADERS: readonly Leader[] = [
    { token: "nexus", form: "named-executable", nameTokens: 2 },
    { token: "npx", form: "transpiler-script", nameTokens: 0 },
    { token: "tsx", form: "transpiler-script", nameTokens: 0 },
    { token: "node", form: "bundle-runtime", nameTokens: 0 },
    { token: "pnpm", form: "workspace-alias", nameTokens: 0 },
];

/** A line that is nothing but a run of three or more backticks, and whatever follows the run. */
const FENCE_RE = /^(`{3,})(.*)$/;

/**
 * The backtick run a fence line carries, or undefined when the line opens and closes nothing.
 * A body's own fences nest — a longer marker wraps blocks written with shorter ones — so the run
 * length, not the mere presence of a marker, decides what a line does.
 */
function fenceMarker(raw: string): { length: number; rest: string } | undefined {
    const match: RegExpMatchArray | null = raw.trim().match(FENCE_RE);
    return match === null ? undefined : { length: match[1].length, rest: match[2] };
}

/** The code spans of one body: every line inside a fence, plus every inline backtick span. */
function codeSpans(content: string): { line: number; text: string }[] {
    const spans: { line: number; text: string }[] = [];
    // The run length of the open fence, or 0 outside every fence.
    let openLength = 0;
    content.split("\n").forEach((raw, index) => {
        const line: number = index + 1;
        const marker: { length: number; rest: string } | undefined = fenceMarker(raw);
        if (openLength === 0) {
            // An info string may not itself contain a backtick, so such a line opens nothing.
            if (marker !== undefined && !marker.rest.includes("`")) {
                openLength = marker.length;
                return;
            }
        } else {
            // Only a marker at least as long as the opener closes it, and only when nothing
            // follows it. Anything shorter — or trailed by text — is literal fence content.
            if (marker !== undefined && marker.length >= openLength && marker.rest.trim() === "") {
                openLength = 0;
                return;
            }
            spans.push({ line, text: raw });
            return;
        }
        for (const match of raw.matchAll(/`([^`]+)`/g)) {
            spans.push({ line, text: match[1] });
        }
    });
    return spans;
}

/** Read the dispatch name a named form addresses: the name-shaped tokens before the first flag. */
function dispatchName(tokens: string[], limit: number): string | undefined {
    const parts: string[] = [];
    for (const token of tokens.slice(0, limit)) {
        if (!NAME_RE.test(token)) {
            break;
        }
        parts.push(token);
    }
    return parts.length === 0 ? undefined : parts.join(" ");
}

/** Classify one command-position segment, or return undefined when it invokes no toolkit. */
function readSegment(segment: string): { form: AddressingForm; name?: string; text: string } | undefined {
    const tokens: string[] = segment.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return undefined;
    }
    // A leading `VAR=value` assignment is shell preamble, not the command.
    while (tokens.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) {
        tokens.shift();
    }
    const leader: Leader | undefined = LEADERS.find((candidate) => candidate.token === tokens[0]);
    if (leader === undefined) {
        return undefined;
    }
    const rest: string[] = tokens.slice(1);
    if (leader.nameTokens === 0) {
        // A runtime named with nothing to run is prose about the runtime, not an invocation.
        return rest.length === 0 ? undefined : { form: leader.form, text: tokens.join(" ") };
    }
    const name: string | undefined = dispatchName(rest, leader.nameTokens);
    return name === undefined ? undefined : { form: leader.form, name, text: tokens.join(" ") };
}

/**
 * Every invocation in `content`'s code spans, in document order. Prose outside a code span is
 * never read; a repository-bound artifact inside one is read even when no command surrounds it.
 */
export function findInvocations(content: string): Invocation[] {
    const found: Invocation[] = [];
    for (const span of codeSpans(content)) {
        let matched = false;
        for (const segment of span.text.split(SEGMENT_SPLIT_RE)) {
            const read = readSegment(segment);
            if (read !== undefined) {
                matched = true;
                found.push({ relPath: "", line: span.line, text: read.text, form: read.form, name: read.name });
            }
        }
        if (!matched && REPO_BOUND_ARTIFACT_RE.test(span.text)) {
            found.push({ relPath: "", line: span.line, text: span.text.trim(), form: "unrecognised" });
        }
    }
    return found;
}

function classify(invocation: Invocation, surfaces: ToolkitSurfaces): Classification {
    if (invocation.form === "named-executable") {
        return surfaces.nexus.includes(invocation.name ?? "") ? "resolving" : "undeclared";
    }
    return "unmigrated";
}

/**
 * Shorten a named form to the longest prefix the surface declares, so `nexus workspace status
 * --root <dir>` resolves on the two-token name while `nexus deploy --payload <d>` resolves on one.
 * An undeclared name keeps every name-shaped token it wrote, so the failure names what was written.
 */
function resolveName(invocation: Invocation, surfaces: ToolkitSurfaces): Invocation {
    if (invocation.form !== "named-executable" || invocation.name === undefined) {
        return invocation;
    }
    const parts: string[] = invocation.name.split(" ");
    for (let take = parts.length; take > 0; take--) {
        const candidate: string = parts.slice(0, take).join(" ");
        if (surfaces.nexus.includes(candidate)) {
            return { ...invocation, name: candidate };
        }
    }
    return invocation;
}

/**
 * The inventory: every code-span invocation in every shipped body under `claudeDir`, classified
 * as resolving, undeclared, or not yet migrated. Sorted the way `listComponentFiles` sorts.
 */
export function scanComponentInvocations(claudeDir: string, surfaces: ToolkitSurfaces): Invocation[] {
    const inventory: Invocation[] = [];
    for (const relPath of listComponentFiles(claudeDir)) {
        if (!relPath.endsWith(BODY_EXTENSION)) {
            continue;
        }
        const content: string = fs.readFileSync(path.join(claudeDir, ...relPath.split("/")), "utf8");
        for (const raw of findInvocations(content)) {
            const invocation: Invocation = resolveName({ ...raw, relPath }, surfaces);
            inventory.push({ ...invocation, classification: classify(invocation, surfaces) });
        }
    }
    return inventory;
}

/**
 * The verdict over an inventory: an undeclared name fails, and so does any legacy repository-bound
 * form. Both name the body and the offending name, so the failure is actionable without re-running
 * a search.
 */
export function checkComponentInvocations(inventory: readonly Invocation[]): InvocationProblem[] {
    const problems: InvocationProblem[] = [];
    for (const site of inventory) {
        if (site.classification === "undeclared") {
            problems.push({
                relPath: site.relPath,
                message:
                    `${site.relPath}:${site.line} names '${site.name}', which the executable does not declare ` +
                    `— in: ${site.text}`,
            });
        } else if (site.classification === "unmigrated") {
            problems.push({
                relPath: site.relPath,
                message:
                    `${site.relPath}:${site.line} addresses the executable by ${site.form} rather than by name ` +
                    `— in: ${site.text}`,
            });
        }
    }
    return problems;
}

/** The gate's failure text: every problem, one per line, each naming its body and its name. */
export function formatInvocationProblems(problems: readonly InvocationProblem[]): string {
    return [
        "Component invocation gate (story #301) — a shipped body addresses the executable in a way it must not:",
        ...problems.map((problem) => `  - ${problem.message}`),
    ].join("\n");
}

/**
 * The declared surface, read from the registry that composes the executable's own usage text —
 * never the human usage prose, and never a duplicate of that list (decision records #325, #362).
 */
export function readToolkitSurfaces(): ToolkitSurfaces {
    return { nexus: DISPATCH_NAMES };
}
