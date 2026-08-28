/**
 * The dispatcher's frozen contract (story #355): which stream each answer goes to, which exit
 * code it carries, and that a capability's arguments and exit code travel through untouched.
 */

import { describe, expect, it } from "vitest";
import { runNexusGh } from "./dispatch";
import { type ToolkitIo } from "./io";
import { CAPABILITY_NAMES, TOOLKIT_NAME, capabilityListing, findCapability, usage } from "./registry";

function recordingIo(): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd: "/tmp", stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

describe("nexus-gh dispatch", () => {
    it("prints the sorted registry names as one JSON object and exits 0 for --capabilities", () => {
        const io = recordingIo();
        expect(runNexusGh(["--capabilities"], io)).toBe(0);
        expect(JSON.parse(io.out.join("\n"))).toEqual({ capabilities: [...CAPABILITY_NAMES] });
        expect([...CAPABILITY_NAMES]).toEqual([...CAPABILITY_NAMES].sort());
        expect(io.err).toEqual([]);
    });

    it("writes usage to stderr and exits 2 when invoked with no arguments", () => {
        const io = recordingIo();
        expect(runNexusGh([], io)).toBe(2);
        expect(io.err.join("\n")).toBe(usage());
        expect(io.out).toEqual([]);
    });

    it.each(["-h", "--help"])("writes usage to stdout and exits 0 for %s", (flag) => {
        const io = recordingIo();
        expect(runNexusGh([flag], io)).toBe(0);
        expect(io.out.join("\n")).toBe(usage());
        expect(io.err).toEqual([]);
    });

    it("names the unknown capability, then the usage text, on stderr with exit 2", () => {
        const io = recordingIo();
        expect(runNexusGh(["not-a-capability", "--flag"], io)).toBe(2);
        expect(io.err[0]).toBe(`${TOOLKIT_NAME}: unknown capability 'not-a-capability'`);
        expect(io.err.slice(1).join("\n")).toBe(usage());
        expect(io.out).toEqual([]);
    });

    it("hands a capability its own arguments unmodified and returns its exit code unchanged", () => {
        const io = recordingIo();
        const seen: string[][] = [];
        const capability = findCapability("version");
        expect(capability).toBeDefined();
        const original = capability!.run;
        capability!.run = (args) => {
            seen.push(args);
            return 17;
        };
        try {
            expect(runNexusGh(["version", "--odd", "value", "--"], io)).toBe(17);
        } finally {
            capability!.run = original;
        }
        expect(seen).toEqual([["--odd", "value", "--"]]);
    });
});

describe("the declared surface", () => {
    it("renders the machine listing and the human usage from the same registry", () => {
        const listed: string[] = JSON.parse(capabilityListing()).capabilities;
        for (const name of listed) {
            expect(usage()).toContain(name);
            expect(findCapability(name)).toBeDefined();
        }
        expect(listed).toEqual([...CAPABILITY_NAMES]);
    });

    it("keeps filing the epic and story issues by declaring both filers as capabilities", () => {
        expect(CAPABILITY_NAMES).toContain("create-epic");
        expect(CAPABILITY_NAMES).toContain("create-story");
    });
});
