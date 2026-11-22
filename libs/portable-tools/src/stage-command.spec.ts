/**
 * `nexus epic`, `nexus decision-record` and `nexus analyze` (epic #1068, stories #1069, #1070,
 * #1071): each verb starts one interactive Claude Code session on the planning model and hands it
 * the matching slash command with the lead's arguments. The platform is injected, so each case
 * states what the settings and the harness say and asserts what the command did about it.
 */

import { describe, expect, it } from "vitest";
import { type HarnessModels } from "@nexus/delivery-config/harness-models";
import { type SessionSpec } from "./distill-command.js";
import { runStageCommand, STAGE_SLASH, type StageDeps, type StageInput, type StageSessionEnd, type StageVerb } from "./stage-command.js";

const MODELS: HarnessModels = { planning: { value: "opus", layer: "built-in" }, implementing: null, unknownKeys: [] };

interface World {
    models: HarnessModels;
    onPath: boolean;
    end: StageSessionEnd;
}

function world(over: Partial<World> = {}): World {
    return { models: MODELS, onPath: true, end: { started: true, exitCode: 0, error: null }, ...over };
}

function harness(w: World) {
    const sessions: SessionSpec[] = [];
    const deps: StageDeps = {
        modelSettings: () => w.models,
        onPath: () => w.onPath,
        session: async (spec: SessionSpec): Promise<StageSessionEnd> => {
            sessions.push(spec);
            return w.end;
        },
    };
    const out: string[] = [];
    const err: string[] = [];
    const io = { stdout: (l: string): void => void out.push(l), stderr: (l: string): void => void err.push(l) };
    return {
        deps,
        sessions,
        io,
        get out(): string {
            return out.join("\n");
        },
        get err(): string {
            return err.join("\n");
        },
    };
}

async function run(w: World, input: Partial<StageInput> & { verb: StageVerb }) {
    const h = harness(w);
    const code = await runStageCommand(h.deps, { cwd: "/r", args: [], ...input }, h.io);
    return { ...h, code };
}

/** The prompt the session was handed, which is always its first argument. */
const promptOf = (s: SessionSpec): string => s.args[0] ?? "";
/** The model the session runs on, or null when it passes none. */
const modelOf = (s: SessionSpec): string | null => {
    const at = s.args.indexOf("--model");
    return at === -1 ? null : (s.args[at + 1] ?? null);
};

describe("nexus epic (story #1069)", () => {
    it("starts one interactive session on the planning model with /nxs.epic and the description", async () => {
        const r = await run(world(), { verb: "epic", args: ["Add team invitations"] });
        expect(r.code).toBe(0);
        expect(r.sessions).toHaveLength(1);
        const s = r.sessions[0];
        expect(s.command).toBe("claude");
        expect(s.cwd).toBe("/r");
        expect(promptOf(s)).toBe("/nxs.epic Add team invitations");
        expect(modelOf(s)).toBe("opus");
        // Interactive: no headless prompt flag, no streamed output format, no permission mode of its own.
        expect(s.args).not.toContain("-p");
        expect(s.args).not.toContain("--output-format");
        expect(s.args).not.toContain("--permission-mode");
    });

    it("hands /nxs.epic the arguments unchanged and in the order typed", async () => {
        const r = await run(world(), { verb: "epic", args: ["--from", "#12", "--assets", "docs/a.png", "#34"] });
        expect(promptOf(r.sessions[0])).toBe("/nxs.epic --from #12 --assets docs/a.png #34");
    });

    it("runs on the model --planning-model names, and keeps that flag out of the prompt", async () => {
        const r = await run(world(), { verb: "epic", args: ["Add team invitations", "--planning-model", "claude-opus-5-5"] });
        expect(modelOf(r.sessions[0])).toBe("claude-opus-5-5");
        expect(promptOf(r.sessions[0])).toBe("/nxs.epic Add team invitations");
        expect(r.out).toContain("--planning-model");
    });

    it("accepts the model in its --planning-model=<model> form too", async () => {
        const r = await run(world(), { verb: "epic", args: ["Add team invitations", "--planning-model=sonnet"] });
        expect(modelOf(r.sessions[0])).toBe("sonnet");
        expect(promptOf(r.sessions[0])).toBe("/nxs.epic Add team invitations");
    });

    it("refuses a --planning-model with no value, starting no session", async () => {
        const r = await run(world(), { verb: "epic", args: ["Add team invitations", "--planning-model"] });
        expect(r.code).toBe(2);
        expect(r.sessions).toHaveLength(0);
        expect(r.err).toContain("--planning-model");
    });

    it("refuses with its usage and starts no session when no argument is given", async () => {
        const r = await run(world(), { verb: "epic", args: [] });
        expect(r.code).toBe(2);
        expect(r.sessions).toHaveLength(0);
        expect(r.err).toContain("nexus epic");
    });
});

describe("nexus decision-record (story #1070)", () => {
    it("starts one interactive session on the planning model with /nxs.decision-record #N", async () => {
        const r = await run(world(), { verb: "decision-record", args: ["#42"] });
        expect(r.code).toBe(0);
        expect(promptOf(r.sessions[0])).toBe("/nxs.decision-record #42");
        expect(modelOf(r.sessions[0])).toBe("opus");
    });

    it("starts the same session whether the epic is written as N or as '#N'", async () => {
        const bare = await run(world(), { verb: "decision-record", args: ["42"] });
        const hashed = await run(world(), { verb: "decision-record", args: ["#42"] });
        expect(promptOf(bare.sessions[0])).toBe(promptOf(hashed.sessions[0]));
        expect(bare.sessions[0].args).toEqual(hashed.sessions[0].args);
    });

    it("hands /nxs.decision-record the further arguments unchanged", async () => {
        const r = await run(world(), { verb: "decision-record", args: ["42", "--from", "docs/hld.md", "--revise"] });
        expect(promptOf(r.sessions[0])).toBe("/nxs.decision-record #42 --from docs/hld.md --revise");
    });

    it("refuses with its usage and starts no session when no epic is named", async () => {
        const r = await run(world(), { verb: "decision-record", args: [] });
        expect(r.code).toBe(2);
        expect(r.sessions).toHaveLength(0);
        expect(r.err).toContain("nexus decision-record");
    });

    it("refuses an epic reference that is not a number, starting no session", async () => {
        const r = await run(world(), { verb: "decision-record", args: ["--from"] });
        expect(r.code).toBe(2);
        expect(r.sessions).toHaveLength(0);
        expect(r.err).toContain("nexus decision-record");
    });
});

describe("nexus analyze (story #1071)", () => {
    it("starts one interactive session on the planning model with /nxs.analyze --pr <N>", async () => {
        const r = await run(world(), { verb: "analyze", args: ["--pr", "77"] });
        expect(r.code).toBe(0);
        expect(promptOf(r.sessions[0])).toBe("/nxs.analyze --pr 77");
        expect(modelOf(r.sessions[0])).toBe("opus");
    });

    it("hands /nxs.analyze the further arguments unchanged", async () => {
        const r = await run(world(), { verb: "analyze", args: ["--pr", "77", "--resolve"] });
        expect(promptOf(r.sessions[0])).toBe("/nxs.analyze --pr 77 --resolve");
    });

    it("starts the stage with no argument, which analyzes the epic of the current branch", async () => {
        const r = await run(world(), { verb: "analyze", args: [] });
        expect(r.code).toBe(0);
        expect(promptOf(r.sessions[0])).toBe("/nxs.analyze");
    });
});

describe("the session the three verbs start (epic #1068)", () => {
    it.each<StageVerb>(["epic", "decision-record", "analyze"])("%s runs on the settings' planning model, naming it before the session", async (verb) => {
        const models: HarnessModels = { planning: { value: "sonnet", layer: "repository settings" }, implementing: null, unknownKeys: [] };
        const r = await run(world({ models }), { verb, args: verb === "epic" ? ["x"] : ["#1"] });
        expect(modelOf(r.sessions[0])).toBe("sonnet");
        expect(r.out).toContain("sonnet");
        expect(r.out).toContain("repository settings");
    });

    it("passes no model when the harness resolves none, and says so", async () => {
        const models: HarnessModels = { planning: null, implementing: null, unknownKeys: [] };
        const r = await run(world({ models }), { verb: "epic", args: ["x"] });
        expect(modelOf(r.sessions[0])).toBeNull();
        expect(r.out.toLowerCase()).toContain("no planning model");
    });

    it.each(["--dangerously-skip-permissions", "opus extra", ""])("refuses the model value '%s' before any session, naming its layer", async (value) => {
        const models: HarnessModels = { planning: { value, layer: "hub settings" }, implementing: null, unknownKeys: [] };
        const r = await run(world({ models }), { verb: "epic", args: ["x"] });
        expect(r.code).toBe(2);
        expect(r.sessions).toHaveLength(0);
        expect(r.err).toContain("hub settings");
    });

    it("returns the session's own exit code", async () => {
        const r = await run(world({ end: { started: true, exitCode: 3, error: null } }), { verb: "analyze", args: [] });
        expect(r.code).toBe(3);
    });

    it("stops with a message when the session cannot start", async () => {
        const r = await run(world({ end: { started: false, exitCode: null, error: "spawn claude ENOENT" } }), { verb: "analyze", args: [] });
        expect(r.code).toBe(1);
        expect(r.err).toContain("spawn claude ENOENT");
    });

    it("refuses before any session when the harness is not on the PATH", async () => {
        const r = await run(world({ onPath: false }), { verb: "epic", args: ["x"] });
        expect(r.code).toBe(1);
        expect(r.sessions).toHaveLength(0);
        expect(r.err).toContain("claude");
    });

    it("names the slash command each verb starts", () => {
        expect(STAGE_SLASH).toEqual({ epic: "/nxs.epic", "decision-record": "/nxs.decision-record", analyze: "/nxs.analyze" });
    });
});
