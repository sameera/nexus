/**
 * Filing approved deferred scope as epic stubs (epic #830, story #866, decision record #872, D9).
 *
 * Close files each approved proposal as one unplanned epic stub through the existing batch filer
 * (`nexus create-story`), the path today's close files its stubs through: one `STORY-*.md` work
 * item per stub, classified as an epic, carrying the unplanned label and no parent, so the filer's
 * own refusal of a parented stub still applies. The classification and the label are read through
 * the shared publishing resolver, never written out here. Every issue goes into the issues
 * repository close resolved (G46), which can differ from the repository stories are filed into.
 *
 * The filer's resume ledger gives the numbers. It is not what makes a re-run safe — a re-run finds
 * its earlier stubs by their key, through the epic's back-references — but its refs are named for
 * the proposal, never for the position in the batch, so a ledger an interrupted run left behind
 * can never hand one proposal's number to another.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { type FilerEnvironment } from "@nexus/delivery-config/story-filer/environment";
import { runCreateStory } from "@nexus/delivery-config/story-filer/run";

/** One stub to file: the filer's ref, the key its number is returned under, and its title and body. */
export interface StubToFile {
    ref: string;
    key: string;
    title: string;
    body: string;
}

export type FileStubsResult =
    | { ok: true; numbers: Map<string, number>; notes: string[] }
    /** `numbers` holds every stub that was filed before the failure. */
    | { ok: false; message: string; numbers: Map<string, number> };

/** The resume ledger's file name, as the filer writes it. */
const LEDGER = ".nxs-created.json";

/** A zero-width space: breaks a run of hyphens without changing what a reader sees. */
const BREAK = "​";

/** A title the filer's line-oriented frontmatter reader reads back: quoted, no line break, no `---`. */
function frontmatterTitle(title: string): string {
    return `"${title.replace(/\s+/g, " ").replace(/-{3,}/g, (run) => run.split("").join(BREAK))}"`;
}

/** The filer's lookup form of a ref: its `STORY-` prefix dropped and its case ignored. */
function ledgerRef(ref: string): string {
    return ref.trim().replace(/^story-/i, "").trim().toLowerCase();
}

/**
 * File `stubs` into `issuesRepo` from the checkout at `root`. The scratch folder the filer reads
 * lives under the checkout's ignored `.nexus/tmp/`, named so distill never reads it as an entry,
 * and is removed once every stub is filed.
 */
export function fileDeferredStubs(root: string, issuesRepo: string, batch: string, stubs: readonly StubToFile[], env?: FilerEnvironment): FileStubsResult {
    const dir = path.join(root, ".nexus", "tmp", `close-stubs-${batch}`);
    const unplanned = resolvePublishingKey(root, "unplanned-label");
    const epicLabel = resolvePublishingKey(root, "epic-label");
    const epicType = resolvePublishingKey(root, "epic-type");

    fs.mkdirSync(dir, { recursive: true });
    for (const name of fs.readdirSync(dir)) if (/^STORY-.*\.md$/.test(name)) fs.rmSync(path.join(dir, name));
    stubs.forEach((s, i) => {
        const fm = ["---", `ref: ${s.ref}`, `title: ${frontmatterTitle(s.title)}`, `labels: [${unplanned}]`, "---", ""];
        fs.writeFileSync(path.join(dir, `STORY-STUB-${String(i + 1).padStart(2, "0")}.md`), `${fm.join("\n")}\n${s.body}`);
    });

    const said: string[] = [];
    const argv = [dir, "--root", root, "--keep-manifest", "--issues-repo", issuesRepo];
    if (epicLabel !== "") argv.push("--classification-label", epicLabel);
    if (epicType !== "") argv.push("--classification-type", epicType);
    const code = runCreateStory(argv, { cwd: root, stdout: () => undefined, stderr: (line) => said.push(line) }, env);

    const numbers = new Map<string, number>();
    let ledger: Record<string, { number?: string }> = {};
    try {
        ledger = JSON.parse(fs.readFileSync(path.join(dir, LEDGER), "utf8")) as Record<string, { number?: string }>;
    } catch {
        // No ledger: nothing was filed.
    }
    for (const s of stubs) {
        const n = Number(ledger[ledgerRef(s.ref)]?.number);
        if (Number.isInteger(n) && n > 0) numbers.set(s.key, n);
    }

    const missing = stubs.filter((s) => !numbers.has(s.key));
    if (missing.length > 0) {
        const cause = said.filter((l) => l.trim() !== "").slice(-3).join(" ") || `the filer exited ${code}`;
        return { ok: false, message: `${missing.length} of ${stubs.length} stub(s) were not filed (${missing.map((s) => `"${s.title}"`).join(", ")}): ${cause}`, numbers };
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return {
        ok: true,
        numbers,
        notes: code === 0 ? [] : [`Every stub was filed, but the batch filer reported part of its decoration incomplete: ${said.filter((l) => l.trim() !== "").slice(-2).join(" ")}`],
    };
}
