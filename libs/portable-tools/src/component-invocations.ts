/**
 * The component-invocation gate (story #301, decision record #325): every toolkit invocation
 * written in a shipped component body must name a toolkit and a dispatch name that toolkit
 * declares, and the migration to that shape cannot silently regress.
 *
 * One scanner walks the same set of shipped bodies the payload-composition boundary already walks,
 * extracts every invocation written in a code span — fenced or inline, because a legacy path one
 * backtick away is still an instruction — and classifies it against a closed set of addressing
 * forms: the two named-toolkit forms, and the legacy repository-bound ones (a transpiler run
 * against a script, an interpreter run against a script, a runtime run against a bundle, and a
 * workspace script alias). Being unrecognised is itself reportable.
 *
 * A named form is resolved against the toolkit's own declared surface, which the caller obtains
 * from that surface and never from a copy. A legacy form is tolerated only in a body the pending
 * register still lists; anywhere else it fails the gate by name. The register only shrinks, and
 * reaching empty is this epic's completion condition.
 *
 * Node builtins only; this file is not a bundle entry point, so it is never itself vendored.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { DISPATCH_NAMES } from "./nexus-cli.js";
import { listComponentFiles } from "./vendor-components.js";

/** The closed set of addressing forms a code-span invocation can take. */
export type AddressingForm =
    /** `nexus <verb> [<subverb>]` — the named TypeScript executable. */
    | "named-executable"
    /** `nexus-gh <capability>` — the named Python toolkit. */
    | "named-python-toolkit"
    /** `tsx <script>` / `npx tsx <script>` — a transpiler run against a repository-relative script. */
    | "transpiler-script"
    /** `python <script>` / `python3 <script>` — an interpreter run against a script path. */
    | "interpreter-script"
    /** `node <bundle>.mjs` — a runtime run against a vendored bundle. */
    | "bundle-runtime"
    /** `pnpm <script>` — a workspace script alias, which resolves only inside a Nexus checkout. */
    | "workspace-alias"
    /** A repository-bound artifact named in a code span with no command around it. */
    | "unrecognised";

/** Every form other than the two named ones is repository-bound and must not survive this epic. */
export const LEGACY_FORMS: readonly AddressingForm[] = [
    "transpiler-script",
    "interpreter-script",
    "bundle-runtime",
    "workspace-alias",
    "unrecognised",
];

/** How one invocation stands against the declared surfaces. */
export type Classification =
    /** A named form whose dispatch name the toolkit declares. */
    | "resolving"
    /** A named form whose dispatch name the toolkit does not declare — always a failure. */
    | "undeclared"
    /** A legacy repository-bound form — a failure unless the body is still on the register. */
    | "unmigrated";

/** The declared surface of each toolkit, read from that surface and never from a duplicate. */
export interface ToolkitSurfaces {
    /** Complete dispatch names the `nexus` executable answers to, subverbs included. */
    nexus: readonly string[];
    /** Capability names the `nexus-gh` toolkit answers to. */
    nexusGh: readonly string[];
}

/** One invocation found in one code span of one body. */
export interface Invocation {
    /** Posix-style path relative to the `.claude/` root; empty from the content-only entry point. */
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

/** A dispatch name, a capability name, or a workspace script alias — never a path or a flag. */
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

// Longest first: `nexus-gh` must win over `nexus`.
const LEADERS: readonly Leader[] = [
    { token: "nexus-gh", form: "named-python-toolkit", nameTokens: 1 },
    { token: "nexus", form: "named-executable", nameTokens: 2 },
    { token: "npx", form: "transpiler-script", nameTokens: 0 },
    { token: "tsx", form: "transpiler-script", nameTokens: 0 },
    { token: "python3", form: "interpreter-script", nameTokens: 0 },
    { token: "python", form: "interpreter-script", nameTokens: 0 },
    { token: "node", form: "bundle-runtime", nameTokens: 0 },
    { token: "pnpm", form: "workspace-alias", nameTokens: 0 },
];

/** The code spans of one body: every line inside a fence, plus every inline backtick span. */
function codeSpans(content: string): { line: number; text: string }[] {
    const spans: { line: number; text: string }[] = [];
    let fenced = false;
    content.split("\n").forEach((raw, index) => {
        const line: number = index + 1;
        if (raw.trim().startsWith("```")) {
            fenced = !fenced;
            return;
        }
        if (fenced) {
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
    if (invocation.form === "named-python-toolkit") {
        return surfaces.nexusGh.includes(invocation.name ?? "") ? "resolving" : "undeclared";
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
 * The verdict over an inventory. An undeclared name always fails, wherever it sits. A legacy form
 * fails unless its body is still on `pending`. A `pending` entry for a body with no legacy form
 * left also fails: the register only shrinks, so a spent entry must be deleted rather than kept.
 */
export function checkComponentInvocations(inventory: readonly Invocation[], pending: readonly string[]): InvocationProblem[] {
    const problems: InvocationProblem[] = [];
    for (const site of inventory) {
        if (site.classification === "undeclared") {
            problems.push({
                relPath: site.relPath,
                message:
                    `${site.relPath}:${site.line} names '${site.name}', which the toolkit does not declare ` +
                    `— in: ${site.text}`,
            });
        } else if (site.classification === "unmigrated" && !pending.includes(site.relPath)) {
            problems.push({
                relPath: site.relPath,
                message:
                    `${site.relPath}:${site.line} addresses a toolkit by ${site.form} rather than by name ` +
                    `— in: ${site.text}`,
            });
        }
    }
    for (const relPath of pending) {
        const stillLegacy: boolean = inventory.some((site) => site.relPath === relPath && site.classification === "unmigrated");
        if (!stillLegacy) {
            problems.push({
                relPath,
                message: `${relPath} is on the pending register but has nothing left to migrate — delete the entry`,
            });
        }
    }
    return problems;
}

/** The gate's failure text: every problem, one per line, each naming its body and its name. */
export function formatInvocationProblems(problems: readonly InvocationProblem[]): string {
    return [
        "Component invocation gate (story #301) — a shipped body addresses a toolkit it must not:",
        ...problems.map((problem) => `  - ${problem.message}`),
    ].join("\n");
}

/** The Python toolkit's entry point inside this checkout — the only Python the gate ever runs. */
export function pythonToolkitEntry(repoRoot: string): string {
    return path.join(repoRoot, "libs", "gh-toolkit", "bin", "nexus-gh");
}

/**
 * Both declared surfaces, each read from the surface itself (decision record #325). The
 * executable's dispatch names come from the registry that composes its own usage text; the Python
 * toolkit's capability names come from executing its entry point and reading the machine listing
 * it emits for this purpose — never the human usage prose, and never a duplicate of either list.
 * A surface that cannot be obtained throws; the gate never falls back to an assumed list.
 */
export function readToolkitSurfaces(repoRoot: string): ToolkitSurfaces {
    const entry: string = pythonToolkitEntry(repoRoot);
    const listing: string = execFileSync("python3", [entry, "--capabilities"], { encoding: "utf8" });
    const parsed: { capabilities?: unknown } = JSON.parse(listing);
    if (!Array.isArray(parsed.capabilities)) {
        throw new Error(`the Python toolkit's capability listing is not a name array: ${listing}`);
    }
    return { nexus: DISPATCH_NAMES, nexusGh: parsed.capabilities as string[] };
}
