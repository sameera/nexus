import express from "express";
import { WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import { createAppServer } from "./http-server";
import { attachPtyBridgeHandler } from "./pty-bridge";

/*
 * Regression guard for the epic's success metric: the PTY bridge's upgrade
 * handler must complete a handshake on the server's underlying HTTP server
 * with zero changes to the request-handling path. Runs against a trivial
 * stand-in request listener rather than the real RR8 handler — the property
 * under test is that this app owns the `http.Server` (and its free `upgrade`
 * event), not RR8's rendering, so no Vite/virtual-module wiring is needed.
 */
describe("custom HTTP server upgrade seam", () => {
    it("completes a WS handshake without disturbing normal requests", async () => {
        const app = express();
        app.get("/", (_req, res) => res.send("ok"));

        const server = createAppServer(app);
        attachPtyBridgeHandler(server);

        await new Promise<void>((resolve) => server.listen(0, resolve));
        const { port } = server.address() as { port: number };

        try {
            const response = await fetch(`http://localhost:${port}/`);
            expect(await response.text()).toBe("ok");

            await new Promise<void>((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${port}/pty`);
                ws.once("open", () => {
                    ws.close();
                    resolve();
                });
                ws.once("error", reject);
            });
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});
