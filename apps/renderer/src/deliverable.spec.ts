import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import * as esbuild from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";

import { type FetchLike, type HandlerDependencies } from "./handler.js";

const COMMIT = "d".repeat(40);
const ENTRY = path.join(import.meta.dirname, "handler.ts");

let built: esbuild.BuildResult<{ write: false; metafile: true }>;

beforeAll(async () => {
    built = await esbuild.build({
        entryPoints: [ENTRY],
        absWorkingDir: path.dirname(ENTRY),
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node22",
        write: false,
        metafile: true,
    });
}, 60_000);

describe("what the renderer delivers", () => {
    it("bundles into a single self-contained artifact", () => {
        expect(built.outputFiles).toHaveLength(1);
        expect(built.errors).toEqual([]);
    });

    it("carries no dependency beyond the renderer's own source", () => {
        const foreign = Object.keys(built.metafile.inputs).filter(
            (input) => input.includes("node_modules"),
        );

        expect(foreign).toEqual([]);
    });

    it("needs no long-lived process of its own", () => {
        const code = built.outputFiles[0].text;

        expect(code).not.toContain("node:http");
        expect(code).not.toContain("createServer");
    });

    it("answers as a handler once bundled, holding nothing between requests", async () => {
        const directory = await mkdtemp(path.join(tmpdir(), "nexus-renderer-"));
        const artifact = path.join(directory, "handler.mjs");
        await writeFile(artifact, built.outputFiles[0].text, "utf8");

        try {
            const module: { handleRequest: (r: Request, d: HandlerDependencies) => Promise<Response> } =
                await import(pathToFileURL(artifact).href);

            const bodies = ["<p>first</p>", "<p>second</p>"];
            const fetch: FetchLike = async () =>
                new Response(bodies.shift() ?? "<p>exhausted</p>", { status: 200 });
            const dependencies = { config: { stores: ["acme/assets"], sizeCap: 1024 }, fetch };
            const request = () =>
                new Request(
                    `https://renderer.example/?url=${encodeURIComponent(
                        `https://github.com/acme/assets/blob/${COMMIT}/a.html`,
                    )}`,
                );

            expect(await (await module.handleRequest(request(), dependencies)).text()).toBe(
                "<p>first</p>",
            );
            expect(await (await module.handleRequest(request(), dependencies)).text()).toBe(
                "<p>second</p>",
            );
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
