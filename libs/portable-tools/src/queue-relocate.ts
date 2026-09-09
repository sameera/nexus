/**
 * One-shot relocation of stranded member-queue entries into the hub queue (epic #215, story #510).
 *
 * Runs from the hub, walks every present member's committed queue, and for every entry whose
 * close record names a repository this workspace declares, copies it into the hub queue,
 * commits it path-scoped, and reads the commit back to verify it byte for byte against the
 * source. It never removes the member-side copy — the relocation's whole point is to stop being
 * the second remover of a committed queue entry, so the lead deletes the leftover copy in an
 * ordinary commit, using the command this prints.
 *
 * Every candidate entry across every member is gated before any entry is copied: one entry this
 * relocation cannot place stops the whole run and names that entry, rather than leaving a
 * partially relocated workspace that looks finished and is not. Re-running against a workspace
 * already relocated finds every entry already present and identical in the hub and copies
 * nothing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Runner, defaultRunner, git } from "@nexus/close-migration/run";
import { type ResolvedWorkspace, resolveWorkspace } from "@nexus/workspace/resolve";
import { type ParseRangeResult, parseRange } from "./derive-entry-diff.js";

export type RelocateProblem =
    | "not-a-workspace-hub"
    | "must-run-from-hub"
    | "missing-close-record"
    | "missing-range"
    | "malformed-range"
    | "unknown-repo"
    | "entry-conflict"
    | "verify-mismatch";

export interface RelocateDiagnostic {
    member: string;
    entry: string;
    problem: RelocateProblem;
    message: string;
}

export interface RelocatedEntry {
    member: string;
    entry: string;
    hubCommit: string;
    /** The command the lead runs, as an ordinary commit, to delete the now-relocated member copy. */
    removeCommand: string;
}

export interface RelocateOutcome {
    relocated: RelocatedEntry[];
    alreadyPresent: Array<{ member: string; entry: string }>;
}

export type RelocateResult = { ok: true; outcome: RelocateOutcome } | { ok: false; errors: RelocateDiagnostic[] };

interface Candidate {
    member: string;
    memberRoot: string;
    entry: string;
    entryDir: string;
    hubDest: string;
}

/** Directory names (not dotfiles) directly under `<root>/.nexus/queue`. */
function listQueueEntries(root: string): string[] {
    const dir = path.join(root, ".nexus", "queue");
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort();
}

/** Sorted relative-path → git blob SHA for every file under `root`, read directly off disk. */
function manifestOf(root: string, run: Runner): Map<string, string> {
    const manifest = new Map<string, string>();
    const walk = (dir: string, relPrefix: string) => {
        for (const name of fs.readdirSync(dir).sort()) {
            const abs = path.join(dir, name);
            const rel = relPrefix ? `${relPrefix}/${name}` : name;
            if (fs.statSync(abs).isDirectory()) {
                walk(abs, rel);
            } else {
                const sha = git(run, root, "hash-object", abs);
                if (sha) {
                    manifest.set(rel, sha);
                }
            }
        }
    };
    walk(root, "");
    return manifest;
}

function manifestsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
    if (a.size !== b.size) {
        return false;
    }
    for (const [key, sha] of a) {
        if (b.get(key) !== sha) {
            return false;
        }
    }
    return true;
}

function knownRepo(ws: ResolvedWorkspace, repo: string): boolean {
    return repo === ws.hub.normalizedRemote || ws.members.some((m) => m.normalizedRemote === repo);
}

function gateEntry(ws: ResolvedWorkspace, c: Candidate): RelocateDiagnostic | { alreadyPresent: boolean } {
    const parsed: ParseRangeResult = parseRange(c.entryDir);
    if (!parsed.ok) {
        const problem: RelocateProblem =
            parsed.error.problem === "missing-close-record"
                ? "missing-close-record"
                : parsed.error.problem === "malformed-range"
                  ? "malformed-range"
                  : "missing-range";
        return { member: c.member, entry: c.entry, problem, message: parsed.error.message };
    }
    for (const item of parsed.range) {
        if (!knownRepo(ws, item.repo)) {
            return {
                member: c.member,
                entry: c.entry,
                problem: "unknown-repo",
                message: `${c.entry}'s close record names repo '${item.repo}', which this workspace does not declare (hub or member); fix .nexus/config/workspace.yml or the stamp`,
            };
        }
    }
    if (fs.existsSync(c.hubDest)) {
        const run = defaultRunner;
        const same = manifestsEqual(manifestOf(c.entryDir, run), manifestOf(c.hubDest, run));
        if (!same) {
            return {
                member: c.member,
                entry: c.entry,
                problem: "entry-conflict",
                message: `the hub queue already holds '${c.entry}' and it differs from ${c.member}'s copy; inspect ${c.hubDest}, remove or reconcile it, then re-run`,
            };
        }
        return { alreadyPresent: true };
    }
    return { alreadyPresent: false };
}

export function relocateQueue(hubRoot: string, run: Runner = defaultRunner): RelocateResult {
    const resolved = resolveWorkspace(hubRoot);
    if (!resolved.ok || resolved.workspace.mode !== "workspace") {
        return {
            ok: false,
            errors: [
                {
                    member: "(hub)",
                    entry: "",
                    problem: "not-a-workspace-hub",
                    message: !resolved.ok
                        ? resolved.error.message
                        : `${hubRoot} has no hub manifest (.nexus/config/workspace.yml); relocation runs only from a hub`,
                },
            ],
        };
    }
    const ws = resolved.workspace;
    if (path.resolve(hubRoot) !== path.resolve(ws.hubRoot)) {
        return {
            ok: false,
            errors: [
                {
                    member: "(hub)",
                    entry: "",
                    problem: "must-run-from-hub",
                    message: `${hubRoot} resolved to workspace hub ${ws.hubRoot}; run the relocation from the hub checkout itself`,
                },
            ],
        };
    }

    // --- 1. Enumerate every candidate across every present member -------------
    const candidates: Candidate[] = [];
    for (const member of ws.members) {
        if (member.checkout !== "present") {
            continue;
        }
        for (const entry of listQueueEntries(member.expectedPath)) {
            candidates.push({
                member: member.name,
                memberRoot: member.expectedPath,
                entry,
                entryDir: path.join(member.expectedPath, ".nexus", "queue", entry),
                hubDest: path.join(ws.hubRoot, ".nexus", "queue", entry),
            });
        }
    }

    // --- 2. Gate every candidate before copying any ----------------------------
    const errors: RelocateDiagnostic[] = [];
    const toCopy: Candidate[] = [];
    const alreadyPresent: Array<{ member: string; entry: string }> = [];
    for (const c of candidates) {
        const gated = gateEntry(ws, c);
        if ("problem" in gated) {
            errors.push(gated);
        } else if (gated.alreadyPresent) {
            alreadyPresent.push({ member: c.member, entry: c.entry });
        } else {
            toCopy.push(c);
        }
    }
    if (errors.length > 0) {
        return { ok: false, errors };
    }

    // --- 3. Copy, commit, and verify each entry ---------------------------------
    const relocated: RelocatedEntry[] = [];
    for (const c of toCopy) {
        const relPath = `.nexus/queue/${c.entry}`;
        fs.mkdirSync(path.join(ws.hubRoot, ".nexus", "queue"), { recursive: true });
        fs.cpSync(c.entryDir, c.hubDest, { recursive: true });

        const addResult = run("git", ["add", "--", relPath], { cwd: ws.hubRoot });
        const commitResult =
            addResult.status === 0
                ? run(
                      "git",
                      ["commit", "-m", `relocate: queue entry ${c.entry} from ${c.member}`, "--", relPath],
                      { cwd: ws.hubRoot },
                  )
                : addResult;
        if (addResult.status !== 0 || commitResult.status !== 0) {
            fs.rmSync(c.hubDest, { recursive: true, force: true });
            return {
                ok: false,
                errors: [
                    {
                        member: c.member,
                        entry: c.entry,
                        problem: "entry-conflict",
                        message: `failed to commit the relocated entry in the hub: ${commitResult.stderr || addResult.stderr}`,
                    },
                ],
            };
        }

        const hubCommit = git(run, ws.hubRoot, "rev-parse", "HEAD") ?? "";
        const same = manifestsEqual(manifestOf(c.entryDir, run), manifestOf(c.hubDest, run));
        if (!same) {
            return {
                ok: false,
                errors: [
                    {
                        member: c.member,
                        entry: c.entry,
                        problem: "verify-mismatch",
                        message: `hub commit ${hubCommit} exists but does not match ${c.member}'s copy of '${c.entry}'; inspect it manually — never auto-reset hub history`,
                    },
                ],
            };
        }

        relocated.push({
            member: c.member,
            entry: c.entry,
            hubCommit,
            removeCommand: `git -C ${c.memberRoot} rm -r -q -- ${relPath} && git -C ${c.memberRoot} commit -qm "queue: remove relocated entry ${c.entry}"`,
        });
    }

    return { ok: true, outcome: { relocated, alreadyPresent } };
}

export function renderRelocateOutcome(o: RelocateOutcome): string {
    const lines: string[] = [];
    if (o.relocated.length === 0 && o.alreadyPresent.length === 0) {
        lines.push("Relocated nothing — no member queue holds an entry.");
        return lines.join("\n");
    }
    for (const r of o.relocated) {
        lines.push(`Relocated ${r.entry} (from ${r.member}) — hub commit ${r.hubCommit}`);
        lines.push(`  the member copy is still at ${r.member}; delete it with:`);
        lines.push(`  ${r.removeCommand}`);
    }
    for (const p of o.alreadyPresent) {
        lines.push(`${p.entry} (from ${p.member}) already relocated — verified identical; nothing to do`);
    }
    if (o.relocated.length === 0) {
        lines.push("Ran again on an already-relocated workspace: moved nothing.");
    }
    return lines.join("\n");
}

export function renderRelocateFailure(errors: RelocateDiagnostic[]): string {
    const lines = [`Relocation refused: ${errors.length} problem(s)`];
    for (const e of errors) {
        lines.push(`  ${e.problem} [${e.member}/${e.entry}]: ${e.message}`);
    }
    return lines.join("\n");
}

export function runCli(argv: string[]): number {
    const root = argv[0] ?? process.cwd();
    const result = relocateQueue(path.resolve(root));
    if (!result.ok) {
        process.stderr.write(renderRelocateFailure(result.errors) + "\n");
        return 1;
    }
    process.stdout.write(renderRelocateOutcome(result.outcome) + "\n");
    return 0;
}
