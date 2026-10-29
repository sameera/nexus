/**
 * `nexus implement-epic` — implement an approved epic unattended (epic #928, decision record #966).
 *
 * The command replaces the two implement-epic scripts. It checks the epic before any model runs,
 * creates the epic's branch itself, runs one agent stage that implements the stories, checks the
 * story commits, pushes, opens a draft pull request that claims every live story, then runs analyze
 * against the pull request and fix rounds until the newest trusted verdict has no open Critical,
 * High or Medium item. It marks the pull request ready only on such a verdict for its current head.
 *
 * Every decision the command makes reads git, the issue graph, the published verdict, or the
 * fixed-prefix lines of a stage's final message (D12). Each stage's prompt is written once and the
 * launcher turns it into the selected harness's form. Every stop goes through one path (D11): it
 * names the stage and the reason, rewrites the run status section of the pull request body when a
 * pull request exists, and exits non-zero.
 *
 * Only the command posts answers (D9). It posts one only when the answer follows from something a
 * person wrote before the run started, and an answer line that appears or changes during an agent
 * stage stops the run.
 */

import { type Departure, type Finding, type Judgments, openItems } from "@nexus/pr-acceptance/judgments-block";
import { type PrAnswer } from "@nexus/pr-acceptance/waiver";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { resolveEpic } from "@nexus/epic-resolve/resolve";
import { readPrVerdict } from "@nexus/epic-verdicts/pr-verdict";
import { readItemRegistry } from "@nexus/epic-verdicts/verdict-items";
import { readPrWaivers } from "@nexus/pr-acceptance/waiver";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { git, type Runner } from "@nexus/workspace/run";
import { onPath, spawnSession, type SessionEnd, type SessionSpec } from "./distill-command.js";

export type Harness = "claude" | "codex";

/** The final-message prefix of the implementation stage's blocked outcome (D3). */
export const BLOCKED_PREFIX = "Implementation blocked:";

/** The final-message prefix of each escalation a fix round names instead of fixing (D7). */
export const ESCALATION_PREFIX = "Escalation:";

/** The final-message prefix naming the suite the stage ran, when none was declared (D14). */
export const TEST_COMMAND_PREFIX = "Test command:";

/** The markers around the run status section of the pull request body (D11). */
export const STATUS_OPEN = "<!-- nexus:implement-epic-status -->";
export const STATUS_CLOSE = "<!-- /nexus:implement-epic-status -->";

/** The permission mode each harness runs under unless the lead names another (D15). */
export const DEFAULT_PERMISSION_MODE: Record<Harness, string> = {
    claude: "auto",
    codex: "workspace-write",
};

export const DEFAULT_TURNS = 40;
export const DEFAULT_FIX_TURNS = 30;
export const DEFAULT_ROUNDS = 5;

/** The settings key the test command is read from, through the shared resolver (D14, G21). */
export const TEST_COMMAND_KEY = "test-command";

export interface ImplementInput {
    cwd: string;
    epic: number;
    harness: Harness;
    /** A permission mode named on the invocation, or null for the harness default. */
    permissionMode: string | null;
    /** A test command named on the invocation, or null to read the setting. */
    testCommand: string | null;
    /** A base branch named on the invocation, or null for the repository's default branch. */
    base: string | null;
    turns: number;
    fixTurns: number;
    rounds: number;
    /** Extra arguments for the harness, passed after `--`. They never reach a prompt. */
    harnessArgs: string[];
}

/** What the one epic resolver gives the command (G2). */
export interface EpicFacts {
    title: string;
    /** The live stories, records and withdrawn stories already removed, by ascending number. */
    stories: number[];
    blockedBy: Map<number, number[]>;
    record: { number: number; state: "open" | "closed" } | null;
    /** The `owner/repo` the epic's issues live in. */
    issuesRepo: string;
    /** Whether the epic carries the repository's needs-design label. */
    needsDesign: boolean;
    /** The root the settings resolver reads from. */
    root: string;
}

export interface Commit {
    sha: string;
    /** The full commit message. */
    message: string;
}

export type VerdictRead =
    | { ok: true; found: false; prHead: string }
    | { ok: true; found: true; head: string; prHead: string; judgments: Judgments | null }
    | { ok: false; message: string };

export type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

export interface ImplementDeps {
    resolveEpic(cwd: string, epic: number): Outcome<EpicFacts>;
    /** The test command the settings declare, or "" when none does. */
    testCommandSetting(root: string): string;
    defaultBranch(cwd: string): string | null;
    clean(cwd: string): boolean;
    branchExists(cwd: string, branch: string): boolean;
    /** Create `branch` off `base` and check it out; the base commit it was cut from. */
    createBranch(cwd: string, branch: string, base: string): Outcome<string>;
    currentBranch(cwd: string): string | null;
    headSha(cwd: string): string | null;
    /** The commits after `baseSha` up to HEAD, oldest first. */
    commits(cwd: string, baseSha: string): Commit[] | null;
    push(cwd: string, branch: string): Outcome<null>;
    /** The `owner/repo` the pull request lives in. */
    prRepo(cwd: string): string | null;
    openPr(cwd: string, branch: string): Outcome<number | null>;
    createPr(cwd: string, pr: { base: string; branch: string; title: string; body: string }): Outcome<number>;
    prBody(cwd: string, pr: number): string | null;
    editPrBody(cwd: string, pr: number, body: string): boolean;
    markReady(cwd: string, pr: number): boolean;
    /** The newest trusted verdict, read the way close and the merge pre-check read it (G9, G24). */
    readVerdict(cwd: string, pr: number, repo: string, issuesRepo: string): VerdictRead;
    /** Every answer line on the pull request, through the one answer reader (G26). */
    answers(cwd: string, pr: number, repo: string): Outcome<PrAnswer[]>;
    postComment(cwd: string, pr: number, body: string): boolean;
    /** A file's content at a commit, or null when it is absent there. */
    fileAt(cwd: string, sha: string, file: string): string | null;
    autoModeAvailable(): boolean;
    onPath(command: string): boolean;
    session(spec: SessionSpec, line: (text: string) => void): Promise<SessionEnd>;
}

export interface ImplementIo {
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/** The branch a run creates and the only branch it may push (D2). */
export function branchFor(epic: number): string {
    return `nxs/epic-${epic}`;
}

/** Appended to every stage prompt: nobody can answer a question. */
export const UNATTENDED_CLAUSE =
    "\n\nYou are running unattended inside a headless command. Nobody can answer a question, so never end by " +
    "asking which option to take, and never wait for a decision. If the stage cannot proceed, state in " +
    "your final message what blocked it and stop. Otherwise carry the stage through to its documented output.";

/** The implementation stage's goal: met by the stories done, or by the blocked outcome (D3). */
export function implementationPrompt(epic: number, turns: number, testCommand: string | null): string {
    const suite =
        testCommand === null
            ? `No test command is declared. Find the repository's full test suite and run it. When you finish the stories, end your final message with one line beginning exactly '${TEST_COMMAND_PREFIX}' that names the command you ran.`
            : `The full test suite is \`${testCommand}\`.`;
    return (
        `/goal Either (a) every story sub-issue of epic #${epic} is implemented on this branch — ` +
        "one commit per story, in blocked_by order, each commit body ending with a line " +
        "reading exactly 'Closes #<that story's issue number>' — and the full test suite " +
        "passes, or (b) the run has stopped on something it cannot do from this checkout, " +
        "has made no commit, and its final message ends with one line beginning exactly " +
        `'${BLOCKED_PREFIX}' that names what blocked it and what would unblock it. ` +
        "Outcome (b) is the only way to stop short; once you have written that line, the " +
        "goal holds and you stop — do not wait for a reply. Prove (a): git log shows one " +
        "commit per story, each with its Closes line, test command exits 0. Start by " +
        `running /nxs-epic-resolve ${epic}, then read the ` +
        "decision-record sub-issue it names with gh issue view. The record is binding: " +
        "every guarantee (G<n>) under Guarantees must hold, including those under " +
        "'Existing behaviour to preserve'. Each decision (D<n>) under 'Design rationale " +
        "and mechanism' → 'Decisions and reasons' is built in the commit of the story " +
        "its 'Delivered by' line names, the way Mechanism describes; a decision " +
        "delivered by an issue outside this epic is not yours to build. Do the Approval " +
        "brief's 'Before implementation' items before the first story; if one cannot be " +
        "done from this checkout, end with outcome (b). Leave 'Delivered by another " +
        "epic' and 'Committed follow-up' items and Concept-store changes alone — other " +
        "issues and /nxs.distill deliver them. " +
        "Before starting each story, re-read its epic.md section and the decisions it " +
        "delivers. Stay on the current branch. Do not push and do not open a PR — the calling command does both. " +
        `${suite} Stop after ${turns} turns.`
    );
}

/** One harness call for `prompt` (D12): the prompt is written once and turned into the harness's form. */
export function stageSpec(harness: Harness, prompt: string, mode: string, harnessArgs: string[], cwd: string): SessionSpec {
    if (harness === "codex") {
        // Codex has skills, not Claude slash commands or its /goal extension.
        const text = prompt
            .replace(/^\/goal /, "")
            .replace(/\/nxs\.analyze/g, "$nxs-analyze")
            .replace(/\/nxs\.distill/g, "$nxs-distill")
            .replace(/\/nxs\.decision-record/g, "$nxs-decision-record")
            .replace(/\/nxs-epic-resolve/g, "$nxs-epic-resolve");
        return { command: "codex", args: ["exec", "--sandbox", mode, "--json", ...harnessArgs, "--", text], cwd };
    }
    return { command: "claude", args: ["-p", prompt, "--permission-mode", mode, "--output-format", "stream-json", "--verbose", ...harnessArgs], cwd };
}

/** The last line of `message` that begins with `prefix`, with the prefix removed; null when none. */
export function prefixedLine(message: string | null, prefix: string): string | null {
    const lines = (message ?? "").split(/\r?\n/).map((l) => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith(prefix)) return lines[i].slice(prefix.length).trim();
    }
    return null;
}

/** Every line of `message` that begins with `prefix`, with the prefix removed. */
export function prefixedLines(message: string | null, prefix: string): string[] {
    return (message ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith(prefix))
        .map((l) => l.slice(prefix.length).trim());
}

const sameRepo = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The story numbers a commit message claims with a closing keyword, in `issuesRepo`. */
export function claimedStories(message: string, issuesRepo: string): number[] {
    const out: number[] = [];
    for (const line of message.split(/\r?\n/)) {
        const m = /^\s*(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:([\w.-]+\/[\w.-]+))?#(\d+)\s*$/i.exec(line);
        if (m === null) continue;
        if (m[1] !== undefined && !sameRepo(m[1], issuesRepo)) continue;
        out.push(Number(m[2]));
    }
    return out;
}

/**
 * The story commit check (D3, G6): one commit per live story, each claiming its story, in an order
 * the dependency graph allows. A commit that claims no story is a follow-up and passes. The reason
 * the branch fails, or null when it passes.
 */
export function checkStoryCommits(commits: readonly Commit[], stories: readonly number[], blockedBy: Map<number, number[]>, issuesRepo: string): string | null {
    const live = new Set(stories);
    const at = new Map<number, number>();
    for (let i = 0; i < commits.length; i++) {
        const claimed = [...new Set(claimedStories(commits[i].message, issuesRepo).filter((n) => live.has(n)))];
        if (claimed.length > 1) return `commit ${commits[i].sha.slice(0, 12)} claims more than one story (${claimed.map((n) => `#${n}`).join(", ")}); each story needs its own commit.`;
        if (claimed.length === 0) continue;
        const story = claimed[0];
        if (at.has(story)) return `story #${story} is claimed by more than one commit; each story needs exactly one.`;
        at.set(story, i);
    }
    const missing = stories.filter((s) => !at.has(s));
    if (missing.length > 0) return `no commit claims ${missing.map((n) => `#${n}`).join(", ")} with a 'Closes #<n>' line.`;
    for (const story of stories) {
        for (const blocker of blockedBy.get(story) ?? []) {
            if (!live.has(blocker)) continue;
            if ((at.get(blocker) ?? -1) > (at.get(story) ?? -1)) return `story #${story} is committed before #${blocker}, which blocks it.`;
        }
    }
    return null;
}

/** A story reference in the pull request's repository (G7): bare when the issues live there. */
export function issueRef(n: number, issuesRepo: string, prRepo: string): string {
    return sameRepo(issuesRepo, prRepo) ? `#${n}` : `${issuesRepo}#${n}`;
}

/** The status section, between its markers. */
export function statusSection(text: string): string {
    return `${STATUS_OPEN}\n**Run status (\`nexus implement-epic\`):** ${text}\n${STATUS_CLOSE}`;
}

/** `body` with its status section rewritten, or the section appended when it has none (D11). */
export function withStatus(body: string, text: string): string {
    const section = statusSection(text);
    const start = body.indexOf(STATUS_OPEN);
    const end = body.indexOf(STATUS_CLOSE);
    if (start !== -1 && end > start) return body.slice(0, start) + section + body.slice(end + STATUS_CLOSE.length);
    return `${body.trimEnd()}\n\n${section}\n`;
}

/** The draft pull request's body: the claims, then the status section (D4). */
export function prBody(epic: number, stories: readonly number[], issuesRepo: string, prRepo: string, status: string): string {
    return [
        `Implements the story sub-issues of ${issueRef(epic, issuesRepo, prRepo)}, one commit per story in blocked-by order.`,
        "",
        ...stories.map((s) => `Closes ${issueRef(s, issuesRepo, prRepo)}`),
        "",
        "The epic itself closes through `nexus close`, not by merge.",
        "",
        statusSection(status),
        "",
    ].join("\n");
}

type Item = Departure | Finding;

const BLOCKING: ReadonlySet<string> = new Set(["critical", "high", "medium"]);

/** The open Critical, High and Medium items of a verdict. */
export function openBlocking(judgments: Judgments | null): Item[] {
    return judgments === null ? [] : openItems(judgments).filter((i) => BLOCKING.has(i.severity));
}

/** The work list (D6): the open Critical, High and Medium items. A Low item is never on it. */
export function workList(judgments: Judgments | null): Item[] {
    return openBlocking(judgments);
}

/** The departures the verdict already marks as superseding a record decision: escalations with no stage spent (D7). */
export function supersedingDepartures(items: readonly Item[]): Departure[] {
    return items.filter((i): i is Departure => i.kind === "departure" && i.supersedes !== null);
}

function describeItem(i: Item): string {
    const about = i.kind === "departure" ? `departs from ${i.departsFrom}` : `about ${i.about}`;
    const where = i.location === undefined ? (i.files.length > 0 ? i.files.join(", ") : "no file named") : `${i.location.file}:${i.location.line}`;
    return [`- ${i.id} (${i.severity}, ${about}): ${i.summary}`, `  Where: ${where}`, ...(i.fix === undefined ? [] : [`  Fix: ${i.fix}`])].join("\n");
}

/** A fix round's goal: the listed items only, and the text each one cites. */
export function fixPrompt(epic: number, round: number, rounds: number, items: readonly Item[], testCommand: string | null, fixTurns: number): string {
    const suite = testCommand === null ? "the repository's full test suite" : `\`${testCommand}\``;
    return [
        `/goal Every item listed below is fixed in the code on this branch, the fixes are committed, and ${suite} passes. This is round ${round} of ${rounds} on epic #${epic}.`,
        "",
        "The list is the whole work list, taken from the newest analyze verdict on the pull request:",
        "",
        ...items.map(describeItem),
        "",
        "Read only what an item cites: the acceptance criterion, the record guarantee (G<n>) or decision (D<n>), and the files it points at. Do not read the epic or the decision record end to end, and do not run /nxs.analyze — the calling command runs it the moment you stop.",
        "",
        "Sort every item before you edit anything. An item is an escalation when its fix would contradict a decision or guarantee the record states, or would meet a guarantee only by changing its wording. It is also an escalation when the fix is architectural: it adds a dependency, changes an interface or data format that another component or stage reads, or moves a responsibility between components the record names. Every other item is fixable.",
        "",
        `If any item is an escalation, change nothing and commit nothing. End your final message with one line per escalation, beginning exactly '${ESCALATION_PREFIX}', then the item's ID and the reason, and stop. The lead revises the record; the calling command stops the run.`,
        "",
        "Otherwise fix each item with the smallest change that satisfies what it cites. Test first: write or amend the test that pins the behaviour before the code that satisfies it. Never make an item disappear instead of fixing it: do not weaken, skip or delete a test, and do not edit the epic or the decision record.",
        "",
        "Never answer a departure, a finding or a deferred-scope proposal. Post no comment on the pull request, and above all no answer line (`<ID> — accepted: <reason>`, `<ID> — waived: <reason>`, `<ID> — approved`). The calling command stops the run if an answer line appears or changes during this round.",
        "",
        `Commit on this branch in follow-up commits — never an amend and never a rebase — and leave the per-story commits and their \`Closes #<n>\` lines alone. Do not push and do not touch the pull request. Finish with one line per item: fixed, or left alone with the reason. Stop after ${fixTurns} turns.`,
    ].join("\n");
}

/** One answer line per comment, as `<url>\t<id>\t<verb>\t<reason>`, so an edit changes a row (G14). */
function answerRows(answers: readonly PrAnswer[]): Set<string> {
    return new Set(answers.map((a) => [a.url, a.id, a.verb, a.reason].join("\t")));
}

/**
 * The inferred answers available on a verdict (D9, G15, G16): an open departure whose decision stub
 * was committed before the run's first commit, and which supersedes no record decision, is accepted
 * citing that stub. Nothing is waived and no deferral is approved.
 */
export function inferredAnswers(judgments: Judgments | null, preRunStub: (path: string) => string | null, alreadyPosted: ReadonlySet<string>): Array<{ id: string; line: string }> {
    if (judgments === null) return [];
    const out: Array<{ id: string; line: string }> = [];
    for (const item of openItems(judgments)) {
        if (item.kind !== "departure" || item.stub === null || item.supersedes !== null || alreadyPosted.has(item.id)) continue;
        const content = preRunStub(item.stub.path);
        const reason = item.stub.reason.trim();
        if (content === null || reason === "" || !content.includes(reason)) continue;
        out.push({
            id: item.id,
            line: `${item.id} — accepted: ${reason.replace(/\s+/g, " ")} (source: decision stub ${item.stub.path}, committed before this run; posted by the unattended nexus implement-epic command)`,
        });
    }
    return out;
}

class RunStop extends Error {
    constructor(
        readonly stage: string,
        readonly reason: string,
    ) {
        super(reason);
    }
}

/** Run the whole command; its exit code. */
export async function runImplementEpic(deps: ImplementDeps, input: ImplementInput, io: ImplementIo): Promise<number> {
    const { cwd, epic, harness } = input;
    let pr: number | null = null;
    let prRepo = "";
    let testCommand: string | null = input.testCommand;
    const say = (line: string): void => io.stderr(line);
    const fail = (stage: string, reason: string): never => {
        throw new RunStop(stage, reason);
    };

    const setStatus = (text: string): boolean => {
        if (pr === null) return true;
        const body = deps.prBody(cwd, pr);
        return body !== null && deps.editPrBody(cwd, pr, withStatus(body, text));
    };

    const stop = (s: RunStop): number => {
        io.stderr(`implement-epic stopped at ${s.stage}: ${s.reason}`);
        if (pr !== null && !setStatus(`stopped at ${s.stage}. ${s.reason}`)) {
            io.stderr(`implement-epic could not update the status section of PR #${pr}.`);
        }
        return 1;
    };

    try {
        // 1. Preflight (D2, D14, D15): nothing below runs a model.
        const resolved = deps.resolveEpic(cwd, epic);
        if (!resolved.ok) return fail("preflight", `epic #${epic} could not be resolved: ${resolved.message}`);
        const facts = resolved.value;
        if (facts.record === null && facts.needsDesign) fail("preflight", `epic #${epic} needs design and has no decision record. Run /nxs.decision-record ${epic} first.`);
        if (facts.record !== null && facts.record.state !== "closed") fail("preflight", `the decision record #${facts.record.number} of epic #${epic} is not approved. Approve it by closing it first.`);
        if (facts.stories.length === 0) fail("preflight", `epic #${epic} has no live story to implement.`);
        if (!deps.onPath(harness)) fail("preflight", `the ${harness} command is not on the PATH.`);
        const mode = input.permissionMode ?? DEFAULT_PERMISSION_MODE[harness];
        if (harness === "claude" && mode === "auto" && !deps.autoModeAvailable()) {
            fail("preflight", "auto permission mode is not available to this account. Pass --permission-mode <mode> to choose another mode.");
        }
        if (testCommand === null) {
            const declared = deps.testCommandSetting(facts.root).trim();
            testCommand = declared === "" ? null : declared;
        }
        const base = input.base ?? deps.defaultBranch(cwd);
        if (base === null) return fail("preflight", "the repository's default branch could not be read. Pass --base <branch>.");
        if (!deps.clean(cwd)) fail("preflight", "the working tree has uncommitted changes. Commit or stash them first.");
        const branch = branchFor(epic);
        if (deps.branchExists(cwd, branch)) fail("preflight", `branch ${branch} already exists. Delete or rename it, or continue by hand with /nxs.analyze --pr.`);
        const created = deps.createBranch(cwd, branch, base);
        if (!created.ok) return fail("preflight", `branch ${branch} could not be created off ${base}: ${created.message}`);
        const baseSha = created.value;
        say(`implement-epic: epic #${epic} on ${branch} off ${base} | harness ${harness} | permission mode ${mode} | test command ${testCommand ?? "found by the implementation stage"}`);

        const runStage = async (stage: string, prompt: string): Promise<SessionEnd> => {
            say(`>>> ${stage}`);
            const end = await deps.session(stageSpec(harness, prompt + UNATTENDED_CLAUSE, mode, input.harnessArgs, cwd), (l) => io.stdout(l));
            if (!end.started) fail(stage, `the ${harness} harness could not start: ${end.error ?? "unknown error"}`);
            return end;
        };
        const onBranch = (stage: string): void => {
            if (deps.currentBranch(cwd) !== branch) fail(stage, `the stage left the checkout off ${branch}; the command pushes only that branch.`);
        };

        // 2. Implementation stage (D3).
        const impl = await runStage("implementation", implementationPrompt(epic, input.turns, testCommand));
        const blocked = prefixedLine(impl.finalMessage, BLOCKED_PREFIX);
        if (blocked !== null) fail("implementation", `the stage ended blocked: ${blocked}`);
        if (impl.exitCode !== 0 || impl.error !== null) fail("implementation", `the stage failed: ${impl.error ?? `exit ${impl.exitCode}`}`);
        if (testCommand === null) testCommand = prefixedLine(impl.finalMessage, TEST_COMMAND_PREFIX);
        onBranch("implementation");

        // 3. Story commit check, push and draft pull request (D3, D4).
        const commits = deps.commits(cwd, baseSha);
        if (commits === null) fail("story-commit-check", `the commits on ${branch} could not be read.`);
        const bad = checkStoryCommits(commits ?? [], facts.stories, facts.blockedBy, facts.issuesRepo);
        if (bad !== null) fail("story-commit-check", bad);
        const pushed = deps.push(cwd, branch);
        if (!pushed.ok) fail("push", pushed.message);
        const repo = deps.prRepo(cwd);
        if (repo === null) return fail("pull-request", "the pull request's repository could not be read.");
        prRepo = repo;
        const testNote = testCommand === null ? "no test command was declared or named" : `test command \`${testCommand}\``;
        const body = prBody(epic, facts.stories, facts.issuesRepo, prRepo, `implemented; analyze runs next (${testNote}).`);
        const existing = deps.openPr(cwd, branch);
        if (!existing.ok) fail("pull-request", existing.message);
        if (existing.ok && existing.value !== null) {
            pr = existing.value;
            if (!deps.editPrBody(cwd, pr, body)) fail("pull-request", `the body of PR #${pr} could not be rewritten to claim every story.`);
        } else {
            const opened = deps.createPr(cwd, { base, branch, title: `epic #${epic}: ${facts.title}`, body });
            if (!opened.ok) return fail("pull-request", opened.message);
            pr = opened.value;
        }
        const prNum: number = pr;
        say(`implement-epic: draft PR #${prNum}`);

        const readAnswers = (stage: string): Set<string> => {
            const r = deps.answers(cwd, prNum, prRepo);
            if (!r.ok) return fail(stage, `the answer lines on PR #${prNum} could not be read: ${r.message}`);
            return answerRows(r.value);
        };
        // An answer line that appears or changes during an agent stage stops the run (G14).
        const guarded = async (stage: string, prompt: string): Promise<SessionEnd> => {
            const before = readAnswers(stage);
            const end = await runStage(stage, prompt);
            const after = readAnswers(stage);
            const posted = [...after].filter((row) => !before.has(row)).map((row) => row.split("\t")[0]);
            if (posted.length > 0) fail(stage, `an answer line was posted or edited during the stage, which only a person may do: ${[...new Set(posted)].join(", ")}`);
            return end;
        };

        const posted = new Set<string>();
        let round = 0;
        let lastIds: string | null = null;
        let resolveNext = false;
        for (;;) {
            // 4. Analyze, published on the pull request every time (D5).
            const stage = round === 0 ? "analyze" : `analyze (round ${round})`;
            const end = await guarded(stage, `/nxs.analyze --pr ${prNum}${resolveNext ? " --resolve" : ""}`);
            resolveNext = false;
            const head = deps.headSha(cwd);
            const v = deps.readVerdict(cwd, prNum, prRepo, facts.issuesRepo);
            if (!v.ok) return fail(stage, `the verdict on PR #${prNum} could not be read: ${v.message}`);
            if (!v.found || v.head !== head) {
                return fail(stage, `analyze published no verdict for ${head ?? "the head"}${end.error !== null ? ` (${end.error})` : ""}.`);
            }

            // 5. Answers the command can infer (D9).
            const answers = inferredAnswers(v.judgments, (p) => deps.fileAt(cwd, baseSha, p), posted);
            if (answers.length > 0) {
                if (!deps.postComment(cwd, prNum, answers.map((a) => a.line).join("\n"))) fail("answers", `the inferred answers could not be posted on PR #${prNum}.`);
                for (const a of answers) posted.add(a.id);
                say(`implement-epic: posted inferred answers for ${answers.map((a) => a.id).join(", ")}`);
                resolveNext = true;
                continue;
            }

            // 8. Loop end.
            const open = openBlocking(v.judgments);
            if (open.length === 0) {
                // 9. Finish (D10): only a verdict for the current head with nothing open.
                if (v.head !== v.prHead) fail("finish", `the newest verdict is for ${v.head}, but PR #${prNum}'s head is ${v.prHead}.`);
                if (!setStatus(`finished. The newest verdict, for ${v.head}, has no open Critical, High or Medium item (${testNote}).`)) {
                    io.stderr(`implement-epic could not update the status section of PR #${prNum}.`);
                }
                if (!deps.markReady(cwd, prNum)) fail("finish", `PR #${prNum} could not be marked ready for review.`);
                io.stdout(`implement-epic: PR #${prNum} is ready for review.`);
                return 0;
            }
            // 6. Work list (D6), and the escalations the verdict already labels (D7).
            const work = workList(v.judgments);
            const ids = open.map((i) => `${i.id} (${i.severity})`).join(", ");
            const superseding = supersedingDepartures(work);
            if (superseding.length > 0) {
                fail(
                    "fix",
                    `escalation, for the lead to revise the record: ${superseding.map((d) => `${d.id} supersedes ${d.supersedes?.decision ?? "a record decision"} (${d.supersedes?.instead ?? d.summary})`).join("; ")}.`,
                );
            }
            // D8: progress is the set of open Critical, High and Medium item IDs, never a count.
            const idSet = work
                .map((i) => i.id)
                .sort()
                .join(",");
            if (idSet === lastIds) fail("fix", `round ${round} left the same items open: ${ids}.`);
            if (round >= input.rounds) fail("fix", `the round cap of ${input.rounds} was reached with items still open: ${ids}.`);
            lastIds = idSet;
            round++;

            // 7. Fix round: it sorts every item before it edits anything (D7).
            const fixStage = `fix (round ${round})`;
            const headBefore = deps.headSha(cwd);
            const fix = await guarded(fixStage, fixPrompt(epic, round, input.rounds, work, testCommand, input.fixTurns));
            const escalations = prefixedLines(fix.finalMessage, ESCALATION_PREFIX);
            if (escalations.length > 0) {
                const committed = deps.headSha(cwd) !== headBefore ? " The stage committed despite the escalation; nothing was pushed." : "";
                fail(fixStage, `escalation, for the lead to revise the record: ${escalations.join("; ")}.${committed}`);
            }
            if (fix.exitCode !== 0 || fix.error !== null) fail(fixStage, `the stage failed: ${fix.error ?? `exit ${fix.exitCode}`}`);
            onBranch(fixStage);
            const again = deps.push(cwd, branch);
            if (!again.ok) fail("push", again.message);
        }
    } catch (e) {
        if (e instanceof RunStop) return stop(e);
        throw e;
    }
}

/** Whether the installed claude lists auto among its permission modes (D15). */
export function claudeOffersAuto(run: Runner): boolean {
    const r = run("claude", ["--help"], { cwd: process.cwd() });
    if (r.status !== 0) return false;
    const line = r.stdout.split(/\r?\n/).find((l) => l.includes("--permission-mode")) ?? "";
    const idx = r.stdout.indexOf(line);
    // The choices may wrap onto the lines after the option.
    const text = r.stdout.slice(idx, idx + 600);
    return /\bauto\b/.test(text);
}

/** The platform-backed deps, against the real git, gh and harness. */
export function implementEpicDeps(run: Runner): ImplementDeps {
    const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
    const err = (r: { status: number | null; stderr: string }, what: string): Outcome<never> => ({ ok: false, message: r.stderr.trim() || `${what} exited ${r.status}` });
    return {
        resolveEpic: (cwd, epic) => {
            const ws = resolveWorkspace(cwd);
            if (!ws.ok) return { ok: false, message: "the workspace could not be resolved" };
            const root = ws.workspace.mode === "workspace" ? ws.workspace.hubRoot : ws.workspace.root;
            const r = resolveEpic(run, root, epic);
            if (!r.ok) return { ok: false, message: `${r.error.problem}: ${r.error.message}` };
            const issuesRepo = r.resolved.issuesRepo;
            if (issuesRepo === null) return { ok: false, message: "the epic's issues repository could not be read" };
            const labels = run("gh", ["issue", "view", String(epic), "--repo", issuesRepo, "--json", "labels", "--jq", ".labels[].name"], { cwd: root });
            if (labels.status !== 0) return err(labels, "gh");
            const needsDesignLabel = resolvePublishingKey(root, "needs-design-label");
            return ok({
                title: r.resolved.title,
                stories: r.resolved.stories.map((s) => s.number),
                blockedBy: r.resolved.blockedBy,
                record: r.record,
                issuesRepo,
                needsDesign: labels.stdout.split(/\r?\n/).some((l) => l.trim() === needsDesignLabel),
                root,
            });
        },
        testCommandSetting: (root) => resolvePublishingKey(root, TEST_COMMAND_KEY),
        defaultBranch: (cwd) => {
            const r = run("gh", ["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"], { cwd });
            const name = r.stdout.trim();
            return r.status === 0 && name !== "" ? name : null;
        },
        clean: (cwd) => {
            const r = run("git", ["status", "--porcelain"], { cwd });
            return r.status === 0 && r.stdout.trim() === "";
        },
        branchExists: (cwd, branch) =>
            run("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd }).status === 0 ||
            run("git", ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`], { cwd }).status === 0,
        createBranch: (cwd, branch, base) => {
            const r = run("git", ["switch", "-c", branch, base], { cwd });
            if (r.status !== 0) return err(r, "git switch");
            const sha = git(run, cwd, "rev-parse", "HEAD");
            return sha === null ? { ok: false, message: "HEAD could not be read" } : ok(sha);
        },
        currentBranch: (cwd) => git(run, cwd, "rev-parse", "--abbrev-ref", "HEAD"),
        headSha: (cwd) => git(run, cwd, "rev-parse", "HEAD"),
        commits: (cwd, baseSha) => {
            const r = run("git", ["log", "--reverse", "--format=%H%x1f%B%x1e", `${baseSha}..HEAD`], { cwd });
            if (r.status !== 0) return null;
            return r.stdout
                .split("\x1e")
                .map((rec) => rec.replace(/^\s+/, ""))
                .filter((rec) => rec !== "")
                .map((rec) => {
                    const [sha, message] = rec.split("\x1f");
                    return { sha: sha.trim(), message: message ?? "" };
                });
        },
        push: (cwd, branch) => {
            const r = run("git", ["push", "-u", "origin", `${branch}:${branch}`], { cwd });
            return r.status === 0 ? ok(null) : err(r, "git push");
        },
        prRepo: (cwd) => {
            const r = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { cwd });
            return r.status === 0 && r.stdout.trim() !== "" ? r.stdout.trim() : null;
        },
        openPr: (cwd, branch) => {
            const r = run("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "number", "--jq", ".[0].number // empty"], { cwd });
            if (r.status !== 0) return err(r, "gh");
            const n = r.stdout.trim();
            return ok(n === "" ? null : Number(n));
        },
        createPr: (cwd, p) => {
            const r = run("gh", ["pr", "create", "--draft", "--base", p.base, "--head", p.branch, "--title", p.title, "--body", p.body], { cwd });
            if (r.status !== 0) return err(r, "gh pr create");
            const m = /\/pull\/(\d+)/.exec(r.stdout);
            return m === null ? { ok: false, message: `gh pr create printed no pull request link: ${r.stdout.trim()}` } : ok(Number(m[1]));
        },
        prBody: (cwd, pr) => {
            const r = run("gh", ["pr", "view", String(pr), "--json", "body", "--jq", ".body"], { cwd });
            return r.status === 0 ? r.stdout : null;
        },
        editPrBody: (cwd, pr, body) => run("gh", ["pr", "edit", String(pr), "--body", body], { cwd }).status === 0,
        markReady: (cwd, pr) => run("gh", ["pr", "ready", String(pr)], { cwd }).status === 0,
        readVerdict: (cwd, pr, repo, issuesRepo) => {
            const v = readPrVerdict(run, cwd, pr, repo, issuesRepo);
            if (!v.ok) return { ok: false, message: `${v.error.problem}: ${v.error.message}` };
            if (!v.verdict.found || v.verdict.receipt === null) return { ok: true, found: false, prHead: v.verdict.prHead };
            const reg = readItemRegistry(run, cwd, pr, repo, issuesRepo);
            if (!reg.ok) return { ok: false, message: `${reg.error.problem}: ${reg.error.message}` };
            return { ok: true, found: true, head: v.verdict.receipt.head, prHead: v.verdict.prHead, judgments: reg.registry };
        },
        answers: (cwd, pr, repo) => {
            const r = readPrWaivers(run, cwd, pr, { ghRepo: repo });
            return r.ok ? ok(r.value.answers) : { ok: false, message: r.error.message };
        },
        postComment: (cwd, pr, body) => run("gh", ["pr", "comment", String(pr), "--body", body], { cwd }).status === 0,
        fileAt: (cwd, sha, file) => {
            const r = run("git", ["show", `${sha}:${file}`], { cwd });
            return r.status === 0 ? r.stdout : null;
        },
        autoModeAvailable: () => claudeOffersAuto(run),
        onPath: (command) => onPath(command),
        session: spawnSession,
    };
}
