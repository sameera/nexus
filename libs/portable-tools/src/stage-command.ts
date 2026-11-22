/**
 * `nexus epic`, `nexus decision-record` and `nexus analyze` (epic #1068, stories #1069, #1070,
 * #1071): one entry point per planning stage, so a lead starts the stage from the shell instead of
 * opening Claude Code and picking a model by hand.
 *
 * Each verb starts exactly the session the lead would have started by hand — the same stage, the
 * same arguments in the order typed, in the lead's own checkout and permission mode — and hands it
 * the matching slash command as its first prompt. The one thing the command decides is the model:
 * the harness's planning model, resolved through the same catalogue and layers `nexus implement`
 * reads (D10), so one setting governs both. A model named on the invocation wins and never reaches
 * the prompt.
 *
 * The session is interactive: the stages it starts ask the lead at their gates, so the command
 * passes no headless flag, no output format and no permission mode of its own, and it leaves the
 * terminal to the harness. Every refusal happens before any session exists and names the usage.
 */

import { spawn } from "node:child_process";
import { harnessModels, type HarnessModels, type ModelSetting } from "@nexus/delivery-config/harness-models";
import { unsafeModel } from "./implement.js";
import { onPath, type SessionEnd, type SessionSpec } from "./distill-command.js";

/** The three stages that gain a command, and the slash command each one starts. */
export type StageVerb = "epic" | "decision-record" | "analyze";

/** The slash command each verb hands its session. */
export const STAGE_SLASH: Record<StageVerb, string> = {
    epic: "/nxs.epic",
    "decision-record": "/nxs.decision-record",
    analyze: "/nxs.analyze",
};

/** The harness these stages run on. Codex has skills, not slash commands (epic #1068, out of scope). */
export const STAGE_HARNESS = "claude";

/** How one session ended, as the harness launcher reports it. */
export type StageSessionEnd = SessionEnd;

export interface StageInput {
    cwd: string;
    verb: StageVerb;
    /** The arguments after the verb, exactly as typed and in order. */
    args: string[];
}

export interface StageDeps {
    /** The planning and implementing models `harness` resolves to at `root`, through the one catalogue. */
    modelSettings(root: string, harness: string): HarnessModels;
    /** Whether `command` resolves on the PATH. */
    onPath(command: string): boolean;
    /** Run one interactive session to its end. */
    session(spec: SessionSpec): Promise<StageSessionEnd>;
}

export interface StageIo {
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/** The flag that names the session's model, which never reaches the stage's arguments. */
export const PLANNING_MODEL_FLAG = "--planning-model";

/** A bare epic number, with or without its `#`. */
const EPIC_NUMBER = /^#?\d+$/;

/** The usage line each verb refuses with. */
export function stageUsage(verb: StageVerb): string {
    if (verb === "epic") return `usage: nexus epic <description> [--from #<n>] [--assets <path>] [${PLANNING_MODEL_FLAG} <model>]`;
    if (verb === "decision-record") return `usage: nexus decision-record <N> [--from <path>] [--revise] [${PLANNING_MODEL_FLAG} <model>]`;
    return `usage: nexus analyze [--pr <N>] [--resolve] [${PLANNING_MODEL_FLAG} <model>]`;
}

/** The invocation split into the model it names and the arguments the stage receives. */
export interface StageInvocation {
    /** The model named on the invocation, or null to resolve it from the settings. */
    planningModel: string | null;
    /** Every other token, as typed and in order. */
    args: string[];
    /** Why the invocation is malformed, or null when it is not. */
    problem: string | null;
}

/** Split `--planning-model` (and its `=` form) out of the arguments the stage receives. */
export function stageInvocation(argv: readonly string[]): StageInvocation {
    const args: string[] = [];
    let planningModel: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === PLANNING_MODEL_FLAG) {
            const value = argv[i + 1];
            if (value === undefined || value.trim() === "") return { planningModel: null, args, problem: `${PLANNING_MODEL_FLAG} takes the model to run this one session on.` };
            planningModel = value;
            i++;
            continue;
        }
        if (a.startsWith(`${PLANNING_MODEL_FLAG}=`)) {
            const value = a.slice(PLANNING_MODEL_FLAG.length + 1);
            if (value.trim() === "") return { planningModel: null, args, problem: `${PLANNING_MODEL_FLAG} takes the model to run this one session on.` };
            planningModel = value;
            continue;
        }
        args.push(a);
    }
    return { planningModel, args, problem: null };
}

/** The prompt one session is handed: the stage's slash command and its arguments. */
export function stagePrompt(verb: StageVerb, args: readonly string[]): string {
    return [STAGE_SLASH[verb], ...stageArguments(verb, args)].join(" ");
}

/**
 * The arguments the stage receives. They are the lead's, unchanged and in order, except the epic
 * reference the decision-record stage is addressed by: `N` and `#N` name the same epic, so the
 * stage is always handed the one form `#N` and both invocations start the same session.
 */
export function stageArguments(verb: StageVerb, args: readonly string[]): string[] {
    if (verb !== "decision-record" || args.length === 0) return [...args];
    return [`#${args[0].replace(/^#/, "")}`, ...args.slice(1)];
}

/** One interactive Claude Code session for `prompt` on `model`, or on the harness default when null. */
export function interactiveSpec(prompt: string, model: string | null, cwd: string): SessionSpec {
    return { command: STAGE_HARNESS, args: [prompt, ...(model === null ? [] : ["--model", model])], cwd };
}

/** Why the invocation names no stage to start, or null when it does. */
function refuseReason(verb: StageVerb, args: readonly string[]): string | null {
    if (verb === "epic" && args.length === 0) return "epic: name the capability to plan.";
    if (verb === "decision-record") {
        const first = args[0];
        if (first === undefined) return "decision-record: name the epic: nexus decision-record <N>.";
        if (!EPIC_NUMBER.test(first) || Number(first.replace(/^#/, "")) <= 0) {
            return `decision-record: the epic is a number, N or #N; got '${first}'.`;
        }
    }
    return null;
}

/** Run one of the three stage commands (epic #1068). */
export async function runStageCommand(deps: StageDeps, input: StageInput, io: StageIo): Promise<number> {
    const refuse = (message: string): number => {
        io.stderr(`${message}\n${stageUsage(input.verb)}`);
        return 2;
    };
    const invocation = stageInvocation(input.args);
    if (invocation.problem !== null) return refuse(invocation.problem);
    const why = refuseReason(input.verb, invocation.args);
    if (why !== null) return refuse(why);

    // D10: the planning model, from the invocation or the settings, with the layer it came from.
    const settings = deps.modelSettings(input.cwd, STAGE_HARNESS);
    const planning: ModelSetting | null =
        invocation.planningModel !== null ? { value: invocation.planningModel, layer: PLANNING_MODEL_FLAG } : settings.planning;
    if (planning !== null) {
        const unsafe = unsafeModel(planning.value);
        if (unsafe !== null) return refuse(`the planning model '${planning.value}' from ${planning.layer} ${unsafe}. Set it to one model name.`);
    }
    if (settings.unknownKeys.length > 0) {
        io.stderr(`warning: the ${STAGE_HARNESS} section of the settings declares keys this command does not know: ${settings.unknownKeys.join(", ")}.`);
    }
    if (!deps.onPath(STAGE_HARNESS)) {
        io.stderr(`${input.verb}: the ${STAGE_HARNESS} harness is not on the PATH, so no session can start.`);
        return 1;
    }

    const model = planning?.value ?? null;
    const prompt = stagePrompt(input.verb, invocation.args);
    io.stdout(
        `${input.verb}: ${prompt} | harness ${STAGE_HARNESS} | ` +
            (planning === null
                ? `no planning model is set for ${STAGE_HARNESS}, so the session runs on the harness default model`
                : `planning model ${planning.value} (from ${planning.layer})`),
    );
    const end = await deps.session(interactiveSpec(prompt, model, input.cwd));
    if (!end.started) {
        io.stderr(`${input.verb}: the ${STAGE_HARNESS} harness could not start: ${end.error ?? "unknown error"}.`);
        return 1;
    }
    return end.exitCode ?? 1;
}

/**
 * Run one session with the lead's own terminal: the harness reads the keyboard and draws its own
 * interface, exactly as a session the lead opened by hand would. Nothing here reads or rewrites
 * the session's output, because an interactive session's output is a screen, not a stream of
 * events.
 */
export function spawnInteractive(spec: SessionSpec): Promise<StageSessionEnd> {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(spec.command, spec.args, { cwd: spec.cwd, stdio: "inherit" });
        } catch (e) {
            resolve({ started: false, exitCode: null, error: e instanceof Error ? e.message : String(e), finalMessage: null });
            return;
        }
        child.on("error", (e) => resolve({ started: false, exitCode: null, error: e.message, finalMessage: null }));
        child.on("close", (code) => resolve({ started: true, exitCode: code, error: null, finalMessage: null }));
    });
}

/** The production dependencies: the one model catalogue, the PATH, and the harness launcher. */
export function stageDeps(): StageDeps {
    return {
        modelSettings: (root, harness) => harnessModels(root, harness),
        onPath: (command) => onPath(command),
        session: (spec) => spawnInteractive(spec),
    };
}
