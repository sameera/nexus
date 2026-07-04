import express from "express";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { createAppServer } from "./http-server";
import { attachPtyBridgeHandler } from "./pty-bridge";
import { getActiveSessionCount } from "./pty-session";

async function startServer() {
    const app = express();
    app.get("/", (_req, res) => res.send("ok"));
    const server = createAppServer(app);
    attachPtyBridgeHandler(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as { port: number };
    return { server, port };
}

function connect(port: number, path = "/pty") {
    return new WebSocket(`ws://localhost:${port}${path}`);
}

function waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
        ws.once("open", () => resolve());
        ws.once("error", reject);
    });
}

function collectOutput(ws: WebSocket) {
    let buffer = Buffer.alloc(0);
    ws.on("message", (data, isBinary) => {
        if (isBinary) buffer = Buffer.concat([buffer, data as Buffer]);
    });
    return () => buffer;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 3000, intervalMs = 20): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) {
            throw new Error("timed out waiting for condition");
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}

describe("pty bridge", () => {
    let cleanup: (() => Promise<void>) | undefined;

    afterEach(async () => {
        if (cleanup) {
            await cleanup();
            cleanup = undefined;
        }
    });

    it("completes a WS handshake on /pty without disturbing normal HTTP requests", async () => {
        const { server, port } = await startServer();
        cleanup = () => new Promise((resolve) => server.close(() => resolve()));

        const response = await fetch(`http://localhost:${port}/`);
        expect(await response.text()).toBe("ok");

        const ws = connect(port);
        await waitForOpen(ws);
        ws.close();
    });

    it("spawns a shell and delivers initial output to the client", async () => {
        const { server, port } = await startServer();
        const ws = connect(port);
        cleanup = () =>
            new Promise((resolve) => {
                ws.close();
                server.close(() => resolve());
            });
        await waitForOpen(ws);

        const firstFrame = await new Promise<Buffer>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("no output received")), 3000);
            ws.once("message", (data, isBinary) => {
                clearTimeout(timer);
                if (isBinary) resolve(data as Buffer);
                else reject(new Error("expected a binary frame"));
            });
        });

        expect(firstFrame.length).toBeGreaterThan(0);
    });

    it("streams input to the shell and returns its output in order", async () => {
        const { server, port } = await startServer();
        const ws = connect(port);
        cleanup = () =>
            new Promise((resolve) => {
                ws.close();
                server.close(() => resolve());
            });
        await waitForOpen(ws);
        const getOutput = collectOutput(ws);
        await waitUntil(() => getOutput().length > 0);

        const token = `verify-${Math.random().toString(36).slice(2)}`;
        ws.send(Buffer.from(`echo ${token}\r`));

        await waitUntil(() => getOutput().toString("utf8").includes(token));
    });

    it("resizes the pty on a resize control message", async () => {
        const { server, port } = await startServer();
        const ws = connect(port);
        cleanup = () =>
            new Promise((resolve) => {
                ws.close();
                server.close(() => resolve());
            });
        await waitForOpen(ws);
        const getOutput = collectOutput(ws);
        await waitUntil(() => getOutput().length > 0);

        ws.send(JSON.stringify({ type: "resize", cols: 120, rows: 40 }));
        ws.send(Buffer.from("stty size\r"));

        await waitUntil(() => getOutput().toString("utf8").includes("40 120"));
    });

    it("echoes a single line of input back within 100ms", async () => {
        const { server, port } = await startServer();
        const ws = connect(port);
        cleanup = () =>
            new Promise((resolve) => {
                ws.close();
                server.close(() => resolve());
            });
        await waitForOpen(ws);
        const getOutput = collectOutput(ws);
        await waitUntil(() => getOutput().length > 0);

        const marker = `rtt-${Math.random().toString(36).slice(2)}`;
        const before = performance.now();
        ws.send(Buffer.from(marker));
        await waitUntil(() => getOutput().toString("utf8").includes(marker));
        const elapsed = performance.now() - before;

        expect(elapsed).toBeLessThan(100);
    });

    describe("shell configuration", () => {
        const originalPrimeShell = process.env.PRIME_SHELL;
        const originalShell = process.env.SHELL;

        afterEach(() => {
            if (originalPrimeShell === undefined) delete process.env.PRIME_SHELL;
            else process.env.PRIME_SHELL = originalPrimeShell;
            if (originalShell === undefined) delete process.env.SHELL;
            else process.env.SHELL = originalShell;
        });

        it("spawns the user's default login shell ($SHELL) when no override is set", async () => {
            delete process.env.PRIME_SHELL;
            process.env.SHELL = "/bin/bash";
            const { server, port } = await startServer();
            const ws = connect(port);
            cleanup = () =>
                new Promise((resolve) => {
                    ws.close();
                    server.close(() => resolve());
                });
            await waitForOpen(ws);
            const getOutput = collectOutput(ws);
            await waitUntil(() => getOutput().length > 0);

            ws.send(Buffer.from("echo MARK-$(ps -o comm= -p $$)-MARK\r"));

            await waitUntil(() => getOutput().toString("utf8").includes("MARK-bash-MARK"));
        });

        it("spawns the PRIME_SHELL override instead of $SHELL", async () => {
            process.env.SHELL = "/bin/bash";
            process.env.PRIME_SHELL = "/bin/sh";
            const { server, port } = await startServer();
            const ws = connect(port);
            cleanup = () =>
                new Promise((resolve) => {
                    ws.close();
                    server.close(() => resolve());
                });
            await waitForOpen(ws);
            const getOutput = collectOutput(ws);
            await waitUntil(() => getOutput().length > 0);

            ws.send(Buffer.from("echo MARK-$(ps -o comm= -p $$)-MARK\r"));

            await waitUntil(() => getOutput().toString("utf8").includes("MARK-sh-MARK"));
            expect(getOutput().toString("utf8")).not.toContain("MARK-bash-MARK");
        });
    });

    it("does not spawn a session for a mismatched Origin, and stays same-origin-permissive for absent Origin", async () => {
        const { server, port } = await startServer();
        cleanup = () => new Promise((resolve) => server.close(() => resolve()));

        const rejected = new WebSocket(`ws://localhost:${port}/pty`, {
            origin: "http://evil.example:9999",
        });
        const statusCode = await new Promise<number | undefined>((resolve, reject) => {
            rejected.once("unexpected-response", (_req, res) => resolve(res.statusCode));
            rejected.once("open", () => reject(new Error("should not have connected")));
        });
        expect(statusCode).toBe(403);
        expect(getActiveSessionCount()).toBe(0);

        const allowed = connect(port);
        await waitForOpen(allowed);
        allowed.close();
    });

    describe("session teardown", () => {
        async function connectAndCapturePid(port: number) {
            const ws = connect(port);
            await waitForOpen(ws);
            const getOutput = collectOutput(ws);
            await waitUntil(() => getOutput().length > 0);
            ws.send(Buffer.from("echo PID-$$-PID\r"));
            await waitUntil(() => /PID-\d+-PID/.test(getOutput().toString("utf8")));
            const match = /PID-(\d+)-PID/.exec(getOutput().toString("utf8"));
            if (!match) throw new Error("could not read PID from shell output");
            return { ws, pid: Number.parseInt(match[1], 10) };
        }

        function isAlive(pid: number): boolean {
            try {
                process.kill(pid, 0);
                return true;
            } catch {
                return false;
            }
        }

        it("terminates and reaps the PTY child when the client disconnects", async () => {
            const { server, port } = await startServer();
            cleanup = () => new Promise((resolve) => server.close(() => resolve()));

            const { ws, pid } = await connectAndCapturePid(port);
            ws.close();

            await waitUntil(() => !isAlive(pid));
        });

        it("closes the socket when the shell exits on its own", async () => {
            const { server, port } = await startServer();
            cleanup = () => new Promise((resolve) => server.close(() => resolve()));

            const { ws } = await connectAndCapturePid(port);
            const closed = new Promise<void>((resolve) => ws.once("close", () => resolve()));
            ws.send(Buffer.from("exit\r"));

            await closed;
            await waitUntil(() => getActiveSessionCount() === 0);
        });

        it(
            "leaves zero orphaned processes and a zero active-session count across N connect/disconnect cycles",
            async () => {
                const { server, port } = await startServer();
                cleanup = () => new Promise((resolve) => server.close(() => resolve()));

                const pids: number[] = [];
                const cycles = 5;
                for (let i = 0; i < cycles; i++) {
                    const { ws, pid } = await connectAndCapturePid(port);
                    pids.push(pid);
                    const closed = new Promise<void>((resolve) => ws.once("close", () => resolve()));
                    ws.close();
                    await closed;
                    await waitUntil(() => getActiveSessionCount() === 0);
                }

                for (const pid of pids) {
                    await waitUntil(() => !isAlive(pid));
                }
            },
            20000,
        );
    });
});
